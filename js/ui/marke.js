// =====================================================================
// marke.js – Das Markenzeichen: Bitcoin-Zeichen in einem Ziffernblatt aus
// 52 Strichen – einer für jede Woche eines Jahres. Wird im Intro, beim
// Aktualisieren und im Kopf der App verwendet und kann sich animieren.
// (Das Zeichen ist aus der Schrift Inter als Vektorpfad übernommen.)
// =====================================================================

import { svg } from "../dom.js";

export const BITCOIN_PFAD = "M42.86 33.47L42.86 27.00L45.81 27.00L45.81 33.47ZM49.79 33.47L49.79 27.00L52.76 27.00L52.76 33.47ZM42.86 73.00L42.86 66.53L45.81 66.53L45.81 73.00ZM49.79 73.00L49.79 66.53L52.76 66.53L52.76 73.00ZM36.10 68.40L36.10 31.60L50.46 31.60Q54.47 31.60 57.14 32.83Q59.81 34.07 61.14 36.22Q62.46 38.36 62.46 41.10Q62.46 43.31 61.60 44.92Q60.74 46.52 59.27 47.53Q57.80 48.54 55.95 48.97L55.95 49.34Q57.96 49.43 59.78 50.52Q61.60 51.62 62.75 53.59Q63.90 55.56 63.90 58.32Q63.90 61.20 62.50 63.48Q61.10 65.77 58.30 67.09Q55.51 68.40 51.31 68.40ZM43.18 62.54L50.04 62.54Q53.53 62.54 55.10 61.20Q56.67 59.85 56.67 57.71Q56.67 56.11 55.89 54.84Q55.11 53.58 53.67 52.85Q52.23 52.13 50.25 52.13L43.18 52.13ZM43.18 47.17L49.48 47.17Q51.15 47.17 52.49 46.56Q53.82 45.95 54.59 44.82Q55.37 43.69 55.37 42.13Q55.37 40.06 53.90 38.73Q52.43 37.41 49.63 37.41L43.18 37.41Z";

/** Ziffernblatt mit 52 Strichen (viewBox 0 0 100 100). */
export function ziffernblatt({ klasse = "marke", mitZeichen = true, radius = 36, laenge = 4.2 } = {}) {
  const striche = [];
  for (let i = 0; i < 52; i++) {
    const w = -Math.PI / 2 + (2 * Math.PI * i) / 52;
    const x1 = 50 + (radius - laenge) * Math.cos(w); const y1 = 50 + (radius - laenge) * Math.sin(w);
    const x2 = 50 + radius * Math.cos(w); const y2 = 50 + radius * Math.sin(w);
    striche.push(svg("line", { x1: x1.toFixed(2), y1: y1.toFixed(2), x2: x2.toFixed(2), y2: y2.toFixed(2), class: "marke-strich" }));
  }
  return svg("svg", { viewBox: "0 0 100 100", class: klasse, "aria-hidden": "true" },
    svg("g", { class: "marke-striche" }, striche),
    mitZeichen ? svg("path", { d: BITCOIN_PFAD, class: "marke-zeichen" }) : null);
}
