// =====================================================================
// meldung.js – Die Statuszeile spricht (Bewegung B7).
//
// Oben rechts steht der Status ("Live · 21:00"). Meldungen bekommen
// kein eigenes Kästchen: Die Statuspille dehnt sich federnd zur
// Nachricht, der Text rollt hinein – und danach wieder zurück.
// Eine Aktion (z. B. "Rückgängig") sitzt mit in der Pille.
// =====================================================================

import { h, icon } from "../dom.js";
import { Feder } from "../bewegung/feder.js";
import { tick } from "./haptik.js";

let pille = null; let grund = null; let inhalt = null; let links = null;
let breite = null;
let dauernd = { text: "", art: "laedt" };
let zeitgeber = 0;

/** Einmal beim Start: die Elemente der Kopfzeile übergeben. */
export function statusAnbinden({ el, kopfLinks }) {
  pille = el; links = kopfLinks;
  grund = h("span", { class: "status-grund", "aria-hidden": "true" });
  inhalt = h("span", { class: "status-inhalt" });
  pille.replaceChildren(grund, inhalt);
  breite = new Feder(0, { art: "zeiger", genau: 0.2, beiWert: (b) => {
    grund.style.clipPath = `inset(0 0 0 ${Math.max(0, grund.offsetWidth - b).toFixed(1)}px round 999px)`;
    // Wird die Pille breit, weicht der Text links aus
    const platz = pille.parentElement.clientWidth - 140;
    if (links) links.style.opacity = String(Math.max(0, Math.min(1, 1 - (b - 150) / Math.max(40, platz - 150))));
  } });
}

function zeige(kinder, art, richtung = 1) {
  if (!pille) return;
  const neu = h("span", { class: `status-zeile status-zeile--${art}` }, kinder);
  const alt = [...inhalt.children];
  inhalt.append(neu);
  for (const a of alt) {
    a.classList.add("geht");
    a.animate([{ transform: "none", opacity: 1 }, { transform: `translate3d(0, ${-10 * richtung}px, 0)`, opacity: 0 }], { duration: 200, easing: "ease-in", fill: "forwards" }).onfinish = () => a.remove();
  }
  neu.animate([{ transform: `translate3d(0, ${12 * richtung}px, 0)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 340, delay: alt.length ? 90 : 0, easing: "cubic-bezier(.2,.9,.25,1)", fill: "backwards" });
  pille.dataset.art = art;
  const ziel = neu.offsetWidth + 26;
  if (breite.ruht && breite.wert === 0) breite.springe(ziel); else breite.zu(ziel);
}

/** Dauerhafter Status (Live, Stand …, Lädt …). */
export function setzeStatus(text, art) {
  const gleich = dauernd.text === text && dauernd.art === art;
  dauernd = { text, art };
  if (zeitgeber || gleich) return;
  zeige([h("span", { class: "status-punkt", "aria-hidden": "true" }), h("span", null, text)], art, 1);
  pille?.setAttribute("aria-label", art === "alt" ? `Keine Verbindung, ${text}` : text);
}

/**
 * Kurze Meldung. art: "info" | "erfolg" | "fehler"; aktion: { text, los }.
 * Gleiche Schnittstelle wie die früheren Toasts.
 */
export function toast(text, { art = "info", aktion = null, dauer = 3800 } = {}) {
  if (!pille) return;
  clearTimeout(zeitgeber);
  const symbol = art === "erfolg" ? icon("haken", { groesse: 15, strich: 2.2 }) : art === "fehler" ? icon("info", { groesse: 15, strich: 2 }) : null;
  const knopf = aktion ? h("button", { type: "button", class: "status-aktion tippbar", onclick: () => { clearTimeout(zeitgeber); zuruck(); aktion.los(); } }, aktion.text) : null;
  zeige([symbol, h("span", { class: "status-meldung" }, text), knopf], `meldung-${art}`, 1);
  pille.setAttribute("aria-label", text);
  if (art === "erfolg") tick(8);
  zeitgeber = setTimeout(zuruck, aktion ? Math.max(dauer, 6000) : dauer);
}

function zuruck() {
  zeitgeber = 0;
  const { text, art } = dauernd;
  dauernd = { text: "", art: "" };
  setzeStatus(text, art);
}

