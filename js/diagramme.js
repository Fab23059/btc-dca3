// =====================================================================
// diagramme.js – Die Diagramme (mit Chart.js 4.4.3, liegt in /vendor).
//
// Eigene Zutaten:
//   * Einzeichnen: Die Linie wächst von links nach rechts, die Fläche
//     darunter blendet verzögert auf.
//   * Scrubbing: Finger über das Diagramm → Führungslinie und Punkt
//     wandern mit, die große Zahl darüber zeigt den Wert an dieser Stelle.
//   * Flächen als Verlauf, der nach unten ausläuft; die Fläche zwischen
//     "Wert" und "Investiert" zeigt den Gewinn (grün) bzw. Verlust (rot).
// =====================================================================

import { wenigBewegung } from "./dom.js";
import { tick } from "./ui/haptik.js";
import { zahl, datumKurz, uhrzeit } from "./format.js";
import { datumBerlin } from "./zeit.js";

const Chart = globalThis.Chart;
export const diagrammeVerfuegbar = () => typeof Chart === "function";

// Farben aus dem Stylesheet lesen, damit alles an einer Stelle definiert ist.
function farbe(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
let F = null;
function farben() {
  if (!F) {
    F = {
      akzent: farbe("--akzent-rgb"),
      plus: farbe("--plus-rgb"),
      minus: farbe("--minus-rgb"),
      text3: farbe("--text-3"),
      linie: farbe("--diagramm-linie"),
      grund: farbe("--grund"),
    };
  }
  return F;
}

if (diagrammeVerfuegbar()) {
  Chart.defaults.font.family = '"Inter Variable", "Inter", system-ui, sans-serif';
  Chart.defaults.font.size = 10.5;
  Chart.defaults.animation = false;
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.enabled = false;
  Chart.defaults.events = [];   // Zeiger-Ereignisse behandeln wir selbst (Scrubbing)
}

const bremsen = (t) => 1 - Math.pow(1 - t, 3);

// ---------------------------------------------------------------------
// Das Zeichen-Plugin
// ---------------------------------------------------------------------

function punkteVon(chart, i) {
  const meta = chart.getDatasetMeta(i);
  return meta && !meta.hidden ? meta.data.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) : [];
}

function verlaufFlaeche(ctx, chart, f, staerke) {
  const p = punkteVon(chart, f.datensatz);
  if (p.length < 2) return;
  const a = chart.chartArea;
  const g = ctx.createLinearGradient(0, a.top, 0, a.bottom);
  g.addColorStop(0, `rgba(${f.rgb}, ${f.alpha * staerke})`);
  g.addColorStop(0.65, `rgba(${f.rgb}, ${f.alpha * 0.25 * staerke})`);
  g.addColorStop(1, `rgba(${f.rgb}, 0)`);
  ctx.beginPath();
  ctx.moveTo(p[0].x, a.bottom);
  for (const q of p) ctx.lineTo(q.x, q.y);
  ctx.lineTo(p[p.length - 1].x, a.bottom);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
}

function zwischenFlaeche(ctx, chart, f, staerke) {
  const o = punkteVon(chart, f.oben); const u = punkteVon(chart, f.unten);
  if (o.length < 2 || u.length < 2) return;
  const a = chart.chartArea;
  const flaeche = () => {
    ctx.beginPath();
    ctx.moveTo(o[0].x, o[0].y);
    for (const q of o) ctx.lineTo(q.x, q.y);
    for (let i = u.length - 1; i >= 0; i--) ctx.lineTo(u[i].x, u[i].y);
    ctx.closePath();
  };
  const bereich = (oberhalb) => {
    ctx.beginPath();
    ctx.moveTo(u[0].x, oberhalb ? a.top - 20 : a.bottom + 20);
    for (const q of u) ctx.lineTo(q.x, q.y);
    ctx.lineTo(u[u.length - 1].x, oberhalb ? a.top - 20 : a.bottom + 20);
    ctx.closePath();
  };
  for (const [oberhalb, rgb] of [[true, f.plus], [false, f.minus]]) {
    ctx.save();
    bereich(oberhalb); ctx.clip();
    flaeche();
    ctx.fillStyle = `rgba(${rgb}, ${f.alpha * staerke})`;
    ctx.fill();
    ctx.restore();
  }
}

const zeichenPlugin = {
  id: "sparplanZeichnen",
  beforeDatasetsDraw(chart) {
    const z = chart.$z;
    if (!z) return;
    const { ctx, chartArea: a } = chart;
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.left - 4, a.top - 16, (a.right - a.left + 8) * z.fortschritt, a.bottom - a.top + 32);
    ctx.clip();
    for (const f of z.flaechen ?? []) {
      if (f.art === "verlauf") verlaufFlaeche(ctx, chart, f, z.fuellung);
      if (f.art === "zwischen") zwischenFlaeche(ctx, chart, f, z.fuellung);
    }
  },
  afterDatasetsDraw(chart) {
    const z = chart.$z;
    if (!z) return;
    const { ctx, chartArea: a } = chart;
    ctx.restore();
    const c = farben();

    // Kaufmarken (z. B. weiße Punkte im Kursverlauf)
    if (z.marken && z.fortschritt > 0.98) {
      for (const m of z.marken) {
        const x = chart.scales.x.getPixelForValue(m.t); const y = chart.scales.y.getPixelForValue(m.c);
        if (x < a.left - 1 || x > a.right + 1) continue;
        ctx.beginPath(); ctx.arc(x, y, 3.6, 0, Math.PI * 2);
        ctx.fillStyle = m.voll ? "#F2F2F4" : c.grund; ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = m.voll ? c.grund : "rgba(242,242,244,.85)"; ctx.stroke();
      }
    }

    // Beschriftung direkt am Linienende statt Legende
    if (z.endbeschriftung && z.fortschritt >= 1 && !z.scrub) {
      ctx.font = `500 10.5px "Inter Variable", system-ui, sans-serif`;
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      const belegt = [];
      for (const b of z.endbeschriftung) {
        const p = punkteVon(chart, b.datensatz);
        const q = p[p.length - 1];
        if (!q) continue;
        let y = Math.max(a.top + 6, Math.min(a.bottom - 6, q.y + b.versatz));
        for (const yy of belegt) if (Math.abs(yy - y) < 13) y = yy + (y >= yy ? 13 : -13);
        belegt.push(y);
        // dunkler Rand um die Schrift, damit sie über Linien lesbar bleibt
        ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.strokeStyle = c.grund;
        ctx.strokeText(b.text, q.x - 10, y);
        ctx.fillStyle = b.farbe;
        ctx.fillText(b.text, q.x - 10, y);
      }
    }

    // Scrubbing: Führungslinie und Punkt
    if (z.scrub != null) {
      const p = punkteVon(chart, z.hauptsatz);
      const q = p[z.scrub];
      if (!q) return;
      ctx.save();
      if (z.balken) {
        const breite = q.width ?? 10;
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.beginPath(); ctx.roundRect(q.x - breite / 2 - 4, a.top, breite + 8, a.bottom - a.top, 6); ctx.fill();
      } else {
        const g = ctx.createLinearGradient(0, a.top, 0, a.bottom);
        g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.2, "rgba(255,255,255,0.28)");
        g.addColorStop(0.8, "rgba(255,255,255,0.28)"); g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = g; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(Math.round(q.x) + 0.5, a.top); ctx.lineTo(Math.round(q.x) + 0.5, a.bottom); ctx.stroke();
        for (const n of z.nebensaetze ?? []) {
          const r = punkteVon(chart, n)[z.scrub];
          if (!r) continue;
          ctx.beginPath(); ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(242,242,244,0.7)"; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${z.punktRgb ?? c.akzent}, 0.18)`; ctx.fill();
        ctx.beginPath(); ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${z.punktRgb ?? c.akzent})`; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = c.grund; ctx.stroke();
      }
      ctx.restore();
    }
  },
};

// ---------------------------------------------------------------------
// Grundgerüst: Diagramm mit Einzeichnen und Scrubbing
// ---------------------------------------------------------------------

function nahesterIndex(punkte, x) {
  let lo = 0; let hi = punkte.length - 1;
  if (hi < 0) return null;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (punkte[mid].x <= x) lo = mid; else hi = mid;
  }
  // bei gleichen x (Kaufsprung) den späteren Punkt nehmen
  if (Math.abs(punkte[hi].x - x) <= Math.abs(punkte[lo].x - x)) {
    while (hi + 1 < punkte.length && punkte[hi + 1].x === punkte[hi].x) hi++;
    return hi;
  }
  return lo;
}

function grundDiagramm(canvas, { beimScrubben, typ = "line" }) {
  const chart = new Chart(canvas, { type: typ, data: { datasets: [] }, options: {}, plugins: [zeichenPlugin] });
  chart.$z = { fortschritt: 1, fuellung: 1, scrub: null, hauptsatz: 0 };
  let anim = 0; let aktiv = false; let letzter = null;

  function einzeichnen(dauer = 950) {
    cancelAnimationFrame(anim);
    if (wenigBewegung()) { chart.$z.fortschritt = 1; chart.$z.fuellung = 1; chart.draw(); return; }
    const t0 = performance.now();
    const schritt = (t) => {
      const e = Math.min(1, (t - t0) / dauer);
      chart.$z.fortschritt = bremsen(e);
      chart.$z.fuellung = Math.max(0, Math.min(1, (t - t0 - dauer * 0.4) / (dauer * 0.8)));
      chart.draw();
      if (e < 1 || chart.$z.fuellung < 1) anim = requestAnimationFrame(schritt);
    };
    chart.$z.fortschritt = 0; chart.$z.fuellung = 0;
    anim = requestAnimationFrame(schritt);
  }

  function bewegen(e) {
    const punkte = punkteVon(chart, chart.$z.hauptsatz);
    if (!punkte.length) return;
    const rect = canvas.getBoundingClientRect();
    const i = nahesterIndex(punkte, e.clientX - rect.left);
    if (i == null || i === chart.$z.scrub) return;
    chart.$z.scrub = i;
    chart.draw();
    const info = beimScrubben?.(i);
    if (info?.kauf && letzter !== i) tick(6);
    letzter = i;
  }
  function ende() {
    aktiv = false; letzter = null;
    if (chart.$z.scrub == null) return;
    chart.$z.scrub = null;
    chart.draw();
    beimScrubben?.(null);
  }
  canvas.addEventListener("pointerdown", (e) => { aktiv = true; bewegen(e); });
  canvas.addEventListener("pointermove", (e) => { if (aktiv || e.pointerType === "mouse") bewegen(e); });
  canvas.addEventListener("pointerup", () => { if (aktiv) ende(); });
  canvas.addEventListener("pointercancel", ende);
  canvas.addEventListener("pointerleave", ende);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  return { chart, einzeichnen, ende };
}

/** Achse für Zeitwerte: wenige Beschriftungen, die jüngste immer dabei. */
function zeitAchse({ min, max, mitUhrzeit = false, anzahl = 4 }) {
  const c = farben();
  return {
    type: "linear", min, max, offset: false,
    grid: { display: false }, border: { display: false },
    afterBuildTicks: (achse) => {
      const ticks = [];
      for (let i = 0; i < anzahl; i++) ticks.push({ value: min + ((max - min) * i) / (anzahl - 1) });
      achse.ticks = ticks;
    },
    ticks: {
      color: c.text3, maxRotation: 0, autoSkip: false, align: "inner", padding: 6,
      callback: (v) => (mitUhrzeit ? uhrzeit(v) : datumKurz(datumBerlin(v))),
    },
  };
}

/** Wertachse rechts außen (überdeckt nie die Linie); Grenzen eng um die Daten. */
function wertAchse({ format, werte = [], abNull = false } = {}) {
  const c = farben();
  const w = werte.filter(Number.isFinite);
  let min = w.length ? Math.min(...w) : 0; let max = w.length ? Math.max(...w) : 1;
  const rand = (max - min || Math.abs(max) || 1) * 0.08;
  min = abNull && min >= 0 ? 0 : min - rand;
  max += rand;
  return {
    position: "right", min, max,
    grid: { color: c.linie, drawTicks: false, lineWidth: 1 }, border: { display: false },
    afterFit: (achse) => { achse.width = Math.max(achse.width, 44); },
    ticks: { color: c.text3, padding: 8, maxTicksLimit: 4, includeBounds: false, callback: format },
  };
}

/** Meldet den Punkt an die Ansicht und gibt ihn zurück (für das Haptik-Signal bei Käufen). */
const melde = (f, p) => { f(p); return p; };

const euroAchsenFormat = (v) => `${zahl(v, 0)} €`;

// ---------------------------------------------------------------------
// 1) Depotwert: Wert (orange) über der Treppe der Einzahlungen (grau)
// ---------------------------------------------------------------------

export function wertDiagramm(canvas, beimScrubben) {
  let punkte = [];
  const g = grundDiagramm(canvas, { beimScrubben: (i) => melde(beimScrubben, i == null ? null : punkte[i]) });
  const c = farben();
  return {
    zeige(neu, { mitUhrzeit = false, einzeichnen = true } = {}) {
      punkte = neu;
      if (!punkte.length) return;
      const min = punkte[0].t; const max = punkte[punkte.length - 1].t;
      g.chart.data.datasets = [
        { data: punkte.map((p) => ({ x: p.t, y: p.wert })), borderColor: `rgb(${c.akzent})`, borderWidth: 2, pointRadius: 0, tension: 0, borderJoinStyle: "round", order: 1 },
        { data: punkte.map((p) => ({ x: p.t, y: p.investiert })), borderColor: "rgba(242,242,244,0.42)", borderWidth: 1.25, pointRadius: 0, tension: 0, order: 2 },
      ];
      g.chart.options.scales = { x: zeitAchse({ min, max, mitUhrzeit }), y: wertAchse({ format: euroAchsenFormat, werte: punkte.flatMap((p) => [p.wert, p.investiert]), abNull: true }) };
      g.chart.options.layout = { padding: { top: 12, bottom: 0, left: 0, right: 4 } };
      Object.assign(g.chart.$z, {
        hauptsatz: 0, nebensaetze: [1], balken: false, marken: null,
        flaechen: [
          { art: "verlauf", datensatz: 1, rgb: "242,242,244", alpha: 0.05 },
          { art: "zwischen", oben: 0, unten: 1, plus: c.plus, minus: c.minus, alpha: 0.16 },
        ],
        endbeschriftung: [
          { datensatz: 0, text: "Wert", farbe: `rgba(${c.akzent}, 0.95)`, versatz: -12 },
          { datensatz: 1, text: "Investiert", farbe: "rgba(242,242,244,0.5)", versatz: 12 },
        ],
      });
      g.chart.update("none");
      if (einzeichnen) g.einzeichnen(); else g.chart.draw();
    },
    ende: g.ende,
  };
}

// ---------------------------------------------------------------------
// 2) Wochen: graue Einzahlung (immer gleich) + farbige Kursbewegung
// ---------------------------------------------------------------------

export function wochenDiagramm(canvas, beimScrubben) {
  let wochen = [];
  const g = grundDiagramm(canvas, { typ: "bar", beimScrubben: (i) => melde(beimScrubben, i == null ? null : wochen[i]) });
  const c = farben();
  return {
    zeige(neu, { einzeichnen = true } = {}) {
      wochen = neu;
      const n = wochen.length;
      const step = Math.max(1, Math.ceil(n / 4));
      g.chart.data.labels = wochen.map((w) => datumKurz(w.montag));
      g.chart.data.datasets = [
        { data: wochen.map((w) => w.einzahlung), backgroundColor: "rgba(242,242,244,0.22)", borderRadius: 3, borderSkipped: false, stack: "s", categoryPercentage: 0.72, barPercentage: 0.9, maxBarThickness: 22 },
        { data: wochen.map((w) => w.kurseffekt ?? 0), backgroundColor: wochen.map((w) => (w.kurseffekt ?? 0) >= 0 ? `rgba(${c.plus}, ${w.laufend ? 0.45 : 0.75})` : `rgba(${c.minus}, ${w.laufend ? 0.45 : 0.75})`), borderRadius: 3, borderSkipped: false, stack: "s", categoryPercentage: 0.72, barPercentage: 0.9, maxBarThickness: 22 },
      ];
      g.chart.options.scales = {
        x: { stacked: true, grid: { display: false }, border: { display: false }, ticks: { color: c.text3, maxRotation: 0, autoSkip: false, callback: (v, i) => (i === n - 1 || (i % step === 0 && n - 1 - i >= step * 0.6) ? g.chart.data.labels[i] : "") } },
        y: { ...wertAchse({ format: euroAchsenFormat, werte: wochen.flatMap((w) => [w.einzahlung + Math.max(0, w.kurseffekt ?? 0), Math.min(0, w.kurseffekt ?? 0)]) }), stacked: true },
      };
      Object.assign(g.chart.$z, { hauptsatz: 0, nebensaetze: [], balken: true, flaechen: [], marken: null, endbeschriftung: null });
      g.chart.update("none");
      if (einzeichnen) g.einzeichnen(800); else g.chart.draw();
    },
    ende: g.ende,
  };
}

// ---------------------------------------------------------------------
// 3) Sats: Der Bestand wächst nur – jede Stufe ist ein Kauf
// ---------------------------------------------------------------------

export function satsDiagramm(canvas, beimScrubben) {
  let punkte = [];
  const g = grundDiagramm(canvas, { beimScrubben: (i) => melde(beimScrubben, i == null ? null : punkte[i]) });
  const c = farben();
  return {
    zeige(neu, { einzeichnen = true } = {}) {
      punkte = neu;
      if (!punkte.length) return;
      g.chart.data.datasets = [
        { data: punkte.map((p) => ({ x: p.t, y: p.btc * 1e8 })), borderColor: `rgb(${c.akzent})`, borderWidth: 2, pointRadius: 0, tension: 0 },
      ];
      g.chart.options.scales = { x: zeitAchse({ min: punkte[0].t, max: punkte[punkte.length - 1].t }), y: wertAchse({ format: (v) => `${zahl(v / 1000, 0)}k`, werte: punkte.map((p) => p.btc * 1e8), abNull: true }) };
      Object.assign(g.chart.$z, { hauptsatz: 0, nebensaetze: [], balken: false, marken: null, endbeschriftung: null, flaechen: [{ art: "verlauf", datensatz: 0, rgb: c.akzent, alpha: 0.3 }] });
      g.chart.update("none");
      if (einzeichnen) g.einzeichnen(); else g.chart.draw();
    },
    ende: g.ende,
  };
}

// ---------------------------------------------------------------------
// 4) Kursverlauf mit deinen Käufen als Punkte
// ---------------------------------------------------------------------

export function kursDiagramm(canvas, beimScrubben) {
  let punkte = [];
  const g = grundDiagramm(canvas, { beimScrubben: (i) => melde(beimScrubben, i == null ? null : punkte[i]) });
  return {
    zeige(neu, { kaeufe = [], mitUhrzeit = false, einzeichnen = true } = {}) {
      punkte = neu;
      if (!punkte.length) return;
      const min = punkte[0].t; const max = punkte[punkte.length - 1].t;
      // Kaufzeitpunkte als Marken; Punkte im Verlauf merken, damit Scrubbing sie erkennt
      const marken = kaeufe.filter((k) => k.gezaehlt && k.ts >= min && k.ts <= max).map((k) => ({ t: k.ts, c: k.kurs, voll: k.status === "eingetragen", kauf: k }));
      for (const m of marken) {
        let best = 0;
        for (let i = 1; i < punkte.length; i++) if (Math.abs(punkte[i].t - m.t) < Math.abs(punkte[best].t - m.t)) best = i;
        punkte[best] = { ...punkte[best], kauf: m.kauf };
      }
      g.chart.data.datasets = [
        { data: punkte.map((p) => ({ x: p.t, y: p.c })), borderColor: "rgba(242,242,244,0.92)", borderWidth: 1.6, pointRadius: 0, tension: 0 },
      ];
      g.chart.options.scales = { x: zeitAchse({ min, max, mitUhrzeit }), y: wertAchse({ format: (v) => zahl(v, 0), werte: punkte.map((p) => p.c) }) };
      g.chart.options.layout = { padding: { top: 12, bottom: 0, left: 0, right: 4 } };
      Object.assign(g.chart.$z, { hauptsatz: 0, nebensaetze: [], balken: false, marken, endbeschriftung: null, punktRgb: "242,242,244", flaechen: [{ art: "verlauf", datensatz: 0, rgb: "242,242,244", alpha: 0.12 }] });
      g.chart.update("none");
      if (einzeichnen) g.einzeichnen(); else g.chart.draw();
    },
    ende: g.ende,
  };
}
