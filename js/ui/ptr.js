// =====================================================================
// ptr.js – "Zum Aktualisieren ziehen": Am oberen Rand nach unten ziehen,
// ein Ring füllt sich, beim Loslassen werden die Kurse neu geladen.
// =====================================================================

import { h, svg } from "../dom.js";
import { tick } from "./haptik.js";

const SCHWELLE = 72;   // so weit (in Pixeln) muss man ziehen

export function ziehenZumAktualisieren(seiten, aktualisieren) {
  const kreis = svg("circle", { cx: 16, cy: 16, r: 11, class: "ptr-ring", pathLength: 100 });
  const anzeige = h("div", { class: "ptr", "aria-hidden": "true" },
    svg("svg", { viewBox: "0 0 32 32", width: 32, height: 32 }, svg("circle", { cx: 16, cy: 16, r: 11, class: "ptr-spur" }), kreis));
  document.body.append(anzeige);

  let start = null; let laeuft = false;

  const setze = (dy) => {
    const weg = Math.min(SCHWELLE * 1.6, Math.pow(Math.max(0, dy), 0.82));
    const anteil = Math.min(1, weg / SCHWELLE);
    anzeige.style.setProperty("--weg", `${weg}px`);
    anzeige.style.setProperty("--anteil", String(anteil));
    kreis.style.setProperty("stroke-dashoffset", String(100 - anteil * 100));
    anzeige.classList.toggle("ist-bereit", anteil >= 1);
  };

  for (const seite of seiten) {
    seite.addEventListener("touchstart", (e) => {
      if (laeuft || seite.scrollTop > 0 || e.touches.length !== 1 || document.documentElement.classList.contains("hat-ebene")) return;
      if (e.target.closest("canvas, .kein-ptr")) return;
      start = { y: e.touches[0].clientY, x: e.touches[0].clientX, aktiv: false };
    }, { passive: true });

    seite.addEventListener("touchmove", (e) => {
      if (!start) return;
      const dy = e.touches[0].clientY - start.y;
      const dx = e.touches[0].clientX - start.x;
      if (!start.aktiv) {
        if (Math.abs(dx) > Math.abs(dy) || dy < 6 || seite.scrollTop > 0) { if (Math.abs(dx) > 8 || dy < -6) start = null; return; }
        start.aktiv = true;
        anzeige.classList.add("ist-aktiv");
      }
      setze(dy);
    }, { passive: true });

    const ende = async () => {
      if (!start) return;
      const war = start.aktiv && anzeige.classList.contains("ist-bereit");
      start = null;
      if (!war) { anzeige.classList.remove("ist-aktiv", "ist-bereit"); setze(0); return; }
      laeuft = true;
      anzeige.classList.add("laedt");
      anzeige.style.setProperty("--weg", `${SCHWELLE * 0.8}px`);
      tick(8);
      try { await aktualisieren(); } finally {
        laeuft = false;
        anzeige.classList.remove("laedt", "ist-aktiv", "ist-bereit");
        setze(0);
      }
    };
    seite.addEventListener("touchend", ende);
    seite.addEventListener("touchcancel", ende);
  }
}
