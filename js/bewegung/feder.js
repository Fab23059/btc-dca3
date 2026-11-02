// =====================================================================
// feder.js – Das Herz aller Bewegungen: gedämpfte Federn.
//
// Jede Bewegung in der App ist eine Feder, keine feste Kurve:
//   * Sie lässt sich jederzeit unterbrechen und umlenken (neues Ziel),
//     ohne dass die Geschwindigkeit verloren geht.
//   * Sie kann mit dem Tempo eines Fingers starten (Wischen, Werfen).
//   * Alle Federn teilen sich EINEN Bildtakt (requestAnimationFrame).
//
// Parameter wie bei Apple: "antwort" (Sekunden bis zum Ziel, ungefähr)
// und "daempfung" (1 = ohne Nachschwingen, kleiner = federnder).
// Masse 1 → Steifheit k = (2π / antwort)², Reibung c = 4π · daempfung / antwort.
// =====================================================================

import { wenigBewegung } from "../dom.js";

/** Die drei Federn der App (siehe GESTALTUNG.md). */
export const FEDERN = Object.freeze({
  raum: { antwort: 0.5, daempfung: 0.86 },     // große Flächen: Fenster, Tablett, Linie
  zeiger: { antwort: 0.3, daempfung: 0.78 },   // kleine Teile: Ziffern, Zeiger, Markierungen
  gummi: { antwort: 0.42, daempfung: 1 },      // Nachgeben am Rand, Zurückfedern
  ruhig: { antwort: 0.9, daempfung: 1 },       // langsames Ausglimmen (Licht)
});

const SCHRITT = 1 / 240;                // feste Rechenschritte → gleich auf 60 und 120 Hz
const aktiv = new Set();
let bild = 0;
let zuletzt = 0;

/** Zeitlupe nur für Entwickler-Aufnahmen (Storyboards); im Alltag immer 1. */
const zeitfaktor = () => {
  const z = Number(globalThis.__ZEITLUPE);
  return Number.isFinite(z) && z >= 1 && z <= 40 ? 1 / z : 1;
};

function takt(t) {
  const dt = Math.min(0.05, Math.max(0, (t - zuletzt) / 1000)) * zeitfaktor();
  zuletzt = t;
  for (const f of [...aktiv]) f.schritt(dt);
  for (const f of beiBild) f(t);
  bild = aktiv.size || beiBild.size ? requestAnimationFrame(takt) : 0;
}
function wecken() {
  if (bild) return;
  zuletzt = performance.now();
  bild = requestAnimationFrame(takt);
}

/** Zusätzliche Aufgaben im selben Bildtakt (z. B. Leinwand neu zeichnen). */
const beiBild = new Set();
export function imTakt(f) { beiBild.add(f); wecken(); return () => beiBild.delete(f); }

export class Feder {
  /**
   * @param {number} wert  Startwert
   * @param {object} o     art ("raum" | "zeiger" | …) oder antwort/daempfung,
   *                       beiWert(wert, tempo) wird in jedem Bild gerufen,
   *                       genau = Ruhe-Schwelle (Einheit des Werts)
   */
  constructor(wert = 0, { art = "raum", antwort, daempfung, beiWert = null, genau = 0.001 } = {}) {
    this.x = wert; this.v = 0; this.z = wert;
    this.genau = genau;
    this.beiWert = beiWert;
    this.warten = [];
    this.art(antwort ? { antwort, daempfung: daempfung ?? 1 } : art);
  }

  /** Andere Federhärte, z. B. "zeiger" oder { antwort: 0.4, daempfung: 0.9 } */
  art(a) {
    const p = typeof a === "string" ? FEDERN[a] ?? FEDERN.raum : a;
    this.k = (2 * Math.PI / p.antwort) ** 2;
    this.c = (4 * Math.PI * p.daempfung) / p.antwort;
    return this;
  }

  get wert() { return this.x; }
  get tempo() { return this.v; }
  get ziel() { return this.z; }
  get ruht() { return !aktiv.has(this); }

  /** Zum Ziel federn. tempo = Startgeschwindigkeit (Einheit pro Sekunde), z. B. vom Finger. */
  zu(ziel, { tempo } = {}) {
    this.z = ziel;
    if (tempo != null) this.v = tempo;
    if (wenigBewegung()) { this.springe(ziel); return Promise.resolve(); }
    aktiv.add(this);
    wecken();
    return new Promise((ok) => this.warten.push(ok));
  }

  /** Sofort an einen Wert setzen (z. B. 1 : 1 unter dem Finger). Hält die Feder an. */
  springe(wert) {
    this.x = wert; this.z = wert; this.v = 0;
    aktiv.delete(this);
    this.beiWert?.(this.x, 0);
    this.fertig();
  }

  /** Mitten in der Bewegung festhalten (Finger greift zu) – Tempo bleibt gemerkt. */
  halte() { aktiv.delete(this); this.z = this.x; return this.v; }

  fertig() { const w = this.warten; this.warten = []; for (const ok of w) ok(); }

  schritt(dt) {
    let rest = dt;
    while (rest > 1e-6) {
      const h = Math.min(SCHRITT, rest);
      const a = -this.k * (this.x - this.z) - this.c * this.v;
      this.v += a * h;
      this.x += this.v * h;
      rest -= h;
    }
    const ruhig = Math.abs(this.x - this.z) < this.genau && Math.abs(this.v) < this.genau * 12;
    if (ruhig) { this.x = this.z; this.v = 0; aktiv.delete(this); }
    this.beiWert?.(this.x, this.v);
    if (ruhig) this.fertig();
  }
}

/**
 * Wohin würde ein geworfenes Objekt rollen? (Apple: Projektion mit Abbremsung.)
 * tempo in Einheiten/Sekunde, Ergebnis = zusätzliche Strecke.
 */
export function wurfweite(tempo, abbremsung = 0.998) {
  return ((tempo / 1000) * abbremsung) / (1 - abbremsung);
}

/** Gummiband: je weiter man über den Rand zieht, desto zäher (wie bei iOS). */
export function gummi(strecke, grenze = 120) {
  const s = Math.abs(strecke);
  return Math.sign(strecke) * (1 - 1 / ((s * 0.55) / grenze + 1)) * grenze;
}

export const mische = (a, b, t) => a + (b - a) * t;
export const klemme = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
