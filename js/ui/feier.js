// =====================================================================
// feier.js – Ein Meilenstein ist erreicht: ein kurzer, ruhiger Goldregen
// und ein Hinweis. Keine Raketen, kein Lärm.
// =====================================================================

import { h, wenigBewegung } from "../dom.js";
import { toast } from "./toast.js";
import { tick } from "./haptik.js";

const FARBEN = ["#F0A04B", "#F7C27A", "#E8893A", "#F2F2F4", "#C9A27A"];

export function feiern(text) {
  tick(14);
  toast(text, { art: "feier", dauer: 5200 });
  if (wenigBewegung()) return;
  const ebene = h("div", { class: "konfetti-ebene", "aria-hidden": "true" });
  document.body.append(ebene);
  const breite = innerWidth;
  for (let i = 0; i < 34; i++) {
    const teil = h("span", { class: "konfetti", style: { left: `${Math.random() * breite}px`, background: FARBEN[i % FARBEN.length], width: `${4 + Math.random() * 5}px`, height: `${7 + Math.random() * 7}px` } });
    ebene.append(teil);
    const dauer = 2400 + Math.random() * 1600;
    const seit = (Math.random() - 0.5) * 140;
    teil.animate([
      { transform: "translate3d(0, -20px, 0) rotate(0deg)", opacity: 0 },
      { opacity: 1, offset: 0.08 },
      { transform: `translate3d(${seit}px, ${innerHeight * 0.95}px, 0) rotate(${(Math.random() - 0.5) * 900}deg)`, opacity: 0 },
    ], { duration: dauer, delay: Math.random() * 400, easing: "cubic-bezier(0.25, 0.6, 0.35, 1)", fill: "forwards" });
  }
  setTimeout(() => ebene.remove(), 4600);
}
