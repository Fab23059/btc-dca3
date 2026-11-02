// =====================================================================
// tablett.js – Kleine Dinge kommen als Tablett von unten (Bewegung B6):
// Rechenweg, Rückfragen, Sicherung einlesen, Push einrichten.
//
//   * Es steigt federnd auf und lässt sich am Griff nach unten werfen.
//   * Ändert sich der Inhalt, wächst oder schrumpft das Tablett an Ort
//     und Stelle, statt neu aufzugehen.
// =====================================================================

import { h, icon, fuelle } from "../dom.js";
import { Feder, gummi } from "../bewegung/feder.js";
import { ziehe } from "../bewegung/geste.js";
import { ebeneAnmelden } from "./ebenen.js";

export function oeffneTablett({ titel, untertitel = null, inhalt, fuss = null, beimSchliessen = null }) {
  const titelId = `tablett-${Math.random().toString(36).slice(2, 8)}`;
  const koerper = h("div", { class: "tablett-koerper" }, inhalt);
  const fussEl = h("div", { class: "tablett-fuss" }, fuss);
  if (!fuss) fussEl.hidden = true;
  const kopf = h("header", { class: "tablett-kopf" },
    h("span", { class: "tablett-griff", "aria-hidden": "true" }),
    h("div", { class: "tablett-titelblock" },
      h("h2", { class: "tablett-titel", id: titelId }, titel),
      untertitel ? h("p", { class: "tablett-unter" }, untertitel) : null),
    h("button", { type: "button", class: "rund tippbar", "aria-label": "Schließen", onclick: () => anfrage() }, icon("schliessen", { groesse: 18 })));
  const blatt = h("section", { class: "tablett", role: "dialog", "aria-modal": "true", "aria-labelledby": titelId, tabindex: "-1" }, kopf, koerper, fussEl);
  const schleier = h("div", { class: "tablett-schleier", onclick: () => anfrage() });
  const ebene = h("div", { class: "tablett-ebene" }, schleier, blatt);
  document.body.append(ebene);

  let offen = true;
  const hoehe = () => blatt.offsetHeight || 400;
  const setze = (y) => {
    blatt.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
    schleier.style.opacity = String(Math.max(0, Math.min(1, 1 - y / hoehe())) * 0.55);
  };
  const feder = new Feder(hoehe() + 40, { art: "raum", genau: 0.3, beiWert: setze });
  setze(hoehe() + 40);
  requestAnimationFrame(() => { feder.zu(0); blatt.focus({ preventScroll: true }); });

  let wurf = null;
  const anfrage = ebeneAnmelden(ebene, () => {
    offen = false;
    beimSchliessen?.();
    feder.zu(hoehe() + 40, wurf != null ? { tempo: wurf } : {}).then(() => ebene.remove());
  });

  ziehe(kopf, {
    achse: "y",
    darf: (e) => !e.target.closest("button"),
    start: () => feder.halte(),
    bewege: ({ dy }) => setze(dy < 0 ? gummi(dy, 60) : dy),
    ende: ({ dy, vy }) => {
      const y = dy < 0 ? gummi(dy, 60) : dy;
      feder.springe(y);
      if (vy > 700 || y > hoehe() * 0.42) { wurf = vy; anfrage(); }
      else feder.zu(0, { tempo: vy });
    },
  });

  /** Inhalt tauschen: Das Tablett wächst/schrumpft federnd auf die neue Höhe. */
  function tausche(neu, neuerFuss) {
    const vorher = hoehe();
    fuelle(koerper, neu);
    if (neuerFuss !== undefined) { fuelle(fussEl, neuerFuss); fussEl.hidden = !neuerFuss; }
    const nachher = hoehe();
    feder.springe(nachher - vorher + feder.wert);
    feder.zu(0);
    neu?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
  }

  return { el: blatt, koerper, schliessen: () => offen && anfrage(), tausche };
}

/** Gleiche Schnittstelle wie früher (Einstellungen, Push nutzen sie). */
export const oeffneSheet = oeffneTablett;
