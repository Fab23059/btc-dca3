// =====================================================================
// weg.js – "Der Weg": Gedanke des Tages, Meilensteine mit Ausblick und
// ein ruhiger Blick auf das Marktumfeld (Stimmung, Halving, Blockhöhe).
// =====================================================================

import { h, svg, fuelle, wenigBewegung } from "../dom.js";
import { ZITATE, zitatDesTages } from "../zitate.js";
import { meilensteine, zielName } from "../kennzahlen.js";
import { SPARRATE_EUR } from "../konfig.js";
import { lies, schreibe, SCHLUESSEL } from "../speicher.js";
import { euro, sats, ganz, anzahl, datumMonatKurz, zahl, monatsname, vorZeit } from "../format.js";
import { datumBerlin, zerlege } from "../zeit.js";
import { veraenderung, skelett } from "./gemeinsam.js";

const karte = (titel, ...inhalt) => h("section", { class: "karte weg-karte" }, titel ? h("h2", { class: "label" }, titel) : null, ...inhalt);

function stimmungText(w) {
  if (w < 25) return "Extreme Angst";
  if (w < 45) return "Angst";
  if (w < 55) return "Neutral";
  if (w < 75) return "Gier";
  return "Extreme Gier";
}

export function erstelleWeg(app) {
  const z = app.zustand;

  // ---- Zitat-Bühne ----
  let zitatNr = null;
  const zitatText = h("blockquote", { class: "zitat-text" });
  const zitatAutor = h("p", { class: "zitat-autor" });
  const buehne = h("button", { type: "button", class: "zitat-buehne tippbar", "aria-label": "Neuer Gedanke", onclick: () => neuesZitat() },
    h("span", { class: "zitat-zeichen", "aria-hidden": "true" }, "\u201C"),
    zitatText, zitatAutor,
    h("span", { class: "zitat-hinweis" }, "Antippen für einen neuen Gedanken"));

  function zeigeZitat(i, animiert) {
    zitatNr = i;
    const q = ZITATE[i];
    const setzen = () => { zitatText.textContent = q.t; zitatAutor.textContent = q.a; };
    if (!animiert || wenigBewegung()) { setzen(); return; }
    const a = [zitatText, zitatAutor].map((el) => el.animate([{ opacity: 1, filter: "blur(0)" }, { opacity: 0, filter: "blur(6px)" }], { duration: 260, easing: "ease-in", fill: "forwards" }));
    a[0].onfinish = () => {
      setzen();
      [zitatText, zitatAutor].forEach((el, k) => el.animate([{ opacity: 0, filter: "blur(6px)", transform: "translateY(6px)" }, { opacity: 1, filter: "blur(0)", transform: "none" }], { duration: 620, delay: k * 120, easing: "cubic-bezier(0.32,0.72,0,1)", fill: "both" }));
    };
  }
  function neuesZitat() {
    let i = Math.floor(Math.random() * ZITATE.length);
    if (i === zitatNr) i = (i + 1) % ZITATE.length;
    schreibe(SCHLUESSEL.zitat, { nr: i, tag: datumBerlin(Date.now()) });
    zeigeZitat(i, true);
  }

  const meilen = h("div");
  const markt = h("div");
  const el = h("div", { class: "seite-inhalt" },
    h("header", { class: "seiten-kopf" }, h("p", { class: "seiten-titel" }, "Schritt für Schritt")),
    buehne, meilen, markt);

  // ---- Meilensteine ----
  function zeigeMeilensteine() {
    const m = meilensteine(z.kaeufe, z.aktuell?.kurs, SPARRATE_EUR);
    const n = m.naechstes;
    const kopf = h("div", { class: "meilenstein-kopf" },
      h("p", { class: "zahl-mittel" }, h("span", { class: "z-ganz" }, sats(m.sats)), h("span", { class: "z-einheit" }, "sats")),
      h("p", { class: "text-2" }, m.sats ? `${zahl(m.sats / 1e6, 2)} % eines ganzen Bitcoin` : "Der erste Kauf startet alles"));
    const ausblick = n ? [
      h("div", { class: "fortschritt fortschritt--gross" }, h("span", { class: "fortschritt-fuellung", style: { "--anteil": String(n.fortschritt) } })),
      h("div", { class: "fortschritt-beschriftung" },
        h("span", null, `Nächstes Ziel: ${zielName(n.ziel)} sats`),
        h("span", { class: "text-3" }, `${zahl(n.fortschritt * 100, 0)} %`)),
      h("p", { class: "analyse-text" }, `Noch ${sats(n.fehlt)} sats${n.kaeufeNoch ? ` – beim heutigen Kurs etwa ${anzahl(n.kaeufeNoch, "Kauf", "Käufe")}` : ""}.${n.danach ? ` Danach wartet ${zielName(n.danach)}.` : ""}`),
    ] : [h("p", { class: "analyse-text" }, "Alle Sats-Ziele erreicht. Bemerkenswert.")];

    // Pfad: erreichte Ziele mit Datum, dann das nächste und übernächste
    const punkte = [
      ...m.erreicht.map((e) => ({ titel: `${zielName(e.ziel)} sats`, unter: `erreicht am ${datumMonatKurz(e.am)} · Kauf Nr. ${e.kaufNr}`, art: "erreicht" })),
      ...(n ? [{ titel: `${zielName(n.ziel)} sats`, unter: n.kaeufeNoch ? `in etwa ${anzahl(n.kaeufeNoch, "Kauf", "Käufen")}` : "als Nächstes", art: "naechstes" }] : []),
      ...(n?.danach ? [{ titel: `${zielName(n.danach)} sats`, unter: "danach", art: "spaeter" }] : []),
    ];
    const pfad = h("ol", { class: "pfad" }, punkte.map((p) => h("li", { class: `pfad-punkt pfad-punkt--${p.art}` },
      h("span", { class: "pfad-marke", "aria-hidden": "true" }),
      h("span", { class: "pfad-titel" }, p.titel), h("span", { class: "pfad-unter" }, p.unter))));

    const w = m.naechsteWoche;
    const wochen = h("div", { class: "wochen-serie" },
      h("p", { class: "zahl-mittel" }, h("span", { class: "z-ganz" }, ganz(m.wochen)), h("span", { class: "z-einheit" }, m.wochen === 1 ? "Woche" : "Wochen")),
      h("p", { class: "text-2" }, "in Folge, ohne Unterbrechung"),
      h("div", { class: "wochen-punkte", "aria-hidden": "true" }, Array.from({ length: Math.min(52, Math.max(m.wochen, w?.ziel ?? m.wochen)) }, (_, i) => h("span", { class: i < m.wochen ? "an" : "" }))),
      w ? h("p", { class: "analyse-text" }, `Nächster Halt: ${w.ziel} Wochen – noch ${anzahl(w.noch, "Woche", "Wochen")}.`) : null);

    fuelle(meilen,
      karte("Meilensteine", kopf, ...ausblick, pfad),
      karte("Beständigkeit", wochen));
  }

  // ---- Marktumfeld ----
  function zeigeMarkt() {
    const a = z.aktuell;
    const s = z.markt?.stimmung; const b = z.markt?.block;
    const satsFuer15 = a?.kurs ? (SPARRATE_EUR / a.kurs) * 1e8 : null;
    const heute = karte("Bitcoin heute",
      h("div", { class: "markt-zeile" },
        h("p", { class: "zahl-mittel" }, a ? euro(a.kurs, 0) : skelett("6em")),
        a?.aenderung24h != null ? veraenderung(null, a.aenderung24h, { klein: true }) : null),
      h("dl", { class: "werte-liste" },
        h("div", null, h("dt", null, "24 h Hoch"), h("dd", null, a?.hoch24h ? euro(a.hoch24h, 0) : "–")),
        h("div", null, h("dt", null, "24 h Tief"), h("dd", null, a?.tief24h ? euro(a.tief24h, 0) : "–")),
        h("div", null, h("dt", null, "Für 15\u00A0€ gibt es"), h("dd", null, satsFuer15 ? `${sats(satsFuer15)} sats` : "–")),
        h("div", null, h("dt", null, "Stand"), h("dd", null, a ? vorZeit(a.zeit) : "–"))));

    let stimmung = null;
    if (s) {
      const winkel = Math.PI * (1 - s.wert / 100);
      const r = 52; const cx = 64; const cy = 60;
      const px = cx + r * Math.cos(winkel); const py = cy - r * Math.sin(winkel);
      stimmung = karte("Marktstimmung",
        h("div", { class: "stimmung" },
          svg("svg", { viewBox: "0 0 128 68", class: "tacho", "aria-hidden": "true" },
            svg("defs", null, svg("linearGradient", { id: "tacho-verlauf", x1: 0, x2: 1, y1: 0, y2: 0 },
              svg("stop", { offset: "0", style: { "stop-color": "var(--minus)" } }), svg("stop", { offset: "0.5", style: { "stop-color": "var(--text-3)" } }), svg("stop", { offset: "1", style: { "stop-color": "var(--plus)" } }))),
            svg("path", { d: `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`, class: "tacho-spur" }),
            svg("path", { d: `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`, class: "tacho-bogen", stroke: "url(#tacho-verlauf)" }),
            svg("circle", { cx: px, cy: py, r: 5.5, class: "tacho-zeiger" })),
          h("div", { class: "stimmung-text" }, h("p", { class: "zahl-mittel" }, String(s.wert)), h("p", { class: "text-2" }, stimmungText(s.wert)))),
        h("p", { class: "analyse-text" }, "Fear & Greed Index (0 = extreme Angst, 100 = extreme Gier). Die Stimmung schwankt – dein Plan bleibt derselbe."));
    }

    let halving = null;
    if (b) {
      const EPOCHE = 210_000;
      const naechstes = Math.ceil((b.hoehe + 1) / EPOCHE) * EPOCHE;
      const fehlt = naechstes - b.hoehe;
      const anteil = (b.hoehe % EPOCHE) / EPOCHE;
      const wann = new Date(b.zeit + fehlt * 10 * 60_000);
      const { jahr, monat } = zerlege(datumBerlin(wann.getTime()));
      halving = karte("Nächstes Halving",
        h("p", { class: "zahl-mittel" }, `${monatsname(monat)} ${jahr}`, h("span", { class: "text-3 zahl-zusatz" }, " (ca.)")),
        h("div", { class: "fortschritt" }, h("span", { class: "fortschritt-fuellung fortschritt-fuellung--ruhig", style: { "--anteil": String(anteil) } })),
        h("dl", { class: "werte-liste" },
          h("div", null, h("dt", null, "Aktueller Block"), h("dd", null, ganz(b.hoehe))),
          h("div", null, h("dt", null, "Halving bei Block"), h("dd", null, ganz(naechstes))),
          h("div", null, h("dt", null, "Noch"), h("dd", null, `${ganz(fehlt)} Blöcke`)),
          h("div", null, h("dt", null, "Etwa"), h("dd", null, `${ganz(fehlt / 144)} Tage`))),
        h("p", { class: "analyse-text" }, "Alle 210.000 Blöcke halbiert sich die Menge neuer Bitcoin. Ein Block entsteht etwa alle zehn Minuten."));
    }
    fuelle(markt, h("h2", { class: "abschnitt-titel" }, "Umfeld"), heute, stimmung, halving);
  }

  // Zitat des Tages (oder das zuletzt angetippte von heute)
  const gemerkt = lies(SCHLUESSEL.zitat);
  const heute = datumBerlin(Date.now());
  zeigeZitat(gemerkt?.tag === heute && Number.isInteger(gemerkt.nr) && ZITATE[gemerkt.nr] ? gemerkt.nr : zitatDesTages(heute), false);

  return {
    el,
    aktualisiere() {
      zeigeMeilensteine();
      zeigeMarkt();
    },
  };
}
