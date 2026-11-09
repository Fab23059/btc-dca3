// =====================================================================
// speicher.js – Alles, was die App im Browser speichert.
//
// SICHERHEITSREGEL: Diese App schreibt ausschließlich Schlüssel, die mit
// "dca3_" beginnen. Jeder Schreib- und Löschzugriff läuft durch
// pruefeSchluessel() – ein anderer Schlüssel löst sofort einen Fehler aus.
// Die Daten der alten App ("btcdca_…") werden nur in altdaten.js gelesen.
// =====================================================================

import { SPEICHER_PRAEFIX, GRENZEN } from "./konfig.js";
import { istDatum, wochentag, tageZwischen, berlinZeitpunkt } from "./zeit.js";

export const SCHLUESSEL = Object.freeze({
  eintraege: "dca3_eintraege",          // deine eingetragenen Käufe – das Wertvollste
  sicherungen: "dca3_sicherungen",      // automatische Schnappschüsse vor jeder Änderung
  kaufkurse: "dca3_kaufkurse",          // Marktkurs zur Kaufzeit je Montag (automatisch geholt)
  altkurse: "dca3_altkurse",            // Montagskurse aus der alten App (damit hat sie Käufe ohne Eintrag erfasst)
  tageskurse: "dca3_tageskurse",        // Tagesschlusskurse
  letzterKurs: "dca3_letzter_kurs",     // zuletzt bekannter aktueller Kurs (für den Offline-Start)
  markt: "dca3_markt",                  // Stimmung und Blockhöhe (zuletzt bekannt)
  einstellungen: "dca3_einstellungen",
  abgleich: "dca3_abgleich",            // Stand des Abgleichs mit der alten App
  status: "dca3_status",                // Migration, letzte Sicherung …
  gefeiert: "dca3_gefeiert",            // schon gefeierte Meilensteine
  zitat: "dca3_zitat",
  push: "dca3_push",                    // öffentlicher Teil der Push-Einrichtung
});

export const reiheSchluessel = (name) => `${SPEICHER_PRAEFIX}reihe_${name}`;

/** Der Schutzwall: nur eigene Schlüssel dürfen beschrieben oder gelöscht werden. */
function pruefeSchluessel(k) {
  if (typeof k !== "string" || !k.startsWith(SPEICHER_PRAEFIX)) {
    throw new Error(`Schreibschutz: "${k}" gehört nicht zu dieser App.`);
  }
}

/** Liest einen Wert. Fehlt er oder ist er kaputt, kommt der Ersatzwert zurück. */
export function lies(k, ersatz = null) {
  try {
    const roh = localStorage.getItem(k);
    if (roh == null) return ersatz;
    const wert = JSON.parse(roh);
    return wert ?? ersatz;
  } catch {
    return ersatz;
  }
}

/** Löscht die eigenen, jederzeit neu ladbaren Kurs-Zwischenspeicher (bei Platzmangel). */
function raeumeZwischenspeicherAuf() {
  const weg = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(`${SPEICHER_PRAEFIX}reihe_`)) weg.push(k);
  }
  weg.forEach((k) => entferne(k));
}

/**
 * Schreibt einen Wert. Bei wichtigen Daten (pruefen = true) wird
 * zurückgelesen, ob er wirklich angekommen ist.
 * Gibt true zurück, wenn es geklappt hat.
 */
export function schreibe(k, wert, { pruefen = false } = {}) {
  pruefeSchluessel(k);
  const text = JSON.stringify(wert);
  try {
    localStorage.setItem(k, text);
  } catch (e) {
    // Speicher voll? Erst die eigenen Kurs-Zwischenspeicher opfern, dann nochmal.
    raeumeZwischenspeicherAuf();
    try {
      localStorage.setItem(k, text);
    } catch {
      if (pruefen) throw new Error("Speichern fehlgeschlagen – der Browser-Speicher ist voll oder gesperrt.");
      return false;
    }
  }
  if (pruefen && localStorage.getItem(k) !== text) {
    throw new Error("Speichern fehlgeschlagen – der Wert ließ sich nicht zurücklesen.");
  }
  return true;
}

export function entferne(k) {
  pruefeSchluessel(k);
  try { localStorage.removeItem(k); } catch { /* nichts zu tun */ }
}

// ---------------------------------------------------------------------
// Käufe (Einträge)
// ---------------------------------------------------------------------

const istZahl = (n) => typeof n === "number" && Number.isFinite(n);

/**
 * Prüft einen einzelnen Kauf-Eintrag und gibt eine saubere Kopie zurück –
 * oder einen Fehlertext. Akzeptiert auch das alte Format (price statt kurs).
 */
export function pruefeEintrag(montag, roh) {
  if (!istDatum(montag)) return { fehler: "kein gültiges Datum" };
  if (wochentag(montag) !== 1) return { fehler: "kein Montag" };
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return { fehler: "kein Eintrag" };

  const btc = roh.btc ?? null;
  const kurs = roh.kurs ?? roh.price ?? null;
  const e = {};
  if (btc !== null) {
    if (!istZahl(btc) || btc < GRENZEN.btcMin || btc > GRENZEN.btcMax) return { fehler: `unplausible BTC-Menge (${String(btc).slice(0, 20)})` };
    e.btc = btc;
  }
  if (kurs !== null) {
    if (!istZahl(kurs) || kurs < GRENZEN.kursMin || kurs > GRENZEN.kursMax) return { fehler: `unplausibler Kurs (${String(kurs).slice(0, 20)})` };
    e.kurs = kurs;
  }
  if (e.btc == null && e.kurs == null) return { fehler: "weder Menge noch Kurs" };
  if (roh.datum != null) {
    // Tatsächlicher Kauftag (darf vom Montag abweichen, muss aber in dieselbe Woche fallen)
    if (!istDatum(roh.datum)) return { fehler: "ungültiger Kauftag" };
    const abstand = tageZwischen(montag, roh.datum);
    if (abstand < 0 || abstand > 6) return { fehler: "Kauftag liegt nicht in dieser Sparwoche" };
    if (abstand > 0) e.datum = roh.datum;
  }
  if (roh.zeit != null) {
    // Kaufzeitpunkt, wenn früher eingetragen als geplant (Bitvavo kauft manchmal schon vormittags):
    // muss in dieselbe Sparwoche fallen
    const wochenStart = berlinZeitpunkt(montag, 0, 0);
    if (!istZahl(roh.zeit) || roh.zeit < wochenStart || roh.zeit >= wochenStart + 7 * 86_400_000) return { fehler: "Kaufzeit liegt nicht in dieser Sparwoche" };
    e.zeit = Math.round(roh.zeit);
  }
  if (roh.herkunft === "alt" || roh.herkunft === "neu" || roh.herkunft === "import") e.herkunft = roh.herkunft;
  if (istZahl(roh.geaendert)) e.geaendert = roh.geaendert;
  return { eintrag: e };
}

/** Prüft eine ganze Sammlung von Einträgen. Ungültige werden gemeldet, nie stillschweigend verworfen. */
export function pruefeEintraege(roh) {
  const gueltig = {};
  const fehler = [];
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return { gueltig, fehler };
  for (const [montag, wert] of Object.entries(roh)) {
    const r = pruefeEintrag(montag, wert);
    if (r.eintrag) gueltig[montag] = r.eintrag;
    else fehler.push({ montag: String(montag).slice(0, 40), grund: r.fehler });
  }
  return { gueltig, fehler };
}

export function ladeEintraege() {
  return pruefeEintraege(lies(SCHLUESSEL.eintraege, {})).gueltig;
}

/** Legt vor jeder Änderung einen Schnappschuss an (die letzten 20 bleiben erhalten). */
export function sichere(grund) {
  const liste = lies(SCHLUESSEL.sicherungen, []);
  const neu = Array.isArray(liste) ? liste : [];
  neu.unshift({ zeit: Date.now(), grund, eintraege: lies(SCHLUESSEL.eintraege, {}) });
  schreibe(SCHLUESSEL.sicherungen, neu.slice(0, 20));
}

export function ladeSicherungen() {
  const liste = lies(SCHLUESSEL.sicherungen, []);
  return Array.isArray(liste) ? liste : [];
}

/** Speichert die komplette Sammlung (nach Prüfung) – mit Schnappschuss davor. */
export function speichereEintraege(eintraege, grund) {
  const { gueltig, fehler } = pruefeEintraege(eintraege);
  if (fehler.length) throw new Error(`Ungültiger Eintrag ${fehler[0].montag}: ${fehler[0].grund}`);
  sichere(grund);
  schreibe(SCHLUESSEL.eintraege, gueltig, { pruefen: true });
  return gueltig;
}

/** Einen Kauf setzen oder ändern. */
export function setzeEintrag(montag, daten, herkunft = "neu") {
  const alle = ladeEintraege();
  const r = pruefeEintrag(montag, { ...daten, herkunft, geaendert: Date.now() });
  if (r.fehler) throw new Error(r.fehler);
  alle[montag] = r.eintrag;
  return speichereEintraege(alle, `Kauf ${montag} gespeichert`);
}

/** Einen Kauf entfernen. Gibt den alten Eintrag zurück (für "Rückgängig"). */
export function loescheEintrag(montag) {
  const alle = ladeEintraege();
  const vorher = alle[montag] ?? null;
  delete alle[montag];
  speichereEintraege(alle, `Kauf ${montag} entfernt`);
  return vorher;
}

// ---------------------------------------------------------------------
// Einstellungen und Status
// ---------------------------------------------------------------------

const STANDARD_EINSTELLUNGEN = Object.freeze({
  altAbgleich: true,      // neue Käufe aus der alten App übernehmen
  erinnerung: true,       // Hinweis/Benachrichtigung, wenn ein Kauf fehlt
  haptik: true,           // feines Vibrieren beim Fahren über Käufe im Diagramm
  einheit: "eur",
  name: "Fabi",           // für den Gruß
  effekte: true,          // Nebel, Lichtleck, lebendes Korn (aus = ruhiger, spart Akku)
});

export function ladeEinstellungen() {
  const e = lies(SCHLUESSEL.einstellungen, {});
  const sauber = { ...STANDARD_EINSTELLUNGEN };
  if (e && typeof e === "object") {
    for (const k of Object.keys(STANDARD_EINSTELLUNGEN)) {
      if (typeof e[k] === typeof STANDARD_EINSTELLUNGEN[k]) sauber[k] = e[k];
    }
  }
  return sauber;
}

export function speichereEinstellung(k, wert) {
  const e = ladeEinstellungen();
  if (!(k in STANDARD_EINSTELLUNGEN) || typeof wert !== typeof STANDARD_EINSTELLUNGEN[k]) return e;
  if (k === "name") wert = wert.replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 24);
  e[k] = wert;
  schreibe(SCHLUESSEL.einstellungen, e);
  return e;
}

export function ladeStatus() {
  const s = lies(SCHLUESSEL.status, {});
  return s && typeof s === "object" ? s : {};
}

export function setzeStatus(teil) {
  const s = { ...ladeStatus(), ...teil };
  schreibe(SCHLUESSEL.status, s);
  return s;
}
