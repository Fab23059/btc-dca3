// =====================================================================
// sparkline.js – Winzige Verlaufslinien neben Kennzahlen (als SVG).
// =====================================================================

import { svg } from "../dom.js";

let zaehler = 0;

/** Liniengrafik aus Werten. farbe ist ein CSS-Farbwert. */
export function sparkline(werte, { breite = 88, hoehe = 28, farbe = "currentColor", flaeche = true, stufen = false } = {}) {
  const el = svg("svg", { viewBox: `0 0 ${breite} ${hoehe}`, width: breite, height: hoehe, class: "sparkline", "aria-hidden": "true", preserveAspectRatio: "none" });
  const w = werte.filter((x) => Number.isFinite(x));
  if (w.length < 2) return el;
  const min = Math.min(...w); const max = Math.max(...w);
  const spanne = max - min || 1;
  const x = (i) => (i / (w.length - 1)) * (breite - 2) + 1;
  const y = (v) => hoehe - 2 - ((v - min) / spanne) * (hoehe - 4);
  let d = `M${x(0).toFixed(1)},${y(w[0]).toFixed(1)}`;
  for (let i = 1; i < w.length; i++) {
    if (stufen) d += `H${x(i).toFixed(1)}`;
    d += `L${x(i).toFixed(1)},${y(w[i]).toFixed(1)}`;
  }
  if (flaeche) {
    const id = `spark-${++zaehler}`;
    el.append(
      svg("defs", null, svg("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 },
        svg("stop", { offset: "0", "stop-color": farbe, "stop-opacity": "0.28" }),
        svg("stop", { offset: "1", "stop-color": farbe, "stop-opacity": "0" }))),
      svg("path", { d: `${d}L${x(w.length - 1).toFixed(1)},${hoehe}L${x(0).toFixed(1)},${hoehe}Z`, fill: `url(#${id})`, stroke: "none" }),
    );
  }
  el.append(svg("path", { d, fill: "none", stroke: farbe, "stroke-width": 1.5, "stroke-linejoin": "round", "stroke-linecap": "round", "vector-effect": "non-scaling-stroke" }));
  const lx = x(w.length - 1); const ly = y(w[w.length - 1]);
  el.append(svg("circle", { cx: lx, cy: ly, r: 2.2, fill: farbe }));
  return el;
}

/** Reihe gleich großer Klötzchen – eine je Einzahlung (zeigt: jede Woche gleich viel). */
export function kloetzchen(anzahl, { max = 16, breite = 88, hoehe = 28 } = {}) {
  const n = Math.min(anzahl, max);
  const el = svg("svg", { viewBox: `0 0 ${breite} ${hoehe}`, width: breite, height: hoehe, class: "kloetzchen", "aria-hidden": "true" });
  if (!n) return el;
  const luecke = 2;
  const b = (breite - luecke * (max - 1)) / max;
  for (let i = 0; i < n; i++) {
    const hoeheI = 6 + ((hoehe - 8) * (i + 1)) / max;
    el.append(svg("rect", { x: breite - (n - i) * (b + luecke) + luecke, y: hoehe - hoeheI, width: b, height: hoeheI, rx: 1.5, class: i === n - 1 ? "kloetzchen-neu" : "" }));
  }
  return el;
}
