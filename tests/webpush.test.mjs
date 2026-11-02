// Prüft die Push-Verschlüsselung gegen den offiziellen Testvektor aus RFC 8291, Abschnitt 5.
import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { verschluesseln, vapidKopf, pruefeAbo, b64urlZuBytes, bytesZuB64url } from "../push/webpush.mjs";

test("RFC 8291 Testvektor: identische verschlüsselte Nachricht", async () => {
  const body = await verschluesseln({
    nutzlast: "When I grow up, I want to be a watermelon",
    p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
    auth: "BTBZMqHH6r4Tts7J_aSIgg",
    salz: "DGv6ra1nlYgDCS1FRnbzlw",
    absender: {
      oeffentlich: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
      privat: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
    },
  });
  assert.equal(bytesZuB64url(body), "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN");
});

test("VAPID: Signatur lässt sich mit dem öffentlichen Schlüssel prüfen", async () => {
  // Schlüssel so erzeugen, wie es die App im Browser tut
  const paar = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const oeffentlich = bytesZuB64url(new Uint8Array(await webcrypto.subtle.exportKey("raw", paar.publicKey)));
  const privat = (await webcrypto.subtle.exportKey("jwk", paar.privateKey)).d;
  const kopf = await vapidKopf({ endpunkt: "https://fcm.googleapis.com/fcm/send/abc", oeffentlich, privat, betreff: "https://fab23059.github.io/btc-dca3/", jetzt: 1_800_000_000_000 });
  const [, token, k] = kopf.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(k, oeffentlich);
  const [h, c, sig] = token.split(".");
  const claims = JSON.parse(Buffer.from(b64urlZuBytes(c)).toString());
  assert.equal(claims.aud, "https://fcm.googleapis.com");
  assert.equal(claims.exp, 1_800_000_000 + 12 * 3600);
  const ok = await webcrypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, paar.publicKey, b64urlZuBytes(sig), new TextEncoder().encode(`${h}.${c}`));
  assert.ok(ok);
});

test("Nur bekannte Push-Dienste werden angesprochen", () => {
  const keys = { p256dh: "x", auth: "y" };
  assert.doesNotThrow(() => pruefeAbo({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys }));
  assert.doesNotThrow(() => pruefeAbo({ endpoint: "https://web.push.apple.com/abc", keys }));
  assert.throws(() => pruefeAbo({ endpoint: "https://boese.example.com/x", keys }), /Unbekannter Push-Dienst/);
  assert.throws(() => pruefeAbo({ endpoint: "http://fcm.googleapis.com/x", keys }), /Unbekannter/);
});
