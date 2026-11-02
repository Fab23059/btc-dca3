// =====================================================================
// linie.js – Die Linie: Wert des Depots über der Treppe der Einzahlungen.
// Selbst gezeichnet, weil sie Dinge kann, die eine fertige Bibliothek
// nicht kann:
//
//   B4  Wechselt der Zeitraum, fließt die Linie in ihre neue Form –
//       jeder Punkt federt einzeln von alt nach neu.
//   B3  Zeitreise: Der Finger fährt über die Linie, der Moment wird
//       gemeldet (alle Zahlen rollen dorthin), die Zukunft rechts davon
//       verblasst. Loslassen: Die Zeit gleitet zurück ins Jetzt.
//   B8  Beim ersten Mal zieht sich die Linie von links nach rechts.
//   R6  Licht aus Bewegung: Der Zeiger leuchtet stärker, je schneller
//       der Finger ist.
//
// Gezeichnet wird nur, solange sich etwas bewegt.
// =====================================================================

import { h, wenigBewegung } from "../dom.js";
import { Feder, imTakt, klemme } from "../bewegung/feder.js";
import { ziehe } from "../bewegung/geste.js";
import { tick } from "./haptik.js";

const OBEN = 22; const UNTEN = 14; const RECHTS = 22;
const GLUT = [255, 138, 42];

/** Wert an Zeitpunkt t (linear zwischen Nachbarpunkten; bei gleichem t gilt der spätere). */
function wertBei(punkte, t, schl) {
  let lo = 0; let hi = punkte.length - 1;
  if (t <= punkte[0].t) return punkte[0][schl];
  if (t >= punkte[hi].t) return punkte[hi][schl];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (punkte[m].t <= t) lo = m; else hi = m; }
  const a = punkte[lo]; const b = punkte[hi];
  if (schl === "investiert") return a.investiert;                 // Treppe: springt erst beim Kauf
  const k = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
  return a[schl] + (b[schl] - a[schl]) * k;
}

/** Index des Punkts, der t am nächsten liegt. */
export function naechsterPunkt(punkte, t) {
  let lo = 0; let hi = punkte.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (punkte[m].t <= t) lo = m; else hi = m; }
  return Math.abs(punkte[hi].t - t) < Math.abs(t - punkte[lo].t) ? hi : lo;
}

export function linie(behaelter, { beimScrubben = () => {} } = {}) {
  const leinwand = h("canvas", { class: "linie-leinwand", role: "img", "aria-label": "Verlauf: Wert deines Depots über deinen Einzahlungen" });
  const kopf = h("span", { class: "linie-kopf", "aria-hidden": "true" });
  const achseL = h("span", { class: "linie-achse linie-achse--links" });
  const achseR = h("span", { class: "linie-achse linie-achse--rechts" });
  behaelter.append(leinwand, kopf, h("div", { class: "linie-achsen", "aria-hidden": "true" }, achseL, achseR));
  const ctx = leinwand.getContext("2d");

  let B = 0; let H = 0; let dpr = 1; let N = 0;
  let punkte = [];
  let t0 = 0; let t1 = 1;
  let alt = null; let neu = null;                  // Bildschirm-Y je Spalte
  let scrub = null;                                 // Spalte (Kommazahl) oder null
  let glanz = 0;                                    // Leuchtkraft des Zeigers
  let leer = true;

  const morph = new Feder(1, { art: "raum", genau: 0.001, beiWert: () => malen() });
  const aufzug = new Feder(1, { antwort: 1.1, daempfung: 1, genau: 0.001, beiWert: () => malen() });
  const zeiger = new Feder(0, { art: "zeiger", genau: 0.05, beiWert: (x) => { scrub = x; melde(); malen(); } });
  const licht = new Feder(0, { art: "ruhig", genau: 0.002, beiWert: (x) => { glanz = x; malen(); } });

  function mass() {
    const r = behaelter.getBoundingClientRect();
    if (!r.width) return false;
    dpr = Math.min(3, devicePixelRatio || 1);
    B = r.width; H = leinwand.clientHeight || 240;
    leinwand.width = Math.round(B * dpr); leinwand.height = Math.round(H * dpr);
    N = Math.max(2, Math.round(B - RECHTS));
    return true;
  }

  /** Bildschirm-Koordinaten für die Daten (eine Spalte je Pixel). */
  function rechne(daten) {
    const ys = new Float32Array(N); const inv = new Float32Array(N);
    const a = daten[0].t; const b = daten[daten.length - 1].t;
    const werte = new Float64Array(N); const einz = new Float64Array(N);
    let min = Infinity; let max = -Infinity;
    for (let i = 0; i < N; i++) {
      const t = a + ((b - a) * i) / (N - 1);
      werte[i] = wertBei(daten, t, "wert"); einz[i] = wertBei(daten, t, "investiert");
      min = Math.min(min, werte[i], einz[i]); max = Math.max(max, werte[i], einz[i]);
    }
    const abNull = daten[0].investiert < 1;
    const rand = (max - min || max || 1) * 0.1;
    if (abNull) min = 0; else min -= rand;
    max += rand * 0.6;
    const y = (v) => OBEN + (1 - (v - min) / (max - min || 1)) * (H - OBEN - UNTEN);
    for (let i = 0; i < N; i++) { ys[i] = y(werte[i]); inv[i] = y(einz[i]); }
    return { ys, inv, a, b };
  }

  const x = (i) => (i / (N - 1)) * (B - RECHTS);

  function aktuell() {
    if (!neu) return null;
    const m = morph.wert;
    if (!alt || m >= 1 || alt.ys.length !== N) return neu;
    const ys = new Float32Array(N); const inv = new Float32Array(N);
    for (let i = 0; i < N; i++) { ys[i] = alt.ys[i] + (neu.ys[i] - alt.ys[i]) * m; inv[i] = alt.inv[i] + (neu.inv[i] - alt.inv[i]) * m; }
    return { ys, inv };
  }

  let geplant = false;
  function malen() {
    if (geplant) return;
    geplant = true;
    const ab = imTakt(() => { ab(); geplant = false; zeichne(); });
  }

  function zeichne() {
    if (!B || leer) return;
    const d = aktuell();
    if (!d) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, B, H);
    const bis = Math.max(1, Math.round(aufzug.wert * (N - 1)));
    const s = scrub == null ? null : klemme(Math.round(scrub), 0, N - 1);

    // Fläche unter der Linie: ein Hauch Glut, der nach unten verlischt
    const g = ctx.createLinearGradient(0, OBEN, 0, H);
    g.addColorStop(0, `rgba(${GLUT}, 0.13)`); g.addColorStop(1, `rgba(${GLUT}, 0)`);
    ctx.beginPath(); ctx.moveTo(x(0), H);
    for (let i = 0; i <= bis; i++) ctx.lineTo(x(i), d.ys[i]);
    ctx.lineTo(x(bis), H); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();

    // Treppe der Einzahlungen
    ctx.beginPath();
    for (let i = 0; i <= bis; i++) (i ? ctx.lineTo(x(i), d.inv[i]) : ctx.moveTo(x(i), d.inv[i]));
    ctx.strokeStyle = "rgba(242, 237, 230, 0.24)"; ctx.lineWidth = 1; ctx.lineJoin = "miter"; ctx.stroke();

    // Die Linie – bei der Zeitreise verblasst die "Zukunft" rechts vom Finger
    const strich = (von, b2, alpha, schein) => {
      if (b2 <= von) return;
      ctx.beginPath(); ctx.moveTo(x(von), d.ys[von]);
      for (let i = von + 1; i <= b2; i++) ctx.lineTo(x(i), d.ys[i]);
      ctx.strokeStyle = `rgba(${GLUT}, ${alpha})`; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.shadowColor = `rgba(${GLUT}, ${schein})`; ctx.shadowBlur = schein ? 12 : 0;
      ctx.stroke(); ctx.shadowBlur = 0;
    };
    if (s == null) strich(0, bis, 1, 0.45);
    else { strich(0, s, 1, 0.5); strich(s, bis, 0.28, 0); }

    // Komet beim Aufziehen
    if (aufzug.wert < 1) punkt(x(bis), d.ys[bis], 3.5, 0.9);

    // Zeiger der Zeitreise
    if (s != null) {
      const xs = x(s);
      const lg = ctx.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, `rgba(${GLUT}, 0)`); lg.addColorStop(0.5, `rgba(${GLUT}, ${0.35 + 0.4 * glanz})`); lg.addColorStop(1, `rgba(${GLUT}, 0)`);
      ctx.fillStyle = lg; ctx.fillRect(xs - 0.5, 0, 1, H);
      punkt(xs, d.ys[s], 4.5, 0.55 + 0.45 * glanz);
    }
    // Lage des "Jetzt"-Punkts (der atmende Punkt ist ein eigenes Element)
    const ende = d.ys[N - 1];
    kopf.style.transform = `translate3d(${x(N - 1).toFixed(1)}px, ${ende.toFixed(1)}px, 0)`;
    kopf.classList.toggle("ist-sichtbar", aufzug.wert >= 1 && s == null);
  }

  function punkt(px, py, r, staerke) {
    const halo = ctx.createRadialGradient(px, py, 0, px, py, r * 5);
    halo.addColorStop(0, `rgba(${GLUT}, ${0.55 * staerke})`); halo.addColorStop(1, `rgba(${GLUT}, 0)`);
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(px, py, r * 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#FFE3C4"; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }

  // ---- Zeitreise ----
  let letzterKauf = null;
  function melde() {
    if (scrub == null || !punkte.length) return;
    const anteil = klemme(scrub / (N - 1));
    const t = t0 + (t1 - t0) * anteil;
    const p = punkte[naechsterPunkt(punkte, t)];
    beimScrubben({ punkt: p, t, anteil, zurueck: !zeiger.ruht });
  }
  let letztesX = 0; let letzteZeit = 0;
  ziehe(leinwand, {
    achse: "x", schwelle: 4,
    darf: () => !leer && N > 2,
    start: ({ x: px }) => {
      zeiger.halte(); licht.halte();
      const r = leinwand.getBoundingClientRect();
      scrub = klemme(px - r.left, 0, B - RECHTS) / (B - RECHTS) * (N - 1);
      letztesX = px; letzteZeit = performance.now();
      behaelter.classList.add("wird-gescrubbt");
      melde(); malen();
    },
    bewege: ({ x: px }) => {
      const r = leinwand.getBoundingClientRect();
      scrub = (klemme(px - r.left, 0, B - RECHTS) / (B - RECHTS)) * (N - 1);
      const jetzt = performance.now();
      const tempo = Math.abs(px - letztesX) / Math.max(8, jetzt - letzteZeit) * 1000;
      letztesX = px; letzteZeit = jetzt;
      glanz = Math.min(1, glanz * 0.7 + Math.min(1, tempo / 1400) * 0.5);
      const p = punkte[naechsterPunkt(punkte, t0 + (t1 - t0) * (scrub / (N - 1)))];
      if (p.kauf && p.kauf.nr !== letzterKauf) { tick(5); letzterKauf = p.kauf.nr; }
      melde(); malen();
    },
    ende: () => {
      behaelter.classList.remove("wird-gescrubbt");
      licht.springe(glanz); licht.zu(0);
      if (wenigBewegung()) { scrub = null; beimScrubben(null); malen(); return; }
      zeiger.springe(scrub);
      zeiger.zu(N - 1).then(() => { if (zeiger.wert >= N - 1.5) { scrub = null; beimScrubben(null); malen(); } });
    },
  });

  new ResizeObserver(() => { if (mass() && punkte.length) { neu = rechne(punkte); alt = null; malen(); } }).observe(behaelter);

  return {
    /** Neue Daten zeigen. fliessen: Linie fließt von der alten Form; aufziehen: von links einzeichnen. */
    zeige(daten, { fliessen = true, aufziehen = false } = {}) {
      if (!B) mass();
      leer = !daten || daten.length < 2;
      behaelter.classList.toggle("ist-leer", leer);
      if (leer) { ctx.clearRect(0, 0, leinwand.width, leinwand.height); kopf.classList.remove("ist-sichtbar"); return; }
      const vorher = neu ? aktuell() : null;
      punkte = daten; t0 = daten[0].t; t1 = daten[daten.length - 1].t;
      neu = rechne(daten);
      if (vorher && fliessen && vorher.ys.length === N && !aufziehen) {
        alt = { ys: Float32Array.from(vorher.ys), inv: Float32Array.from(vorher.inv) };
        morph.springe(0); morph.zu(1);
      } else { alt = null; morph.springe(1); }
      if (aufziehen && !wenigBewegung()) { aufzug.springe(0); aufzug.zu(1); } else malen();
    },
    achsen(links, rechts) { achseL.textContent = links; achseR.textContent = rechts; },
    get scrubbt() { return scrub != null; },
  };
}
