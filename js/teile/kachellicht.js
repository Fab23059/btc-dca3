// =====================================================================
// kachellicht.js – Die Kacheln fangen Licht (Bewegung B18).
//
// Über der Startseite hängt eine Lichtquelle, oben rechts, wie überall
// in der App. Jede Kachel hat eine glatte Oberfläche und eine feine
// Oberkante. Beides spiegelt dieses Licht:
//
//   * Kippst du das Handy, wandert die Lichtquelle (neigung.js). Der
//     Schein gleitet über die Kacheln, die Lichtkante läuft an ihrer
//     Oberkante entlang.
//   * Rollst du die Seite, ziehen die Kacheln unter dem Licht durch:
//     Wer oben ist, glänzt, wer weiter unten liegt, wird ruhiger.
//     Das funktioniert auch ohne Lagesensor.
//
// Bewegt werden nur Lage und Deckkraft (Regel 5). Gerechnet wird nur,
// wenn sich Licht oder Seite bewegen, und höchstens einmal pro Bild.
// "Atmosphäre" aus oder "Bewegung reduzieren": Das Licht steht still.
// =====================================================================

import { h, wenigBewegung } from "../dom.js";
import { imTakt, klemme } from "../bewegung/feder.js";
import { beiLicht } from "../bewegung/neigung.js";

const still = () => wenigBewegung() || document.documentElement.classList.contains("ruhig");

/**
 * @param {Element[]} kacheln  die Kacheln der Startseite
 * @param {Element}   rolle    das Element, das rollt (für das Mitziehen beim Scrollen)
 */
export function kachellicht(kacheln, rolle) {
  const teile = kacheln.map((el) => {
    const schein = h("span", { class: "kachel-schein", "aria-hidden": "true" });
    const kante = h("span", { class: "kachel-kante", "aria-hidden": "true" });
    el.append(schein, kante);
    return { el, schein, kante };
  });

  let lx = 0.5; let ly = -0.55;
  let geplant = false;

  function rechne() {
    geplant = false;
    const W = innerWidth; const H = innerHeight;
    // Wo die Lichtquelle über dem Bildschirm steht (Ruhelage: oben rechts, knapp über dem Rand)
    const sx = W * (0.5 + 0.5 * lx);
    const sy = H * (0.05 + 0.32 * ly);
    // Erst alle Lagen lesen, dann alles schreiben – so rechnet der Browser das Layout nur einmal
    const lagen = teile.map((t) => t.el.getBoundingClientRect());
    teile.forEach((t, i) => {
      const r = lagen[i];
      if (!r.width || r.bottom < -40 || r.top > H + 40) return;
      // Schein: Spiegelbild der Lichtquelle auf der Kachel. Waagerecht folgt er der Quelle.
      // Senkrecht hängt er davon ab, wo die Kachel steht: Liegt sie weit unter dem Licht,
      // spiegelt es sich an ihrem oberen Rand, steht sie auf seiner Höhe, in ihrer Mitte.
      // Beim Scrollen wandert er deshalb über die Fläche.
      const px = klemme(sx - r.left, -0.1 * r.width, 1.1 * r.width);
      const tiefe = klemme((r.top + r.height * 0.5 - sy) / H);
      const py = r.height * (0.78 - 0.74 * tiefe);
      // Je weiter die Kachel unter dem Licht liegt, desto ruhiger glänzt sie
      const abstand = Math.max(0, r.top + r.height * 0.5 - sy);
      const kraft = Math.exp(-abstand / (H * 0.9));
      t.schein.style.transform = `translate3d(${(px - r.width * 0.55).toFixed(1)}px, ${(py - r.width * 0.55).toFixed(1)}px, 0)`;
      t.schein.style.opacity = (0.45 + 0.55 * kraft).toFixed(3);
      // Kante: Das Licht trifft die Oberkante dort, wo die Quelle darüber steht
      const kx = klemme(sx - r.left, 0, r.width);
      t.kante.style.transform = `translate3d(${(kx - r.width * 0.32).toFixed(1)}px, 0, 0)`;
      t.kante.style.opacity = (0.25 + 0.75 * kraft * klemme(1.2 - Math.abs(kx / r.width - 0.5))).toFixed(3);
    });
  }

  const plane = () => {
    if (geplant) return;
    geplant = true;
    const ab = imTakt(() => { ab(); rechne(); });
  };

  // Licht der Hand (nur wenn es sich bewegen darf)
  let abmelden = null;
  const schalte = () => {
    if (still()) {
      abmelden?.(); abmelden = null;
      lx = 0.5; ly = -0.55; plane();
    } else if (!abmelden) {
      abmelden = beiLicht((l) => { lx = l.x; ly = l.y; plane(); });
    }
  };
  new MutationObserver(schalte).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  schalte();

  rolle?.addEventListener("scroll", () => { if (!still()) plane(); }, { passive: true });
  addEventListener("resize", plane);
  for (const t of teile) new ResizeObserver(plane).observe(t.el);
  plane();
}
