// =====================================================================
// pruefung.mjs – Browser-Prüfung (nur für Entwickler, braucht Playwright).
//
// Startet alte und neue App unter DERSELBEN Adresse (wie auf GitHub Pages),
// mit nachgebauten Kursquellen und festen Uhrzeiten. Prüft:
//   * die alte App wird nie beschrieben (btcdca_… bleibt Byte für Byte gleich)
//   * keine Fehler, keine Verstöße gegen die Sicherheitsrichtlinie
//   * Zahlen, Screenshots (390 × 844 und 360 × 780), Offline-Start
//
// Aufruf: node tests/browser/pruefung.mjs <ausgabeordner>
// =====================================================================

import http from "node:http";
import { readFile } from "node:fs/promises";
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
import { erzeugeVerlauf, kurs, antwort } from "./attrappe.mjs";
import { berlinZeitpunkt } from "../../js/zeit.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const WURZEL = new URL("../../", import.meta.url).pathname;
const AUS = process.argv[2] ?? "pruefung-ausgabe";
mkdirSync(AUS, { recursive: true });

const ALTE_APP = execFileSync("git", ["-C", WURZEL, "show", "07912df:index.html"]);
const TYPEN = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

// ---- Kleiner Webserver: /btc-dca3/ = neue App, /btc-dca2/ = alte App ----
const server = http.createServer(async (req, res) => {
  const pfad = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (pfad === "/btc-dca2/" || pfad === "/btc-dca2/index.html") { res.writeHead(200, { "content-type": TYPEN[".html"] }); res.end(ALTE_APP); return; }
  if (pfad.startsWith("/btc-dca3/")) {
    let datei = pfad.slice("/btc-dca3/".length) || "index.html";
    if (datei.includes("..")) { res.writeHead(400); res.end(); return; }
    try {
      const inhalt = await readFile(join(WURZEL, datei));
      res.writeHead(200, { "content-type": TYPEN[extname(datei)] ?? "application/octet-stream" });
      res.end(inhalt);
    } catch { res.writeHead(404); res.end("nicht gefunden"); }
    return;
  }
  res.writeHead(404); res.end("leer");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASIS = `http://localhost:${server.address().port}`;

// ---- Kursverlauf und Testdaten der "alten App" ----
const ENDE = Date.UTC(2026, 10, 4) / 1000;
const v = erzeugeVerlauf({ ende: ENDE });
const montage = []; for (let d = Date.UTC(2026, 5, 8); d <= Date.UTC(2026, 10, 2); d += 7 * 86400e3) montage.push(new Date(d).toISOString().slice(0, 10));
const phase = (m) => (m <= "2026-06-29" ? { h: 8, min: 40, fee: 0.004 } : { h: 20, min: 50, fee: 0.0025 });
const kaufTs = (m) => berlinZeitpunkt(m, phase(m).h, phase(m).min);

// Eingetragene Käufe wie in der alten App: Binance mit Menge+Kurs, Bitvavo meist nur Menge.
// Zwei Wochen absichtlich ohne Eintrag (geschätzt), dazu die letzten beiden (26.10. und 2.11.).
const overrides = {};
for (const m of montage) {
  if (["2026-08-17", "2026-09-28", "2026-10-26", "2026-11-02"].includes(m)) continue;
  const markt = kurs(v, kaufTs(m) / 1000) * 1.0015;                 // Bitvavo-Spread
  const btc = Math.round(((15 * (1 - phase(m).fee)) / markt) * 1e8) / 1e8;
  overrides[m] = m <= "2026-06-29" ? { btc, price: Math.round(markt * 100) / 100 } : { btc };
}
const altSpeicher = {
  btcdca_overrides_v1: JSON.stringify(overrides),
  // Fehler 2 der alten App: Kurs für den 26.10. vor der Kaufzeit gemerkt (15:12 statt 20:50)
  btcdca_monday_prices_v4: JSON.stringify({ "2026-10-19": kurs(v, kaufTs("2026-10-19") / 1000), "2026-10-26": kurs(v, Date.UTC(2026, 9, 26, 14, 12) / 1000) }),
  btcdca_daily_closes_v2: JSON.stringify({ "2026-10-01": 60000 }),
  btcdca_celebrated: JSON.stringify(["s50000", "s100000", "s200000", "w4", "w8", "w12"]),
  btcdca_lastquote: "5",
  btcdca_pc_1m: JSON.stringify({ ts: 1, data: [{ t: Date.UTC(2026, 9, 1), c: 60000 }, { t: Date.UTC(2026, 9, 2), c: 60100 }] }),
};
writeFileSync(join(AUS, "testdaten.json"), JSON.stringify({ start: v.start, punkte: Array.from(v.p), overrides, altSpeicher }));

const ergebnis = { fehler: [], szenarien: {} };
const browser = await chromium.launch();

const netz = { offline: false };
async function kontext({ jetztMs, breite = 390, hoehe = 844, ausfall = [] }) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "de-DE", timezoneId: "Europe/Berlin", serviceWorkers: "allow" });
  await ctx.route(/^https:\/\/(min-api\.cryptocompare\.com|api\.exchange\.coinbase\.com|api\.coingecko\.com|api\.alternative\.me|mempool\.space)\//, (route) => {
    if (netz.offline) return route.abort("internetdisconnected");
    const a = antwort(v, jetztMs, route.request().url(), { ausfall });
    if (!a) return route.abort();
    return route.fulfill({ status: a[0], contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(a[1]) });
  });
  // Die alte App lädt Chart.js vom CDN – hier aus dem Repository
  await ctx.route(/^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com)\//, async (route) => {
    if (route.request().url().includes("chart.umd")) return route.fulfill({ contentType: "text/javascript", body: await readFile(join(WURZEL, "vendor/chart-4.4.3.umd.min.js")) });
    return route.fulfill({ contentType: "text/javascript", body: "" });
  });
  return ctx;
}

async function seite(ctx, jetztMs, name) {
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date(jetztMs));
  p.on("console", (m) => { if (m.type() === "error" || /Content Security Policy|TrustedHTML|Trusted Type/i.test(m.text())) ergebnis.fehler.push(`${name}: ${m.text()}`); });
  p.on("pageerror", (e) => ergebnis.fehler.push(`${name}: ${e.message}`));
  return p;
}

const speicherBild = (p) => p.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
const nurAlt = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => k.startsWith("btcdca_overrides") || k.startsWith("btcdca_celebrated") || k.startsWith("btcdca_lastquote")));

async function neueApp(p, schuss) {
  await p.goto(`${BASIS}/btc-dca3/`);
  await p.waitForFunction(() => document.documentElement.dataset.bereit === "1");
  await p.waitForFunction(() => /Live/.test(document.querySelector("#kopf-status")?.textContent ?? ""), null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1600);
  if (schuss) await p.screenshot({ path: join(AUS, `${schuss}.png`) });
}

const lesen = (p) => p.evaluate(() => {
  const t = (s) => document.querySelector(s)?.textContent.replace(/\s+/g, " ").trim() ?? null;
  const kacheln = [...document.querySelectorAll("#seite-depot .kennzahl")].map((k) => k.textContent.replace(/\s+/g, " ").trim());
  return { wert: t("#seite-depot .held-zahl"), zeile: t("#seite-depot .held-zeile"), kacheln, hinweise: t("#seite-depot .hinweise"), status: t("#kopf-status") };
});

// ---------------------------------------------------------------------
// Szenario 1: neue App, Montag 2.11. um 20:47 (vor dem Bitvavo-Kauf)
// ---------------------------------------------------------------------
for (const [name, jetztMs] of [["2047", Date.UTC(2026, 10, 2, 19, 47)], ["2100", Date.UTC(2026, 10, 2, 20, 0)]]) {
  const ctx = await kontext({ jetztMs });
  const p = await seite(ctx, jetztMs, `neu-${name}`);
  await p.goto(`${BASIS}/btc-dca3/leer`);
  await p.evaluate((d) => { for (const [k, w] of Object.entries(d)) localStorage.setItem(k, w); }, altSpeicher);
  const vorher = await speicherBild(p);
  await neueApp(p, `neu-${name}-depot`);
  const zahlen = await lesen(p);
  // Zeiträume
  zahlen.zeitraeume = {};
  for (const zr of ["Woche", "Monat", "Jahr", "Gesamt"]) {
    await p.locator(".zeitraum .segment-option", { hasText: zr }).click();
    await p.waitForTimeout(250);
    zahlen.zeitraeume[zr] = await p.evaluate(() => document.querySelector("#seite-depot .held-zeile").textContent.replace(/\s+/g, " ").trim());
  }
  const nachher = await speicherBild(p);
  const altUnveraendert = Object.keys(altSpeicher).every((k) => nachher[k] === vorher[k]);
  zahlen.altUnveraendert = altUnveraendert;
  zahlen.eigeneSchluessel = Object.keys(nachher).filter((k) => !k.startsWith("btcdca_"));
  zahlen.fremdeNeueSchluessel = Object.keys(nachher).filter((k) => !(k in vorher) && !k.startsWith("dca3_"));
  ergebnis.szenarien[`neu-${name}`] = zahlen;

  if (name === "2100") {
    // Weitere Seiten und Dialoge fotografieren
    await p.locator("#tab-kaeufe").click(); await p.waitForTimeout(900); await p.screenshot({ path: join(AUS, "neu-kaeufe.png") });
    await p.locator("#tab-analyse").click(); await p.waitForTimeout(1600); await p.screenshot({ path: join(AUS, "neu-analyse.png") });
    ergebnis.szenarien["neu-2100"].kursverlauf = await p.evaluate(() => document.querySelector("#seite-analyse .kurs-kopf")?.textContent.replace(/\s+/g, " ").trim());
    await p.locator("#seite-analyse").evaluate((s) => s.scrollTo(0, 99999)); await p.waitForTimeout(500); await p.screenshot({ path: join(AUS, "neu-analyse-unten.png") });
    await p.locator("#tab-weg").click(); await p.waitForTimeout(900); await p.screenshot({ path: join(AUS, "neu-weg.png") });
    await p.locator("#seite-weg").evaluate((s) => s.scrollTo(0, 99999)); await p.waitForTimeout(500); await p.screenshot({ path: join(AUS, "neu-weg-unten.png") });
    await p.locator("#tab-depot").click(); await p.waitForTimeout(700);
    await p.locator("#seite-depot").evaluate((s) => s.scrollTo(0, 99999)); await p.waitForTimeout(500); await p.screenshot({ path: join(AUS, "neu-depot-unten.png") });
    await p.locator("#seite-depot").evaluate((s) => s.scrollTo(0, 0));
    // Ansicht "Wochen"
    await p.locator(".diagramm-kopf .segment-option", { hasText: "Wochen" }).click(); await p.waitForTimeout(1200); await p.screenshot({ path: join(AUS, "neu-depot-wochen.png") });
    // Scrubbing: Finger übers Diagramm
    await p.locator(".diagramm-kopf .segment-option", { hasText: "Wert" }).click(); await p.waitForTimeout(1200);
    const box = await p.locator("#seite-depot .diagramm-canvas").first().boundingBox();
    await p.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2); await p.waitForTimeout(200);
    await p.screenshot({ path: join(AUS, "neu-depot-scrubbing.png") });
    ergebnis.szenarien["neu-2100"].scrub = await p.evaluate(() => document.querySelector("#seite-depot .held").textContent.replace(/\s+/g, " ").trim());
    await p.mouse.move(5, 5);
    // Eintragen-Dialog für den geschätzten 26.10.
    await p.locator("#tab-kaeufe").click(); await p.waitForTimeout(700);
    await p.locator(".kauf-zeile").filter({ hasText: "geschätzt" }).nth(1).click(); await p.waitForTimeout(900);
    await p.locator("#ein-btc").fill("24512"); await p.waitForTimeout(200);
    await p.screenshot({ path: join(AUS, "neu-eintragen-fehler.png") });
    await p.locator("#ein-btc").fill("0,00024512"); await p.waitForTimeout(300);
    await p.screenshot({ path: join(AUS, "neu-eintragen.png") });
    await p.locator(".sheet-fuss .knopf--primaer").click(); await p.waitForTimeout(900);
    await p.screenshot({ path: join(AUS, "neu-nach-speichern.png") });
    ergebnis.szenarien["neu-2100"].nachEintrag = await p.evaluate(() => JSON.parse(localStorage.getItem("dca3_eintraege"))["2026-10-26"]);
    ergebnis.szenarien["neu-2100"].altNachEintrag = await p.evaluate(() => localStorage.getItem("btcdca_overrides_v1"));
    // Einstellungen
    await p.locator("#knopf-einstellungen").click(); await p.waitForTimeout(900); await p.screenshot({ path: join(AUS, "neu-einstellungen.png") });
    await p.keyboard.press("Escape"); await p.waitForTimeout(500);
    // Rechenweg-Detail
    await p.locator("#tab-depot").click(); await p.waitForTimeout(600);
    await p.locator("#seite-depot .kennzahl").first().click(); await p.waitForTimeout(900); await p.screenshot({ path: join(AUS, "neu-rechenweg.png") });
    await p.keyboard.press("Escape"); await p.waitForTimeout(600);

    // Offline: Netz kappen und neu laden → muss starten und den letzten Stand zeigen
    await ctx.setOffline(true); netz.offline = true;
    await p.reload(); await p.waitForFunction(() => document.documentElement.dataset.bereit === "1", null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(2500);
    await p.screenshot({ path: join(AUS, "neu-offline.png") });
    ergebnis.szenarien.offline = await lesen(p);
    await ctx.setOffline(false); netz.offline = false;

    // Alte App danach öffnen: muss unverändert laufen und dieselben Einträge sehen
    const alt = await seite(ctx, jetztMs, "alt-nach-neu");
    await alt.goto(`${BASIS}/btc-dca2/`); await alt.waitForTimeout(3500);
    await alt.screenshot({ path: join(AUS, "alt-nach-neu.png") });
    ergebnis.szenarien["alt-nach-neu"] = await alt.evaluate(() => ({ investiert: document.querySelector("#kInvested")?.textContent, btc: document.querySelector("#kBtc")?.textContent, overrides: localStorage.getItem("btcdca_overrides_v1") }));
  }
  await ctx.close();
}

// ---------------------------------------------------------------------
// Szenario 2: alte App mit denselben Daten (zum Vergleich)
// ---------------------------------------------------------------------
for (const [name, jetztMs] of [["2047", Date.UTC(2026, 10, 2, 19, 47)], ["2100", Date.UTC(2026, 10, 2, 20, 0)]]) {
  const ctx = await kontext({ jetztMs });
  const p = await seite(ctx, jetztMs, `alt-${name}`);
  await p.goto(`${BASIS}/btc-dca2/leer`);
  await p.evaluate((d) => { for (const [k, w] of Object.entries(d)) localStorage.setItem(k, w); }, altSpeicher);
  await p.goto(`${BASIS}/btc-dca2/`); await p.waitForTimeout(3500);
  await p.screenshot({ path: join(AUS, `alt-${name}.png`) });
  ergebnis.szenarien[`alt-${name}`] = await p.evaluate(() => Object.fromEntries(["kInvested", "kValue", "kBtc", "kAvg", "kNow", "kPnl", "kPnlPct"].map((id) => [id, document.getElementById(id)?.textContent])));
  ergebnis.szenarien[`alt-${name}`].montagskurse = await p.evaluate(() => localStorage.getItem("btcdca_monday_prices_v4"));
  await ctx.close();
}

// ---------------------------------------------------------------------
// Szenario 3: schmales Gerät (360 × 780) und Ausfall der Hauptquelle
// ---------------------------------------------------------------------
{
  const jetztMs = Date.UTC(2026, 10, 2, 20, 0);
  const ctx = await kontext({ jetztMs, breite: 360, hoehe: 780, ausfall: ["min-api.cryptocompare.com"] });
  const p = await seite(ctx, jetztMs, "schmal");
  await p.goto(`${BASIS}/btc-dca3/leer`);
  await p.evaluate((d) => { for (const [k, w] of Object.entries(d)) localStorage.setItem(k, w); }, altSpeicher);
  await neueApp(p, "schmal-depot");
  ergebnis.szenarien.schmal = await lesen(p);
  ergebnis.szenarien.schmal.horizontalScroll = await p.evaluate(() => [...document.querySelectorAll(".seite")].map((s) => s.scrollWidth > s.clientWidth + 1));
  ergebnis.szenarien.schmal.ueberlauf = await p.evaluate(() => [...document.querySelectorAll(".seite-inhalt *")].filter((e) => { const r = e.getBoundingClientRect(); const s = e.closest(".seite").getBoundingClientRect(); return r.width > 0 && (r.right > s.right + 1 || r.left < s.left - 1) && !e.closest(".diagramm-flaeche, .held-aurora, .tranchen"); }).slice(0, 10).map((e) => e.className || e.tagName));
  await p.locator("#tab-kaeufe").click(); await p.waitForTimeout(800); await p.screenshot({ path: join(AUS, "schmal-kaeufe.png") });
  await p.locator("#tab-weg").click(); await p.waitForTimeout(800); await p.screenshot({ path: join(AUS, "schmal-weg.png") });
  await ctx.close();
}

// ---------------------------------------------------------------------
// Szenario 4: Gesten – Wischen zwischen Seiten, Ziehen zum Aktualisieren,
// Sheet wegwischen, Zurück-Taste, Scrubbing mit dem Finger
// ---------------------------------------------------------------------
{
  const jetztMs = Date.UTC(2026, 10, 2, 20, 0);
  const ctx = await kontext({ jetztMs });
  const p = await seite(ctx, jetztMs, "gesten");
  await p.goto(`${BASIS}/btc-dca3/leer`);
  await p.evaluate((d) => { for (const [k, w] of Object.entries(d)) localStorage.setItem(k, w); }, altSpeicher);
  await neueApp(p, null);
  const cdp = await ctx.newCDPSession(p);
  const finger = async (punkte, pause = 16) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: punkte[0][0], y: punkte[0][1] }] });
    for (const [x, y] of punkte.slice(1)) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] }); await p.waitForTimeout(pause); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const linie = (x0, y0, x1, y1, n = 14) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  const g = {};
  // Ziehen zum Aktualisieren (oben auf der Depot-Seite)
  const ptr = p.waitForFunction(() => document.querySelector(".ptr")?.classList.contains("laedt"), null, { timeout: 4000 }).then(() => true).catch(() => false);
  await finger(linie(200, 200, 200, 420, 18), 20);
  g.ziehenZumAktualisieren = await ptr;
  await p.waitForTimeout(1500);
  // Scrubbing mit dem Finger
  const box = await p.locator("#seite-depot .diagramm-canvas:not([hidden])").boundingBox();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 60, y: box.y + box.height / 2 }] });
  for (let i = 1; i <= 8; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + 60 + i * 20, y: box.y + box.height / 2 }] }); await p.waitForTimeout(16); }
  g.scrubLabel = await p.evaluate(() => document.querySelector("#seite-depot .held-label").textContent);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await p.waitForTimeout(1000);
  g.nachScrubLabel = await p.evaluate(() => document.querySelector("#seite-depot .held-label").textContent);
  // Wischen zur nächsten Seite (unterhalb des Diagramms)
  await finger(linie(330, 640, 40, 650, 10), 16);
  await p.waitForTimeout(900);
  g.nachWischen = await p.evaluate(() => document.querySelector(".tab.ist-aktiv .tab-text")?.textContent);
  // Sheet öffnen und am Griff wegwischen
  await p.locator("#knopf-einstellungen").click(); await p.waitForTimeout(800);
  const griff = await p.locator(".sheet-griffzone").boundingBox();
  await finger(linie(griff.x + griff.width / 2, griff.y + 10, griff.x + griff.width / 2, griff.y + 380, 12), 16);
  await p.waitForTimeout(800);
  g.sheetNachWischen = await p.locator(".sheet-ebene").count();
  // Zurück-Taste (Android) schließt ein Sheet
  await p.locator("#knopf-einstellungen").click(); await p.waitForTimeout(800);
  await p.goBack().catch(() => {}); await p.waitForTimeout(800);
  g.sheetNachZurueck = await p.locator(".sheet-ebene").count();
  g.nochInDerApp = p.url().includes("/btc-dca3/");
  ergebnis.szenarien.gesten = g;
  await ctx.close();
}

await browser.close();
server.close();
writeFileSync(join(AUS, "ergebnis.json"), JSON.stringify(ergebnis, null, 2));
console.log(JSON.stringify({ fehler: ergebnis.fehler.slice(0, 30), szenarien: Object.keys(ergebnis.szenarien) }, null, 2));
