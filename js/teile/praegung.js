// =====================================================================
// praegung.js – Ein Meilenstein wird geprägt (Bewegung B12).
//
// Meilensteine kommen selten (zuletzt alle paar Wochen, später alle paar
// Monate). Seltene Momente dürfen groß sein. Statt Konfetti gibt es
// deshalb etwas, das bleibt: eine Münze.
//
//   1. Ein Rohling fliegt von der Stelle herein, an der der Meilenstein
//      gefallen ist (Regel 1: nichts erscheint aus dem Nichts).
//   2. Du hältst den Finger darauf – die Kraft baut sich auf. Bei voller
//      Kraft schlägt der Stempel zu: Lichtblitz, Funken, das Relief ist da.
//      (Wer nicht drückt: Nach kurzer Zeit prägt sie sich von selbst.)
//   3. Die Münze kreiselt aus wie eine echte Münze auf dem Tisch: Sie
//      wackelt immer flacher und dabei immer SCHNELLER, bis sie liegt.
//      Das ist keine Kurve, sondern das echte Gesetz dieser Bewegung
//      ("Eulersche Scheibe"): Tempo ∝ 1 / Wurzel der Neigung.
//   4. Danach gehört sie dir: mit dem Finger wenden (Rückseite: Datum
//      und Kauf), kippen lässt das Licht darüberlaufen (neigung.js).
//      Antippen des Hintergrunds legt sie zu den Abzeichen.
//
// Bewegt werden nur Lage, Drehung und Deckkraft (Regel 5).
// "Bewegung reduzieren": Die Münze liegt sofort fertig da.
// =====================================================================

import { h, svg, wenigBewegung } from "../dom.js";
import { Feder, imTakt, klemme, mische } from "../bewegung/feder.js";
import { ziehe } from "../bewegung/geste.js";
import { beiLicht, fingerlicht } from "../bewegung/neigung.js";
import { ebeneAnmelden } from "./ebenen.js";
import { stieben } from "./funkenflug.js";
import { tick } from "./haptik.js";

const zeitfaktor = () => {
  const z = Number(globalThis.__ZEITLUPE);
  return Number.isFinite(z) && z >= 1 && z <= 40 ? 1 / z : 1;
};

const KREISEL_SEKUNDEN = 2.1;
const STARTNEIGUNG = 0.96;       // Bogenmaß, etwa 55°
const VON_SELBST_NACH = 2600;    // ms, bis sie sich ohne Drücken prägt

/** Die Münze als Element (auch einzeln nutzbar, z. B. klein in der Abzeichen-Liste). */
export function muenze({ wert, einheit, datum = "", unter = "" }) {
  const relief = h("span", { class: "muenze-relief" },
    h("span", { class: "muenze-kreise", "aria-hidden": "true" }),
    h("span", { class: "muenze-wert zahl" }, wert),
    h("span", { class: "muenze-einheit" }, einheit));
  const glanz = h("span", { class: "muenze-glanz", "aria-hidden": "true" });
  const roh = h("span", { class: "muenze-roh", "aria-hidden": "true" });
  const vorn = h("span", { class: "muenze-seite muenze-vorn" }, relief, roh, glanz);
  const hinten = h("span", { class: "muenze-seite muenze-hinten" },
    h("span", { class: "muenze-relief" },
      h("span", { class: "muenze-rueck-oben" }, "erreicht"),
      h("span", { class: "muenze-rueck-datum zahl" }, datum),
      h("span", { class: "muenze-rueck-unten" }, unter)));
  const el = h("span", { class: "muenze" }, hinten, vorn);
  return { el, relief, glanz, roh };
}

/**
 * Prägt einen Meilenstein.
 *
 * @param {object} o
 *   wert, einheit   z. B. "500k", "sats"  oder  "26", "Wochen"
 *   datum, unter    Rückseite, z. B. "2. Nov 2026", "Kauf 22"
 *   satz            Zeile unter der Münze, z. B. "Eine halbe Million sats."
 *   herkunft        Element, aus dem der Rohling kommt (z. B. die Statuszeile)
 *   ablage          Element (oder Funktion), in das die Münze am Ende fliegt (das Abzeichen)
 *   sofort          true = schon geprägt zeigen (z. B. beim Antippen eines Abzeichens, das man längst hat)
 *   buehne          Nur für Vorführungen: Element, in dem statt bildschirmfüllend geprägt wird
 * @returns Promise, das sich erfüllt, wenn die Münze abgelegt wurde
 */
export function praege({ wert, einheit, datum, unter, satz = "", herkunft = null, ablage = null, buehne = null, sofort = false }) {
  const m = muenze({ wert, einheit, datum, unter });
  const kraftRing = svg("circle", { cx: 60, cy: 60, r: 57, class: "praegung-kraft-bogen", pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 });
  const kraftEl = svg("svg", { class: "praegung-kraft", viewBox: "0 0 120 120", "aria-hidden": "true" }, kraftRing);
  const welle = h("span", { class: "praegung-welle", "aria-hidden": "true" });
  const blitz = h("span", { class: "praegung-blitz", "aria-hidden": "true" });
  const lage = h("span", { class: "praegung-lage" }, m.el);                     // Flug + Druck
  const halter = h("button", { type: "button", class: "praegung-halter", "aria-label": `Meilenstein ${wert} ${einheit} prägen` }, welle, kraftEl, lage, blitz);
  const hinweis = h("p", { class: "praegung-hinweis" }, "Halten zum Prägen");
  const text = h("p", { class: "praegung-satz" }, satz);
  const schleier = h("div", { class: "praegung-schleier" });
  const ebene = h("div", { class: ["praegung-ebene", buehne && "praegung-ebene--buehne"], role: "dialog", "aria-modal": buehne ? null : "true", "aria-label": `${wert} ${einheit} erreicht` },
    schleier, h("div", { class: "praegung-mitte" }, halter, hinweis, text));
  (buehne ?? document.body).append(ebene);

  let zustand = "rohling";       // rohling → gepraegt → liegt → geht
  let lichtX = 0.5; let lichtY = -0.55;
  let wende = 0;                 // Drehung um die Hochachse in Grad
  let theta = 0; let phi = 0;    // Kreiseln: Neigung und Umlaufwinkel
  let druck = 1;                 // Stauchung beim Schlag
  let fertigOk;
  const fertig = new Promise((ok) => { fertigOk = ok; });

  /** Alle Drehungen der Münze in einem transform – das ist ihre ganze Bewegung. */
  function stelle() {
    const kipp = (theta * 180) / Math.PI; const um = (phi * 180) / Math.PI;
    m.el.style.transform = `rotateZ(${um.toFixed(2)}deg) rotateX(${kipp.toFixed(2)}deg) rotateZ(${(-um).toFixed(2)}deg) rotateY(${wende.toFixed(2)}deg) scale(${druck.toFixed(4)})`;
    // Der Glanz läuft gegen die Kipprichtung über die Fläche
    const gx = -lichtX * 34 - Math.sin((wende * Math.PI) / 180) * 60 + Math.cos(phi) * theta * 70;
    const gy = -lichtY * 34 + Math.sin(phi) * theta * 70;
    m.glanz.style.transform = `translate3d(${gx.toFixed(1)}%, ${gy.toFixed(1)}%, 0)`;
  }
  const lichtAb = beiLicht((l) => { lichtX = l.x; lichtY = l.y; stelle(); });
  const fingerAb = fingerlicht(halter);

  // ---- 1. Der Rohling fliegt herein ----
  const flug = new Feder(0, { art: "raum", genau: 0.001, beiWert: (p) => setzeFlug(p) });
  let quelle = null;
  function vermesse(el) {
    const z = typeof el === "function" ? el() : el;
    const r = z?.isConnected ? z.getBoundingClientRect() : null;
    const hier = halter.getBoundingClientRect();
    if (!r || !r.width) return { dx: 0, dy: 60, s: 0.3 };
    return { dx: r.left + r.width / 2 - (hier.left + hier.width / 2), dy: r.top + r.height / 2 - (hier.top + hier.height / 2), s: Math.max(0.12, Math.min(r.width, r.height) / hier.width) };
  }
  function setzeFlug(p) {
    const q = klemme(p, -0.05, 1.05);
    const a = quelle ?? { dx: 0, dy: 60, s: 0.3 };
    lage.style.transform = `translate3d(${mische(a.dx, 0, q).toFixed(2)}px, ${mische(a.dy, 0, q).toFixed(2)}px, 0) scale(${mische(a.s, 1, q).toFixed(4)})`;
    lage.style.opacity = String(klemme(q * 3));
    schleier.style.opacity = String(klemme(q) * 0.88);
  }

  // ---- 2. Kraft aufbauen und schlagen ----
  const kraft = new Feder(0, { antwort: 0.85, daempfung: 1, genau: 0.004, beiWert: (k) => {
    kraftRing.style.strokeDashoffset = String(1 - klemme(k));
    kraftEl.style.opacity = String(klemme(k * 6));
    if (zustand === "rohling") { druck = 1 - 0.07 * klemme(k); stelle(); }
    if (k > 0.985 && zustand === "rohling") schlag();
  } });
  let stufe = 0;
  const druecke = () => { if (zustand === "rohling") { kraft.art({ antwort: 0.85, daempfung: 1 }).zu(1); stufe = 0; halteTicks(); } };
  // Loslassen vor dem Schlag: Die Kraft fällt weich zurück
  const lasse = () => { if (zustand === "rohling") kraft.art("gummi").zu(0); };
  function halteTicks() {
    // Während die Kraft steigt, tickt es in der Hand – in fünf Stufen
    const ab = imTakt(() => {
      if (zustand !== "rohling" || kraft.ruht) { ab(); return; }
      const s = Math.floor(kraft.wert * 5);
      if (s > stufe) { stufe = s; tick(4 + s * 2); }
    });
  }
  halter.addEventListener("pointerdown", druecke);
  for (const t of ["pointerup", "pointercancel", "pointerleave"]) halter.addEventListener(t, lasse);
  halter.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); druecke(); } });
  halter.addEventListener("keyup", lasse);
  let vonSelbst = setTimeout(druecke, VON_SELBST_NACH / zeitfaktor());

  const schlagFeder = new Feder(1, { antwort: 0.34, daempfung: 0.42, genau: 0.001, beiWert: (x) => { druck = x; stelle(); } });
  const reliefFeder = new Feder(0, { art: "zeiger", genau: 0.002, beiWert: (x) => {
    m.relief.style.opacity = String(klemme(x));
    m.relief.style.transform = `scale(${(1.14 - 0.14 * klemme(x, 0, 1.2)).toFixed(4)})`;
    m.roh.style.opacity = String(1 - klemme(x));
  } });

  function schlag() {
    zustand = "gepraegt";
    clearTimeout(vonSelbst);
    kraft.halte();
    kraftEl.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.25)" }], { duration: 420, easing: "ease-out", fill: "forwards" });
    hinweis.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" });
    tick(22);
    // Der Stempel trifft: stauchen und zurückfedern, das Relief ist da
    schlagFeder.springe(0.84); schlagFeder.zu(1);
    reliefFeder.zu(1);
    blitz.animate([{ opacity: 0.95, transform: "scale(0.7)" }, { opacity: 0, transform: "scale(1.9)" }], { duration: 520, easing: "cubic-bezier(.1,.7,.2,1)" });
    welle.animate([{ opacity: 0.9, transform: "scale(0.9)" }, { opacity: 0, transform: "scale(2.5)" }], { duration: 900, easing: "cubic-bezier(.1,.7,.2,1)" });
    const r = halter.getBoundingClientRect();
    stieben({ x: r.left + r.width / 2, y: r.top + r.height / 2, menge: 46, kraft: 1.25, welle: 0 });
    kreiseln();
  }

  // ---- 3. Auskreiseln wie eine Münze auf dem Tisch ----
  function kreiseln() {
    let t = 0; let zuletzt = performance.now(); let halbe = 0;
    const ab = imTakt((jetzt) => {
      const dt = Math.min(0.05, (jetzt - zuletzt) / 1000) * zeitfaktor();
      zuletzt = jetzt; t += dt;
      const rest = Math.max(0, 1 - t / KREISEL_SEKUNDEN);
      theta = STARTNEIGUNG * Math.cbrt(rest);                            // Neigung fällt mit der dritten Wurzel der Restzeit
      const tempo = Math.min(58, 5.4 / Math.sqrt(Math.max(theta, 0.008))); // Umlauf wird schneller, je flacher sie liegt
      phi += tempo * dt;
      // Jeder halbe Umlauf schlägt einmal auf – solange das Handy noch mitkommt
      if (Math.floor(phi / Math.PI) > halbe) { halbe = Math.floor(phi / Math.PI); if (tempo < 30) tick(3); }
      if (rest <= 0) {
        ab(); theta = 0; phi = 0; stelle(); tick(14);
        zustand = "liegt";
        ebene.classList.add("ist-gepraegt");
        text.animate([{ opacity: 0, transform: "translate3d(0, 10px, 0)" }, { opacity: 1, transform: "none" }], { duration: 520, easing: "cubic-bezier(.2,.9,.25,1)", fill: "forwards" });
        return;
      }
      stelle();
    });
  }

  // ---- 4. Wenden mit dem Finger ----
  const wendeFeder = new Feder(0, { antwort: 0.55, daempfung: 0.7, genau: 0.05, beiWert: (x) => { wende = x; stelle(); } });
  let wendeStart = 0;
  ziehe(halter, {
    achse: "x", schwelle: 6,
    darf: () => zustand === "liegt",
    start: () => { wendeFeder.halte(); wendeStart = wende; },
    bewege: ({ dx }) => { wende = wendeStart + dx * 0.9; stelle(); },
    ende: ({ vx }) => {
      const wurf = wende + vx * 0.9 * 0.18;                               // wohin sie von selbst noch drehen würde
      wendeFeder.springe(wende);
      wendeFeder.zu(Math.round(wurf / 180) * 180, { tempo: vx * 0.9 });
      tick(5);
    },
  });

  // ---- Ablegen ----
  function ablegen() {
    if (zustand === "geht") return;
    zustand = "geht";
    clearTimeout(vonSelbst);
    lichtAb(); fingerAb();
    quelle = vermesse(ablage ?? herkunft);
    ebene.classList.remove("ist-gepraegt");
    text.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
    wendeFeder.zu(Math.round(wende / 360) * 360);
    flug.zu(0).then(() => { ebene.remove(); fertigOk(); });
  }
  const anfrage = buehne ? ablegen : ebeneAnmelden(ebene, ablegen);
  // Ein Tipp neben die Münze legt sie ab
  ebene.addEventListener("click", (e) => { if (zustand === "liegt" && !halter.contains(e.target)) anfrage(); });

  // ---- Los ----
  stelle();
  if (wenigBewegung() || sofort) {
    reliefFeder.springe(1); kraftEl.style.opacity = "0"; hinweis.style.opacity = "0";
    clearTimeout(vonSelbst);
    zustand = "liegt"; ebene.classList.add("ist-gepraegt"); text.style.opacity = "1";
    if (wenigBewegung()) setzeFlug(1);
    else { quelle = vermesse(herkunft); setzeFlug(0); requestAnimationFrame(() => flug.zu(1)); }
  } else {
    reliefFeder.springe(0);
    quelle = vermesse(herkunft);
    setzeFlug(0);
    requestAnimationFrame(() => flug.zu(1));
  }

  return { fertig, ablegen: () => anfrage(), el: ebene, get zustand() { return zustand; } };
}
