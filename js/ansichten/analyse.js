// =====================================================================
// analyse.js – Tiefere Analyse: Kursverlauf mit deinen Käufen,
// Durchhalten, Schwankung, Rückgang & Erholung, Wochenrückblick,
// Haltefrist und Kostenbasis je Kauf.
// Alles beschreibend – nichts bewertet vergangene Entscheidungen.
// =====================================================================

import { h, svg, fuelle } from "../dom.js";
import { Zahl } from "../ui/zahl.js";
import { segment } from "../ui/segment.js";
import { kursDiagramm, diagrammeVerfuegbar } from "../diagramme.js";
import { REIHEN } from "../kurse.js";
import { wochenZerlegung, kursBei } from "../rechnen.js";
import { volatilitaet, rueckgang, wochenRueckblick, haltefrist, durchhalten } from "../kennzahlen.js";
import { euro, prozent, zahl, sats, ganz, datum, datumMonatKurz, datumLang, uhrzeit, anzahl, btc as btcFmt } from "../format.js";
import { datumBerlin } from "../zeit.js";
import { euroDarstellung, veraenderung, leer, skelett } from "./gemeinsam.js";

const karte = (titel, ...inhalt) => h("section", { class: "karte analyse-karte" }, h("h2", { class: "label" }, titel), ...inhalt);

export function erstelleAnalyse(app) {
  const z = app.zustand;
  let bereich = "monat";
  let scrubbt = false;

  // ---- Kursverlauf ----
  const kursLabel = h("p", { class: "label" }, "Bitcoin");
  const kursZahlEl = h("p", { class: "zahl-mittel" });
  const kursZahl = new Zahl(kursZahlEl, euroDarstellung(false, 0));
  const kursZeile = h("div", { class: "held-zeile" });
  const canvas = h("canvas", { class: "diagramm-canvas", role: "img", "aria-label": "Bitcoin-Kursverlauf mit deinen Käufen" });
  const flaeche = h("div", { class: "diagramm-flaeche diagramm-flaeche--klein" }, canvas);
  const bereichWahl = segment({
    name: "Zeitraum Kursverlauf", klein: true, aktiv: bereich,
    optionen: Object.entries(REIHEN).map(([wert, d]) => ({ wert, text: d.titel })),
    beiWahl: (w) => { bereich = w; ladeUndZeige(true); },
  });
  let reiheAnfang = null;
  const diagramm = diagrammeVerfuegbar() ? kursDiagramm(canvas, (p) => {
    scrubbt = p != null;
    if (!p) { kursKopf(); return; }
    kursZahl.setze(p.c, { sofort: true });
    kursLabel.textContent = p.kauf ? `Dein Kauf Nr. ${p.kauf.nr}` : (bereich === "tag" || bereich === "woche" ? `${datumLang(datumBerlin(p.t))}, ${uhrzeit(p.t)}` : datumLang(datumBerlin(p.t), true));
    fuelle(kursZeile, reiheAnfang ? veraenderung(null, (p.c / reiheAnfang - 1) * 100, { klein: true }) : null,
      h("span", { class: "held-zeitraum" }, p.kauf ? `${datumLang(p.kauf.montag)} · ${btcFmt(p.kauf.btc)} BTC` : `seit Beginn des Zeitraums`));
  }) : null;

  /** Punkte genau für den gewählten Zeitraum; der erste Punkt liegt exakt am Anfang. */
  function zeitraumPunkte() {
    const r = z.reihen[bereich];
    if (!r?.punkte?.length) return [];
    const spanne = REIHEN[bereich].spanne;
    let punkte = r.punkte;
    if (spanne) {
      const start = z.jetzt - spanne;
      const c0 = kursBei(punkte, start);
      punkte = punkte.filter((p) => p.t > start);
      if (c0 != null) punkte.unshift({ t: start, c: c0 });
    }
    punkte = [...punkte];
    if (z.aktuell?.kurs && z.aktuell.zeit > (punkte[punkte.length - 1]?.t ?? 0)) punkte.push({ t: z.aktuell.zeit, c: z.aktuell.kurs });
    return punkte;
  }

  function kursKopf() {
    if (scrubbt) return;
    kursLabel.textContent = "Bitcoin";
    kursZahl.setze(z.aktuell?.kurs ?? null);
    const r = z.reihen[bereich];
    const zp = zeitraumPunkte();
    if (zp.length > 1) {
      const a = zp[0].c; const e = z.aktuell?.kurs ?? zp[zp.length - 1].c;
      reiheAnfang = a;
      fuelle(kursZeile, veraenderung(null, (e / a - 1) * 100), h("span", { class: "held-zeitraum" }, `im Zeitraum ${REIHEN[bereich].titel}${r.veraltet ? " · Stand " + uhrzeit(r.zeit) : ""}`));
    } else fuelle(kursZeile, skelett("8em"));
  }

  async function ladeUndZeige(einzeichnen) {
    kursKopf();
    try { await app.ladeReihe(bereich); } catch { /* unten behandelt */ }
    const r = z.reihen[bereich];
    flaeche.querySelector(".leer")?.remove();
    if (!r?.punkte?.length) {
      flaeche.append(leer({ titel: "Kursverlauf gerade nicht abrufbar", text: "Keine Kursquelle hat geantwortet. Zieh die Seite nach unten, um es erneut zu versuchen.", symbol: "offline" }));
      return;
    }
    const punkte = zeitraumPunkte();
    diagramm?.zeige(punkte, { kaeufe: z.kaeufe, mitUhrzeit: bereich === "tag", einzeichnen });
    kursKopf();
  }

  const kursKarte = h("section", { class: "karte analyse-karte analyse-karte--diagramm" },
    h("div", { class: "kurs-kopf" }, kursLabel, kursZahlEl, kursZeile),
    flaeche,
    h("div", { class: "kurs-fuss" }, bereichWahl.el),
    h("p", { class: "legende-text" }, h("span", { class: "marke marke--voll" }), "eingetragener Kauf", h("span", { class: "marke" }), "geschätzter Kauf"));

  const rest = h("div", { class: "analyse-rest" });
  const el = h("div", { class: "seite-inhalt" }, h("header", { class: "seiten-kopf" }, h("p", { class: "seiten-titel" }, "Dein Weg in Zahlen")), kursKarte, rest);

  // -------------------------------------------------------------------

  function durchhaltenKarte() {
    const d = durchhalten(z.kaeufe, z.jetzt);
    const stat = (wert, label) => h("div", { class: "stat" }, h("p", { class: "stat-wert" }, wert), h("p", { class: "stat-label" }, label));
    return karte("Durchhalten",
      h("div", { class: "statistik-raster" },
        stat(ganz(d.wochenInFolge), d.wochenInFolge === 1 ? "Woche in Folge" : "Wochen in Folge"),
        stat(ganz(d.kaeufe), d.kaeufe === 1 ? "Kauf" : "Käufe"),
        stat(ganz(d.tage), "Tage dabei"),
        stat(sats(d.sats), "sats gesammelt")),
      d.seit ? h("p", { class: "analyse-text" }, `Seit ${datumLang(d.seit, true)} hat dein Plan keine einzige Woche ausgelassen.`) : null);
  }

  function schwankungKarte() {
    const v = volatilitaet(z.tage?.punkte ?? []);
    if (!v) return karte("Schwankung", h("p", { class: "analyse-text" }, "Für eine belastbare Aussage braucht es mindestens zwei Wochen Tageskurse. Sie werden geladen, sobald eine Kursquelle erreichbar ist."));
    const typischEuro = z.summe.wert != null ? (z.summe.wert * v.tagProzent) / 100 : null;
    return karte("Schwankung",
      h("p", { class: "analyse-gross" }, `±${zahl(v.tagProzent, 1)} %`, h("span", { class: "analyse-gross-zusatz" }, " an einem typischen Tag")),
      h("p", { class: "analyse-text" },
        typischEuro != null ? `Bei deinem Depot sind das etwa ±${euro(typischEuro)} pro Tag. ` : "",
        `Aufs Jahr gerechnet entspricht das einer Volatilität von ${zahl(v.jahrProzent, 0)} %. Zum Vergleich: Breite Aktienfonds liegen meist um 15 %. `,
        "Wer jede Woche kauft, macht genau daraus etwas: In ruhigen wie in unruhigen Wochen fließt derselbe Betrag – mal gibt es mehr Bitcoin dafür, mal weniger."),
      h("p", { class: "fussnote" }, `Grundlage: ${anzahl(v.tage, "Tagesbewegung", "Tagesbewegungen")} seit deinem ersten Kauf.`));
  }

  function rueckgangKarte() {
    const punkte = [...(z.tage?.punkte ?? [])];
    const erster = z.kaeufe.find((k) => k.gezaehlt);
    if (!erster || punkte.length < 10) return null;
    if (z.aktuell?.kurs) punkte.push({ t: z.aktuell.zeit, c: z.aktuell.kurs });
    const ab = punkte.filter((p) => p.t >= erster.ts);
    const r = rueckgang(ab, z.kaeufe);
    if (!r) return null;
    if (r.tiefe === 0) return karte("Rückgang & Erholung", h("p", { class: "analyse-text" }, "Seit deinem ersten Kauf gab es keinen nennenswerten Rückgang."));
    const text = r.erholtTag
      ? `Vom ${datumMonatKurz(r.hochTag)} bis zum ${datumMonatKurz(r.tiefTag)} ging es um ${zahl(Math.abs(r.tiefe), 1)} % abwärts. Nach ${anzahl(r.wochenBisErholt, "Woche", "Wochen")} war der Höchststand wieder erreicht – am ${datumMonatKurz(r.erholtTag)}.`
      : `Vom ${datumMonatKurz(r.hochTag)} bis zum ${datumMonatKurz(r.tiefTag)} ging es um ${zahl(Math.abs(r.tiefe), 1)} % abwärts. Seit dem Tiefpunkt sind ${zahl(r.aufgeholtProzent, 0)} % davon wieder aufgeholt.`;
    return karte("Rückgang & Erholung",
      h("p", { class: "analyse-gross" }, r.erholtTag ? `${anzahl(r.wochenBisErholt, "Woche", "Wochen")}` : `${zahl(r.aufgeholtProzent, 0)} % aufgeholt`,
        h("span", { class: "analyse-gross-zusatz" }, r.erholtTag ? " bis zur Erholung" : "")),
      rueckgangGrafik(ab, r),
      h("p", { class: "analyse-text" }, text, r.kaeufeWaehrenddessen ? ` In dieser Zeit hast du ${anzahl(r.kaeufeWaehrenddessen, "Mal", "Mal")} weitergekauft.` : ""),
      h("p", { class: "fussnote" }, "Gemessen an der Wertentwicklung pro investiertem Euro – deine Einzahlungen verzerren das Bild also nicht."));
  }

  function rueckgangGrafik(p, r) {
    const B = 320; const H = 64;
    const t0 = p[0].t; const t1 = p[p.length - 1].t;
    const min = Math.min(...p.map((x) => x.c)); const max = Math.max(...p.map((x) => x.c));
    const x = (t) => ((t - t0) / (t1 - t0 || 1)) * B;
    const y = (c) => H - 4 - ((c - min) / (max - min || 1)) * (H - 8);
    const d = p.map((q, i) => `${i ? "L" : "M"}${x(q.t).toFixed(1)},${y(q.c).toFixed(1)}`).join("");
    const tHoch = p.find((q) => datumBerlin(q.t) >= r.hochTag)?.t ?? t0;
    const tEnde = r.erholtTag ? (p.find((q) => datumBerlin(q.t) >= r.erholtTag)?.t ?? t1) : t1;
    return svg("svg", { viewBox: `0 0 ${B} ${H}`, class: "rueckgang-grafik", preserveAspectRatio: "none", "aria-hidden": "true" },
      svg("rect", { x: x(tHoch), y: 0, width: Math.max(2, x(tEnde) - x(tHoch)), height: H, class: "rueckgang-band", rx: 4 }),
      svg("path", { d, class: "rueckgang-linie", "vector-effect": "non-scaling-stroke" }));
  }

  function rueckblickKarte() {
    const w = wochenRueckblick(wochenZerlegung(z.kaeufe, z.aktuell?.kurs, z.jetzt));
    if (!w) return null;
    const zeile = (titel, x) => h("div", { class: "rueckblick-zeile" },
      h("p", { class: "rueckblick-titel" }, titel, h("span", { class: "text-3" }, ` · Woche ab ${datumMonatKurz(x.montag)}`)),
      veraenderung(x.kurseffekt, x.prozent, { klein: true }));
    return karte("Wochen im Rückblick",
      zeile("Stärkste Woche", w.staerkste),
      zeile("Schwächste Woche", w.schwaechste),
      h("p", { class: "fussnote" }, `Kursbewegung deines Bestands innerhalb einer Woche, ohne deine Einzahlungen. Betrachtet: ${anzahl(w.anzahl, "abgeschlossene Woche", "abgeschlossene Wochen")}.`));
  }

  function haltefristKarte() {
    const hf = haltefrist(z.kaeufe, z.jetzt);
    if (!hf.tranchen.length) return null;
    const n = hf.naechste;
    return karte("Haltefrist",
      h("p", { class: "analyse-gross" }, `${zahl(hf.anteilFrei, 0)} %`, h("span", { class: "analyse-gross-zusatz" }, " deines Bestands über ein Jahr gehalten")),
      h("div", { class: "fortschritt" }, h("span", { class: "fortschritt-fuellung", style: { "--anteil": String(hf.anteilFrei / 100) } })),
      n ? h("p", { class: "analyse-text" }, `Der nächste Kauf (${datumMonatKurz(n.kaufdatum)}) erreicht die Jahresfrist am ${datum(n.freiAb)} – in ${anzahl(n.tageBis, "Tag", "Tagen")}.`) : h("p", { class: "analyse-text" }, "Alle deine Käufe sind länger als ein Jahr gehalten."),
      h("p", { class: "fussnote" }, "Nach § 23 EStG sind Gewinne aus dem Verkauf privat gehaltener Kryptowerte nach mehr als einem Jahr Haltedauer steuerfrei. Dies ist eine reine Datumsrechnung je Kauf und keine Steuerberatung."));
  }

  function kostenbasisKarte() {
    const kaeufe = z.kaeufe.filter((k) => k.gezaehlt).reverse();
    if (!kaeufe.length) return null;
    const hf = new Map(haltefrist(z.kaeufe, z.jetzt).tranchen.map((t) => [t.montag, t]));
    const kurs = z.aktuell?.kurs;
    let offen = false;
    const liste = h("div", { class: "tranchen" });
    const mehr = h("button", { type: "button", class: "knopf knopf--leise knopf--breit", onclick: () => { offen = !offen; zeichnen(); } });
    function zeichnen() {
      const sichtbar = offen ? kaeufe : kaeufe.slice(0, 5);
      fuelle(liste, sichtbar.map((k) => {
        const t = hf.get(k.montag);
        const gebuehr = k.brutto - k.btc * k.kurs;
        return h("div", { class: "tranche" },
          h("div", { class: "tranche-oben" },
            h("span", { class: "tranche-datum" }, datum(k.kaufdatum)),
            h("span", { class: "tranche-wert" }, kurs ? euro(k.btc * kurs) : "–")),
          h("div", { class: "tranche-unten" },
            h("span", null, `${btcFmt(k.btc)} BTC zu ${euro(k.kurs, 0)}`),
            h("span", null, kurs ? prozent((kurs / k.kurs - 1) * 100, 1) : "")),
          h("div", { class: "tranche-unten" },
            h("span", null, `Gebühr ${euro(Math.max(0, gebuehr))}${k.status === "geschaetzt" ? " · geschätzt" : ""}`),
            h("span", null, t?.frei ? "steuerfrei" : `steuerfrei ab ${datum(t.freiAb)}`)));
      }));
      mehr.textContent = offen ? "Weniger anzeigen" : `Alle ${kaeufe.length} Käufe anzeigen`;
      mehr.hidden = kaeufe.length <= 5;
    }
    zeichnen();
    return karte("Kostenbasis je Kauf", h("p", { class: "analyse-text" }, "Jeder Kauf mit Kurs, Menge, Gebühr und seinem heutigen Wert."), liste, mehr);
  }

  return {
    el,
    aktualisiere({ ersteMal = false } = {}) {
      if (ersteMal) ladeUndZeige(true); else kursKopf();
      if (!z.summe.anzahl) {
        fuelle(rest, leer({ titel: "Die Analyse wartet auf den ersten Kauf", text: "Sobald es Käufe gibt, siehst du hier Schwankung, Erholung, Haltefristen und mehr.", symbol: "analyse" }));
        return;
      }
      fuelle(rest, durchhaltenKarte(), rueckgangKarte(), schwankungKarte(), rueckblickKarte(), haltefristKarte(), kostenbasisKarte());
    },
    neuZeichnen() { ladeUndZeige(false); },
  };
}

