// =====================================================================
// zaehlwerk.js – Zahlen als mechanisches Zählwerk.
//
// Jede Ziffer sitzt auf einer eigenen Walze und rollt bei einer Änderung
// durch alle Zwischenwerte zur neuen Ziffer – die großen Stellen zuerst,
// die kleinen zuletzt, mit Federphysik und einem Hauch Bewegungsunschärfe.
// Punkte, Kommas und das €-Zeichen bleiben stehen.
//
// Für Vorleseprogramme steht der fertige Wert als Text daneben.
// =====================================================================

import { h, wenigBewegung } from "../dom.js";
import { feder } from "./federwerk.js";

const ZEILE = 1.16; // Zeilenhöhe der Walzen in em

/**
 * Ein Zählwerk in einem Element.
 *   darstellen(wert) → Liste von [cssKlasse, text] (wie bei Zahl)
 */
export class Zaehlwerk {
  constructor(el, darstellen, { glimmen = false, einrollen = false } = {}) {
    this.el = el;
    this.darstellen = darstellen;
    this.glimmen = glimmen;
    this.einrollen = einrollen;   // beim ersten Anzeigen von 0 hochrollen
    this.wert = null;
    this.muster = "";
    this.walzen = [];
    this.schnell = false;
    el.classList.add("zaehlwerk");
    this.vorlesen = h("span", { class: "unsichtbar" });
    this.anzeige = h("span", { class: "zaehlwerk-anzeige", "aria-hidden": "true" });
    el.replaceChildren(this.anzeige, this.vorlesen);
  }

  /** Während des Scrubbings: kurze, knackige Bewegung statt großer Rolle. */
  set eilig(an) { this.schnell = an; }

  setze(wert, { sofort = false } = {}) {
    const teile = this.darstellen(wert);
    const text = teile.map(([, t]) => t).join("");
    this.vorlesen.textContent = text;
    this.el.classList.toggle("ist-leer", wert == null);
    // Muster: Klassen + Zeichenarten. Ändert es sich, wird neu aufgebaut.
    const muster = teile.map(([k, t]) => `${k}:${t.replace(/\d/g, "0")}`).join("|");
    const ruhig = sofort || wenigBewegung() || document.hidden || (this.wert == null && !this.einrollen);
    if (muster !== this.muster) {
      this.aufbauen(teile, ruhig);
      this.muster = muster;
    } else {
      this.drehen(teile, ruhig);
    }
    if (this.glimmen && !ruhig && this.wert != null && wert != null && Math.abs(wert - this.wert) > Math.abs(this.wert) * 0.0005) {
      this.el.classList.remove("puls"); void this.el.offsetWidth; this.el.classList.add("puls");
    }
    this.wert = wert;
  }

  aufbauen(teile, ruhig) {
    const alt = this.walzen.map((w) => w.ziffer);
    this.walzen = [];
    const kinder = [];
    for (const [klasse, text] of teile) {
      const gruppe = h("span", { class: `z-${klasse}` });
      for (const zeichen of text) {
        if (/\d/.test(zeichen)) {
          const band = h("span", { class: "walze-band" }, ...Array.from({ length: 20 }, (_, i) => h("span", null, String(i % 10))));
          const halter = h("span", { class: "walze-halter" }, zeichen);
          const walze = h("span", { class: "walze" }, halter, band);
          const w = { walze, band, halter, ziffer: Number(zeichen), pos: Number(zeichen) };
          this.walzen.push(w);
          gruppe.append(walze);
        } else {
          gruppe.append(h("span", { class: "zeichen" }, zeichen));
        }
      }
      kinder.push(gruppe);
    }
    this.anzeige.replaceChildren(...kinder);
    // Beim Neuaufbau rollen die Walzen von der alten (oder von 0) zur Zielziffer
    const n = this.walzen.length;
    this.walzen.forEach((w, i) => {
      const von = ruhig ? w.ziffer : (alt[i - (n - alt.length)] ?? 0);
      w.pos = von;
      this.setzePos(w, von, true);
    });
    if (!ruhig) requestAnimationFrame(() => this.walzen.forEach((w, i) => this.rolle(w, w.ziffer, i, n)));
  }

  drehen(teile, ruhig) {
    const ziffern = teile.map(([, t]) => t).join("").replace(/\D/g, "").split("").map(Number);
    const n = this.walzen.length;
    this.walzen.forEach((w, i) => {
      const z = ziffern[i];
      if (z === w.ziffer) return;
      w.ziffer = z;
      w.halter.textContent = String(z);
      if (ruhig) { w.pos = z; this.setzePos(w, z, true); } else this.rolle(w, z, i, n);
    });
  }

  rolle(w, ziel, i, n) {
    // Ziel auf dem doppelten Band so wählen, dass es vorwärts rollt (wie ein Zählwerk)
    let p = w.pos % 10;
    this.setzePos(w, p, true);
    let nach = ziel;
    if (nach < p) nach += 10;
    w.pos = nach;
    const f = feder(this.schnell ? "schnapp" : i < n - 3 ? "traege" : "feder");
    const dauer = this.schnell ? Math.min(220, f.dauer) : f.dauer + (n - i) * 10;
    const verz = this.schnell ? 0 : i * 38;
    requestAnimationFrame(() => {
      w.walze.classList.add("rollt");
      w.band.style.setProperty("transition", `transform ${dauer}ms ${f.kurve} ${verz}ms, filter ${dauer}ms ease-out ${verz}ms`);
      w.band.style.setProperty("transform", `translate3d(0, ${-nach * ZEILE}em, 0)`);
      clearTimeout(w.uhr);
      w.uhr = setTimeout(() => { w.walze.classList.remove("rollt"); w.pos = ziel; this.setzePos(w, ziel, true); }, dauer + verz + 40);
    });
  }

  setzePos(w, pos, ohneUebergang) {
    if (ohneUebergang) w.band.style.setProperty("transition", "none");
    w.band.style.setProperty("transform", `translate3d(0, ${-pos * ZEILE}em, 0)`);
  }
}
