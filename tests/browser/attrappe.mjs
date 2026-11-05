// =====================================================================
// attrappe.mjs – Nachgebaute Kursquellen für Browser-Tests (nur Entwickler).
// Erzeugt einen festen, wiederholbaren Kursverlauf und beantwortet damit
// alle Abfragen der App, als wären es CryptoCompare, Coinbase usw.
// =====================================================================

const STUNDE = 3600;
const AUG = Date.UTC(2026, 7, 1) / 1000;       // 1. August 2026
const SEP_ENDE = Date.UTC(2026, 8, 20) / 1000; // 20. September 2026

/** Fester Kursverlauf: Stundenpunkte p[k] zum Zeitpunkt START + k·3600 s. */
export function erzeugeVerlauf({ start = Date.UTC(2021, 0, 1) / 1000, ende }) {
  let s = 20260608;
  const zufall = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const n = Math.ceil((ende - start) / STUNDE) + 48;
  const p = new Float64Array(n);
  let x = Math.log(28_000);
  for (let k = 0; k < n; k++) {
    const t = start + k * STUNDE;
    const tage = (t - start) / 86400;
    // langfristiger Anstieg + Zyklen + Rauschen; Sommer 2026: Rückgang im August, Erholung im September
    const ziel = Math.log(28_000) + 0.00045 * tage + 0.18 * Math.sin(tage / 210) +
      (t > AUG && t < SEP_ENDE ? -0.16 * Math.sin(Math.PI * (t - AUG) / (SEP_ENDE - AUG)) : 0);
    x += (ziel - x) * 0.004 + (zufall() - 0.5) * 0.009;
    p[k] = Math.round(Math.exp(x) * 100) / 100;
  }
  return { start, p };
}

/** Kurs zu beliebigem Zeitpunkt (Sekunden): linear zwischen den Stundenpunkten. */
export function kurs(v, t) {
  const k = Math.floor((t - v.start) / STUNDE);
  const a = v.p[k]; const b = v.p[k + 1];
  return a + ((b - a) * (t - v.start - k * STUNDE)) / STUNDE;
}

const runde = (x) => Math.round(x * 100) / 100;

function kerzen(v, jetzt, sekunden, limit, toTs) {
  const ende = Math.min(toTs ?? jetzt, jetzt);
  const letzte = Math.floor(ende / sekunden) * sekunden;
  const aus = [];
  for (let i = limit; i >= 0; i--) {
    const t = letzte - i * sekunden;
    const offen = kurs(v, t);
    const schluss = kurs(v, Math.min(t + sekunden, jetzt));
    aus.push({ time: t, open: runde(offen), close: runde(schluss), high: runde(Math.max(offen, schluss) * 1.002), low: runde(Math.min(offen, schluss) * 0.998) });
  }
  return aus;
}

/** Beantwortet eine Anfrage. Gibt [status, body] zurück oder null (nicht zuständig). */
export function antwort(v, jetztMs, adresse, { ausfall = [] } = {}) {
  const u = new URL(adresse);
  const jetzt = Math.floor(jetztMs / 1000);
  const q = (k) => u.searchParams.get(k);
  if (ausfall.includes(u.hostname)) return [503, { fehler: "ausgefallen" }];

  if (u.hostname === "min-api.cryptocompare.com") {
    const c = kurs(v, jetzt);
    if (u.pathname === "/data/pricemultifull") {
      const vor = kurs(v, jetzt - 86400);
      return [200, { RAW: { BTC: { EUR: { PRICE: runde(c), CHANGEPCT24HOUR: (c / vor - 1) * 100, HIGH24HOUR: runde(Math.max(c, vor) * 1.01), LOW24HOUR: runde(Math.min(c, vor) * 0.99), LASTUPDATE: jetzt, MKTCAP: c * 19_962_000, CIRCULATINGSUPPLY: 19_962_000, TOTALVOLUME24HTO: c * 412_000 } } } }];
    }
    if (u.pathname === "/data/v2/news/") {
      const titel = ["Bitcoin holds steady as long-term holders keep accumulating", "Miners prepare for the next difficulty adjustment", "Spot ETF inflows continue for a third week", "Lightning Network capacity reaches a new high", "Analysts: volatility at multi-month low", "Exchange reserves fall to lowest level since 2018"];
      return [200, { Type: 100, Data: titel.map((t, i) => ({ id: String(i), title: t, url: `https://example.org/news/${i}`, published_on: jetzt - (i + 1) * 5400, source: "beispiel", source_info: { name: ["CoinDesk", "Decrypt", "The Block", "Bitcoin Magazine", "Cointelegraph", "CryptoSlate"][i] } })) }];
    }
    if (u.pathname === "/data/price") return [200, { EUR: runde(c) }];
    const m = u.pathname.match(/^\/data\/v2\/histo(minute|hour|day)$/);
    if (m) {
      const basis = { minute: 60, hour: 3600, day: 86400 }[m[1]];
      const agg = Number(q("aggregate") ?? 1);
      const toTs = q("toTs") ? Number(q("toTs")) : null;
      if (m[1] === "minute" && toTs && jetzt - toTs > 7 * 86400) return [200, { Response: "Error", Message: "nur 7 Tage" }];
      return [200, { Response: "Success", Data: { Data: kerzen(v, jetzt, basis * agg, Number(q("limit")), toTs) } }];
    }
  }

  if (u.hostname === "api.exchange.coinbase.com") {
    if (u.pathname.endsWith("/ticker")) return [200, { price: runde(kurs(v, jetzt)).toFixed(2), time: new Date(jetztMs).toISOString() }];
    if (u.pathname.endsWith("/stats")) { const o = kurs(v, jetzt - 86400); return [200, { open: o.toFixed(2), high: (o * 1.02).toFixed(2), low: (o * 0.98).toFixed(2), last: kurs(v, jetzt).toFixed(2) }]; }
    if (u.pathname.endsWith("/candles")) {
      const g = Number(q("granularity"));
      const von = Math.floor(Date.parse(q("start")) / 1000); const bis = Math.floor(Date.parse(q("end")) / 1000);
      const anzahl = Math.min(300, Math.floor((bis - von) / g));
      return [200, kerzen(v, jetzt, g, anzahl, bis).filter((k) => k.time >= von).reverse().map((k) => [k.time, k.low, k.high, k.open, k.close, 1.5])];
    }
  }

  if (u.hostname === "api.coingecko.com") return [429, { status: { error_code: 429, error_message: "Rate limit" } }];
  if (u.hostname === "api.alternative.me") return [200, { data: [38, 41, 45, 52, 49, 55, 61, 58].map((w, i) => ({ value: String(w), value_classification: "Fear", timestamp: String(jetzt - i * 86400) })) }];
  if (u.hostname === "mempool.space") {
    const m = u.pathname.match(/\/api\/v1\/mining\/blocks\/timestamp\/(\d+)/);
    if (m) return [200, { height: 973412 - Math.round((jetzt - Number(m[1])) / 600), hash: "0".repeat(64), timestamp: Number(m[1]) }];
    return [200, 973412];
  }
  return null;
}
