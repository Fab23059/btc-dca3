// =====================================================================
// zahl.js – Zahlen, die sich bewegen: Jede Änderung wird hochgezählt
// (≈ 800 ms, sanft abbremsend), statt hart ausgetauscht zu werden.
// Dank Tabellenziffern springt dabei nichts hin und her.
// =====================================================================

import { h, wenigBewegung } from "../dom.js";

const bremsen = (t) => 1 - Math.pow(1 - t, 4); // schnell los, sanft ankommen

/**
 * Eine animierte Zahl in einem Element.
 *   darstellen(wert) → Liste von [cssKlasse, text]
 * Beispiel Euro: [["vz",""],["ganz","1.234"],["komma",",56"],["einheit","€"]]
 */
export class Zahl {
  constructor(el, darstellen, { dauer = 820 } = {}) {
    this.el = el;
    this.darstellen = darstellen;
    this.dauer = dauer;
    this.wert = null;
    this.ziel = null;
    this.spans = [];
    this.anim = 0;
  }

  /** Zeigt einen Wert. Ohne Vorwert (oder bei "sofort") ohne Animation. */
  setze(wert, { sofort = false } = {}) {
    if (wert == null || !Number.isFinite(wert)) {
      cancelAnimationFrame(this.anim);
      this.wert = null; this.ziel = null;
      this.zeichne(null);
      return;
    }
    if (this.ziel === wert) return;
    const start = this.wert;
    this.ziel = wert;
    cancelAnimationFrame(this.anim);
    if (start == null || sofort || wenigBewegung() || document.hidden) {
      this.wert = wert;
      this.zeichne(wert);
      return;
    }
    const t0 = performance.now();
    const schritt = (t) => {
      const p = Math.min(1, (t - t0) / this.dauer);
      this.wert = start + (wert - start) * bremsen(p);
      this.zeichne(p === 1 ? wert : this.wert);
      if (p < 1) this.anim = requestAnimationFrame(schritt);
      else this.wert = wert;
    };
    this.anim = requestAnimationFrame(schritt);
  }

  zeichne(wert) {
    const teile = this.darstellen(wert);
    // Spans nur neu bauen, wenn sich die Struktur ändert – sonst nur Text tauschen.
    if (teile.length !== this.spans.length || teile.some(([k], i) => this.spans[i].dataset.teil !== k)) {
      this.spans = teile.map(([k]) => h("span", { class: `z-${k}`, dataset: { teil: k } }));
      this.el.replaceChildren(...this.spans);
    }
    teile.forEach(([, text], i) => {
      if (this.spans[i].textContent !== text) this.spans[i].textContent = text;
    });
    this.el.classList.toggle("ist-leer", wert == null);
  }
}
