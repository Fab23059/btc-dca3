// =====================================================================
// sheet.js – Dialoge als "Bottom Sheet": fahren federnd von unten herein,
// haben einen Ziehgriff, lassen sich nach unten wegwischen und federn
// gummiartig nach, wenn man nach oben zieht.
// =====================================================================

import { h, icon, wenigBewegung } from "../dom.js";
import { ebeneAnmelden } from "./ebenen.js";
import { fokus } from "./federwerk.js";

export function oeffneSheet({ titel, untertitel = null, inhalt, fuss = null, beimSchliessen = null, breit = false }) {
  const titelId = `sheet-titel-${Math.random().toString(36).slice(2, 8)}`;
  const koerper = h("div", { class: "sheet-inhalt" }, inhalt);
  const griff = h("div", { class: "sheet-griffzone", "aria-hidden": "true" }, h("span", { class: "sheet-griff" }));
  const zuKnopf = h("button", { type: "button", class: "rundknopf sheet-zu", "aria-label": "Schließen", onclick: () => anfrage() }, icon("schliessen", { groesse: 20 }));
  const kopf = h("header", { class: "sheet-kopf" },
    h("div", { class: "sheet-titelblock" },
      h("h2", { id: titelId, class: "sheet-titel" }, titel),
      untertitel ? h("p", { class: "sheet-untertitel" }, untertitel) : null),
    zuKnopf);
  const blatt = h("section", { class: ["sheet", breit && "sheet--breit"], role: "dialog", "aria-modal": "true", "aria-labelledby": titelId, tabindex: "-1" },
    griff, kopf, koerper, fuss ? h("footer", { class: "sheet-fuss" }, fuss) : null);
  const hintergrund = h("div", { class: "sheet-hintergrund", onclick: () => anfrage() });
  const ebene = h("div", { class: "ebene sheet-ebene" }, hintergrund, blatt);
  document.body.append(ebene);

  let offen = true;
  const anfrage = ebeneAnmelden(ebene, () => {
    offen = false;
    ebene.classList.remove("ist-offen");
    blatt.style.removeProperty("transform");
    const weg = () => ebene.remove();
    if (wenigBewegung()) weg(); else setTimeout(weg, 420);
    beimSchliessen?.();
  });

  requestAnimationFrame(() => requestAnimationFrame(() => {
    ebene.classList.add("ist-offen");
    blatt.focus({ preventScroll: true });
    const kinder = koerper.firstElementChild?.children?.length > 1 ? [...koerper.firstElementChild.children] : [...koerper.children];
    if (!kinder.some((k) => k.getAnimations?.().length)) fokus(kinder.slice(0, 8), { abstand: 50, start: 120, hub: 18 });
  }));

  // ---- Ziehen zum Schließen ----
  let start = null;
  const ziehStart = (e) => {
    if (e.button > 0) return;
    if (e.target.closest("button, input, select, textarea, a")) return;
    start = { y: e.clientY, t: performance.now(), dy: 0 };
    blatt.classList.add("wird-gezogen");
    blatt.setPointerCapture(e.pointerId);
  };
  const ziehen = (e) => {
    if (!start) return;
    let dy = e.clientY - start.y;
    if (dy < 0) dy = -Math.pow(-dy, 0.7);   // Gummiband nach oben
    start.dy = dy;
    blatt.style.transform = `translate3d(0, ${dy}px, 0)`;
    hintergrund.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / (blatt.offsetHeight || 1)));
  };
  const ziehEnde = () => {
    if (!start) return;
    const tempo = start.dy / Math.max(1, performance.now() - start.t);
    blatt.classList.remove("wird-gezogen");
    hintergrund.style.removeProperty("opacity");
    if (start.dy > 120 || (start.dy > 30 && tempo > 0.6)) anfrage();
    else blatt.style.removeProperty("transform");
    start = null;
  };
  for (const zone of [griff, kopf]) {
    zone.addEventListener("pointerdown", ziehStart);
  }
  blatt.addEventListener("pointermove", ziehen);
  blatt.addEventListener("pointerup", ziehEnde);
  blatt.addEventListener("pointercancel", ziehEnde);

  return { el: blatt, koerper, schliessen: () => offen && anfrage() };
}
