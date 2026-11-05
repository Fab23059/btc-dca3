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
//   B8  Bei jedem Zeitraumwechsel fährt ein Komet die Linie von links
//       nach rechts ab: Schweif, Funken, die Käufe zünden im Vorbeiflug,
//       im Jetzt läuft eine Lichtwelle aus.
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

export function linie(behaelter, { beimScrubben = () => {}, beiAnkunft = () => {} } = {}) {
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
  let marken = [];                                  // Käufe auf der Linie: { spalte, zuend }
  let treppe = true;                                // Treppe der Einzahlungen zeigen?
  const funken = [];                                // Funken, die der Komet verliert
  let bildZeit = 0; let letzterKopf = -1;
  let blitzWert = 0;                                // Aufblitzen bei der Ankunft im Jetzt

  const morph = new Feder(1, { art: "raum", genau: 0.001, beiWert: () => malen() });
  const aufzug = new Feder(1, { antwort: 1.25, daempfung: 1, genau: 0.001, beiWert: () => malen() });
  const blitz = new Feder(0, { antwort: 1.1, daempfung: 1, genau: 0.002, beiWert: (x) => { blitzWert = x; malen(); } });
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
    const kaeufe = daten.filter((p) => p.kauf);
    marken = kaeufe.length <= 120 ? kaeufe.map((p) => ({ spalte: Math.round(((p.t - a) / (b - a || 1)) * (N - 1)), zuend: -1 })) : [];
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
    const jetzt = performance.now();
    const dt = bildZeit ? Math.min(0.05, (jetzt - bildZeit) / 1000) : 0;
    bildZeit = jetzt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, B, H);
    const faehrt = aufzug.wert < 0.999;
    const bis = Math.max(1, Math.round(aufzug.wert * (N - 1)));
    const s = scrub == null ? null : klemme(Math.round(scrub), 0, N - 1);
    const ende = s ?? bis;

    // Fläche unter der Linie: Glut, die nach unten verlischt
    const g = ctx.createLinearGradient(0, OBEN, 0, H);
    g.addColorStop(0, `rgba(${GLUT}, 0.26)`); g.addColorStop(0.55, `rgba(${GLUT}, 0.07)`); g.addColorStop(1, `rgba(${GLUT}, 0)`);
    ctx.beginPath(); ctx.moveTo(x(0), H);
    for (let i = 0; i <= ende; i++) ctx.lineTo(x(i), d.ys[i]);
    ctx.lineTo(x(ende), H); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();

    // Treppe der Einzahlungen
    if (treppe) {
      ctx.beginPath();
      for (let i = 0; i <= bis; i++) (i ? ctx.lineTo(x(i), d.inv[i]) : ctx.moveTo(x(i), d.inv[i]));
      ctx.strokeStyle = "rgba(242, 237, 230, 0.26)"; ctx.lineWidth = 1; ctx.lineJoin = "miter"; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    }

    // Die Linie: breiter Schein darunter, heller Kern darüber.
    // Bei der Zeitreise verblasst die "Zukunft" rechts vom Finger.
    const pfad = (von, b2) => { ctx.beginPath(); ctx.moveTo(x(von), d.ys[von]); for (let i = von + 1; i <= b2; i++) ctx.lineTo(x(i), d.ys[i]); };
    const kern = ctx.createLinearGradient(0, 0, B, 0);
    kern.addColorStop(0, `rgba(${GLUT}, 0.75)`); kern.addColorStop(0.7, `rgb(${GLUT})`); kern.addColorStop(1, "#FFC98F");
    const strich = (von, b2, alpha, schein) => {
      if (b2 <= von) return;
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      if (schein) {
        pfad(von, b2);
        ctx.strokeStyle = `rgba(${GLUT}, ${0.2 * schein})`; ctx.lineWidth = 7;
        ctx.shadowColor = `rgba(${GLUT}, ${0.9 * schein})`; ctx.shadowBlur = 22;
        ctx.stroke(); ctx.shadowBlur = 0;
      }
      pfad(von, b2);
      ctx.globalAlpha = alpha; ctx.strokeStyle = kern; ctx.lineWidth = 2.2;
      ctx.stroke(); ctx.globalAlpha = 1;
    };
    const energie = 0.75 + 0.25 * glanz + 0.6 * (1 - blitzWert) * (blitzWert > 0 ? 1 : 0);
    if (s == null) strich(0, bis, 1, Math.min(1.4, energie));
    else { strich(0, s, 1, 1 + 0.4 * glanz); strich(s, bis, 0.22, 0); }

    // Käufe als Punkte auf der Linie – sie zünden, wenn der Komet vorbeizieht
    for (const m of marken) {
      if (m.spalte > bis || m.spalte < 0 || m.spalte >= N) continue;
      if (m.zuend < 0) m.zuend = faehrt ? jetzt : jetzt - 2000;
      const alter = (jetzt - m.zuend) / 1000;
      const pop = alter < 0.6 ? 1 + 1.6 * Math.exp(-alter * 7) * Math.sin(Math.min(Math.PI, alter * 9)) : 1;
      const zukunft = s != null && m.spalte > s;
      const py = d.ys[m.spalte];
      if (alter < 0.6) {
        const halo = ctx.createRadialGradient(x(m.spalte), py, 0, x(m.spalte), py, 14);
        halo.addColorStop(0, `rgba(${GLUT}, ${0.6 * (1 - alter / 0.6)})`); halo.addColorStop(1, `rgba(${GLUT}, 0)`);
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x(m.spalte), py, 14, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = zukunft ? "rgba(255, 227, 196, 0.25)" : "rgba(255, 233, 210, 0.92)";
      ctx.beginPath(); ctx.arc(x(m.spalte), py, 1.9 * pop, 0, Math.PI * 2); ctx.fill();
    }

    // Komet beim Aufziehen: langer Schweif, heller Kopf, Funken
    if (faehrt) {
      const schweif = Math.min(bis, 110);
      const kx = x(bis); const ky = d.ys[bis];
      const sg = ctx.createLinearGradient(x(bis - schweif), 0, kx, 0);
      sg.addColorStop(0, "rgba(255, 200, 140, 0)"); sg.addColorStop(1, "rgba(255, 236, 214, 0.95)");
      pfad(bis - schweif, bis);
      ctx.strokeStyle = sg; ctx.lineWidth = 3.6; ctx.shadowColor = `rgba(${GLUT}, 1)`; ctx.shadowBlur = 16; ctx.stroke(); ctx.shadowBlur = 0;
      punkt(kx, ky, 4.5, 1.1);
      if (letzterKopf >= 0 && bis > letzterKopf && !wenigBewegung()) {
        const n = Math.min(5, 1 + Math.round((bis - letzterKopf) / 5));
        for (let i = 0; i < n; i++) {
          funken.push({ x: kx, y: ky, vx: -20 - Math.random() * 90, vy: -70 + Math.random() * 90, leben: 0.35 + Math.random() * 0.6, alt: 0, r: 0.7 + Math.random() * 1.3 });
        }
      }
      letzterKopf = bis;
    } else letzterKopf = -1;

    // Funken: fliegen, fallen leicht, verglühen
    if (funken.length) {
      ctx.globalCompositeOperation = "lighter";
      for (let i = funken.length - 1; i >= 0; i--) {
        const f = funken[i];
        f.alt += dt; f.vy += 140 * dt; f.vx *= 0.97; f.x += f.vx * dt; f.y += f.vy * dt;
        const rest = 1 - f.alt / f.leben;
        if (rest <= 0) { funken.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(255, ${Math.round(150 + 80 * rest)}, ${Math.round(70 + 90 * rest)}, ${(0.9 * rest).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + rest * 0.6), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // Ankunft im Jetzt: eine Lichtwelle läuft vom Endpunkt aus
    if (blitzWert > 0 && blitzWert < 1) {
      const ex = x(N - 1); const ey = d.ys[N - 1];
      const r = 6 + 54 * blitzWert;
      ctx.strokeStyle = `rgba(255, 214, 170, ${(0.85 * (1 - blitzWert)).toFixed(3)})`; ctx.lineWidth = 2 * (1 - blitzWert) + 0.5;
      ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(${GLUT}, ${(0.5 * (1 - blitzWert)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.55, 0, Math.PI * 2); ctx.stroke();
      punkt(ex, ey, 3 + 4 * (1 - blitzWert), 1.4 * (1 - blitzWert));
    }

    // Zeiger der Zeitreise
    if (s != null) {
      const xs = x(s);
      const lg = ctx.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, `rgba(${GLUT}, 0)`); lg.addColorStop(0.5, `rgba(${GLUT}, ${0.45 + 0.45 * glanz})`); lg.addColorStop(1, `rgba(${GLUT}, 0)`);
      ctx.fillStyle = lg; ctx.fillRect(xs - 0.75, 0, 1.5, H);
      punkt(xs, d.ys[s], 5, 0.7 + 0.5 * glanz);
    }
    // Lage des "Jetzt"-Punkts (der atmende Punkt ist ein eigenes Element)
    const endeY = d.ys[N - 1];
    kopf.style.transform = `translate3d(${x(N - 1).toFixed(1)}px, ${endeY.toFixed(1)}px, 0)`;
    kopf.classList.toggle("ist-sichtbar", !faehrt && s == null);

    // Solange etwas glüht oder fliegt: weiterzeichnen
    const glueht = marken.some((m) => m.zuend >= 0 && jetzt - m.zuend < 650);
    if (funken.length || glueht) malen();
    else bildZeit = 0;
  }

  function punkt(px, py, r, staerke) {
    const halo = ctx.createRadialGradient(px, py, 0, px, py, r * 6);
    halo.addColorStop(0, `rgba(${GLUT}, ${Math.min(1, 0.6 * staerke)})`); halo.addColorStop(1, `rgba(${GLUT}, 0)`);
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(px, py, r * 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#FFEBD6"; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
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
    zeige(daten, { fliessen = true, aufziehen = false, mitTreppe = true } = {}) {
      if (!B) mass();
      treppe = mitTreppe;
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
      if (aufziehen && !wenigBewegung()) {
        for (const m of marken) m.zuend = -1;
        funken.length = 0;
        aufzug.springe(0);
        blitz.springe(0);
        aufzug.zu(1).then(() => {
          if (aufzug.wert < 0.999) return;            // unterbrochen (neuer Lauf)
          blitz.springe(0); blitz.zu(1).then(() => { blitzWert = 0; malen(); });
          beiAnkunft();
        });
      } else malen();
    },
    achsen(links, rechts) { achseL.textContent = links; achseR.textContent = rechts; },
    get scrubbt() { return scrub != null; },
  };
}
