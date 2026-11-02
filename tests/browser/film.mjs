// =====================================================================
// film.mjs – Nimmt eine Vorführung der App als Video auf (nur Entwickler).
// Gleiche Testkurse wie pruefung.mjs, Montag 2.11.2026, 21:00 Uhr.
// Aufruf: node tests/browser/film.mjs <ausgabeordner>
// Aufgenommen wird per Bildschirm-Mitschnitt (CDP-Screencast) in voller
// Handy-Auflösung; ffmpeg setzt die Einzelbilder danach zu einer MP4 zusammen.
// =====================================================================

import http from "node:http";
import { readFile } from "node:fs/promises";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
import { erzeugeVerlauf, kurs, antwort } from "./attrappe.mjs";
import { berlinZeitpunkt } from "../../js/zeit.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const WURZEL = new URL("../../", import.meta.url).pathname;
const AUS = process.argv[2] ?? "film-ausgabe";
mkdirSync(AUS, { recursive: true });
const TYPEN = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer(async (req, res) => {
  const pfad = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const datei = pfad.replace(/^\/btc-dca3\//, "") || "index.html";
  if (datei.includes("..")) { res.writeHead(400); res.end(); return; }
  try { const d = await readFile(join(WURZEL, datei)); res.writeHead(200, { "content-type": TYPEN[extname(datei)] ?? "application/octet-stream" }); res.end(d); } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASIS = `http://localhost:${server.address().port}`;

const jetztMs = Date.UTC(2026, 10, 2, 20, 0);
const v = erzeugeVerlauf({ ende: Date.UTC(2026, 10, 4) / 1000 });
const montage = []; for (let d = Date.UTC(2026, 5, 8); d <= Date.UTC(2026, 10, 2); d += 7 * 86400e3) montage.push(new Date(d).toISOString().slice(0, 10));
const phase = (m) => (m <= "2026-06-29" ? { h: 8, min: 40, fee: 0.004 } : { h: 20, min: 50, fee: 0.0025 });
const overrides = {};
for (const m of montage) {
  if (["2026-08-17", "2026-09-28", "2026-10-26", "2026-11-02"].includes(m)) continue;
  const markt = kurs(v, berlinZeitpunkt(m, phase(m).h, phase(m).min) / 1000) * 1.0015;
  overrides[m] = { btc: Math.round(((15 * (1 - phase(m).fee)) / markt) * 1e8) / 1e8 };
}

const browser = await chromium.launch({ args: ["--enable-gpu-rasterization", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "de-DE", timezoneId: "Europe/Berlin",
});
await ctx.route(/^https:\/\//, (route) => {
  const a = antwort(v, jetztMs, route.request().url());
  return a ? route.fulfill({ status: a[0], contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(a[1]) }) : route.abort();
});
const p = await ctx.newPage();
await p.clock.setFixedTime(new Date(jetztMs));
await p.goto(`${BASIS}/btc-dca3/leer`);
await p.evaluate((o) => localStorage.setItem("btcdca_overrides_v1", JSON.stringify(o)), overrides);
const cdp = await ctx.newCDPSession(p);
const warte = (ms) => p.waitForTimeout(ms);
// Mitschnitt: jedes gemalte Bild kommt mit Zeitstempel an
const BILDER = join(AUS, "bilder");
rmSync(BILDER, { recursive: true, force: true }); mkdirSync(BILDER, { recursive: true });
const bilder = [];
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const datei = join(BILDER, `b${String(bilder.length).padStart(5, "0")}.jpg`);
  writeFileSync(datei, Buffer.from(data, "base64"));
  bilder.push({ datei, t: metadata.timestamp });
  try { await cdp.send("Page.screencastFrameAck", { sessionId }); } catch { /* Ende */ }
});
const finger = async (von, bis, schritte = 16, pause = 18) => {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: von[0], y: von[1] }] });
  for (let i = 1; i <= schritte; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: von[0] + ((bis[0] - von[0]) * i) / schritte, y: von[1] + ((bis[1] - von[1]) * i) / schritte }] }); await warte(pause); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};
const scrolle = async (sel, y) => { await p.locator(sel).evaluate((s, yy) => s.scrollTo({ top: yy, behavior: "smooth" }), y); };
const langsamUeber = async (sel, schritte = 40) => {
  const b = await p.locator(sel).first().boundingBox();
  for (let i = 0; i <= schritte; i++) { await p.mouse.move(b.x + 8 + (b.width - 16) * (i / schritte), b.y + b.height * 0.5); await warte(45); }
  await p.mouse.move(2, 2);
};

// 1) Erster Start: das Intro
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
await p.goto(`${BASIS}/btc-dca3/`);
await warte(7600);
// 2) Depot: Zahlen rollen, Linie zeichnet sich, Lichtlauf
await warte(2600);
await langsamUeber("#seite-depot .diagramm-canvas:not([hidden])");
await warte(600);
await p.locator(".diagramm-kopf .segment-option", { hasText: "Wochen" }).click(); await warte(2200);
await langsamUeber("#seite-depot .diagramm-canvas:not([hidden])", 26);
await p.locator(".diagramm-kopf .segment-option", { hasText: "Wert" }).click(); await warte(1200);
await p.locator(".zeitraum .segment-option", { hasText: "Monat" }).click(); await warte(1800);
await p.locator(".zeitraum .segment-option", { hasText: "Gesamt" }).click(); await warte(1400);
await scrolle("#seite-depot", 760); await warte(2400);
await scrolle("#seite-depot", 0); await warte(900);
// 3) Wischen zu Käufe
await finger([340, 700], [40, 700], 14, 16); await warte(2400);
// 4) Kauf eintragen
await p.locator(".kauf-zeile").filter({ hasText: "geschätzt" }).first().click(); await warte(1300);
await p.locator("#ein-btc").click(); await warte(900);
for (const z of "0,00023") { await p.keyboard.type(z); await warte(110); }
await warte(700);
await p.locator(".vorschlag").click(); await warte(1200);
await p.locator(".sheet-fuss .knopf--primaer").click(); await warte(3200);
// 5) Analyse
await p.locator("#tab-analyse").click(); await warte(2600);
await langsamUeber("#seite-analyse .diagramm-canvas", 30);
for (const y of [620, 1300, 1950, 2700]) { await scrolle("#seite-analyse", y); await warte(2900); }
const kachel = p.locator(".mosaik-kachel").nth(8);
if (await kachel.count()) { await kachel.click(); await warte(1200); }
// 6) Weg: der Baum
await p.locator("#tab-weg").click(); await warte(3600);
const bb = await p.locator("canvas.baum").boundingBox();
for (let i = 0; i <= 40; i++) { await p.mouse.move(bb.x + bb.width * 0.5 + bb.width * 0.46 * (i / 40), bb.y + bb.height * 0.5); await warte(55); }
await p.mouse.move(2, 2); await warte(900);
for (const y of [640, 1250, 1900]) { await scrolle("#seite-weg", y); await warte(2700); }
await scrolle("#seite-weg", 0); await warte(1200);
// 7) Ziehen zum Aktualisieren
await finger([195, 260], [195, 520], 22, 22); await warte(2200);
// 8) Einstellungen
await p.locator("#knopf-einstellungen").click(); await warte(1500);
await p.locator(".schalter").nth(2).click(); await warte(900);
await p.locator(".schalter").nth(2).click(); await warte(900);
await p.keyboard.press("Escape"); await warte(1200);
await p.locator("#tab-depot").click(); await warte(2000);

await cdp.send("Page.stopScreencast");
await ctx.close(); await browser.close(); server.close();

// Einzelbilder mit ihren echten Abständen zu einem Video zusammensetzen
const liste = bilder.map((b, i) => `file '${b.datei}'\nduration ${Math.max(0.001, ((bilder[i + 1]?.t ?? b.t + 0.04) - b.t)).toFixed(4)}`).join("\n");
writeFileSync(join(AUS, "bilder.txt"), `${liste}\nfile '${bilder.at(-1).datei}'\n`);
const ziel = join(AUS, "vorfuehrung.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(AUS, "bilder.txt"), "-vf", "fps=30,scale=780:-2", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-movflags", "+faststart", ziel]);
console.log("Video:", ziel, `${bilder.length} Bilder, ${(bilder.at(-1).t - bilder[0].t).toFixed(1)} s`);
