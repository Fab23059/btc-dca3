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
// 1) Start: Der Wert rollt hoch, die Linie zieht sich, die Fenster steigen auf
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
await p.goto(`${BASIS}/btc-dca3/`);
await warte(5200);
const zug = async (punkte, pause = 16, halten = 0) => {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: punkte[0][0], y: punkte[0][1] }] });
  for (const [x, y] of punkte.slice(1)) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] }); await warte(pause); }
  if (halten) await warte(halten);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};
const strecke = (x0, y0, x1, y1, n = 30) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
const nachOben = () => p.locator("#heute").evaluate((s) => s.scrollTo({ top: 0, behavior: "smooth" }));
const kachel = async (i) => { await p.locator(".stapel .kachel").nth(i).evaluate((k) => k.scrollIntoView({ behavior: "smooth", block: "center" })); await warte(900); await p.locator(".stapel .kachel").nth(i).click(); };

// 2) Zeitreise: langsam zurück, kurz verweilen, wieder vor – loslassen
const lb = await p.locator(".linie-leinwand").boundingBox();
const ly = lb.y + lb.height * 0.55;
await zug([...strecke(lb.x + lb.width * 0.92, ly, lb.x + lb.width * 0.08, ly, 70), ...strecke(lb.x + lb.width * 0.08, ly, lb.x + lb.width * 0.55, ly, 30)], 26, 500);
await warte(1800);

// 3) Zeitraum: die Linie fließt
for (const z of ["Monat", "Woche", "Jahr", "Alles"]) { await p.locator(".zeitraum-wahl", { hasText: z }).click(); await warte(1500); }

// 4) Käufe entfalten, eine Zeile eintragen, Fenster mit dem Finger falten
await kachel(0); await warte(1500);
await p.locator(".fenster .kauf-zeile", { hasText: "geschätzt" }).first().click(); await warte(1500);
await p.locator("#ein-btc").click(); await warte(500);
for (const zeichen of "0,00023") { await p.keyboard.type(zeichen); await warte(120); }
await warte(900);
await p.locator(".vorschlag").click(); await warte(1200);
await p.locator(".formular-fuss .knopf--glut").click(); await warte(3200);
await zug(strecke(195, 230, 195, 700, 34), 18);
await warte(1800);

// 5) Baum: wächst beim Öffnen, Zeitleiste zurück, Stamm berühren
await kachel(1); await warte(1800);
const zl = await p.locator(".zeitleiste").boundingBox();
await zug([...strecke(zl.x + zl.width, zl.y + zl.height / 2, zl.x + 2, zl.y + zl.height / 2, 60)], 30, 700);
await warte(1500);
const bb = await p.locator(".fenster .baum-leinwand").boundingBox();
await zug(strecke(bb.x + bb.width * 0.5, bb.y + bb.height * 0.5, bb.x + bb.width * 0.95, bb.y + bb.height * 0.5, 40), 30, 400);
await warte(800);
await p.locator(".fenster-zu").click(); await warte(1600);

// 6) Zahlen: entfalten, lesen, mit dem Finger zurückfalten
await kachel(2); await warte(1800);
for (const y of [500, 1100, 1700]) { await p.locator(".fenster-rolle").evaluate((s, yy) => s.scrollTo({ top: yy, behavior: "smooth" }), y); await warte(1700); }
await p.locator(".fenster-rolle").evaluate((s) => s.scrollTo({ top: 0, behavior: "smooth" })); await warte(1100);
await zug(strecke(195, 260, 195, 760, 28), 16);
await warte(1600);

// 7) Ziehen zum Aktualisieren
await nachOben(); await warte(1200);
await zug(strecke(195, 200, 195, 470, 26), 22, 200);
await warte(2600);

// 8) Rechenweg als Tablett, wegwischen
await p.locator(".held").click(); await warte(1800);
const tk = await p.locator(".tablett-kopf").boundingBox();
await zug(strecke(tk.x + tk.width / 2, tk.y + 20, tk.x + tk.width / 2, tk.y + 480, 18), 14);
await warte(1300);

// 9) Einstellungen entfalten sich aus dem Zahnrad
await p.locator("#knopf-einstellungen").click(); await warte(2000);
await p.locator(".fenster-zu").click(); await warte(1800);

await cdp.send("Page.stopScreencast");
await ctx.close(); await browser.close(); server.close();

// Einzelbilder mit ihren echten Abständen zu einem Video zusammensetzen
const liste = bilder.map((b, i) => `file '${b.datei}'\nduration ${Math.max(0.001, ((bilder[i + 1]?.t ?? b.t + 0.04) - b.t)).toFixed(4)}`).join("\n");
writeFileSync(join(AUS, "bilder.txt"), `${liste}\nfile '${bilder.at(-1).datei}'\n`);
const ziel = join(AUS, "vorfuehrung.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(AUS, "bilder.txt"), "-vf", "fps=30,scale=780:-2", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-movflags", "+faststart", ziel]);
console.log("Video:", ziel, `${bilder.length} Bilder, ${(bilder.at(-1).t - bilder[0].t).toFixed(1)} s`);
