// =====================================================================
// format.js – Zahlen und Daten im deutschen Format.
// 1.234,56 € · 0,00024512 BTC · +4,82 % · Mo, 2. November
// =====================================================================

import { zerlege, wochentag, berlinTeile } from "./zeit.js";

const STRICH = "–"; // Gedankenstrich als Platzhalter für "kein Wert"
const MINUS = "−";  // typografisch korrektes Minus
const NBSP = " ";   // geschütztes Leerzeichen: Zahl und Einheit bleiben zusammen

const zahlFormate = new Map();
function zahlFormat(min, max) {
  const k = `${min}-${max}`;
  if (!zahlFormate.has(k)) {
    zahlFormate.set(k, new Intl.NumberFormat("de-DE", { minimumFractionDigits: min, maximumFractionDigits: max }));
  }
  return zahlFormate.get(k);
}

const istZahl = (n) => typeof n === "number" && Number.isFinite(n);

/** Zahl mit festen Nachkommastellen, deutsches Format, ohne Vorzeichenlogik. */
export function zahl(n, stellen = 2, maxStellen = stellen) {
  if (!istZahl(n)) return STRICH;
  return zahlFormat(stellen, maxStellen).format(n).replace("-", MINUS);
}

/** Vorzeichen als eigenes Zeichen (+ / −), für Gewinne und Veränderungen. */
export function vorzeichen(n) {
  if (!istZahl(n) || n === 0) return "";
  return n > 0 ? "+" : MINUS;
}

/** 1.234,56 € */
export function euro(n, stellen = 2) {
  if (!istZahl(n)) return STRICH;
  return zahl(n, stellen) + NBSP + "€";
}

/** +12,34 € bzw. −12,34 € */
export function euroMitVorzeichen(n, stellen = 2) {
  if (!istZahl(n)) return STRICH;
  return vorzeichen(n) + zahl(Math.abs(n), stellen) + NBSP + "€";
}

/** +4,82 % */
export function prozent(n, stellen = 2) {
  if (!istZahl(n)) return STRICH;
  return vorzeichen(n) + zahl(Math.abs(n), stellen) + NBSP + "%";
}

/** 0,00024512 */
export function btc(n) {
  if (!istZahl(n)) return STRICH;
  return zahl(n, 8);
}

/** 24.512 (Satoshi, ganze Zahl) */
export function sats(n) {
  if (!istZahl(n)) return STRICH;
  return zahl(Math.round(n), 0);
}

/** Ganze Zahl mit Tausenderpunkt */
export function ganz(n) {
  if (!istZahl(n)) return STRICH;
  return zahl(Math.round(n), 0);
}

/**
 * Zerlegt einen Eurobetrag für die große Darstellung in Teile:
 * Vorzeichen, Vorkomma, Nachkomma, Währung – so können Nachkommastellen
 * und €-Zeichen kleiner und leiser gesetzt werden.
 */
export function euroTeile(n, stellen = 2, mitVorzeichen = false) {
  if (!istZahl(n)) return { vz: "", ganz: STRICH, komma: "", einheit: "€" };
  const text = zahl(Math.abs(n), stellen);
  const [g, k] = text.split(",");
  return {
    vz: mitVorzeichen ? vorzeichen(n) : n < 0 ? MINUS : "",
    ganz: g,
    komma: k ? "," + k : "",
    einheit: "€",
  };
}

/** Zerlegt eine BTC-Menge: 0,0041 vorne kräftig, die restlichen Stellen leiser. */
export function btcTeile(n) {
  if (!istZahl(n)) return { vz: "", ganz: STRICH, komma: "", einheit: "BTC" };
  const text = zahl(n, 8);
  const [g, k] = text.split(",");
  return { vz: "", ganz: g + "," + k.slice(0, 4), komma: k.slice(4), einheit: "BTC" };
}

// ---------------------------------------------------------------------
// Daten
// ---------------------------------------------------------------------

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WOCHENTAGE_LANG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MONATE_KURZ = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/** 26.10. */
export function datumKurz(schl) {
  const { monat, tag } = zerlege(schl);
  return `${tag}.${monat}.`;
}

/** 26.10.2026 */
export function datum(schl) {
  const { jahr, monat, tag } = zerlege(schl);
  return `${String(tag).padStart(2, "0")}.${String(monat).padStart(2, "0")}.${jahr}`;
}

/** Mo, 26. Oktober */
export function datumLang(schl, mitJahr = false) {
  const { jahr, monat, tag } = zerlege(schl);
  return `${WOCHENTAGE[wochentag(schl) - 1]}, ${tag}. ${MONATE[monat - 1]}${mitJahr ? " " + jahr : ""}`;
}

/** 26. Okt */
export function datumMonatKurz(schl) {
  const { monat, tag } = zerlege(schl);
  return `${tag}. ${MONATE_KURZ[monat - 1]}`;
}

export function wochentagKurz(schl) { return WOCHENTAGE[wochentag(schl) - 1]; }
export function wochentagLang(schl) { return WOCHENTAGE_LANG[wochentag(schl) - 1]; }
export function monatsname(monat) { return MONATE[monat - 1]; }
export function monatKurz(monat) { return MONATE_KURZ[monat - 1]; }

const uhrFormat = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
const zeitpunktFormat = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

/** 20:50 */
export function uhrzeit(ts) { return uhrFormat.format(new Date(ts)); }

/** 2.11., 20:50 */
export function zeitpunkt(ts) { return zeitpunktFormat.format(new Date(ts)); }

/** "vor 5 Min", "vor 3 Std", "vor 2 Tagen" */
export function vorZeit(ts, jetzt = Date.now()) {
  const s = Math.max(0, (jetzt - ts) / 1000);
  if (s < 90) return "gerade eben";
  if (s < 3600) return `vor ${Math.round(s / 60)} Min`;
  if (s < 86400) return `vor ${Math.round(s / 3600)} Std`;
  const t = Math.round(s / 86400);
  return t === 1 ? "vor 1 Tag" : `vor ${t} Tagen`;
}

/** Mehrzahl: "1 Woche", "3 Wochen" */
export function anzahl(n, einzahl, mehrzahl) {
  return `${ganz(n)}${NBSP}${n === 1 ? einzahl : mehrzahl}`;
}

/** Gruß passend zur Tageszeit in Deutschland */
export function gruss(ts = Date.now()) {
  const st = berlinTeile(ts).stunde;
  if (st >= 5 && st < 11) return "Guten Morgen";
  if (st >= 11 && st < 17) return "Guten Tag";
  if (st >= 17 && st < 23) return "Guten Abend";
  return "Gute Nacht";
}

export { STRICH, MINUS, NBSP };

/**
 * Liest eine Zahl so, wie Menschen (und Börsen) sie schreiben.
 * Erkennt deutsches und englisches Format und alles, was beim Kopieren mitkommt:
 *   "0,00024512" · "0.00024512" · "+ 0.00022552 BTC" (so zeigt es Bitvavo)
 *   "₿ 0,0002" · "22.552 sats" (→ in BTC umgerechnet) · "61.234,56 €" · "€ 61,234.56" · "66878.18 EUR"
 * art: "btc" oder "kurs" (bei "kurs" ist "61.234" ein Tausenderpunkt, kein Komma).
 * Rückgabe: Zahl, null (leer) oder NaN (keine Zahl).
 */
export function leseZahl(text, art) {
  let s = String(text ?? "").trim().toLowerCase();
  const inSats = art === "btc" && /sat/.test(s);
  // Was beim Kopieren mitkommt: Vorzeichen "+", Einheiten, Währungen, Leerzeichen jeder Art
  s = s.replace(/satoshis?|sats?|btc|xbt|₿|eur|€/g, "").replace(/[\s\u00A0\u202F'’]/g, "").replace(/^\+/, "");
  if (!s) return null;
  if (!/^[0-9.,]+$/.test(s)) return NaN;
  if (inSats) {
    // sats sind ganze Zahlen: Punkte und Kommas sind nur Tausendertrenner
    const n = Number(s.replace(/[.,]/g, ""));
    return Number.isFinite(n) ? n / 1e8 : NaN;
  }
  const komma = s.includes(","); const punkt = s.includes(".");
  if (komma && punkt) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (komma) {
    const anzahlKomma = (s.match(/,/g) || []).length;
    if (art === "kurs" && /^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");   // "66,878" (englischer Tausender)
    else if (anzahlKomma > 1) return NaN;
    else s = s.replace(",", ".");
  } else if (punkt && art === "kurs" && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if ((s.match(/\./g) || []).length > 1) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
