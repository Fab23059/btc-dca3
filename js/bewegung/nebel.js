// =====================================================================
// nebel.js – Morgennebel hinter der App.
//
// Der Nebel wird beim Start EINMAL berechnet (zwei kleine, weiche Bilder)
// und danach nur noch verschoben – nie neu gezeichnet. So kostet er
// fast nichts und ruckelt nie:
//   * innen treibt er ganz langsam (CSS-Animation, nur transform)
//   * außen zieht er mit, wenn man scrollt oder durch die Zeit reist
// Die Farben folgen der Tageszeit in Deutschland.
// =====================================================================

import { h } from "../dom.js";
import { berlinTeile } from "../zeit.js";

export function tageszeit(ts = Date.now()) {
  const st = berlinTeile(ts).stunde;
  if (st >= 5 && st < 10) return "morgen";
  if (st >= 10 && st < 17) return "tag";
  if (st >= 17 && st < 22) return "abend";
  return "nacht";
}

// Je Tageszeit: warmer Dunst, kühler Dunst, Lichtkante
const STIMMUNG = {
  morgen: { warm: [232, 150, 112], kuehl: [118, 138, 170], licht: [255, 214, 170] },
  tag: { warm: [214, 150, 96], kuehl: [120, 128, 142], licht: [246, 222, 186] },
  abend: { warm: [236, 128, 54], kuehl: [104, 82, 140], licht: [255, 186, 112] },
  nacht: { warm: [190, 104, 52], kuehl: [56, 70, 128], licht: [176, 164, 226] },
};

// --- Rauschen (einmalig auf der CPU, klein) ---
function zufall(saat) {
  let a = saat >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function rauschfeld(saat) {
  const z = zufall(saat); const N = 64; const g = new Float32Array(N * N);
  for (let i = 0; i < g.length; i++) g[i] = z();
  const at = (x, y) => g[((y & (N - 1)) * N) + (x & (N - 1))];
  const glatt = (t) => t * t * (3 - 2 * t);
  const wert = (x, y) => {
    const xi = Math.floor(x); const yi = Math.floor(y); const xf = glatt(x - xi); const yf = glatt(y - yi);
    const a = at(xi, yi); const b = at(xi + 1, yi); const c = at(xi, yi + 1); const d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y) => { let v = 0; let amp = 0.5; for (let o = 0; o < 5; o++) { v += amp * wert(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 9.2; amp *= 0.5; } return v; };
}

/** Malt ein Nebelbild (klein; wird per CSS weich aufgezogen). */
function maleNebel(leinwand, { saat, farben, dichte, glutOrt }) {
  const B = 112; const H = 224;
  leinwand.width = B; leinwand.height = H;
  const ctx = leinwand.getContext("2d");
  const bild = ctx.createImageData(B, H);
  const f = rauschfeld(saat);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < B; x++) {
      const u = x / B; const v = y / H;
      const px = u * 2.1; const py = v * 4.2;
      // verwirbelt: Rauschen, das sich selbst verbiegt
      const qx = f(px, py); const qy = f(px + 5.2, py + 1.3);
      const n = f(px + 2.6 * qx, py + 2.6 * qy);
      const nebel = Math.max(0, n - 0.32) * 1.9;
      const glut = Math.max(0, 1 - Math.hypot((u - glutOrt[0]) * 1.1, (v - glutOrt[1]) * 0.7) * 1.55);
      const mischung = Math.min(1, glut * 1.2 + qx * 0.25);
      const r = farben.kuehl[0] + (farben.warm[0] - farben.kuehl[0]) * mischung;
      const g = farben.kuehl[1] + (farben.warm[1] - farben.kuehl[1]) * mischung;
      const b = farben.kuehl[2] + (farben.warm[2] - farben.kuehl[2]) * mischung;
      const hell = Math.max(0, n - 0.62) * 2.2;
      const i = (y * B + x) * 4;
      bild.data[i] = Math.min(255, r + farben.licht[0] * hell * 0.5);
      bild.data[i + 1] = Math.min(255, g + farben.licht[1] * hell * 0.5);
      bild.data[i + 2] = Math.min(255, b + farben.licht[2] * hell * 0.5);
      bild.data[i + 3] = Math.min(255, 255 * dichte * nebel * nebel * (0.55 + glut * 0.8));
    }
  }
  ctx.putImageData(bild, 0, 0);
}

/**
 * Baut die Nebelschichten in den Behälter. Rückgabe: { ziehe(scrollAnteil, zeitAnteil) }.
 * scrollAnteil: 0 … 1 (wie weit gescrollt), zeitAnteil: −1 … 1 (Zeitreise links/rechts)
 */
export function baueNebel(behaelter) {
  const farben = STIMMUNG[tageszeit()];
  const a = h("canvas", { class: "nebel-bild" });
  const b = h("canvas", { class: "nebel-bild" });
  const schichtA = h("div", { class: "nebel-schicht nebel-schicht--hinten" }, h("div", { class: "nebel-trieb nebel-trieb--a" }, a));
  const schichtB = h("div", { class: "nebel-schicht nebel-schicht--vorn" }, h("div", { class: "nebel-trieb nebel-trieb--b" }, b));
  behaelter.replaceChildren(schichtA, schichtB);
  behaelter.dataset.tageszeit = tageszeit();

  // Erst nach dem ersten Bild rechnen, damit der Start nicht wartet
  const male = () => {
    maleNebel(a, { saat: 20260608, farben, dichte: 0.62, glutOrt: [0.22, 0.18] });
    maleNebel(b, { saat: 15, farben, dichte: 0.42, glutOrt: [0.8, 0.42] });
    behaelter.classList.add("ist-bereit");
  };
  (globalThis.requestIdleCallback ?? ((f) => setTimeout(f, 60)))(male, { timeout: 400 });

  let scroll = 0; let zeit = 0; let geplant = false;
  const setze = () => {
    geplant = false;
    schichtA.style.transform = `translate3d(${(zeit * -18).toFixed(1)}px, ${(scroll * -60).toFixed(1)}px, 0)`;
    schichtB.style.transform = `translate3d(${(zeit * -42).toFixed(1)}px, ${(scroll * -140).toFixed(1)}px, 0)`;
  };
  return {
    ziehe({ scrollAnteil = scroll, zeitAnteil = zeit } = {}) {
      scroll = scrollAnteil; zeit = zeitAnteil;
      if (!geplant) { geplant = true; requestAnimationFrame(setze); }
    },
  };
}
