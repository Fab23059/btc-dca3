// =====================================================================
// webpush.mjs – Verschickt eine verschlüsselte Push-Nachricht.
//
// Ohne fremde Pakete: nur die eingebaute Kryptografie von Node.js.
//   * Verschlüsselung nach RFC 8291 (aes128gcm) – nur dein Handy kann
//     die Nachricht lesen, weder GitHub noch der Push-Dienst.
//   * Absender-Nachweis nach RFC 8292 (VAPID) – der Push-Dienst nimmt
//     nur Nachrichten an, die mit deinem privaten Schlüssel signiert sind.
// Geprüft mit dem offiziellen Testvektor aus RFC 8291 (tests/webpush.test.mjs).
// =====================================================================

import { webcrypto } from "node:crypto";

const subtle = webcrypto.subtle;
const text = new TextEncoder();

export const b64urlZuBytes = (s) => new Uint8Array(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
export const bytesZuB64url = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function verbinde(...teile) {
  const laenge = teile.reduce((s, t) => s + t.length, 0);
  const aus = new Uint8Array(laenge);
  let pos = 0;
  for (const t of teile) { aus.set(t, pos); pos += t.length; }
  return aus;
}

async function hmac(schluessel, daten) {
  const k = await subtle.importKey("raw", schluessel, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await subtle.sign("HMAC", k, daten));
}

/** Öffentlicher Schlüssel (65 Bytes, unkomprimiert) + privates d → JWK für WebCrypto */
function ecJwk(oeffentlich, d) {
  if (oeffentlich.length !== 65 || oeffentlich[0] !== 4) throw new Error("Öffentlicher Schlüssel hat nicht das erwartete Format.");
  return { kty: "EC", crv: "P-256", x: bytesZuB64url(oeffentlich.slice(1, 33)), y: bytesZuB64url(oeffentlich.slice(33, 65)), d, ext: true };
}

/**
 * Verschlüsselt die Nutzlast für ein Abo (RFC 8291, Inhaltskodierung aes128gcm).
 * salz und absender sind nur für den Testvektor vorgebbar – sonst zufällig.
 */
export async function verschluesseln({ p256dh, auth, nutzlast, salz = null, absender = null }) {
  const uaOeffentlich = b64urlZuBytes(p256dh);
  const authGeheimnis = b64urlZuBytes(auth);
  if (authGeheimnis.length !== 16) throw new Error("Das Abo enthält ein ungültiges auth-Geheimnis.");

  let asPrivat; let asOeffentlich;
  if (absender) {
    asOeffentlich = b64urlZuBytes(absender.oeffentlich);
    asPrivat = await subtle.importKey("jwk", ecJwk(asOeffentlich, absender.privat), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  } else {
    const paar = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    asPrivat = paar.privateKey;
    asOeffentlich = new Uint8Array(await subtle.exportKey("raw", paar.publicKey));
  }
  const uaSchluessel = await subtle.importKey("raw", uaOeffentlich, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhGeheimnis = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: uaSchluessel }, asPrivat, 256));

  // HKDF in Einzelschritten, genau wie in RFC 8291 Abschnitt 3.4 beschrieben
  const prkSchluessel = await hmac(authGeheimnis, ecdhGeheimnis);
  const schluesselInfo = verbinde(text.encode("WebPush: info\0"), uaOeffentlich, asOeffentlich);
  const ikm = await hmac(prkSchluessel, verbinde(schluesselInfo, new Uint8Array([1])));
  const s = salz ? b64urlZuBytes(salz) : webcrypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(s, ikm);
  const cek = (await hmac(prk, verbinde(text.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, verbinde(text.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const klar = verbinde(typeof nutzlast === "string" ? text.encode(nutzlast) : nutzlast, new Uint8Array([2])); // 0x02 = letzter Datensatz
  const aes = await subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const geheim = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aes, klar));

  const rs = new Uint8Array([0, 0, 16, 0]); // Datensatzgröße 4096
  return verbinde(s, rs, new Uint8Array([asOeffentlich.length]), asOeffentlich, geheim);
}

/** VAPID-Kopfzeile (RFC 8292): signiertes Token, das der Push-Dienst prüft. */
export async function vapidKopf({ endpunkt, oeffentlich, privat, betreff, jetzt = Date.now() }) {
  const aud = new URL(endpunkt).origin;
  const kopf = bytesZuB64url(text.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const inhalt = bytesZuB64url(text.encode(JSON.stringify({ aud, exp: Math.floor(jetzt / 1000) + 12 * 3600, sub: betreff })));
  const k = await subtle.importKey("jwk", ecJwk(b64urlZuBytes(oeffentlich), privat), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signatur = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, text.encode(`${kopf}.${inhalt}`)));
  return `vapid t=${kopf}.${inhalt}.${bytesZuB64url(signatur)}, k=${oeffentlich}`;
}

// Nur an bekannte Push-Dienste senden (Schutz vor Missbrauch über ein manipuliertes Abo).
const PUSH_DIENSTE = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

export function pruefeAbo(abo) {
  if (!abo || typeof abo.endpoint !== "string" || !abo.keys?.p256dh || !abo.keys?.auth) throw new Error("Das Abo ist unvollständig.");
  const u = new URL(abo.endpoint);
  if (u.protocol !== "https:" || !PUSH_DIENSTE.some((r) => r.test(u.hostname))) throw new Error(`Unbekannter Push-Dienst: ${u.hostname}`);
}

/** Sendet die Nachricht. Wirft bei Fehlern eine verständliche Meldung. */
export async function sende({ abo, vapid, betreff, nutzlast, ttl = 6 * 3600 }) {
  pruefeAbo(abo);
  const koerper = await verschluesseln({ p256dh: abo.keys.p256dh, auth: abo.keys.auth, nutzlast: JSON.stringify(nutzlast) });
  const antwort = await fetch(abo.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttl),
      Urgency: "normal",
      Authorization: await vapidKopf({ endpunkt: abo.endpoint, oeffentlich: vapid.oeffentlich, privat: vapid.privat, betreff }),
    },
    body: koerper,
    signal: AbortSignal.timeout(20_000),
  });
  if (antwort.status === 404 || antwort.status === 410) throw new Error("Das Push-Abo ist abgelaufen. Bitte in der App unter Einstellungen → Push neu einrichten und PUSH_CONFIG ersetzen.");
  if (!antwort.ok) throw new Error(`Push-Dienst antwortet mit ${antwort.status}: ${(await antwort.text()).slice(0, 200)}`);
  return antwort.status;
}
