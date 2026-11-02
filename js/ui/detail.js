// =====================================================================
// detail.js – Detailansicht, die sich aus dem angetippten Element heraus
// öffnet und beim Schließen genau dorthin zurückfährt. So verliert man
// nie den Faden, wo man war.
// =====================================================================

import { h, icon, wenigBewegung } from "../dom.js";
import { ebeneAnmelden } from "./ebenen.js";

const FEDER = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const SANFT = "cubic-bezier(0.32, 0.72, 0, 1)";

function ausschnitt(quelle) {
  const r = quelle.getBoundingClientRect();
  const radius = parseFloat(getComputedStyle(quelle).borderTopLeftRadius) || 20;
  return `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round ${radius}px)`;
}

export function oeffneDetail(quelle, { titel, ueberschrift = null, inhalt }) {
  const zuKnopf = h("button", { type: "button", class: "rundknopf", "aria-label": "Schließen", onclick: () => anfrage() }, icon("schliessen", { groesse: 20 }));
  const titelId = `detail-${Math.random().toString(36).slice(2, 8)}`;
  const koerper = h("div", { class: "detail-inhalt" }, ueberschrift ? h("div", { class: "detail-ueberschrift" }, ueberschrift) : null, inhalt);
  const panel = h("section", { class: "detail", role: "dialog", "aria-modal": "true", "aria-labelledby": titelId, tabindex: "-1" },
    h("header", { class: "detail-kopf" }, h("h2", { id: titelId, class: "detail-titel" }, titel), zuKnopf),
    koerper);
  const ebene = h("div", { class: "ebene detail-ebene" }, panel);
  document.body.append(ebene);

  const ruhig = wenigBewegung();
  if (!ruhig) {
    panel.animate([{ clipPath: ausschnitt(quelle) }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], { duration: 560, easing: FEDER });
    koerper.animate([{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: 140, easing: SANFT, fill: "backwards" });
  }
  requestAnimationFrame(() => panel.focus({ preventScroll: true }));

  const anfrage = ebeneAnmelden(ebene, () => {
    if (ruhig || !quelle.isConnected) { ebene.remove(); return; }
    koerper.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
    const a = panel.animate([{ clipPath: "inset(0px 0px 0px 0px round 0px)" }, { clipPath: ausschnitt(quelle) }], { duration: 380, easing: SANFT, fill: "forwards" });
    a.onfinish = () => ebene.remove();
  });
  return { koerper, schliessen: () => anfrage() };
}
