// =====================================================================
// dom.js – Bausteine zum Erzeugen von Bildschirm-Elementen.
//
// SICHERHEIT: Die App setzt nie HTML aus Text zusammen (kein innerHTML).
// Alles entsteht über h() und svg(); Texte landen immer als reiner Text
// im Dokument. Die Sicherheitsrichtlinie in index.html (Trusted Types)
// würde einen Verstoß sofort blockieren.
// =====================================================================

const SVG_NS = "http://www.w3.org/2000/svg";

function anwenden(el, attrs) {
  if (!attrs) return;
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.setAttribute("class", Array.isArray(v) ? v.filter(Boolean).join(" ") : v);
    else if (k === "text") el.textContent = v;
    else if (k === "style") for (const [p, w] of Object.entries(v)) el.style.setProperty(p, w);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "ref" && typeof v === "function") v(el);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
}

function anhaengen(el, kinder) {
  for (const k of kinder.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : String(k));
  }
}

/** HTML-Element: h("div", { class: "karte" }, "Text", h("span", …)) */
export function h(tag, attrs, ...kinder) {
  const el = document.createElement(tag);
  anwenden(el, attrs);
  anhaengen(el, kinder);
  return el;
}

/** SVG-Element */
export function svg(tag, attrs, ...kinder) {
  const el = document.createElementNS(SVG_NS, tag);
  anwenden(el, attrs);
  anhaengen(el, kinder);
  return el;
}

/** Inhalt eines Elements ersetzen. */
export function fuelle(el, ...kinder) {
  el.replaceChildren();
  anhaengen(el, kinder);
  return el;
}

export const $ = (sel, wurzel = document) => wurzel.querySelector(sel);
export const $$ = (sel, wurzel = document) => [...wurzel.querySelectorAll(sel)];

/** Bewegung reduziert? (Systemeinstellung "Bewegung reduzieren") */
export const wenigBewegung = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------------
// Symbole (eigene, schlichte Linienzeichnungen, 24 × 24)
// ---------------------------------------------------------------------

const PFADE = {
  depot: ["M3 17l5-5 4 3 8-8", "M15 7h5v5"],
  kaeufe: ["M8 6h12", "M8 12h12", "M8 18h12", "M3.5 6h.01", "M3.5 12h.01", "M3.5 18h.01"],
  analyse: ["M4 20V10", "M10 20V4", "M16 20v-7", "M22 20H2"],
  weg: ["M12 3a9 9 0 1 0 8.6 6.3"],
  zahnrad: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"],
  haken: ["M5 12.5l4.5 4.5L19 7.5"],
  uhr: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"],
  plus: ["M12 5v14", "M5 12h14"],
  pfeilHoch: ["M12 19V5", "M6 11l6-6 6 6"],
  pfeilRunter: ["M12 5v14", "M6 13l6 6 6-6"],
  pfeilRechts: ["M5 12h14", "M13 6l6 6-6 6"],
  schliessen: ["M6 6l12 12", "M18 6L6 18"],
  glocke: ["M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"],
  sicherung: ["M12 3v12", "M7 10l5 5 5-5", "M5 21h14"],
  laden: ["M12 21V9", "M7 14l5-5 5 5", "M5 3h14"],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 11v5", "M12 8h.01"],
  offline: ["M2 2l20 20", "M8.5 16.4a5 5 0 0 1 7 0", "M5 12.9a10 10 0 0 1 5.2-2.7", "M19 12.9a10 10 0 0 0-2.4-1.6", "M12 20h.01"],
  schaetzung: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"],
  stift: ["M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"],
  kopieren: ["M9 9h11v11H9z", "M5 15H4V4h11v1"],
  teilen: ["M12 3v12", "M7 8l5-5 5 5", "M5 13v7h14v-7"],
  schutz: ["M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3z", "M9 12l2 2 4-4"],
};

/** Ein Symbol als SVG. */
export function icon(name, { groesse = 24, klasse = "icon", strich = 1.75 } = {}) {
  const pfade = PFADE[name] ?? PFADE.info;
  const el = svg("svg", { viewBox: "0 0 24 24", width: groesse, height: groesse, class: klasse, "aria-hidden": "true", fill: "none", stroke: "currentColor", "stroke-width": strich, "stroke-linecap": "round", "stroke-linejoin": "round" },
    pfade.map((d) => svg("path", { d })));
  if (name === "schaetzung") el.setAttribute("stroke-dasharray", "2.6 2.6");
  return el;
}
