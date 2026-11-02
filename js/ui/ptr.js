// =====================================================================
// ptr.js – "Zum Aktualisieren ziehen": Beim Ziehen zünden die 52 Wochen-
// striche des Ziffernblatts nacheinander. Ist es voll, glüht das Zeichen
// auf – loslassen lädt neu, während die Striche kreisen.
// =====================================================================

import { h } from "../dom.js";
import { tick } from "./haptik.js";
import { ziffernblatt } from "./marke.js";

const SCHWELLE = 84;   // so weit (in Pixeln) muss man ziehen

export function ziehenZumAktualisieren(seiten, aktualisieren) {
  const blatt = ziffernblatt({ klasse: "ptr-blatt" });
  const striche = [...blatt.querySelectorAll(".marke-strich")];
  const anzeige = h("div", { class: "ptr", "aria-hidden": "true" }, blatt);
  document.body.append(anzeige);

  let start = null; let laeuft = false; let angezeigt = 0;

  const setze = (dy) => {
    const weg = Math.min(SCHWELLE * 1.5, Math.pow(Math.max(0, dy), 0.84));
    const anteil = Math.min(1, weg / SCHWELLE);
    anzeige.style.setProperty("--weg", `${weg}px`);
    anzeige.style.setProperty("--anteil", String(anteil));
    const an = Math.round(anteil * striche.length);
    if (an !== angezeigt) {
      striche.forEach((s, i) => s.classList.toggle("an", i < an));
      if (an > angezeigt && an % 13 === 0 && an > 0) tick(3);
      angezeigt = an;
    }
    const bereit = anteil >= 1;
    if (bereit && !anzeige.classList.contains("ist-bereit")) tick(10);
    anzeige.classList.toggle("ist-bereit", bereit);
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
      anzeige.style.setProperty("--weg", `${SCHWELLE * 0.85}px`);
      try { await aktualisieren(); } finally {
        laeuft = false;
        tick(6);
        anzeige.classList.remove("laedt", "ist-aktiv", "ist-bereit");
        setze(0);
      }
    };
    seite.addEventListener("touchend", ende);
    seite.addEventListener("touchcancel", ende);
  }
}
