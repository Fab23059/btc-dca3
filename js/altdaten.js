// =====================================================================
// altdaten.js – Liest die Daten der alten App. NUR LESEN.
//
// Alte und neue App laufen unter derselben Adresse (fab23059.github.io)
// und teilen sich deshalb denselben Browser-Speicher. Die alte App muss
// unverändert weiterlaufen. Deshalb gilt:
//
//   * Dies ist die EINZIGE Datei, die die alten Schlüssel ("btcdca_…") kennt.
//   * Sie benutzt ausschließlich localStorage.getItem() und localStorage.key().
//   * Es gibt hier kein setItem, kein removeItem und kein clear.
//
// Wer diese Datei ändert: Bitte niemals einen Schreibzugriff einbauen.
// Die Datei tests/schreibschutz.test.mjs prüft das automatisch.
// =====================================================================

import { pruefeEintraege } from "./speicher.js";

const ALT = Object.freeze({
  eintraege: "btcdca_overrides_v1",       // { "2026-10-26": { btc, price } } – manuell eingetragene Käufe
  montagskurse: "btcdca_monday_prices_v4", // { "2026-10-26": 61234.5 } – automatisch geholte Montagskurse
  tageskurse: "btcdca_daily_closes_v2",   // { "2026-10-26": 61234.5 } – Tagesschlusskurse (UTC-Tag)
  gefeiert: "btcdca_celebrated",          // ["s50000", "w4", …] – schon gefeierte Meilensteine
  zitat: "btcdca_lastquote",              // Nummer des zuletzt gezeigten Zitats
  reihenPraefix: "btcdca_pc_",            // btcdca_pc_1m usw. – zwischengespeicherte Kursreihen
});

/** Liest einen Rohtext. Fehler (z. B. gesperrter Speicher) ergeben null. */
function liesRoh(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

function liesJson(k) {
  const roh = liesRoh(k);
  if (roh == null) return { roh: null, wert: null };
  try {
    return { roh, wert: JSON.parse(roh) };
  } catch {
    return { roh, wert: null, kaputt: true };
  }
}

/**
 * Die manuell eingetragenen Käufe der alten App.
 * Liefert geprüfte Einträge und eine Liste der Einträge, die nicht lesbar waren.
 */
export function liesAlteEintraege() {
  const { roh, wert, kaputt } = liesJson(ALT.eintraege);
  if (roh == null) return { vorhanden: false, roh: null, gueltig: {}, fehler: [] };
  if (kaputt) return { vorhanden: true, roh, gueltig: {}, fehler: [{ montag: "(gesamt)", grund: "Daten nicht lesbar" }] };
  const { gueltig, fehler } = pruefeEintraege(wert);
  return { vorhanden: true, roh, gueltig, fehler };
}

const istKurs = (n) => typeof n === "number" && Number.isFinite(n) && n >= 100 && n <= 50_000_000;

function kursTabelle(k) {
  const { wert } = liesJson(k);
  const aus = {};
  if (!wert || typeof wert !== "object" || Array.isArray(wert)) return aus;
  for (const [tag, kurs] of Object.entries(wert)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(tag) && istKurs(kurs)) aus[tag] = kurs;
  }
  return aus;
}

/** Automatisch geholte Montagskurse der alten App (Vorsicht: teils vor der Kaufzeit gemerkt). */
export const liesAlteMontagskurse = () => kursTabelle(ALT.montagskurse);

/** Tagesschlusskurse der alten App. */
export const liesAlteTageskurse = () => kursTabelle(ALT.tageskurse);

/** Schon gefeierte Meilensteine der alten App, damit nichts doppelt gefeiert wird. */
export function liesAlteGefeiert() {
  const { wert } = liesJson(ALT.gefeiert);
  return Array.isArray(wert) ? wert.filter((x) => typeof x === "string" && /^[sw]\d+$/.test(x)) : [];
}

/**
 * Sicherungsdatei der alten App (Knopf "Export" dort): ein Objekt mit
 * btcdca_overrides_v1, btcdca_monday_prices_v4 und btcdca_daily_closes_v2.
 * Gibt die Rohdaten zurück oder null, wenn es keine solche Datei ist.
 */
export function altesSicherungsformat(obj) {
  if (!obj || typeof obj !== "object" || !(ALT.eintraege in obj)) return null;
  return { eintraege: obj[ALT.eintraege], tageskurse: obj[ALT.tageskurse] };
}

/** Zwischengespeicherte Kursreihen der alten App (für einen Start ohne Netz). */
export function liesAlteReihen() {
  const aus = {};
  let anzahl = 0;
  try { anzahl = localStorage.length; } catch { return aus; }
  for (let i = 0; i < anzahl; i++) {
    let k = null;
    try { k = localStorage.key(i); } catch { /* weiter */ }
    if (!k || !k.startsWith(ALT.reihenPraefix)) continue;
    const { wert } = liesJson(k);
    if (!wert || !Array.isArray(wert.data) || typeof wert.ts !== "number") continue;
    const punkte = wert.data
      .filter((p) => p && typeof p.t === "number" && istKurs(p.c))
      .map((p) => [p.t, p.c]);
    if (punkte.length) aus[k.slice(ALT.reihenPraefix.length)] = { zeit: wert.ts, punkte };
  }
  return aus;
}
