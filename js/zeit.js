// =====================================================================
// zeit.js – Kalender und Uhrzeit, immer in deutscher Zeit (Europe/Berlin).
//
// Ein Datum ohne Uhrzeit wird überall als Text "JJJJ-MM-TT" geführt
// (z. B. "2026-11-02"). Das nennen wir "Schlüssel". Rechnen mit solchen
// Schlüsseln passiert in UTC, damit Sommer-/Winterzeit nie stört.
// Echte Zeitpunkte sind Millisekunden seit 1970 (wie Date.now()).
// =====================================================================

const TAG_MS = 86_400_000;

// Formatierer einmal anlegen – das ist deutlich schneller als bei jedem Aufruf.
const berlinFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Berlin", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
});

/** Zerlegt einen Zeitpunkt in die Bestandteile der Berliner Uhrzeit. */
export function berlinTeile(ts) {
  const t = {};
  for (const p of berlinFormat.formatToParts(new Date(ts))) {
    if (p.type !== "literal") t[p.type] = Number(p.value);
  }
  return { jahr: t.year, monat: t.month, tag: t.day, stunde: t.hour % 24, minute: t.minute, sekunde: t.second };
}

/** Abstand der Berliner Zeit zu UTC in Minuten (60 im Winter, 120 im Sommer). */
export function berlinVersatzMin(ts) {
  const b = berlinTeile(ts);
  const alsUtc = Date.UTC(b.jahr, b.monat - 1, b.tag, b.stunde, b.minute, b.sekunde);
  return Math.round((alsUtc - Math.floor(ts / 1000) * 1000) / 60_000);
}

/**
 * Zeitpunkt für "Datum X um hh:mm deutscher Zeit".
 * Zweimal gerechnet, damit auch die Tage der Zeitumstellung stimmen.
 */
export function berlinZeitpunkt(schl, stunde, minute) {
  const { jahr, monat, tag } = zerlege(schl);
  const naiv = Date.UTC(jahr, monat - 1, tag, stunde, minute, 0);
  let ts = naiv - berlinVersatzMin(naiv) * 60_000;
  ts = naiv - berlinVersatzMin(ts) * 60_000;
  return ts;
}

/** Das heutige Datum in Deutschland als Schlüssel. */
export function heuteBerlin(jetzt = Date.now()) {
  const b = berlinTeile(jetzt);
  return schluessel(b.jahr, b.monat, b.tag);
}

/** Datum eines Zeitpunkts in Deutschland als Schlüssel. */
export const datumBerlin = heuteBerlin;

export function schluessel(jahr, monat, tag) {
  return `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}

export function zerlege(schl) {
  const [jahr, monat, tag] = schl.split("-").map(Number);
  return { jahr, monat, tag };
}

/** Prüft, ob ein Text ein echtes Kalenderdatum im Format JJJJ-MM-TT ist. */
export function istDatum(schl) {
  if (typeof schl !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(schl)) return false;
  const { jahr, monat, tag } = zerlege(schl);
  const d = new Date(Date.UTC(jahr, monat - 1, tag));
  return d.getUTCFullYear() === jahr && d.getUTCMonth() === monat - 1 && d.getUTCDate() === tag;
}

/** Schlüssel → Millisekunden (Mitternacht UTC). Nur zum Rechnen mit ganzen Tagen. */
function alsUtcMs(schl) {
  const { jahr, monat, tag } = zerlege(schl);
  return Date.UTC(jahr, monat - 1, tag);
}

function ausUtcMs(ms) {
  const d = new Date(ms);
  return schluessel(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** UTC-Kalendertag eines Zeitpunkts (so beschriften die Kursquellen ihre Tageskerzen). */
export function utcTag(ts) {
  return ausUtcMs(Math.floor(ts / TAG_MS) * TAG_MS);
}

export function plusTage(schl, n) {
  return ausUtcMs(alsUtcMs(schl) + n * TAG_MS);
}

/** Ganze Tage von a bis b (positiv, wenn b später ist). */
export function tageZwischen(a, b) {
  return Math.round((alsUtcMs(b) - alsUtcMs(a)) / TAG_MS);
}

/** Wochentag nach ISO: 1 = Montag … 7 = Sonntag. */
export function wochentag(schl) {
  const w = new Date(alsUtcMs(schl)).getUTCDay();
  return w === 0 ? 7 : w;
}

/** Der Montag der Woche, in der das Datum liegt. */
export function montagVon(schl) {
  return plusTage(schl, 1 - wochentag(schl));
}

/**
 * Jahrestag: dasselbe Datum ein Jahr später. Gibt es den Tag nicht
 * (29. Februar), endet die Frist am letzten Tag des Monats (§ 188 BGB).
 */
export function jahrestag(schl) {
  const { jahr, monat, tag } = zerlege(schl);
  const letzterTagImMonat = new Date(Date.UTC(jahr + 1, monat, 0)).getUTCDate();
  return schluessel(jahr + 1, monat, Math.min(tag, letzterTagImMonat));
}

export { TAG_MS };
