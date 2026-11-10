// =====================================================================
// ringschluss.js – Der neue Ring wird gezogen (Bewegung B11).
//
// Bisher wuchs der Baum bei einem neuen Kauf einfach ein Stück. Jetzt
// wird der neue Jahresring sichtbar GESCHLOSSEN: Ein weißglühender
// Punkt fährt einmal um den Stamm und zieht den Ring hinter sich her.
// Direkt dahinter kühlt die Linie ab – von weiß über Glut-Orange bis
// zum ruhigen Holz. Wo der Punkt schon war, ist das neue Holz da.
//
// Die Form des Rings ist die echte: seine Fläche entspricht den sats
// dieses Kaufs (siehe jahresringe.js). Man sieht also beim Zuschauen,
// wie viel der Kauf dem Stamm hinzugefügt hat.
//
// Sparsam gebaut:
//   * Der Baum wird nur zweimal gezeichnet (einmal ohne, einmal mit dem
//     neuen Ring) und danach nur noch als fertiges Bild kopiert.
//   * Kein Weichzeichner: Das Glühen entsteht aus breiten, durchscheinenden
//     Strichen unter der hellen Linie.
//   * Eine Feder treibt alles. Sie lässt sich jederzeit abbrechen; dann
//     steht sofort der fertige Baum da.
// =====================================================================

import { wenigBewegung } from "../dom.js";
import { Feder, imTakt, klemme } from "../bewegung/feder.js";
import { tick } from "./haptik.js";

const TAU = Math.PI * 2;
const NACHGLUEHEN = 0.42;   // so lange (in Umläufen) bleibt die Linie hinter dem Punkt heiß

const zeitfaktor = () => {
  const z = Number(globalThis.__ZEITLUPE);
  return Number.isFinite(z) && z >= 1 && z <= 40 ? 1 / z : 1;
};

/** Farbe nach Temperatur: 1 = weißglühend, 0.5 = Glut, 0 = erloschen. */
function glutfarbe(t, alpha) {
  const w = klemme((t - 0.5) * 2);                    // Anteil Weiß
  return `rgba(255, ${Math.round(138 + 106 * w)}, ${Math.round(42 + 183 * w)}, ${alpha.toFixed(3)})`;
}

/**
 * Zieht einen Ring sichtbar um den Stamm.
 *
 * @param {object} o
 *   leinwand     die Leinwand des Stamms (wird während des Laufs hier gezeichnet)
 *   dpr          Bildpunkte je Punkt dieser Leinwand
 *   zeichne      (ctx, mitNeuemRing) → zeichnet den Baum ohne bzw. mit dem neuen Ring
 *                (ctx ist bereits auf dpr eingestellt)
 *   ring         der neue Ring aus baumGeometrie(): { r: Float32Array, mitte: { x, y } }
 *   cx, cy, R    Mitte und Radius des Stamms in Punkten (wie bei zeichneBaum)
 *   startwinkel  hier setzt der Punkt an (Standard: oben). Kommt ein Funke
 *                angeflogen, ist es der Winkel, aus dem er kommt.
 * @returns {{ fertig: Promise, ab: Function }}
 */
export function ringschluss({ leinwand, dpr = 1, zeichne, ring, cx, cy, R, startwinkel = -Math.PI / 2 }) {
  const ctx = leinwand.getContext("2d");
  const fertigesBild = () => { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, leinwand.width, leinwand.height); zeichne(ctx, true); };
  if (wenigBewegung() || !ring) { fertigesBild(); return { fertig: Promise.resolve(), ab() {} }; }

  // Beide Zustände einmal vorzeichnen
  const bild = (mitNeu) => {
    const c = document.createElement("canvas");
    c.width = leinwand.width; c.height = leinwand.height;
    const x = c.getContext("2d");
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    zeichne(x, mitNeu);
    return c;
  };
  const alt = bild(false); const neu = bild(true);

  const N = ring.r.length;
  const mx = cx + ring.mitte.x * R; const my = cy + ring.mitte.y * R;
  const start = Math.round((((startwinkel % TAU) + TAU) % TAU) / TAU * N);
  /** Punkt auf dem Ring, q = 0 … 1 Umlauf ab dem Startwinkel. */
  const ort = (q) => {
    const i = (start + Math.round(q * N)) % N;
    const th = (i / N) * TAU;
    return [mx + Math.cos(th) * ring.r[i] * R, my + Math.sin(th) * ring.r[i] * R, th];
  };

  const funken = [];
  let zuletzt = performance.now();
  let weg = 0;            // 0 … 1 + NACHGLUEHEN: Kopf läuft bis 1, danach kühlt nur noch der Rest ab
  let vorher = 0;
  let abgebrochen = false;
  let viertel = 0;

  function male(jetzt) {
    const dt = Math.min(0.05, (jetzt - zuletzt) / 1000) * zeitfaktor();
    zuletzt = jetzt;
    const kopf = klemme(weg);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, leinwand.width, leinwand.height);
    ctx.drawImage(alt, 0, 0);
    // Wo der Punkt schon war, liegt das neue Holz: ein Tortenstück aus dem fertigen Bild
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.beginPath(); ctx.moveTo(mx, my);
    ctx.arc(mx, my, R * 2, (start / N) * TAU, (start / N) * TAU + kopf * TAU);
    ctx.closePath(); ctx.clip();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(neu, 0, 0);
    ctx.restore();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "lighter";
    // Die heiße Linie hinter dem Punkt, in kurzen Stücken – jedes so warm, wie es noch ist
    const von = Math.max(0, weg - NACHGLUEHEN);
    const STUECKE = 34;
    for (let s = 0; s < STUECKE; s++) {
      const a = von + ((kopf - von) * s) / STUECKE; const b = von + ((kopf - von) * (s + 1)) / STUECKE;
      if (b <= a) continue;
      const waerme = klemme(1 - (weg - b) / NACHGLUEHEN);
      if (waerme <= 0.01) continue;
      ctx.beginPath();
      const schritte = Math.max(1, Math.round((b - a) * N));
      for (let i = 0; i <= schritte; i++) { const [x, y] = ort(a + ((b - a) * i) / schritte); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.strokeStyle = glutfarbe(0.5, 0.1 * waerme); ctx.lineWidth = Math.max(6, R * 0.075) * waerme + 2; ctx.stroke();
      ctx.strokeStyle = glutfarbe(0.5, 0.2 * waerme); ctx.lineWidth = Math.max(3, R * 0.034) * waerme + 1; ctx.stroke();
      ctx.strokeStyle = glutfarbe(waerme, 0.95 * waerme); ctx.lineWidth = Math.max(1.2, R * 0.011) * (0.6 + 0.6 * waerme); ctx.stroke();
    }

    // Der Punkt selbst: heller Kern, weicher Hof – und Funken, solange er fährt
    if (weg < 1) {
      const [x, y, th] = ort(kopf);
      const hof = ctx.createRadialGradient(x, y, 0, x, y, Math.max(16, R * 0.16));
      hof.addColorStop(0, "rgba(255, 190, 120, 0.7)"); hof.addColorStop(1, "rgba(255, 138, 42, 0)");
      ctx.fillStyle = hof; ctx.beginPath(); ctx.arc(x, y, Math.max(16, R * 0.16), 0, TAU); ctx.fill();
      ctx.fillStyle = "#FFF6EA"; ctx.beginPath(); ctx.arc(x, y, Math.max(2.4, R * 0.02), 0, TAU); ctx.fill();
      const strecke = (kopf - vorher) * TAU * R;
      for (let n = Math.min(4, Math.round(strecke / 3.5 + Math.random() * 0.8)); n > 0; n--) {
        // Funken stieben nach außen und nach hinten weg
        const richtung = th + (Math.random() - 0.5) * 1.6;
        const v = 30 + Math.random() * 110;
        funken.push({ x, y, vx: Math.cos(richtung) * v + Math.sin(th) * 50, vy: Math.sin(richtung) * v - Math.cos(th) * 50, alt: 0, leben: 0.25 + Math.random() * 0.5, r: 0.6 + Math.random() * 1.1 });
      }
      // Jeder Viertel-Umlauf ist ein feiner Tick in der Hand
      if (Math.floor(kopf * 4) > viertel) { viertel = Math.floor(kopf * 4); tick(4); }
    }
    vorher = kopf;
    for (let i = funken.length - 1; i >= 0; i--) {
      const f = funken[i];
      f.alt += dt;
      const rest = 1 - f.alt / f.leben;
      if (rest <= 0) { funken.splice(i, 1); continue; }
      f.vx *= 1 - 2.2 * dt; f.vy = f.vy * (1 - 2.2 * dt) + 160 * dt;
      f.x += f.vx * dt; f.y += f.vy * dt;
      ctx.fillStyle = `rgba(255, ${Math.round(150 + 90 * rest)}, ${Math.round(70 + 110 * rest)}, ${(0.9 * rest).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + 0.6 * rest), 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // Eine Feder ohne Nachschwingen: Der Umlauf dauert etwa eine Sekunde, danach kühlt der Ring aus
  const lauf = new Feder(0, { antwort: 2.6, daempfung: 1, genau: 0.02, beiWert: (x) => { weg = x; } });
  const fertig = new Promise((ok) => {
    const stopp = imTakt((jetzt) => {
      if (abgebrochen) { stopp(); fertigesBild(); ok(); return; }
      male(jetzt);
      if (lauf.ruht && !funken.length) { stopp(); fertigesBild(); tick(10); ok(); }
    });
    lauf.zu(1 + NACHGLUEHEN);
  });

  return { fertig, ab() { abgebrochen = true; lauf.halte(); } };
}
