// =====================================================================
// toast.js – Kurze Hinweise unten am Bildschirm, optional mit Aktion
// (z. B. "Rückgängig"). Milchglas, federnd, verschwinden von selbst.
// =====================================================================

import { h } from "../dom.js";

let aktuell = null;

export function toast(text, { aktion = null, dauer = 4200, art = "" } = {}) {
  if (aktuell) aktuell.schliessen(true);
  const knopf = aktion ? h("button", { type: "button", class: "toast-aktion", onclick: () => { aktion.los(); schliessen(); } }, aktion.text) : null;
  const el = h("div", { class: ["toast", art && `toast--${art}`], role: "status", "aria-live": "polite" }, h("span", { class: "toast-text" }, text), knopf);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add("ist-sichtbar"));
  let zu = false;
  const uhr = setTimeout(() => schliessen(), aktion ? Math.max(dauer, 6000) : dauer);
  function schliessen(sofort = false) {
    if (zu) return;
    zu = true;
    clearTimeout(uhr);
    if (sofort) { el.remove(); return; }
    el.classList.remove("ist-sichtbar");
    setTimeout(() => el.remove(), 400);
    if (aktuell?.el === el) aktuell = null;
  }
  aktuell = { el, schliessen };
  return aktuell;
}
