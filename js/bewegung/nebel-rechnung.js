// =====================================================================
// nebel-rechnung.js – Rechnet eine Kachel Nebel, einmal pro Start.
//
// Früher hat die Grafikkarte den Nebel in jedem Bild neu gerechnet. Auf
// manchen Handys rechnet sie dabei mit zu wenigen Nachkommastellen: Das
// Rauschen zerfällt in Kästchen, und die Arbeit pro Bild bremst die App.
// Jetzt rechnet ein Hintergrund-Thread (nebel-werk.js) die Kachel einmal
// in voller Genauigkeit (JavaScript rechnet immer mit 64 Bit). Danach wird
// sie nur noch verschoben – das kostet fast nichts.
//
// Die Kachel ist in beide Richtungen nahtlos: Was rechts hinausläuft,
// kommt links genau passend wieder herein, oben und unten ebenso. Dafür
// wiederholt sich das Rauschen in jeder Lage nach einer ganzen Zahl von
// Zellen (periodisches Wertrauschen). Auch das Verwirbeln bleibt nahtlos,
// weil der Wirbel selbst periodisch ist.
// =====================================================================

/** Ganzzahl-Zufall: aus (x, y, saat) wird eine Zahl in [0, 1). */
function zufall(x, y, s) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(s, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Periodisches Rauschen aus mehreren Lagen (fbm). Lage k hat doppelt so feine Zellen wie
 * Lage k−1 und wiederholt sich nach px·2^k bzw. py·2^k Zellen – also alle nach px × py Grundzellen.
 */
function baueFbm(px, py, lagen, saat) {
  const tabellen = [];
  for (let k = 0; k < lagen; k++) {
    const bx = px << k; const by = py << k;
    const t = new Float64Array(bx * by);
    for (let y = 0; y < by; y++) for (let x = 0; x < bx; x++) t[y * bx + x] = zufall(x, y, saat * 31 + k);
    // Jede Lage etwas versetzt, damit die Gitter nicht übereinanderliegen (ändert die Periode nicht)
    tabellen.push({ t, bx, by, ox: 0.37 + k * 0.29, oy: 0.61 + k * 0.17 });
  }
  return (x, y) => {
    let v = 0; let a = 0.5; let f = 1;
    for (let k = 0; k < lagen; k++) {
      const { t, bx, by, ox, oy } = tabellen[k];
      const sx = x * f + ox; const sy = y * f + oy;
      const xi = Math.floor(sx); const yi = Math.floor(sy);
      const fx = sx - xi; const fy = sy - yi;
      // Quintische Glättung: keine sichtbaren Gitterkanten
      const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
      const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
      const x0 = ((xi % bx) + bx) % bx; const x1 = x0 + 1 === bx ? 0 : x0 + 1;
      const y0 = ((yi % by) + by) % by; const y1 = y0 + 1 === by ? 0 : y0 + 1;
      const a00 = t[y0 * bx + x0]; const a10 = t[y0 * bx + x1];
      const a01 = t[y1 * bx + x0]; const a11 = t[y1 * bx + x1];
      const unten = a00 + (a10 - a00) * ux; const oben = a01 + (a11 - a01) * ux;
      v += a * (unten + (oben - unten) * uy);
      a *= 0.5; f *= 2;
    }
    return v;
  };
}

const glatt = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const klemme = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

// Je Schicht: wie dicht, wie stark verwirbelt, wo der Dunst beginnt
const ART = {
  // Hinten: deckend (mit dem dunklen Grund), große ruhige Schwaden
  hinten: { wirbel: 2.6, wolke: [0.3, 0.74], kante: [0.54, 0.86], deckend: true, staerke: 0.62, waerme: 0.5 },
  // Vorn: durchscheinend, feiner, mehr Licht an den Kanten
  vorn: { wirbel: 2.1, wolke: [0.4, 0.8], kante: [0.58, 0.88], deckend: false, staerke: 0.55, waerme: 0.72 },
  // Dieselben Schwaden wie vorn, aber angestrahlt: warm, mit hellen Kanten. Liegt nur dort,
  // wo Licht ist (eine feste Maske über dem Bildschirm) – so verfängt sich das Licht im Nebel.
  licht: { wirbel: 2.1, wolke: [0.4, 0.8], kante: [0.52, 0.86], deckend: false, staerke: 0.5, waerme: 0.9, angestrahlt: true },
};

/**
 * Rechnet eine nahtlose Kachel.
 * @param {object} p
 * @param {number} p.zellenX, p.zellenY  so viele Grundzellen breit/hoch (ganze Zahlen)
 * @param {number} p.punkteJeZelle       Bildpunkte je Zelle
 * @param {"hinten"|"vorn"|"licht"} p.art
 * @param {number} p.saat
 * @param {{warm:number[], kuehl:number[], licht:number[], waerme:number}} p.farben
 * @param {number[]} p.grund
 * @returns {{ breite:number, hoehe:number, daten:Uint8ClampedArray }}
 */
export function rechneKachel({ zellenX, zellenY, punkteJeZelle, art, saat, farben, grund }) {
  const a = ART[art];
  const B = zellenX * punkteJeZelle; const H = zellenY * punkteJeZelle;
  const fbm = baueFbm(zellenX, zellenY, 5, saat);
  const wirbelX = baueFbm(zellenX, zellenY, 3, saat + 7);
  const wirbelY = baueFbm(zellenX, zellenY, 3, saat + 13);
  const daten = new Uint8ClampedArray(B * H * 4);
  const { warm, kuehl, licht } = farben;
  const waermeFaktor = farben.waerme ?? 1;
  // Ein kleiner Zufall je Bildpunkt gegen Farbstufen im Dunkel (Dithering)
  let r = (saat * 2654435761) >>> 0;
  const korn = () => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; };
  const schritt = 1 / punkteJeZelle;

  for (let j = 0; j < H; j++) {
    const y = (j + 0.5) * schritt;
    for (let i = 0; i < B; i++) {
      const x = (i + 0.5) * schritt;
      const wx = wirbelX(x, y); const wy = wirbelY(x, y);
      const n = fbm(x + a.wirbel * wx, y + a.wirbel * wy);
      const wolke = glatt(a.wolke[0], a.wolke[1], n);
      const kante = glatt(a.kante[0], a.kante[1], n);
      // Warme und kühle Stellen wandern mit dem Wirbel – mal glimmt der Dunst, mal ist er kühl
      const w = klemme((a.waerme + (wx - 0.5) * 1.7) * waermeFaktor);
      const k = klemme(kante * 0.55);
      const o = (i + j * B) * 4;
      const d1 = korn() - korn();          // dreieckig verteilt, −1 … 1
      if (a.deckend) {
        const anteil = klemme(wolke * a.staerke, 0, 0.5);
        for (let c = 0; c < 3; c++) {
          const farbe = kuehl[c] + (warm[c] - kuehl[c]) * w;
          const mitLicht = farbe + (licht[c] - farbe) * k;
          daten[o + c] = grund[c] + (mitLicht - grund[c]) * anteil + d1 * 0.75;
        }
        daten[o + 3] = 255;
      } else if (a.angestrahlt) {
        const alpha = klemme(wolke * a.staerke + kante * 0.42, 0, 0.78);
        const hell = klemme(0.35 + kante * 0.75);
        for (let c = 0; c < 3; c++) {
          const farbe = kuehl[c] + (warm[c] - kuehl[c]) * Math.max(w, 0.6);
          daten[o + c] = farbe + (licht[c] - farbe) * hell;
        }
        daten[o + 3] = alpha * 255 + d1 * 0.75;
      } else {
        const alpha = klemme(wolke * a.staerke, 0, 0.5);
        for (let c = 0; c < 3; c++) {
          const farbe = kuehl[c] + (warm[c] - kuehl[c]) * w;
          daten[o + c] = farbe + (licht[c] - farbe) * k;
        }
        daten[o + 3] = alpha * 255 + d1 * 0.75;
      }
    }
  }
  return { breite: B, hoehe: H, daten };
}
