// =====================================================================
// segment.js – Umschalter mit gleitendem Hintergrund (z. B. Woche/Monat/Jahr).
// Der Indikator gleitet federnd zur gewählten Option, statt umzuspringen.
// =====================================================================

import { h } from "../dom.js";

export function segment({ optionen, aktiv, beiWahl, klein = false, name = "Auswahl" }) {
  const indikator = h("span", { class: "segment-indikator", "aria-hidden": "true" });
  const el = h("div", { class: ["segment", klein && "segment--klein"], role: "radiogroup", "aria-label": name }, indikator);
  let wert = aktiv;
  let knoepfe = [];

  function bauen(liste) {
    knoepfe.forEach((k) => k.remove());
    knoepfe = liste.map((o) => h("button", {
      type: "button", class: "segment-option", role: "radio", dataset: { wert: o.wert },
      onclick: () => waehle(o.wert, true),
      onkeydown: (e) => {
        const i = liste.findIndex((x) => x.wert === wert);
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const n = liste[(i + (e.key === "ArrowRight" ? 1 : liste.length - 1)) % liste.length];
          waehle(n.wert, true);
          knoepfe.find((k) => k.dataset.wert === n.wert)?.focus();
        }
      },
    }, o.text));
    el.append(...knoepfe);
    if (!liste.some((o) => o.wert === wert)) wert = liste[liste.length - 1]?.wert;
    markieren(false);
  }

  function markieren(animiert = true) {
    const k = knoepfe.find((x) => x.dataset.wert === wert);
    knoepfe.forEach((x) => {
      const an = x === k;
      x.setAttribute("aria-checked", an ? "true" : "false");
      x.tabIndex = an ? 0 : -1;
      x.classList.toggle("ist-aktiv", an);
    });
    if (!k) return;
    if (!animiert) indikator.classList.add("ohne-uebergang");
    indikator.style.setProperty("--x", `${k.offsetLeft}px`);
    indikator.style.setProperty("--b", `${k.offsetWidth}px`);
    if (!animiert) requestAnimationFrame(() => indikator.classList.remove("ohne-uebergang"));
  }

  function waehle(w, vonNutzer = false) {
    if (w === wert && vonNutzer) return;
    wert = w;
    markieren(true);
    if (vonNutzer) beiWahl?.(w);
  }

  bauen(optionen);
  new ResizeObserver(() => markieren(false)).observe(el);

  return {
    el,
    get wert() { return wert; },
    setze: (w) => waehle(w, false),
    optionen: (liste) => bauen(liste),
  };
}
