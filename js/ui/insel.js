// =====================================================================
// insel.js – Hinweise als "Insel": Oben wächst aus einem kleinen Punkt
// eine dunkle Glaskapsel, die sich federnd zur Nachricht aufzieht,
// ihr Symbol zeichnet sich selbst, der Text wird scharf gestellt.
// Danach zieht sie sich wieder zum Punkt zusammen und verschwindet.
// Nach oben wischen schließt sie sofort.
// =====================================================================

import { h, svg, wenigBewegung } from "../dom.js";
import { feder } from "./federwerk.js";
import { tick } from "./haptik.js";

let aktuell = null;

const SYMBOLE = {
  erfolg: () => svg("svg", { viewBox: "0 0 24 24", class: "insel-symbol-svg" }, svg("path", { d: "M5 12.5l4.5 4.5L19 7.5", class: "insel-strich" })),
  fehler: () => svg("svg", { viewBox: "0 0 24 24", class: "insel-symbol-svg" }, svg("path", { d: "M12 6v8", class: "insel-strich" }), svg("path", { d: "M12 18h.01", class: "insel-strich" })),
  info: () => svg("svg", { viewBox: "0 0 24 24", class: "insel-symbol-svg" }, svg("path", { d: "M12 11v6", class: "insel-strich" }), svg("path", { d: "M12 7h.01", class: "insel-strich" })),
  feier: () => svg("svg", { viewBox: "0 0 24 24", class: "insel-symbol-svg" }, svg("path", { d: "M12 3l2.2 6.3L21 12l-6.8 2.7L12 21l-2.2-6.3L3 12l6.8-2.7z", class: "insel-strich insel-fuellung" })),
  offline: () => svg("svg", { viewBox: "0 0 24 24", class: "insel-symbol-svg" }, svg("path", { d: "M3 3l18 18", class: "insel-strich" }), svg("path", { d: "M8.5 16.4a5 5 0 0 1 7 0", class: "insel-strich" }), svg("path", { d: "M12 20h.01", class: "insel-strich" })),
};

/**
 * Zeigt eine Insel.
 *   titel, text – Inhalt; art – erfolg | fehler | info | feier | offline
 *   aktion – { text, los } für einen Knopf (z. B. "Rückgängig")
 */
export function insel({ titel, text = null, art = "info", aktion = null, dauer = 4200 }) {
  if (aktuell) aktuell.schliessen(true);
  const knopf = aktion ? h("button", { type: "button", class: "insel-aktion impuls", onclick: (e) => { e.stopPropagation(); aktion.los(); schliessen(); } }, aktion.text) : null;
  const inhalt = h("div", { class: "insel-inhalt" },
    h("span", { class: `insel-symbol insel-symbol--${art}`, "aria-hidden": "true" }, (SYMBOLE[art] ?? SYMBOLE.info)()),
    h("span", { class: "insel-text" }, h("span", { class: "insel-titel" }, titel), text ? h("span", { class: "insel-unter" }, text) : null),
    knopf);
  const el = h("div", { class: ["insel", `insel--${art}`], role: art === "fehler" ? "alert" : "status", "aria-live": "polite" }, inhalt);
  document.body.append(el);
  if (art === "fehler") tick(18); else if (art === "erfolg" || art === "feier") tick(8);

  const ruhig = wenigBewegung();
  const breite = el.offsetWidth;
  const punkt = `inset(0px ${Math.max(0, breite / 2 - 20)}px round 999px)`;
  if (!ruhig) {
    const f = feder("gummi");
    el.animate([
      { clipPath: punkt, transform: "translate3d(-50%, -14px, 0) scale(0.9)", opacity: 0 },
      { clipPath: punkt, transform: "translate3d(-50%, 0, 0) scale(1)", opacity: 1, offset: 0.18 },
      { clipPath: "inset(0px 0px round 26px)", transform: "translate3d(-50%, 0, 0) scale(1)", opacity: 1 },
    ], { duration: f.dauer + 260, easing: f.kurve, fill: "both" });
    inhalt.animate([{ opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0)" }], { duration: 420, delay: 200, easing: "ease-out", fill: "backwards" });
  } else el.classList.add("ist-ruhig");

  let zu = false;
  let uhr = setTimeout(() => schliessen(), aktion ? Math.max(dauer, 6500) : dauer);
  // Berührung pausiert das Verschwinden; nach oben wischen schließt
  let startY = null;
  el.addEventListener("pointerdown", (e) => { startY = e.clientY; clearTimeout(uhr); });
  el.addEventListener("pointerup", (e) => {
    if (startY != null && startY - e.clientY > 16) schliessen();
    else uhr = setTimeout(() => schliessen(), 2200);
    startY = null;
  });

  function schliessen(sofort = false) {
    if (zu) return;
    zu = true;
    clearTimeout(uhr);
    if (aktuell?.el === el) aktuell = null;
    if (sofort || ruhig) { el.remove(); return; }
    inhalt.animate([{ opacity: 1, filter: "blur(0)" }, { opacity: 0, filter: "blur(6px)" }], { duration: 180, fill: "forwards" });
    const a = el.animate([
      { clipPath: "inset(0px 0px round 26px)", transform: "translate3d(-50%, 0, 0)", opacity: 1 },
      { clipPath: punkt, transform: "translate3d(-50%, 0, 0)", opacity: 1, offset: 0.65 },
      { clipPath: punkt, transform: "translate3d(-50%, -18px, 0) scale(0.6)", opacity: 0 },
    ], { duration: 560, delay: 120, easing: "cubic-bezier(0.5, 0, 0.2, 1)", fill: "forwards" });
    a.onfinish = () => el.remove();
  }
  aktuell = { el, schliessen };
  return aktuell;
}
