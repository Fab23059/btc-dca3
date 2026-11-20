// =====================================================================
// ziffern.js – Zahlen als Zählwerk. Jede Ziffer ist eine kleine Walze
// mit eigener Feder; die rechte Ziffer läuft zuerst und am schnellsten,
// nach links wird es träger – wie bei einem mechanischen Zählwerk.
//
// Steigt die Zahl, rollen die Walzen vorwärts (9 → 0 → 1), fällt sie,
// rollen sie zurück. Bewegt wird nur transform – die Grafikkarte macht
// den Rest. Die "Energie" (wie schnell sich alles dreht) wird gemeldet,
// damit die Zahl beim Rollen aufleuchten kann.
// =====================================================================

import { h } from "../dom.js";
import { Feder } from "./feder.js";

const BAND = "0123456789012345678".split("").join("\n");
/** Federhärten der Walzen: beim Scrubben flott, beim Mitzählen (B17) so straff, dass nichts nachhinkt. */
const EILIG = { antwort: 0.16, daempfung: 0.9 };
const FOLGSAM = { antwort: 0.05, daempfung: 1 };
/** Zeilenhöhe der Walzen in em – muss zu .ziffern { line-height } passen. */
const ZEILE = 1.1;

/**
 * @param {Element} el
 * @param {object} o
 *   teile(wert) → [[klasse, text], …]   (Klasse steuert Größe/Farbe)
 *   beiEnergie(e)                         Rollgeschwindigkeit 0…1
 */
export class Ziffern {
  constructor(el, { teile, beiEnergie = null, beschreibung = null }) {
    this.el = el;
    this.teile = teile;
    this.beiEnergie = beiEnergie;
    this.beschreibung = beschreibung;
    this.walzen = [];
    this.form = "";
    this.wert = undefined;
    this._eilig = false;
    this._folgsam = false;
    el.classList.add("ziffern");
  }

  /** Welche Federhärte eine Walze gerade braucht. */
  artFuer(w) { return this._folgsam ? FOLGSAM : this._eilig ? EILIG : w.normal; }

  /** Flott, z. B. unter dem Finger bei der Zeitreise. */
  set eilig(an) {
    this._eilig = an;
    for (const w of this.walzen) w.feder.art(this.artFuer(w));
  }

  /**
   * B17 Mitzählen: Die Zahl hängt an einem Punkt, der sich bewegt, und darf ihm nicht
   * hinterherlaufen. Die Walzen federn dann ohne Überschwingen und praktisch ohne Verzug.
   */
  set folgsam(an) {
    this._folgsam = an;
    for (const w of this.walzen) w.feder.art(this.artFuer(w));
  }

  /** Neuen Wert zeigen. sofort = ohne Rollen; einrollen = beim ersten Mal von 0 hochrollen. */
  setze(wert, { sofort = false, einrollen = false } = {}) {
    const teile = this.teile(wert);
    const text = teile.map(([, t]) => t).join("");
    this.el.setAttribute("aria-label", this.beschreibung ? this.beschreibung(text) : text);
    const steigt = this.wert == null || wert == null || this.wert == null ? true : wert >= this.wert;
    this.wert = wert;

    // Die "Form" = alle Nicht-Ziffern und die Anzahl der Ziffern. Ändert sie sich, wird neu gebaut.
    const form = teile.map(([k, t]) => `${k}:${t.replace(/\d/g, "#")}`).join("|");
    if (form !== this.form) {
      const alt = this.walzen.map((w) => w.feder.wert);
      this.baue(teile);
      this.form = form;
      // Vorhandene Walzen von rechts her übernehmen, damit es weiterrollt statt zu springen
      const n = this.walzen.length;
      this.walzen.forEach((w, i) => {
        const j = alt.length - (n - i);
        const start = j >= 0 ? alt[j] : (einrollen && !sofort ? 0 : w.ziel);
        w.feder.springe(start);
      });
    }

    let i = 0;
    for (const [, t] of teile) {
      for (const ch of t) {
        if (!/\d/.test(ch)) continue;
        const w = this.walzen[i++];
        const d = Number(ch);
        const jetzt = w.feder.ziel;
        const aktuell = ((Math.round(jetzt) % 10) + 10) % 10;
        let delta = d - aktuell;
        if (steigt && delta < 0) delta += 10;
        if (!steigt && delta > 0) delta -= 10;
        const ziel = Math.round(jetzt) + delta;
        w.ziel = ziel;
        if (sofort) w.feder.springe(ziel); else w.feder.zu(ziel);
      }
    }
  }

  baue(teile) {
    this.walzen.forEach((w) => w.feder.halte());
    this.walzen = [];
    const kinder = [];
    let anzahlZiffern = 0;
    for (const [, t] of teile) for (const ch of t) if (/\d/.test(ch)) anzahlZiffern++;
    let idx = 0;
    for (const [klasse, t] of teile) {
      const gruppe = h("span", { class: `ziffern-teil ziffern-teil--${klasse}`, "aria-hidden": "true" });
      for (const ch of t) {
        if (!/\d/.test(ch)) { gruppe.append(h("span", { class: "zeichen" }, ch)); continue; }
        const band = h("span", { class: "walze-band" }, BAND);
        const walze = h("span", { class: "walze" }, h("span", { class: "walze-platz" }, "0"), band);
        gruppe.append(walze);
        const vonRechts = anzahlZiffern - 1 - idx++;
        const normal = { antwort: 0.34 + Math.min(6, vonRechts) * 0.045, daempfung: 0.8 };
        const eintrag = { band, ziel: 0, normal, feder: null };
        eintrag.feder = new Feder(0, {
          antwort: normal.antwort, daempfung: normal.daempfung, genau: 0.002,
          beiWert: (x, v) => {
            const q = ((x % 10) + 10) % 10;
            band.style.transform = `translate3d(0, ${(-q * ZEILE).toFixed(4)}em, 0)`;
            eintrag.tempo = v;
            this.melde();
          },
        });
        if (this._eilig || this._folgsam) eintrag.feder.art(this.artFuer(eintrag));
        this.walzen.push(eintrag);
      }
      kinder.push(gruppe);
    }
    this.el.replaceChildren(...kinder);
  }

  melde() {
    if (!this.beiEnergie || this._gemeldet) return;
    this._gemeldet = true;
    queueMicrotask(() => {
      this._gemeldet = false;
      const e = this.walzen.reduce((s, w) => s + Math.abs(w.tempo ?? 0), 0);
      this.beiEnergie(Math.min(1, e / 60));
    });
  }
}
