// =====================================================================
// kurse.js – Holt Kurse aus dem Netz. Jede Abfrage hat Ausweichquellen,
// eine Zeitgrenze und einen Zwischenspeicher mit Haltbarkeit.
// Ist gar nichts erreichbar, gibt es den zuletzt bekannten Stand –
// deutlich als "veraltet" gekennzeichnet.
//
// Quellen (alle ohne Schlüssel, alle nur lesend):
//   1. CryptoCompare  – liefert EUR direkt, Haupt­quelle
//   2. Coinbase       – Minutenkerzen auch für alte Tage, Ausweichquelle
//   3. CoinGecko      – letzte Ausweichquelle (max. 365 Tage, strenges Limit)
// Binance ist im Browser nicht nutzbar (blockiert fremde Webseiten).
// =====================================================================

import { ERLAUBTE_SERVER, GRENZEN } from "./konfig.js";
import { SCHLUESSEL, lies, schreibe, reiheSchluessel } from "./speicher.js";
import { utcTag, zerlege } from "./zeit.js";

const ZEITLIMIT_MS = 10_000;
const CC = "https://min-api.cryptocompare.com/data";
const CB = "https://api.exchange.coinbase.com/products/BTC-EUR";
const CG = "https://api.coingecko.com/api/v3";

const kursOk = (n) => typeof n === "number" && Number.isFinite(n) && n >= GRENZEN.kursMin && n <= GRENZEN.kursMax;
const zahlOk = (n) => typeof n === "number" && Number.isFinite(n);

/** Holt JSON – nur von erlaubten Servern, mit Zeitgrenze, ohne Cookies und ohne Herkunftsangabe. */
async function holeJson(adresse) {
  const url = new URL(adresse);
  if (url.protocol !== "https:" || !ERLAUBTE_SERVER.includes(url.hostname)) throw new Error("Server nicht erlaubt");
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), ZEITLIMIT_MS);
  try {
    const antwort = await fetch(url, { signal: abbruch.signal, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", mode: "cors" });
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    const text = await antwort.text();
    if (text.length > 4_000_000) throw new Error("Antwort zu groß");
    return JSON.parse(text);
  } finally {
    clearTimeout(uhr);
  }
}

/** Probiert Quellen der Reihe nach, bis eine ein gültiges Ergebnis liefert. */
async function ersteGueltige(quellen) {
  let letzterFehler = null;
  for (const [name, holen] of quellen) {
    try {
      const wert = await holen();
      if (wert != null) return { ...wert, quelle: name };
    } catch (e) {
      letzterFehler = e;
    }
  }
  throw letzterFehler ?? new Error("keine Quelle erreichbar");
}

// ---------------------------------------------------------------------
// Kerzen in Punkte {t, c} umwandeln. t ist der Zeitpunkt, zu dem der Kurs c
// galt – bei Kerzen also das ENDE der Kerze (bei der laufenden: jetzt).
// ---------------------------------------------------------------------

function ccKerzen(j, sekundenProKerze) {
  if (!j || j.Response !== "Success" || !Array.isArray(j?.Data?.Data)) throw new Error("CryptoCompare: keine Daten");
  const jetzt = Date.now();
  const punkte = j.Data.Data
    .filter((d) => zahlOk(d.time) && kursOk(d.close))
    .map((d) => ({ t: Math.min(jetzt, (d.time + sekundenProKerze) * 1000), c: d.close }));
  if (!punkte.length) throw new Error("CryptoCompare: leer");
  return punkte;
}

function cbKerzen(j, sekundenProKerze) {
  if (!Array.isArray(j)) throw new Error("Coinbase: keine Daten");
  const jetzt = Date.now();
  const punkte = j
    .filter((k) => Array.isArray(k) && zahlOk(k[0]) && kursOk(k[4]))
    .map((k) => ({ t: Math.min(jetzt, (k[0] + sekundenProKerze) * 1000), c: k[4] }))
    .sort((a, b) => a.t - b.t);
  if (!punkte.length) throw new Error("Coinbase: leer");
  return punkte;
}

function cgPunkte(j) {
  if (!Array.isArray(j?.prices)) throw new Error("CoinGecko: keine Daten");
  const punkte = j.prices.filter((p) => Array.isArray(p) && zahlOk(p[0]) && kursOk(p[1])).map((p) => ({ t: p[0], c: p[1] }));
  if (!punkte.length) throw new Error("CoinGecko: leer");
  return punkte;
}

/** Doppelte Zeitpunkte entfernen, sortieren. */
function aufraeumen(punkte) {
  const m = new Map();
  for (const p of punkte) m.set(p.t, p.c);
  return [...m].sort((a, b) => a[0] - b[0]).map(([t, c]) => ({ t, c }));
}

// ---------------------------------------------------------------------
// Aktueller Kurs (mit 24-Stunden-Veränderung)
// ---------------------------------------------------------------------

export async function holeAktuell() {
  const r = await ersteGueltige([
    ["CryptoCompare", async () => {
      const d = (await holeJson(`${CC}/pricemultifull?fsyms=BTC&tsyms=EUR`))?.RAW?.BTC?.EUR;
      if (!d || !kursOk(d.PRICE)) return null;
      return { kurs: d.PRICE, aenderung24h: zahlOk(d.CHANGEPCT24HOUR) ? d.CHANGEPCT24HOUR : null, hoch24h: kursOk(d.HIGH24HOUR) ? d.HIGH24HOUR : null, tief24h: kursOk(d.LOW24HOUR) ? d.LOW24HOUR : null };
    }],
    ["Coinbase", async () => {
      const [t, s] = await Promise.all([holeJson(`${CB}/ticker`), holeJson(`${CB}/stats`).catch(() => null)]);
      const kurs = Number(t?.price);
      if (!kursOk(kurs)) return null;
      const offen = Number(s?.open);
      return { kurs, aenderung24h: kursOk(offen) ? (kurs / offen - 1) * 100 : null, hoch24h: kursOk(Number(s?.high)) ? Number(s.high) : null, tief24h: kursOk(Number(s?.low)) ? Number(s.low) : null };
    }],
    ["CoinGecko", async () => {
      const d = (await holeJson(`${CG}/coins/markets?vs_currency=eur&ids=bitcoin&price_change_percentage=24h`))?.[0];
      if (!d || !kursOk(d.current_price)) return null;
      return { kurs: d.current_price, aenderung24h: zahlOk(d.price_change_percentage_24h) ? d.price_change_percentage_24h : null, hoch24h: kursOk(d.high_24h) ? d.high_24h : null, tief24h: kursOk(d.low_24h) ? d.low_24h : null };
    }],
  ]);
  const ergebnis = { ...r, zeit: Date.now() };
  schreibe(SCHLUESSEL.letzterKurs, ergebnis);
  return ergebnis;
}

/** Zuletzt bekannter Kurs (für den sofortigen Start, auch ohne Netz). */
export function letzterBekannterKurs() {
  const k = lies(SCHLUESSEL.letzterKurs);
  return k && kursOk(k.kurs) && zahlOk(k.zeit) ? k : null;
}

/** Gegenprobe: derselbe Kurs von zwei unabhängigen Quellen. */
export async function gegenprobe() {
  const [cc, cb] = await Promise.allSettled([
    holeJson(`${CC}/price?fsym=BTC&tsyms=EUR`).then((j) => (kursOk(j?.EUR) ? j.EUR : null)),
    holeJson(`${CB}/ticker`).then((j) => (kursOk(Number(j?.price)) ? Number(j.price) : null)),
  ]);
  return {
    cryptocompare: cc.status === "fulfilled" ? cc.value : null,
    coinbase: cb.status === "fulfilled" ? cb.value : null,
    zeit: Date.now(),
  };
}

// ---------------------------------------------------------------------
// Kurs zur Kaufzeit (für geschätzte Käufe und als Vorschlag beim Eintragen)
// ---------------------------------------------------------------------

/** Holt den Kurs zu einem Zeitpunkt so genau wie möglich (Minute, sonst Stunde). */
export async function holeKursZumZeitpunkt(ts) {
  const sek = Math.floor(ts / 1000);
  const minute = sek - (sek % 60);
  return ersteGueltige([
    ["CryptoCompare", async () => {
      if (Date.now() - ts > 6.5 * 86_400_000) return null;   // Minutenkerzen gibt es dort nur ~7 Tage
      const j = await holeJson(`${CC}/v2/histominute?fsym=BTC&tsym=EUR&limit=3&toTs=${minute + 120}`);
      const k = j?.Response === "Success" ? j.Data.Data.find((d) => d.time === minute) : null;
      return k && kursOk(k.open) ? { kurs: k.open, genauigkeit: "minute" } : null;
    }],
    ["Coinbase", async () => {
      const von = new Date((minute - 120) * 1000).toISOString();
      const bis = new Date((minute + 180) * 1000).toISOString();
      const j = await holeJson(`${CB}/candles?granularity=60&start=${von}&end=${bis}`);
      const k = Array.isArray(j) ? j.find((x) => Array.isArray(x) && x[0] === minute) : null;
      return k && kursOk(k[3]) ? { kurs: k[3], genauigkeit: "minute" } : null;
    }],
    ["CryptoCompare (Stunde)", async () => {
      const j = await holeJson(`${CC}/v2/histohour?fsym=BTC&tsym=EUR&limit=2&toTs=${sek + 3600}`);
      const k = j?.Response === "Success" ? j.Data.Data.find((d) => d.time <= sek && sek < d.time + 3600) : null;
      if (!k || !kursOk(k.open) || !kursOk(k.close)) return null;
      // Zwischen Eröffnung und Schluss der Stunde linear schätzen
      return { kurs: k.open + ((k.close - k.open) * (sek - k.time)) / 3600, genauigkeit: "stunde" };
    }],
    ["CoinGecko", async () => {
      const p = cgPunkte(await holeJson(`${CG}/coins/bitcoin/market_chart/range?vs_currency=eur&from=${sek - 3600}&to=${sek + 3600}`));
      let best = p[0];
      for (const x of p) if (Math.abs(x.t - ts) < Math.abs(best.t - ts)) best = x;
      return { kurs: best.c, genauigkeit: Math.abs(best.t - ts) <= 300_000 ? "minute" : "stunde" };
    }],
  ]);
}

/** Gespeicherte Kaufkurse: { "2026-10-26": { kurs, genauigkeit, quelle, geholt } } */
export function ladeKaufkurse() {
  const roh = lies(SCHLUESSEL.kaufkurse, {});
  const aus = {};
  if (!roh || typeof roh !== "object") return aus;
  for (const [m, v] of Object.entries(roh)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(m) && v && kursOk(v.kurs)) aus[m] = v;
  }
  return aus;
}

/** Kurse aus der alten App – nur als Notlösung, wenn nichts anderes da ist. */
export function ladeAltkurse() {
  const roh = lies(SCHLUESSEL.altkurse, {});
  const aus = {};
  if (roh && typeof roh === "object") for (const [m, k] of Object.entries(roh)) if (kursOk(k)) aus[m] = { kurs: k, genauigkeit: "altapp", quelle: "alte App" };
  return aus;
}

/**
 * Ergänzt fehlende Kaufkurse für vergangene Sparwochen.
 * Gespeichert wird erst, wenn der Kauf mindestens 10 Minuten her ist
 * (vorher kann die Minutenkerze noch unvollständig sein).
 */
export async function ergaenzeKaufkurse(wochen, jetzt = Date.now()) {
  const kurse = ladeKaufkurse();
  const offen = wochen.filter((w) => {
    if (w.ts > jetzt) return false;
    const k = kurse[w.montag];
    if (!k) return true;
    return k.genauigkeit !== "minute" && jetzt - (k.geholt ?? 0) > 86_400_000; // ungenaue einmal am Tag verbessern
  });
  let fehler = 0;
  const arbeiter = async () => {
    while (offen.length) {
      const w = offen.shift();
      try {
        const r = await holeKursZumZeitpunkt(w.ts);
        const eintrag = { kurs: r.kurs, genauigkeit: r.genauigkeit, quelle: r.quelle, geholt: Date.now() };
        if (jetzt - w.ts >= 10 * 60_000) kurse[w.montag] = eintrag;
        else kurse[w.montag] = { ...eintrag, vorlaeufig: true };
      } catch {
        fehler++;
      }
    }
  };
  await Promise.all([arbeiter(), arbeiter(), arbeiter()]);
  const zuSpeichern = {};
  for (const [m, v] of Object.entries(kurse)) if (!v.vorlaeufig) zuSpeichern[m] = v;
  schreibe(SCHLUESSEL.kaufkurse, zuSpeichern);
  return { kurse, fehler };
}

// ---------------------------------------------------------------------
// Kursreihen für Diagramme
// ---------------------------------------------------------------------

const MIN = 60_000;
const STD = 3_600_000;

export const REIHEN = Object.freeze({
  tag:    { titel: "1T", ttl: 5 * MIN,  spanne: 86_400_000,       cc: ["histominute", 290, 5, 300],   cb: [300, 86_400],      cg: 1,    alt: "1d" },
  woche:  { titel: "1W", ttl: 30 * MIN, spanne: 7 * 86_400_000,   cc: ["histohour", 170, 1, 3600],    cb: [3600, 7 * 86_400], cg: 7,    alt: "1w" },
  monat:  { titel: "1M", ttl: 30 * MIN, spanne: 30 * 86_400_000,  cc: ["histohour", 744, 1, 3600],    cb: [21_600, 31 * 86_400], cg: 31, alt: "1m" },
  jahr:   { titel: "1J", ttl: 6 * STD,  spanne: 365 * 86_400_000, cc: ["histoday", 366, 1, 86_400],   cb: [86_400, 299 * 86_400], cg: 365, alt: "1y" },
  jahre5: { titel: "5J", ttl: 24 * STD, spanne: 5 * 365 * 86_400_000, cc: ["histoday", 262, 7, 604_800], cb: null, cg: null, alt: "5y" },
  max:    { titel: "Max", ttl: 24 * STD, spanne: null,            cc: ["histoday", 2000, 7, 604_800], cb: null,                cg: null, alt: "10y" },
});

function cacheLies(name) {
  const o = lies(reiheSchluessel(name));
  if (!o || !Array.isArray(o.punkte) || !zahlOk(o.zeit)) return null;
  const punkte = o.punkte.filter((p) => Array.isArray(p) && zahlOk(p[0]) && kursOk(p[1])).map(([t, c]) => ({ t, c }));
  return punkte.length ? { zeit: o.zeit, punkte } : null;
}

function cacheSchreibe(name, punkte) {
  schreibe(reiheSchluessel(name), { zeit: Date.now(), punkte: punkte.map((p) => [p.t, Math.round(p.c * 100) / 100]) });
}

/**
 * Eine Kursreihe holen. Ergebnis: { punkte, zeit, veraltet, quelle }.
 * Frisch aus dem Zwischenspeicher, sonst aus dem Netz, sonst veraltet.
 */
export async function holeReihe(name, { erzwingen = false } = {}) {
  const def = REIHEN[name];
  const gemerkt = cacheLies(name);
  if (gemerkt && !erzwingen && Date.now() - gemerkt.zeit < def.ttl) return { ...gemerkt, veraltet: false, quelle: "Zwischenspeicher" };
  try {
    const r = await ersteGueltige([
      ["CryptoCompare", async () => {
        const [art, limit, agg, sek] = def.cc;
        return { punkte: ccKerzen(await holeJson(`${CC}/v2/${art}?fsym=BTC&tsym=EUR&limit=${limit}${agg > 1 ? `&aggregate=${agg}` : ""}`), sek) };
      }],
      ["Coinbase", async () => {
        if (!def.cb) return null;
        const [gran, sek] = def.cb;
        const bis = new Date().toISOString();
        const von = new Date(Date.now() - sek * 1000).toISOString();
        return { punkte: cbKerzen(await holeJson(`${CB}/candles?granularity=${gran}&start=${von}&end=${bis}`), gran) };
      }],
      ["CoinGecko", async () => {
        if (!def.cg) return null;
        return { punkte: cgPunkte(await holeJson(`${CG}/coins/bitcoin/market_chart?vs_currency=eur&days=${def.cg}`)) };
      }],
    ]);
    const punkte = aufraeumen(r.punkte);
    cacheSchreibe(name, punkte);
    return { punkte, zeit: Date.now(), veraltet: false, quelle: r.quelle };
  } catch (e) {
    if (gemerkt) return { ...gemerkt, veraltet: true, quelle: "Zwischenspeicher" };
    const alt = cacheLies("alt_" + def.alt);
    if (alt) return { ...alt, veraltet: true, quelle: "alte App" };
    throw e;
  }
}

/**
 * Tagesschlusskurse seit einem Datum (für "Gesamt", Schwankung, Rückgang).
 * Gespeichert als { "JJJJ-MM-TT" (UTC-Tag): Schlusskurs } – dasselbe Format wie die alte App.
 */
export async function holeTagesreihe(seitTs, { erzwingen = false } = {}) {
  const gemerkt = lies(SCHLUESSEL.tageskurse, {}) || {};
  const kurse = { ...(gemerkt.kurse ?? {}) };
  const tage = Math.min(2000, Math.max(2, Math.ceil((Date.now() - seitTs) / 86_400_000) + 3));
  let veraltet = false; let quelle = "Zwischenspeicher";
  if (erzwingen || !zahlOk(gemerkt.zeit) || Date.now() - gemerkt.zeit > 3 * STD) {
    try {
      const r = await ersteGueltige([
        ["CryptoCompare", async () => {
          const j = await holeJson(`${CC}/v2/histoday?fsym=BTC&tsym=EUR&limit=${tage}`);
          if (j?.Response !== "Success") return null;
          const o = {};
          for (const d of j.Data.Data) if (zahlOk(d.time) && kursOk(d.close)) o[utcTag(d.time * 1000)] = d.close;
          return Object.keys(o).length ? { o } : null;
        }],
        ["CoinGecko", async () => {
          const p = cgPunkte(await holeJson(`${CG}/coins/bitcoin/market_chart?vs_currency=eur&days=${Math.min(tage, 365)}&interval=daily`));
          const o = {};
          for (const x of p) o[utcTag(x.t - 1)] = x.c;   // Tageswert um 00:00 UTC = Schluss des Vortags
          return Object.keys(o).length ? { o } : null;
        }],
      ]);
      Object.assign(kurse, r.o);
      quelle = r.quelle;
      schreibe(SCHLUESSEL.tageskurse, { zeit: Date.now(), kurse });
    } catch {
      veraltet = true;
    }
  }
  const jetzt = Date.now();
  const punkte = Object.entries(kurse)
    .filter(([tag, c]) => /^\d{4}-\d{2}-\d{2}$/.test(tag) && kursOk(c))
    .map(([tag, c]) => {
      const { jahr, monat, tag: t } = zerlege(tag);
      return { t: Math.min(jetzt, Date.UTC(jahr, monat - 1, t) + 86_400_000), c };
    })
    .filter((p) => p.t >= seitTs - 2 * 86_400_000)
    .sort((a, b) => a.t - b.t);
  return { punkte, veraltet, quelle, zeit: gemerkt.zeit ?? 0 };
}

// ---------------------------------------------------------------------
// Marktumfeld: Stimmung und Blockhöhe
// ---------------------------------------------------------------------

export async function holeStimmung() {
  const j = await holeJson("https://api.alternative.me/fng/?limit=1");
  const wert = Number.parseInt(j?.data?.[0]?.value, 10);
  if (!Number.isInteger(wert) || wert < 0 || wert > 100) throw new Error("Stimmung: ungültig");
  return { wert, zeit: Date.now() };
}

export async function holeBlockhoehe() {
  const h = await holeJson("https://mempool.space/api/blocks/tip/height");
  if (!Number.isInteger(h) || h < 800_000 || h > 10_000_000) throw new Error("Blockhöhe: ungültig");
  return { hoehe: h, zeit: Date.now() };
}

/**
 * Blockhöhe zu einem Zeitpunkt (z. B. dein erster Kauf). Ändert sich nie –
 * wird deshalb dauerhaft gemerkt.
 */
export async function holeBlockZurZeit(ts) {
  const gemerkt = ladeMarkt().bloecke ?? {};
  const schl = String(Math.floor(ts / 1000));
  if (Number.isInteger(gemerkt[schl])) return gemerkt[schl];
  const j = await holeJson(`https://mempool.space/api/v1/mining/blocks/timestamp/${schl}`);
  const h = j?.height;
  if (!Number.isInteger(h) || h < 800_000 || h > 10_000_000) throw new Error("Blockhöhe: ungültig");
  speichereMarkt({ bloecke: { ...gemerkt, [schl]: h } });
  return h;
}

export function ladeMarkt() {
  const m = lies(SCHLUESSEL.markt, {});
  return m && typeof m === "object" ? m : {};
}

export function speichereMarkt(teil) {
  schreibe(SCHLUESSEL.markt, { ...ladeMarkt(), ...teil });
}
