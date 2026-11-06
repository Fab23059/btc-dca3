// =====================================================================
// kurslinie.js – Der Kursverlauf von Bitcoin, selbst gezeichnet.
//
//   * Bei jedem Zeitraum fährt ein Komet die Linie ab (Schweif, Funken).
//   * Deine Käufe sitzen als helle Punkte auf der Linie und zünden im
//     Vorbeiflug.
//   * Gestrichelt: dein Ø-Kaufpreis. Was darüber liegt, ist im Plus.
//   * Hoch und Tief des Zeitraums sind beschriftet.
//   * Finger auf die Linie: Zeiger, Kurs und Zeitpunkt unter dem Finger.
// =====================================================================

import { h, wenigBewegung } from "../dom.js";
import { Feder, imTakt, klemme } from "../bewegung/feder.js";
import { ziehe } from "../bewegung/geste.js";
import { tick } from "./haptik.js";
import { euro } from "../format.js";

const OBEN = 26; const UNTEN = 22; const RECHTS = 16; const LINKS = 0;
const GLUT = [255, 138, 42];

function kursBeiSpalte(punkte, t) {
  let lo = 0; let hi = punkte.length - 1;
  if (t <= punkte[0].t) return punkte[0].c;
  if (t >= punkte[hi].t) return punkte[hi].c;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (punkte[m].t <= t) lo = m; else hi = m; }
  const a = punkte[lo]; const b = punkte[hi];
  return a.c + ((b.c - a.c) * (t - a.t)) / (b.t - a.t || 1);
}

export function kurslinie(behaelter, { beimScrubben = () => {}, beiAnkunft = () => {} } = {}) {
  const leinwand = h("canvas", { class: "kurslinie-leinwand", role: "img", "aria-label": "Kursverlauf von Bitcoin mit deinen Käufen" });
  behaelter.append(leinwand);
  const ctx = leinwand.getContext("2d");

  let B = 0; let H = 0; let dpr = 1; let N = 0;
  let punkte = []; let t0 = 0; let t1 = 1;
  let ys = null; let werte = null; let yVon = null;
  let min = 0; let max = 1; let minI = 0; let maxI = 0;
  let marken = []; let referenz = null;
  let scrub = null; let leer = true;
  const funken = []; let bildZeit = 0; let letzterKopf = -1; let blitzWert = 0;

  const aufzug = new Feder(1, { antwort: 1.15, daempfung: 1, genau: 0.001, beiWert: () => malen() });
  const blitz = new Feder(0, { antwort: 1, daempfung: 1, genau: 0.002, beiWert: (x) => { blitzWert = x; malen(); } });
  const zeiger = new Feder(0, { art: "zeiger", genau: 0.05, beiWert: (x) => { scrub = x; melde(); malen(); } });

  function mass() {
    const r = behaelter.getBoundingClientRect();
    if (!r.width) return false;
    dpr = Math.min(3, devicePixelRatio || 1);
    B = r.width; H = leinwand.clientHeight || 220;
    leinwand.width = Math.round(B * dpr); leinwand.height = Math.round(H * dpr);
    N = Math.max(2, Math.round(B - RECHTS - LINKS));
    return true;
  }
  const x = (i) => LINKS + (i / (N - 1)) * (B - RECHTS - LINKS);
  const yWert = (v) => OBEN + (1 - (v - min) / (max - min || 1)) * (H - OBEN - UNTEN);

  function rechne() {
    werte = new Float64Array(N); ys = new Float32Array(N);
    t0 = punkte[0].t; t1 = punkte[punkte.length - 1].t;
    let lo = Infinity; let hi = -Infinity;
    for (let i = 0; i < N; i++) {
      const v = kursBeiSpalte(punkte, t0 + ((t1 - t0) * i) / (N - 1));
      werte[i] = v;
      if (v < lo) { lo = v; minI = i; }
      if (v > hi) { hi = v; maxI = i; }
    }
    let a = lo; let b = hi;
    if (referenz != null && referenz > lo * 0.85 && referenz < hi * 1.15) { a = Math.min(a, referenz); b = Math.max(b, referenz); }
    const rand = (b - a || b * 0.01) * 0.12;
    min = a - rand; max = b + rand;
    for (let i = 0; i < N; i++) ys[i] = yWert(werte[i]);
    for (const m of marken) { m.spalte = Math.round(((m.t - t0) / (t1 - t0 || 1)) * (N - 1)); m.zuend = -1; }
  }

  let geplant = false;
  function malen() {
    if (geplant) return;
    geplant = true;
    const ab = imTakt(() => { ab(); geplant = false; zeichne(); });
  }

  function punkt(px, py, r, staerke, kern = "#FFEBD6") {
    const halo = ctx.createRadialGradient(px, py, 0, px, py, r * 6);
    halo.addColorStop(0, `rgba(${GLUT}, ${Math.min(1, 0.6 * staerke)})`); halo.addColorStop(1, `rgba(${GLUT}, 0)`);
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(px, py, r * 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = kern; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }

  function beschriftung(text, px, py, oben) {
    ctx.font = "600 11px Mona, system-ui, sans-serif";
    const b = ctx.measureText(text).width;
    const lx = klemme(px - b / 2, 2, B - b - 2);
    ctx.fillStyle = "rgba(242, 237, 230, 0.62)";
    ctx.fillText(text, lx, oben ? py - 9 : py + 17);
  }

  function zeichne() {
    if (!B || leer || !ys) return;
    const jetzt = performance.now();
    const dt = bildZeit ? Math.min(0.05, (jetzt - bildZeit) / 1000) : 0;
    bildZeit = jetzt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, B, H);
    const faehrt = aufzug.wert < 0.999;
    const bis = Math.max(1, Math.round(aufzug.wert * (N - 1)));
    const s = scrub == null ? null : klemme(Math.round(scrub), 0, N - 1);

    // Ø-Kaufpreis: gestrichelte Linie, darüber bist du im Plus
    if (referenz != null && referenz >= min && referenz <= max) {
      const ry = yWert(referenz);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(242, 237, 230, 0.32)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(B, ry); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = "600 10.5px Mona, system-ui, sans-serif"; ctx.fillStyle = "rgba(242, 237, 230, 0.5)";
      const t = `Ø ${euro(referenz, 0)}`;
      // Links, außer dort liegt die Linie selbst gerade sehr nah
      const links = Math.abs(ys[0] - ry) > 18 || Math.abs(ys[N - 1] - ry) < 18;
      ctx.fillText(t, links ? 4 : B - ctx.measureText(t).width - RECHTS - 4, ry - 6);
    }

    // Fläche
    const g = ctx.createLinearGradient(0, OBEN, 0, H);
    g.addColorStop(0, `rgba(${GLUT}, 0.28)`); g.addColorStop(0.6, `rgba(${GLUT}, 0.06)`); g.addColorStop(1, `rgba(${GLUT}, 0)`);
    ctx.beginPath(); ctx.moveTo(x(0), H);
    for (let i = 0; i <= bis; i++) ctx.lineTo(x(i), ys[i]);
    ctx.lineTo(x(bis), H); ctx.closePath(); ctx.fillStyle = g; ctx.fill();

    const pfad = (von, b2) => { ctx.beginPath(); ctx.moveTo(x(von), ys[von]); for (let i = von + 1; i <= b2; i++) ctx.lineTo(x(i), ys[i]); };
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    // Schein ohne Unschärfe-Filter (zwei breite, durchscheinende Striche)
    pfad(0, bis);
    ctx.strokeStyle = `rgba(${GLUT}, 0.07)`; ctx.lineWidth = 13; ctx.stroke();
    ctx.strokeStyle = `rgba(${GLUT}, 0.15)`; ctx.lineWidth = 6; ctx.stroke();
    const kern = ctx.createLinearGradient(0, 0, B, 0);
    kern.addColorStop(0, `rgba(${GLUT}, 0.8)`); kern.addColorStop(0.75, `rgb(${GLUT})`); kern.addColorStop(1, "#FFC98F");
    if (s == null) { pfad(0, bis); ctx.strokeStyle = kern; ctx.lineWidth = 2; ctx.stroke(); }
    else {
      pfad(0, s); ctx.strokeStyle = kern; ctx.lineWidth = 2; ctx.stroke();
      ctx.globalAlpha = 0.25; pfad(s, bis); ctx.stroke(); ctx.globalAlpha = 1;
    }

    // Hoch und Tief
    if (!faehrt && s == null && N > 40) {
      if (maxI <= bis) { punkt(x(maxI), ys[maxI], 1.6, 0.4, "rgba(255,235,214,0.9)"); beschriftung(`Hoch ${euro(werte[maxI], 0)}`, x(maxI), ys[maxI], true); }
      if (minI <= bis && Math.abs(minI - maxI) > 4) { punkt(x(minI), ys[minI], 1.6, 0.4, "rgba(255,235,214,0.9)"); beschriftung(`Tief ${euro(werte[minI], 0)}`, x(minI), ys[minI], false); }
    }

    // Deine Käufe
    for (const m of marken) {
      if (m.spalte < 0 || m.spalte >= N || m.spalte > bis) continue;
      if (m.zuend < 0) m.zuend = faehrt ? jetzt : jetzt - 2000;
      const alter = (jetzt - m.zuend) / 1000;
      const pop = alter < 0.6 ? 1 + 1.5 * Math.exp(-alter * 7) * Math.sin(Math.min(Math.PI, alter * 9)) : 1;
      const py = yWert(m.c);
      if (alter < 0.6) {
        const halo = ctx.createRadialGradient(x(m.spalte), py, 0, x(m.spalte), py, 16);
        halo.addColorStop(0, `rgba(${GLUT}, ${0.7 * (1 - alter / 0.6)})`); halo.addColorStop(1, `rgba(${GLUT}, 0)`);
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x(m.spalte), py, 16, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#130F0C"; ctx.beginPath(); ctx.arc(x(m.spalte), py, 4.2 * pop, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = s != null && Math.abs(m.spalte - s) <= 3 ? "#FFFFFF" : "rgba(255, 240, 226, 0.95)";
      ctx.beginPath(); ctx.arc(x(m.spalte), py, 2.8 * pop, 0, Math.PI * 2); ctx.fill();
    }

    // Komet
    if (faehrt) {
      const schweif = Math.min(bis, 100);
      const kx = x(bis); const ky = ys[bis];
      const sg = ctx.createLinearGradient(x(bis - schweif), 0, kx, 0);
      sg.addColorStop(0, "rgba(255, 200, 140, 0)"); sg.addColorStop(1, "rgba(255, 236, 214, 0.95)");
      const sw = ctx.createLinearGradient(x(bis - schweif), 0, kx, 0);
      sw.addColorStop(0, `rgba(${GLUT}, 0)`); sw.addColorStop(1, `rgba(${GLUT}, 0.35)`);
      pfad(bis - schweif, bis); ctx.strokeStyle = sw; ctx.lineWidth = 10; ctx.stroke();
      ctx.strokeStyle = sg; ctx.lineWidth = 3.4; ctx.stroke();
      punkt(kx, ky, 4.2, 1.1);
      if (letzterKopf >= 0 && bis > letzterKopf && !wenigBewegung()) {
        const n = Math.min(5, 1 + Math.round((bis - letzterKopf) / 5));
        for (let i = 0; i < n; i++) funken.push({ x: kx, y: ky, vx: -20 - Math.random() * 90, vy: -70 + Math.random() * 90, leben: 0.35 + Math.random() * 0.55, alt: 0, r: 0.7 + Math.random() * 1.2 });
      }
      letzterKopf = bis;
    } else letzterKopf = -1;

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

    // Endpunkt; bei Ankunft läuft eine Welle aus
    if (!faehrt && s == null) {
      const ex = x(N - 1); const ey = ys[N - 1];
      punkt(ex, ey, 3.4, 0.95);
      if (blitzWert > 0 && blitzWert < 1) {
        ctx.strokeStyle = `rgba(255, 214, 170, ${(0.85 * (1 - blitzWert)).toFixed(3)})`; ctx.lineWidth = 2 * (1 - blitzWert) + 0.5;
        ctx.beginPath(); ctx.arc(ex, ey, 6 + 46 * blitzWert, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // Zeiger
    if (s != null) {
      const xs = x(s);
      const lg = ctx.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, `rgba(${GLUT}, 0)`); lg.addColorStop(0.5, `rgba(${GLUT}, 0.8)`); lg.addColorStop(1, `rgba(${GLUT}, 0)`);
      ctx.fillStyle = lg; ctx.fillRect(xs - 0.75, 0, 1.5, H);
      punkt(xs, ys[s], 5, 1);
    }

    // Nur zeichnen, solange sich etwas bewegt – danach ruht die Leinwand
    const glueht = marken.some((m) => m.zuend >= 0 && jetzt - m.zuend < 650);
    if (funken.length || glueht || (blitzWert > 0 && blitzWert < 1)) malen();
    else bildZeit = 0;
  }

  // ---- Finger ----
  let letzteMarke = null;
  function melde() {
    if (scrub == null || !punkte.length) return;
    const i = klemme(Math.round(scrub), 0, N - 1);
    const t = t0 + ((t1 - t0) * i) / (N - 1);
    const m = marken.find((mm) => Math.abs(mm.spalte - i) <= 3) ?? null;
    if (m && m !== letzteMarke) tick(5);
    letzteMarke = m;
    beimScrubben({ t, c: werte[i], marke: m?.daten ?? null, zurueck: !zeiger.ruht });
  }
  ziehe(leinwand, {
    achse: "x", schwelle: 4,
    darf: () => !leer && N > 2,
    start: ({ x: px }) => {
      zeiger.halte();
      const r = leinwand.getBoundingClientRect();
      scrub = (klemme(px - r.left - LINKS, 0, B - RECHTS - LINKS) / (B - RECHTS - LINKS)) * (N - 1);
      behaelter.classList.add("wird-gescrubbt");
      melde(); malen();
    },
    bewege: ({ x: px }) => {
      const r = leinwand.getBoundingClientRect();
      scrub = (klemme(px - r.left - LINKS, 0, B - RECHTS - LINKS) / (B - RECHTS - LINKS)) * (N - 1);
      melde(); malen();
    },
    ende: () => {
      behaelter.classList.remove("wird-gescrubbt");
      if (wenigBewegung()) { scrub = null; beimScrubben(null); malen(); return; }
      zeiger.springe(scrub);
      zeiger.zu(N - 1).then(() => { if (zeiger.wert >= N - 1.5) { scrub = null; beimScrubben(null); malen(); } });
    },
  });

  new ResizeObserver(() => { if (mass() && punkte.length) { rechne(); for (const m of marken) m.zuend = 0; malen(); } }).observe(behaelter);

  return {
    /** punkte [{t,c}], marken [{t,c,daten}], referenz = Ø-Kaufpreis */
    zeige(daten, { marken: mk = [], referenz: ref = null, aufziehen = true } = {}) {
      if (!B) mass();
      leer = !daten || daten.length < 2;
      behaelter.classList.toggle("ist-leer", leer);
      if (leer) { ctx.clearRect(0, 0, leinwand.width, leinwand.height); return; }
      punkte = daten; referenz = ref;
      marken = mk.filter((m) => m.t >= daten[0].t && m.t <= daten[daten.length - 1].t).map((m) => ({ ...m, spalte: 0, zuend: -1 }));
      if (B) rechne();
      funken.length = 0;
      if (aufziehen && !wenigBewegung()) {
        aufzug.springe(0); blitz.springe(0);
        aufzug.zu(1).then(() => {
          if (aufzug.wert < 0.999) return;
          blitz.springe(0); blitz.zu(1).then(() => { blitzWert = 0; malen(); });
          beiAnkunft();
        });
      } else { aufzug.springe(1); malen(); }
    },
    get scrubbt() { return scrub != null; },
  };
}
