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
const CHART_ALT = execFileSync("git", ["-C", WURZEL, "show", "445e49f:vendor/chart-4.4.3.umd.min.js"]);
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
    // Die ALTE App lädt Chart.js von einem CDN – hier aus der Git-Geschichte ausgeliefert
    if (route.request().url().includes("chart.umd")) return route.fulfill({ contentType: "text/javascript", body: CHART_ALT });
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

async function neueApp(p, schuss) {
  await p.goto(`${BASIS}/btc-dca3/`);
  await p.waitForFunction(() => document.documentElement.dataset.bereit === "1");
  // Warten, bis der Status "Live" zeigt (eine Übernahme-Meldung steht vorher ein paar Sekunden dort)
  await p.waitForFunction(() => /Live/.test(document.querySelector("#status")?.getAttribute("aria-label") ?? ""), null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1800);
  // … und erneut, falls inzwischen eine Meldung in der Statuszeile steht
  await p.waitForFunction(() => /Live/.test(document.querySelector("#status")?.getAttribute("aria-label") ?? ""), null, { timeout: 12000 }).catch(() => {});
  if (schuss) await p.screenshot({ path: join(AUS, `${schuss}.png`) });
}

/** Werte lesen. Zählwerke tragen ihren Text als aria-label (die Walzen enthalten alle Ziffern). */
const lesen = (p) => p.evaluate(() => {
  const text = (el) => el?.textContent.replace(/\s+/g, " ").trim() ?? null;
  const zahlen = [...document.querySelectorAll(".stapel .fkopf--zahlen .zk-wert")].map((e) => e.getAttribute("aria-label"));
  return {
    wert: document.querySelector(".held-zahl")?.getAttribute("aria-label"),
    zeile: text(document.querySelector(".held-zeile")),
    zahlen: { investiert: zahlen[0], sats: zahlen[1], durchschnitt: zahlen[2], wochen: zahlen[3] },
    fuss: text(document.querySelector(".fuss")),
    kaeufe: text(document.querySelector(".stapel .fkopf--kaeufe")),
    status: document.querySelector("#status")?.getAttribute("aria-label"),
  };
});
const schliessen = async (p) => { await p.keyboard.press("Escape"); await p.waitForTimeout(900); };
const kachel = (p, i) => p.locator(".stapel .kachel").nth(i);
const zeigeKachel = async (p, i) => { await kachel(p, i).scrollIntoViewIfNeeded(); await p.waitForTimeout(300); };

// ---------------------------------------------------------------------
// Szenario 1: neue App, Montag 2.11. um 20:47 (vor dem Bitvavo-Kauf) und 21:00
// ---------------------------------------------------------------------
for (const [name, jetztMs] of [["2047", Date.UTC(2026, 10, 2, 19, 47)], ["2100", Date.UTC(2026, 10, 2, 20, 0)]]) {
  const ctx = await kontext({ jetztMs });
  const p = await seite(ctx, jetztMs, `neu-${name}`);
  await p.goto(`${BASIS}/btc-dca3/leer`);
  await p.evaluate((d) => { for (const [k, w] of Object.entries(d)) localStorage.setItem(k, w); }, altSpeicher);
  const vorher = await speicherBild(p);
  await neueApp(p, `neu-${name}-heute`);
  const zahlen = await lesen(p);
  zahlen.zeitraeume = {};
  for (const [zr, knopf] of [["Woche", "Woche"], ["Monat", "Monat"], ["Jahr", "Jahr"], ["Gesamt", "Alles"]]) {
    await p.locator(".zeitraum-wahl", { hasText: knopf }).click();
    await p.waitForTimeout(350);
    zahlen.zeitraeume[zr] = await p.evaluate(() => document.querySelector(".held-zeile").textContent.replace(/\s+/g, " ").trim());
    if (zr === "Monat") { await p.waitForTimeout(900); await p.screenshot({ path: join(AUS, `neu-${name}-monat.png`) }); }
  }
  await p.waitForTimeout(900);
  const nachher = await speicherBild(p);
  zahlen.altUnveraendert = Object.keys(altSpeicher).every((k) => nachher[k] === vorher[k]);
  zahlen.eigeneSchluessel = Object.keys(nachher).filter((k) => !k.startsWith("btcdca_"));
  zahlen.fremdeNeueSchluessel = Object.keys(nachher).filter((k) => !(k in vorher) && !k.startsWith("dca3_"));
  ergebnis.szenarien[`neu-${name}`] = zahlen;

  if (name === "2100") {
    const cdp = await ctx.newCDPSession(p);
    const z = ergebnis.szenarien["neu-2100"];
    // Zeitreise: Finger auf der Linie
    const box = await p.locator(".linie-leinwand").boundingBox();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + box.width * 0.8, y: box.y + box.height / 2 }] });
    for (let a = 0.78; a >= 0.5; a -= 0.02) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + box.width * a, y: box.y + box.height / 2 }] }); await p.waitForTimeout(20); }
    await p.waitForTimeout(500);
    await p.screenshot({ path: join(AUS, "neu-zeitreise.png") });
    z.zeitreise = await p.evaluate(() => ({ label: document.querySelector(".held-label").textContent, wert: document.querySelector(".held-zahl").getAttribute("aria-label"), kaeufe: document.querySelector(".stapel .fkopf--kaeufe .fkopf-unter").textContent }));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await p.waitForTimeout(1600);
    z.nachZeitreise = await p.evaluate(() => document.querySelector(".held-label").textContent);

    // Fenster: Käufe, Baum, Zahlen
    await zeigeKachel(p, 0); await kachel(p, 0).click(); await p.waitForTimeout(1300);
    await p.screenshot({ path: join(AUS, "neu-kaeufe.png") });
    // Eintragen aus einer Zeile heraus
    await p.locator(".fenster .kauf-zeile", { hasText: "geschätzt" }).nth(1).click(); await p.waitForTimeout(1200);
    await p.locator("#ein-btc").fill("24512"); await p.waitForTimeout(250);
    await p.screenshot({ path: join(AUS, "neu-eintragen-hilfe.png") });
    await p.locator("#ein-btc").fill("0,00024512"); await p.waitForTimeout(300);
    await p.screenshot({ path: join(AUS, "neu-eintragen.png") });
    await p.locator(".formular-fuss .knopf--glut").click(); await p.waitForTimeout(1800);
    await p.screenshot({ path: join(AUS, "neu-nach-speichern.png") });
    z.nachEintrag = await p.evaluate(() => JSON.parse(localStorage.getItem("dca3_eintraege"))["2026-10-26"]);
    z.altNachEintrag = await p.evaluate(() => localStorage.getItem("btcdca_overrides_v1"));
    z.zeileNachEintrag = await p.evaluate(() => document.querySelector('.fenster .kauf-zeile[data-montag="2026-10-26"]')?.textContent.replace(/\s+/g, " ").trim());
    await schliessen(p);
    await zeigeKachel(p, 1); await kachel(p, 1).click(); await p.waitForTimeout(1400);
    await p.screenshot({ path: join(AUS, "neu-baum.png") });
    await schliessen(p);
    await zeigeKachel(p, 2); await kachel(p, 2).click(); await p.waitForTimeout(1500);
    await p.screenshot({ path: join(AUS, "neu-zahlen.png") });
    for (const y of [700, 1400, 2100]) { await p.locator(".fenster-rolle").evaluate((s, yy) => s.scrollTo(0, yy), y); await p.waitForTimeout(500); await p.screenshot({ path: join(AUS, `neu-zahlen-${y}.png`) }); }
    z.zahlenFenster = await p.evaluate(() => [...document.querySelectorAll(".zahl-abschnitt")].map((a) => a.textContent.replace(/\s+/g, " ").trim().slice(0, 140)));
    await schliessen(p);
    // Rechenweg (Tablett) und Einstellungen
    await p.locator("#heute").evaluate((s) => s.scrollTo(0, 0)); await p.waitForTimeout(400);
    await p.locator(".held").click(); await p.waitForTimeout(1000);
    await p.screenshot({ path: join(AUS, "neu-rechenweg.png") });
    await schliessen(p);
    await p.locator("#knopf-einstellungen").click(); await p.waitForTimeout(1300);
    await p.screenshot({ path: join(AUS, "neu-einstellungen.png") });
    await schliessen(p);
    z.offeneEbenen = await p.locator(".fenster-ebene, .tablett-ebene").count();

    // Offline: Netz kappen und neu laden → muss starten und den letzten Stand zeigen
    await ctx.setOffline(true); netz.offline = true;
    await p.reload(); await p.waitForFunction(() => document.documentElement.dataset.bereit === "1", null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(3000);
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
  await neueApp(p, "schmal-heute");
  ergebnis.szenarien.schmal = await lesen(p);
  ergebnis.szenarien.schmal.horizontalScroll = await p.evaluate(() => { const h = document.querySelector("#heute"); return h.scrollWidth > h.clientWidth + 1; });
  const ueberlauf = () => p.evaluate(() => [...document.querySelectorAll("#heute-inhalt *, .fenster-inhalt *")].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && !e.closest(".linie, .kachel-buehne, .nebel, .fkopf--baum, .status");
  }).slice(0, 10).map((e) => `${e.className?.baseVal ?? e.className ?? e.tagName} ${Math.round(e.getBoundingClientRect().right)}`));
  ergebnis.szenarien.schmal.ueberlauf = await ueberlauf();
  await p.locator("#heute").evaluate((s) => s.scrollTo(0, 99999)); await p.waitForTimeout(500);
  await p.screenshot({ path: join(AUS, "schmal-unten.png") });
  await p.locator(".stapel .kachel").nth(0).click(); await p.waitForTimeout(1300);
  await p.locator(".fenster .kauf-zeile", { hasText: "geschätzt" }).first().click(); await p.waitForTimeout(1300);
  ergebnis.szenarien.schmal.ueberlaufEintragen = await ueberlauf();
  await p.screenshot({ path: join(AUS, "schmal-eintragen.png") });
  await ctx.close();
}

// ---------------------------------------------------------------------
// Szenario 4: Gesten – Ziehen zum Aktualisieren, Fenster mit dem Finger
// falten, Tablett wegwischen, Zurück-Taste, Zeitreise
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
  // Ziehen zum Aktualisieren
  const ptr = p.waitForFunction(() => document.querySelector(".ring")?.classList.contains("dreht"), null, { timeout: 4000 }).then(() => true).catch(() => false);
  await finger(linie(195, 160, 195, 460, 18), 20);
  g.ziehenZumAktualisieren = await ptr;
  await p.waitForTimeout(1500);
  // Zeitreise
  const box = await p.locator(".linie-leinwand").boundingBox();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + box.width * 0.85, y: box.y + 100 }] });
  for (const [x, y] of linie(box.x + box.width * 0.84, box.y + 100, box.x + box.width * 0.3, box.y + 100, 16)) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] }); await p.waitForTimeout(18); }
  g.zeitreiseLabel = await p.evaluate(() => document.querySelector(".held-label").textContent);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await p.waitForTimeout(1500);
  g.nachZeitreise = await p.evaluate(() => document.querySelector(".held-label").textContent);
  // Fenster öffnen und mit dem Finger nach unten falten
  await p.locator(".stapel .kachel").nth(0).scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await p.locator(".stapel .kachel").nth(0).click(); await p.waitForTimeout(1300);
  await finger(linie(195, 240, 195, 640, 16), 16);
  await p.waitForTimeout(1200);
  g.fensterNachZiehen = await p.locator(".fenster-ebene").count();
  // Tablett (Rechenweg) wegwischen
  await p.locator("#heute").evaluate((s) => s.scrollTo(0, 0)); await p.waitForTimeout(400);
  await p.locator(".held").click(); await p.waitForTimeout(900);
  const kopf = await p.locator(".tablett-kopf").boundingBox();
  await finger(linie(kopf.x + kopf.width / 2, kopf.y + 20, kopf.x + kopf.width / 2, kopf.y + 420, 12), 14);
  await p.waitForTimeout(900);
  g.tablettNachWischen = await p.locator(".tablett-ebene").count();
  // Zurück-Taste schließt ein Fenster, die App bleibt offen
  await p.locator("#knopf-einstellungen").click(); await p.waitForTimeout(1000);
  await p.goBack(); await p.waitForTimeout(1000);
  g.fensterNachZurueck = await p.locator(".fenster-ebene").count();
  g.nochInDerApp = p.url().includes("/btc-dca3/");
  ergebnis.szenarien.gesten = g;
  await ctx.close();
}

await browser.close();
server.close();
writeFileSync(join(AUS, "ergebnis.json"), JSON.stringify(ergebnis, null, 2));
console.log(JSON.stringify({ fehler: ergebnis.fehler.slice(0, 30), szenarien: Object.keys(ergebnis.szenarien) }, null, 2));
