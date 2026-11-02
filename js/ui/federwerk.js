// =====================================================================
// federwerk.js – Bewegung nach echter Federphysik.
//
// Statt fester Kurven rechnet die App eine gedämpfte Feder durch (Masse,
// Steifheit, Dämpfung) und übersetzt das Ergebnis in eine CSS-Kurve
// (linear(…)). So schwingt alles minimal nach, wie ein echtes Objekt.
//
// Außerdem hier:
//   * fokus()      – Elemente erscheinen wie durch ein Objektiv scharf gestellt
//   * Lichtimpuls  – jede Berührung sendet einen kurzen Lichtring aus
// =====================================================================

import { wenigBewegung } from "../dom.js";

/** Lage einer Feder (0 → 1) zum Zeitpunkt t (Sekunden), Startgeschwindigkeit 0. */
function federLage(t, steifheit, daempfung, masse = 1) {
  const w0 = Math.sqrt(steifheit / masse);
  const zeta = daempfung / (2 * Math.sqrt(steifheit * masse));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}

/** Wie lange die Feder braucht, bis sie (fast) ruht. */
function federDauer(steifheit, daempfung) {
  for (let t = 0.05; t < 4; t += 0.005) {
    let ruhig = true;
    for (let k = 0; k < 8; k++) if (Math.abs(1 - federLage(t + k * 0.02, steifheit, daempfung)) > 0.0015) { ruhig = false; break; }
    if (ruhig) return t;
  }
  return 4;
}

/** Übersetzt eine Feder in eine CSS-Kurve linear(…) samt Dauer. */
export function federKurve(steifheit, daempfung, stuetzen = 48) {
  const dauer = federDauer(steifheit, daempfung);
  const werte = [];
  for (let i = 0; i <= stuetzen; i++) werte.push(+federLage((dauer * i) / stuetzen, steifheit, daempfung).toFixed(4));
  werte[werte.length - 1] = 1;
  return { kurve: `linear(${werte.join(", ")})`, dauer: Math.round(dauer * 1000) };
}

/** Die Federn der App – von knackig bis verspielt. */
export const FEDERN = Object.freeze({
  schnapp: { steifheit: 600, daempfung: 36 },  // Druck, Umschalter – sofort, kaum Nachschwingen
  feder: { steifheit: 300, daempfung: 21 },    // Erscheinen – leichtes Überschwingen
  gummi: { steifheit: 340, daempfung: 14 },    // Verspieltes: Tab-Indikator, Schalter
  weich: { steifheit: 150, daempfung: 21 },    // große Bewegungen: Sheets, Details
  traege: { steifheit: 70, daempfung: 15 },    // Atmosphäre, Zählwerk großer Stellen
});

const unterstuetzt = typeof CSS !== "undefined" && CSS.supports?.("transition-timing-function", "linear(0, 1)");
const cache = {};

/** { kurve, dauer } einer benannten Feder (mit Rückfall auf eine Bezier-Kurve). */
export function feder(name) {
  if (!cache[name]) {
    const f = FEDERN[name];
    const k = federKurve(f.steifheit, f.daempfung);
    cache[name] = unterstuetzt ? k : { kurve: "cubic-bezier(0.34, 1.56, 0.64, 1)", dauer: Math.min(700, k.dauer) };
  }
  return cache[name];
}

/** Legt alle Federn als CSS-Variablen an: --f-feder, --f-feder-d usw. */
export function federnAlsCss() {
  const wurzel = document.documentElement.style;
  for (const name of Object.keys(FEDERN)) {
    const f = feder(name);
    wurzel.setProperty(`--f-${name}`, f.kurve);
    wurzel.setProperty(`--f-${name}-d`, `${f.dauer}ms`);
  }
}

/** Animiert ein Element mit einer Feder (Web Animations API). */
export function federn(el, keyframes, { name = "feder", verzoegerung = 0, fuellen = "both" } = {}) {
  if (wenigBewegung()) return el.animate(keyframes.slice(-1), { duration: 1, fill: fuellen });
  const f = feder(name);
  return el.animate(keyframes, { duration: f.dauer, easing: f.kurve, delay: verzoegerung, fill: fuellen });
}

// ---------------------------------------------------------------------
// Fokus: Elemente kommen aus der Unschärfe – wie ein Objektiv, das scharf stellt
// ---------------------------------------------------------------------

export function fokus(elemente, { abstand = 46, start = 0, hub = 14 } = {}) {
  const liste = [...elemente].filter(Boolean);
  if (wenigBewegung()) return;
  liste.forEach((el, i) => {
    el.animate([
      { opacity: 0, filter: "blur(10px)", transform: `translate3d(0, ${hub}px, 0) scale(0.985)` },
      { opacity: 1, filter: "blur(0px)", transform: "none" },
    ], { duration: feder("feder").dauer + 120, easing: feder("feder").kurve, delay: start + i * abstand, fill: "backwards" });
  });
}

/** Wie fokus(), aber erst, wenn das Element ins Bild scrollt (einmalig). */
const beobachter = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((eintraege) => {
  for (const e of eintraege) {
    if (!e.isIntersecting) continue;
    beobachter.unobserve(e.target);
    e.target.classList.remove("wartet");
    fokus([e.target], { hub: 22 });
  }
}, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 }) : null;

export function beimSichtbarWerden(elemente) {
  if (!beobachter || wenigBewegung()) return;
  for (const el of elemente) { el.classList.add("wartet"); beobachter.observe(el); }
}

// ---------------------------------------------------------------------
// Lichtimpuls: Jede Berührung sendet von der Fingerspitze einen Lichtring aus
// ---------------------------------------------------------------------

export function lichtimpulseAktivieren() {
  document.addEventListener("pointerdown", (e) => {
    const ziel = e.target.closest(".impuls");
    if (!ziel || wenigBewegung() || ziel.disabled) return;
    const r = ziel.getBoundingClientRect();
    const groesse = Math.max(r.width, r.height) * 2.2;
    const ring = document.createElement("span");
    ring.className = "lichtimpuls";
    ring.setAttribute("aria-hidden", "true");
    ring.style.setProperty("left", `${e.clientX - r.left - groesse / 2}px`);
    ring.style.setProperty("top", `${e.clientY - r.top - groesse / 2}px`);
    ring.style.setProperty("width", `${groesse}px`);
    ring.style.setProperty("height", `${groesse}px`);
    ziel.append(ring);
    const a = ring.animate([
      { transform: "scale(0.05)", opacity: 0.55 },
      { transform: "scale(0.6)", opacity: 0.32, offset: 0.35 },
      { transform: "scale(1)", opacity: 0 },
    ], { duration: 720, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    a.onfinish = () => ring.remove();
  }, { passive: true });
}
