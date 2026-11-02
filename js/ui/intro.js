// =====================================================================
// intro.js – Das Erwachen: einmalig beim ersten Start (und auf Wunsch
// in den Einstellungen). Aus dem Dunkel zünden die 52 Wochenstriche
// nacheinander, das Bitcoin-Zeichen beginnt zu glühen, der Gruß wird
// scharf gestellt, die Zahl der übernommenen Käufe rollt hoch –
// dann fliegt das Zeichen an seinen Platz in der Kopfzeile.
// Antippen überspringt.
// =====================================================================

import { h, wenigBewegung } from "../dom.js";
import { ziffernblatt } from "./marke.js";
import { feder } from "./federwerk.js";
import { tick } from "./haptik.js";
import { Zaehlwerk } from "./zaehlwerk.js";

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

export function spieleIntro({ gruss, zeile, zahl = null, zahlText = "", ziel = null }) {
  return new Promise((fertig) => {
    const ruhig = wenigBewegung();
    const marke = ziffernblatt({ klasse: "intro-marke" });
    const zahlEl = h("span", { class: "intro-zahl" });
    const ebene = h("div", { class: ["intro", ruhig && "intro--ruhig"], role: "dialog", "aria-label": "Willkommen" },
      h("div", { class: "intro-buehne" },
        marke,
        h("p", { class: "intro-gruss" }, ...gruss.split(" ").map((w) => h("span", { class: "intro-wort" }, w))),
        h("p", { class: "intro-zeile" }, zeile),
        zahl != null ? h("p", { class: "intro-daten" }, zahlEl, h("span", null, ` ${zahlText}`)) : null),
      h("p", { class: "intro-weiter" }, "Antippen, um zu beginnen"));
    document.body.append(ebene);
    // "Bewegung reduzieren": dieselbe Begrüßung, aber ruhend – Antippen schließt sie
    if (ruhig) {
      marke.classList.add("glueht");
      zahlEl.textContent = String(zahl ?? "");
      ebene.addEventListener("click", () => { ebene.remove(); fertig(); }, { once: true });
      return;
    }
    let abgebrochen = false;
    const ende = async () => {
      if (abgebrochen) return;
      abgebrochen = true;
      // Das Zeichen fliegt in die Kopfzeile (wenn bekannt), alles andere verblasst
      const r = ziel?.getBoundingClientRect();
      const m = marke.getBoundingClientRect();
      if (r && m.width) {
        const dx = r.left + r.width / 2 - (m.left + m.width / 2);
        const dy = r.top + r.height / 2 - (m.top + m.height / 2);
        const f = feder("weich");
        marke.animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(${r.width / m.width})` }], { duration: f.dauer, easing: f.kurve, fill: "forwards" });
      }
      for (const el of ebene.querySelectorAll(".intro-gruss, .intro-zeile, .intro-daten, .intro-weiter")) el.animate([{ opacity: 1, filter: "blur(0)" }, { opacity: 0, filter: "blur(8px)" }], { duration: 320, fill: "forwards" });
      const a = ebene.animate([{ backgroundColor: "rgba(6,6,8,0.92)" }, { backgroundColor: "rgba(6,6,8,0)" }], { duration: 700, delay: 250, fill: "forwards" });
      setTimeout(fertig, 380);
      a.onfinish = () => ebene.remove();
    };
    ebene.addEventListener("click", ende);

    (async () => {
      await warte(350);
      // 1) Die Striche zünden nacheinander – eine Umdrehung, wie ein Uhrwerk
      const striche = [...marke.querySelectorAll(".marke-strich")];
      striche.forEach((s, i) => {
        s.animate([{ opacity: 0.08, stroke: "rgba(255,255,255,0.3)" }, { opacity: 1, stroke: "#FFC27A", offset: 0.25 }, { opacity: 0.35 + 0.65 * (1 - i / 52), stroke: "#F09A42" }], { duration: 900, delay: i * 22, easing: "ease-out", fill: "forwards" });
        if (i % 6 === 0) setTimeout(() => !abgebrochen && tick(4), i * 22);
      });
      await warte(52 * 22 + 150);
      if (abgebrochen) return;
      // 2) Das Zeichen glüht auf
      marke.classList.add("glueht");
      tick(10);
      await warte(450);
      // 3) Gruß Wort für Wort scharf stellen
      [...ebene.querySelectorAll(".intro-wort")].forEach((w, i) => w.animate([{ opacity: 0, filter: "blur(12px)", transform: "translateY(10px)" }, { opacity: 1, filter: "blur(0)", transform: "none" }], { duration: 700, delay: i * 110, easing: feder("feder").kurve, fill: "both" }));
      await warte(500);
      ebene.querySelector(".intro-zeile").animate([{ opacity: 0, filter: "blur(10px)" }, { opacity: 1, filter: "blur(0)" }], { duration: 700, easing: "ease-out", fill: "both" });
      if (zahl != null) {
        await warte(350);
        ebene.querySelector(".intro-daten").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: "both" });
        new Zaehlwerk(zahlEl, (n) => [["ganz", String(Math.round(n ?? 0))]], { einrollen: true }).setze(zahl);
      }
      await warte(900);
      ebene.querySelector(".intro-weiter").animate([{ opacity: 0 }, { opacity: 0.6 }], { duration: 600, fill: "both" });
      await warte(2200);
      ende();
    })();
  });
}
