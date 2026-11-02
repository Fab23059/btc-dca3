// =====================================================================
// analyse.js – Dein Weg in Zahlen, mit selbst gezeichneten Bildern:
//   * Kursverlauf mit deinen Käufen
//   * Durchhalten als vier Ringe
//   * Schwankung: jeder Tag ein Punkt, der in seine Spalte fällt
//   * Tauchgang: der größte Rückgang und der Weg zurück an die Oberfläche
//   * Wochenmosaik: jede Woche eine Kachel
//   * Reifegrad: wie weit jeder Kauf auf dem Weg zur Jahresfrist ist
//   * Kostenbasis je Kauf
// Alles beschreibend – nichts bewertet vergangene Entscheidungen.
// =====================================================================

import { h, svg, fuelle, wenigBewegung } from "../dom.js";
import { Zaehlwerk } from "../ui/zaehlwerk.js";
import { segment } from "../ui/segment.js";
import { beimSichtbarWerden, fokus } from "../ui/federwerk.js";
import { tick } from "../ui/haptik.js";
import { kursDiagramm, diagrammeVerfuegbar } from "../diagramme.js";
import { REIHEN } from "../kurse.js";
import { wochenZerlegung, kursBei } from "../rechnen.js";
import { volatilitaet, rueckgang, wochenRueckblick, haltefrist, durchhalten, meilensteine, WOCHEN_ZIELE } from "../kennzahlen.js";
import { euro, prozent, zahl, ganz, datum, datumMonatKurz, datumLang, uhrzeit, anzahl, btc as btcFmt } from "../format.js";
import { datumBerlin, heuteBerlin, tageZwischen } from "../zeit.js";
import { SPARRATE_EUR } from "../konfig.js";
import { euroDarstellung, veraenderung, leer, skelett } from "./gemeinsam.js";

const karte = (titel, ...inhalt) => h("section", { class: "karte karte--glanz analyse-karte" }, h("h2", { class: "label" }, titel), ...inhalt);

/** Führt fn aus, sobald el ins Bild kommt (einmalig). */
function sobaldSichtbar(el, fn, schwelle = 0.35) {
  if (wenigBewegung()) { fn(); return; }
  const b = new IntersectionObserver((ee) => { if (ee.some((e) => e.isIntersecting)) { b.disconnect(); fn(); } }, { threshold: schwelle });
  b.observe(el);
}

export function erstelleAnalyse(app) {
  const z = app.zustand;
  let bereich = "monat";
  let scrubbt = false;
  let ersteDarstellung = true;   // Einlauf-Animationen nur, bis die Seite einmal gesehen wurde
  let besucht = false;

  // ---- Kursverlauf ----
  const kursLabel = h("p", { class: "label" }, "Bitcoin");
  const kursZahlEl = h("p", { class: "zahl-mittel" });
  const kursZahl = new Zaehlwerk(kursZahlEl, euroDarstellung(false, 0), { einrollen: true });
  const kursZeile = h("div", { class: "held-zeile" });
  const canvas = h("canvas", { class: "diagramm-canvas", role: "img", "aria-label": "Bitcoin-Kursverlauf mit deinen Käufen" });
  const kapsel = h("span", { class: "scrub-kapsel", "aria-hidden": "true" });
  const flaeche = h("div", { class: "diagramm-flaeche diagramm-flaeche--klein" }, canvas, kapsel);
  const bereichWahl = segment({
    name: "Zeitraum Kursverlauf", klein: true, aktiv: bereich,
    optionen: Object.entries(REIHEN).map(([wert, d]) => ({ wert, text: d.titel })),
    beiWahl: (w) => { bereich = w; ladeUndZeige(true); },
  });
  let reiheAnfang = null;
  const diagramm = diagrammeVerfuegbar() ? kursDiagramm(canvas, (p, pos) => {
    scrubbt = p != null;
    kursZahl.eilig = scrubbt;
    if (!p) { kapsel.classList.remove("ist-sichtbar"); kursKopf(); return; }
    kursZahl.setze(p.c);
    kursLabel.textContent = p.kauf ? `Dein Kauf Nr. ${p.kauf.nr}` : "Bitcoin";
    fuelle(kursZeile, reiheAnfang ? veraenderung(null, (p.c / reiheAnfang - 1) * 100, { klein: true }) : null,
      h("span", { class: "held-zeitraum" }, p.kauf ? `${btcFmt(p.kauf.btc)} BTC` : "seit Beginn des Zeitraums"));
    if (pos) {
      kapsel.textContent = bereich === "tag" || bereich === "woche" ? `${datumMonatKurz(datumBerlin(p.t))} · ${uhrzeit(p.t)}` : datumLang(datumBerlin(p.t), bereich !== "monat");
      const breite = kapsel.offsetWidth || 90;
      kapsel.style.setProperty("left", `${Math.max(breite / 2 + 4, Math.min(flaeche.clientWidth - breite / 2 - 4, pos.x))}px`);
      kapsel.classList.toggle("ist-kauf", Boolean(p.kauf));
      kapsel.classList.add("ist-sichtbar");
    }
  }) : null;

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
      fuelle(kursZeile, veraenderung(null, (e / a - 1) * 100), h("span", { class: "held-zeitraum" }, `im Zeitraum ${REIHEN[bereich].titel}${r?.veraltet ? " · Stand " + uhrzeit(r.zeit) : ""}`));
    } else fuelle(kursZeile, skelett("8em"));
  }

  async function ladeUndZeige(einzeichnen) {
    kursKopf();
    try { await app.ladeReihe(bereich); } catch { /* unten behandelt */ }
    flaeche.querySelector(".leer")?.remove();
    const punkte = zeitraumPunkte();
    if (!punkte.length) {
      flaeche.append(leer({ titel: "Kursverlauf gerade nicht abrufbar", text: "Keine Kursquelle hat geantwortet. Zieh die Seite nach unten, um es erneut zu versuchen.", symbol: "offline" }));
      return;
    }
    diagramm?.zeige(punkte, { kaeufe: z.kaeufe, mitUhrzeit: bereich === "tag", einzeichnen });
    kursKopf();
  }

  const kursKarte = h("section", { class: "karte karte--glanz analyse-karte analyse-karte--diagramm" },
    h("div", { class: "kurs-kopf" }, kursLabel, kursZahlEl, kursZeile),
    flaeche,
    h("div", { class: "kurs-fuss" }, bereichWahl.el),
    h("p", { class: "legende-text" }, h("span", { class: "marke marke--voll" }), "eingetragener Kauf", h("span", { class: "marke" }), "geschätzter Kauf"));

  const rest = h("div", { class: "analyse-rest" });
  const el = h("div", { class: "seite-inhalt" },
    h("header", { class: "seiten-kopf" }, h("p", { class: "seiten-titel serif" }, "Dein Weg in Zahlen"), h("p", { class: "seiten-unter" }, "Was dein Plan bisher geleistet hat – nachgerechnet, nicht bewertet.")),
    kursKarte, rest);

  // -------------------------------------------------------------------
  // Durchhalten: vier Ringe
  // -------------------------------------------------------------------
  function ringe() {
    const d = durchhalten(z.kaeufe, z.jetzt);
    const m = meilensteine(z.kaeufe, z.aktuell?.kurs, SPARRATE_EUR);
    const s = z.summe;
    const naechsteWoche = WOCHEN_ZIELE.find((w) => w > d.wochenInFolge) ?? d.wochenInFolge;
    const daten = [
      { wert: d.wochenInFolge, anteil: d.wochenInFolge / naechsteWoche, label: d.wochenInFolge === 1 ? "Woche in Folge" : "Wochen in Folge", unter: `Ziel ${naechsteWoche}` },
      { wert: s.eingetragen, anteil: s.anzahl ? s.eingetragen / s.anzahl : 0, label: "eingetragen", unter: `von ${s.anzahl} Käufen` },
      { wert: d.tage, anteil: Math.min(1, d.tage / 365), label: "Tage dabei", unter: d.tage >= 365 ? "über ein Jahr" : `noch ${365 - d.tage} bis 1 Jahr` },
      { wert: Math.round(d.sats / 1000), anteil: m.naechstes ? m.naechstes.fortschritt : 1, label: "Tausend sats", unter: m.naechstes ? `nächstes Ziel ${ganz(m.naechstes.ziel / 1000)}k` : "alle Ziele" },
    ];
    const raster = h("div", { class: "ring-raster" }, daten.map((x, i) => {
      const bogen = svg("circle", { cx: 50, cy: 50, r: 42, class: "ring-bogen", pathLength: 100 });
      const zahlEl = h("span", { class: "ring-zahl" });
      const werk = new Zaehlwerk(zahlEl, (n) => [["ganz", n == null ? "–" : ganz(n)]], { einrollen: true });
      const elR = h("div", { class: "ring" },
        h("div", { class: "ring-grafik" },
          svg("svg", { viewBox: "0 0 100 100", "aria-hidden": "true" }, svg("circle", { cx: 50, cy: 50, r: 42, class: "ring-spur" }), bogen),
          zahlEl),
        h("p", { class: "ring-label" }, x.label), h("p", { class: "ring-unter" }, x.unter));
      const los = () => {
        werk.setze(x.wert);
        bogen.style.setProperty("transition-delay", `${i * 90}ms`);
        bogen.style.setProperty("stroke-dashoffset", String(100 - Math.max(0, Math.min(1, x.anteil)) * 100));
      };
      if (ersteDarstellung) sobaldSichtbar(elR, () => requestAnimationFrame(los));
      else { werk.setze(x.wert, { sofort: true }); bogen.style.setProperty("transition", "none"); los(); }
      return elR;
    }));
    return karte("Durchhalten", raster,
      d.seit ? h("p", { class: "analyse-text" }, `Seit ${datumLang(d.seit, true)} hat dein Plan keine einzige Woche ausgelassen.`) : null);
  }

  // -------------------------------------------------------------------
  // Schwankung: jeder Tag ein Punkt, der in seine Spalte fällt
  // -------------------------------------------------------------------
  function schwankung() {
    const tage = z.tage?.punkte ?? [];
    const erster = z.kaeufe.find((k) => k.gezaehlt);
    const ab = erster ? tage.filter((p) => p.t >= erster.ts - 86_400_000) : [];
    const v = volatilitaet(ab);
    if (!v) return karte("Schwankung", h("p", { class: "analyse-text" }, "Für eine belastbare Aussage braucht es mindestens zwei Wochen Tageskurse. Sie werden geladen, sobald eine Kursquelle erreichbar ist."));
    const bew = [];
    for (let i = 1; i < ab.length; i++) bew.push((ab[i].c / ab[i - 1].c - 1) * 100);
    const grenze = Math.max(4, Math.ceil(Math.max(...bew.map(Math.abs)) * 2) / 2);
    const breite = 0.5;
    const spalten = Math.round((grenze * 2) / breite);
    const zaehler = new Array(spalten).fill(0);
    const pos = bew.map((b) => {
      const s = Math.max(0, Math.min(spalten - 1, Math.floor((b + grenze) / breite)));
      return { s, h: zaehler[s]++, b };
    });
    const hoechste = Math.max(...zaehler);
    const W = 320; const H = 150; const sp = W / spalten;
    const r = Math.max(1.3, Math.min(sp * 0.42, (H - 20) / (hoechste * 2.1)));
    const sigma = v.tagProzent;
    const x = (pr) => ((pr + grenze) / (grenze * 2)) * W;
    const innen = bew.filter((b) => Math.abs(b) <= sigma).length;
    const punkte = pos.map((p) => svg("circle", { cx: (p.s + 0.5) * sp, cy: H - 16 - r - p.h * r * 2.1, r, class: Math.abs(p.b) <= sigma ? "tag-punkt" : "tag-punkt tag-punkt--aussen" }));
    const grafik = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "verteilung", "aria-hidden": "true" },
      svg("rect", { x: x(-sigma), y: 0, width: x(sigma) - x(-sigma), height: H - 14, rx: 6, class: "verteilung-band" }),
      svg("line", { x1: x(0), x2: x(0), y1: 4, y2: H - 14, class: "verteilung-null" }),
      ...punkte,
      svg("text", { x: x(-sigma), y: H - 2, class: "verteilung-text", "text-anchor": "middle" }, `−${zahl(sigma, 1)} %`),
      svg("text", { x: x(0), y: H - 2, class: "verteilung-text", "text-anchor": "middle" }, "0"),
      svg("text", { x: x(sigma), y: H - 2, class: "verteilung-text", "text-anchor": "middle" }, `+${zahl(sigma, 1)} %`));
    if (ersteDarstellung && !wenigBewegung()) {
      punkte.forEach((p) => p.style.setProperty("opacity", "0"));
      sobaldSichtbar(grafik, () => {
        punkte.forEach((p, i) => {
          const verz = i * Math.min(16, 1400 / punkte.length);
          p.animate([{ opacity: 0, transform: "translateY(-90px)" }, { opacity: 1, transform: "translateY(0)", offset: 0.7 }, { opacity: 1, transform: "translateY(-3px)", offset: 0.85 }, { opacity: 1, transform: "none" }],
            { duration: 620, delay: verz, easing: "cubic-bezier(0.5, 0, 0.75, 0)", fill: "forwards" });
          if (i % 10 === 0) setTimeout(() => tick(2), verz + 430);
        });
      });
    }
    const typischEuro = z.summe.wert != null ? (z.summe.wert * v.tagProzent) / 100 : null;
    return karte("Schwankung",
      h("p", { class: "analyse-gross" }, `±${zahl(v.tagProzent, 1)} %`, h("span", { class: "analyse-gross-zusatz" }, " an einem typischen Tag")),
      grafik,
      h("p", { class: "analyse-text" },
        `Jeder Punkt ist ein Tag seit deinem ersten Kauf. An ${innen} von ${bew.length} Tagen blieb die Bewegung innerhalb von ±${zahl(sigma, 1)} %`,
        typischEuro != null ? ` – bei deinem Depot etwa ±${euro(typischEuro)}.` : ".",
        ` Aufs Jahr gerechnet entspricht das einer Volatilität von ${zahl(v.jahrProzent, 0)} % (breite Aktienfonds: meist um 15 %).`),
      h("p", { class: "fussnote" }, "Wer jede Woche kauft, macht genau daraus etwas: In ruhigen wie in unruhigen Wochen fließt derselbe Betrag."));
  }

  // -------------------------------------------------------------------
  // Tauchgang: Rückgang und Erholung
  // -------------------------------------------------------------------
  function tauchgang() {
    const punkte = [...(z.tage?.punkte ?? [])];
    const erster = z.kaeufe.find((k) => k.gezaehlt);
    if (!erster || punkte.length < 10) return null;
    if (z.aktuell?.kurs) punkte.push({ t: z.aktuell.zeit, c: z.aktuell.kurs });
    const ab = punkte.filter((p) => p.t >= erster.ts);
    const r = rueckgang(ab, z.kaeufe);
    if (!r) return null;
    if (r.tiefe === 0) return karte("Rückgang & Erholung", h("p", { class: "analyse-text" }, "Seit deinem ersten Kauf gab es keinen nennenswerten Rückgang."));
    // Unterwasser-Kurve: Abstand zum bisherigen Höchststand
    let hoch = 0;
    const dd = ab.map((p) => { hoch = Math.max(hoch, p.c); return { t: p.t, d: p.c / hoch - 1 }; });
    const tiefste = Math.min(...dd.map((p) => p.d)) || -0.01;
    const W = 320; const H = 120; const oben = 18;
    const x = (t) => ((t - dd[0].t) / (dd[dd.length - 1].t - dd[0].t || 1)) * W;
    const y = (d) => oben + (d / tiefste) * (H - oben - 10);
    const linie = dd.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.d).toFixed(1)}`).join("");
    const flaecheD = `${linie}L${W},${oben}L0,${oben}Z`;
    const taucher = svg("circle", { r: 4.5, class: "taucher", cx: 0, cy: oben });
    const grafik = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "tauchgang", "aria-hidden": "true" },
      svg("defs", null, svg("linearGradient", { id: "tauch-verlauf", x1: 0, x2: 0, y1: 0, y2: 1 },
        svg("stop", { offset: "0", style: { "stop-color": "rgba(120, 150, 210, 0.05)" } }), svg("stop", { offset: "1", style: { "stop-color": "rgba(120, 150, 210, 0.32)" } }))),
      svg("line", { x1: 0, x2: W, y1: oben, y2: oben, class: "wasserlinie" }),
      svg("text", { x: 4, y: oben - 6, class: "verteilung-text" }, "Höchststand"),
      svg("path", { d: flaecheD, class: "tauch-flaeche" }),
      svg("path", { d: linie, class: "tauch-linie", pathLength: 1 }),
      taucher);
    // Der Taucher folgt der Kurve: hinab zum Tiefpunkt und zurück nach oben
    const reise = () => {
      const t0 = performance.now(); const dauer = 2600;
      const bild = (t) => {
        const k = Math.min(1, (t - t0) / dauer);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const i = Math.min(dd.length - 1, Math.round(e * (dd.length - 1)));
        taucher.setAttribute("cx", x(dd[i].t).toFixed(1)); taucher.setAttribute("cy", y(dd[i].d).toFixed(1));
        if (k < 1) requestAnimationFrame(bild); else tick(8);
      };
      requestAnimationFrame(bild);
    };
    if (ersteDarstellung && !wenigBewegung()) sobaldSichtbar(grafik, reise, 0.5);
    else { const l = dd[dd.length - 1]; taucher.setAttribute("cx", x(l.t)); taucher.setAttribute("cy", y(l.d)); }
    const text = r.erholtTag
      ? `Vom ${datumMonatKurz(r.hochTag)} bis zum ${datumMonatKurz(r.tiefTag)} ging es um ${zahl(Math.abs(r.tiefe), 1)} % abwärts. Nach ${anzahl(r.wochenBisErholt, "Woche", "Wochen")} war der Höchststand wieder erreicht – am ${datumMonatKurz(r.erholtTag)}.`
      : `Vom ${datumMonatKurz(r.hochTag)} bis zum ${datumMonatKurz(r.tiefTag)} ging es um ${zahl(Math.abs(r.tiefe), 1)} % abwärts. Seit dem Tiefpunkt sind ${zahl(r.aufgeholtProzent, 0)} % davon wieder aufgeholt.`;
    return karte("Rückgang & Erholung",
      h("p", { class: "analyse-gross" }, r.erholtTag ? `${anzahl(r.wochenBisErholt, "Woche", "Wochen")}` : `${zahl(r.aufgeholtProzent, 0)} % aufgeholt`,
        h("span", { class: "analyse-gross-zusatz" }, r.erholtTag ? " bis zurück an die Oberfläche" : "")),
      grafik,
      h("p", { class: "analyse-text" }, text, r.kaeufeWaehrenddessen ? ` In dieser Zeit hast du ${anzahl(r.kaeufeWaehrenddessen, "Mal", "Mal")} weitergekauft.` : ""),
      h("p", { class: "fussnote" }, "Gemessen an der Wertentwicklung pro investiertem Euro – deine Einzahlungen verzerren das Bild also nicht."));
  }

  // -------------------------------------------------------------------
  // Wochenmosaik
  // -------------------------------------------------------------------
  function mosaik() {
    const zer = wochenZerlegung(z.kaeufe, z.aktuell?.kurs, z.jetzt);
    if (zer.length < 2) return null;
    const groesst = Math.max(...zer.map((w) => Math.abs(w.prozent ?? 0)), 1);
    const info = h("p", { class: "mosaik-info" }, "Tippe eine Woche an.");
    const kacheln = zer.map((w, i) => {
      const staerke = Math.min(1, Math.abs(w.prozent ?? 0) / groesst);
      const plus = (w.kurseffekt ?? 0) >= 0;
      const k = h("button", {
        type: "button", class: ["mosaik-kachel", plus ? "ist-plus" : "ist-minus", w.laufend && "ist-laufend"],
        style: { "--staerke": staerke.toFixed(2), "--i": String(i) },
        "aria-label": `Woche ab ${datumMonatKurz(w.montag)}: Kursbewegung ${prozent(w.prozent)}`,
        onclick: () => {
          kacheln.forEach((x2) => x2.classList.remove("ist-gewaehlt"));
          k.classList.add("ist-gewaehlt"); tick(5);
          fuelle(info, h("strong", null, `Woche ab ${datumMonatKurz(w.montag)}${w.laufend ? " (läuft)" : ""}`), `Einzahlung ${euro(w.einzahlung)} · Kursbewegung `, veraenderung(w.kurseffekt, w.prozent, { klein: true }));
        },
      }, h("span", { class: "mosaik-einzahlung", "aria-hidden": "true" }));
      return k;
    });
    const raster = h("div", { class: ["mosaik", ersteDarstellung && !wenigBewegung() && "mosaik--wartet"] }, kacheln);
    if (ersteDarstellung) sobaldSichtbar(raster, () => raster.classList.remove("mosaik--wartet"));
    const rb = wochenRueckblick(zer);
    return karte("Wochenmosaik",
      h("p", { class: "analyse-text" }, "Jede Kachel eine Woche. Der helle Punkt ist deine Einzahlung – immer gleich. Die Farbe zeigt, wohin der Kurs in dieser Woche lief, die Stärke wie weit."),
      raster, info,
      rb ? h("div", { class: "rueckblick" },
        h("div", { class: "rueckblick-zeile" }, h("p", { class: "rueckblick-titel" }, "Stärkste Woche", h("span", { class: "text-3" }, ` · ab ${datumMonatKurz(rb.staerkste.montag)}`)), veraenderung(rb.staerkste.kurseffekt, rb.staerkste.prozent, { klein: true })),
        h("div", { class: "rueckblick-zeile" }, h("p", { class: "rueckblick-titel" }, "Schwächste Woche", h("span", { class: "text-3" }, ` · ab ${datumMonatKurz(rb.schwaechste.montag)}`)), veraenderung(rb.schwaechste.kurseffekt, rb.schwaechste.prozent, { klein: true }))) : null);
  }

  // -------------------------------------------------------------------
  // Reifegrad (Haltefrist)
  // -------------------------------------------------------------------
  function reifegrad() {
    const hf = haltefrist(z.kaeufe, z.jetzt);
    if (!hf.tranchen.length) return null;
    const heute = heuteBerlin(z.jetzt);
    const saeulen = hf.tranchen.map((t, i) => {
      const gehalten = Math.max(0, tageZwischen(t.kaufdatum, heute));
      const anteil = Math.min(1, gehalten / 366);
      return h("span", { class: ["reife-saeule", t.frei && "ist-reif"], style: { "--anteil": anteil.toFixed(3), "--i": String(i) }, title: `${datum(t.kaufdatum)}: ${gehalten} Tage` });
    });
    const skyline = h("div", { class: ["reife", ersteDarstellung && !wenigBewegung() && "reife--wartet"] },
      h("span", { class: "reife-linie", "aria-hidden": "true" }, h("span", null, "1 Jahr")), saeulen);
    if (ersteDarstellung) sobaldSichtbar(skyline, () => skyline.classList.remove("reife--wartet"));
    const n = hf.naechste;
    const tageEl = h("span", { class: "zahl-mittel" });
    const tageWerk = new Zaehlwerk(tageEl, (x) => [["ganz", x == null ? "–" : ganz(x)], ["einheit", x === 1 ? " Tag" : " Tage"]], { einrollen: true });
    if (n) { if (ersteDarstellung) sobaldSichtbar(tageEl, () => tageWerk.setze(n.tageBis)); else tageWerk.setze(n.tageBis, { sofort: true }); }
    return karte("Reifegrad · Haltefrist",
      n ? h("div", { class: "reife-kopf" }, tageEl, h("p", { class: "text-2" }, `bis der erste noch offene Kauf (${datumMonatKurz(n.kaufdatum)}) die Jahresfrist erreicht – am ${datum(n.freiAb)}.`))
        : h("p", { class: "analyse-gross" }, "Alles gereift", h("span", { class: "analyse-gross-zusatz" }, " – jeder Kauf über ein Jahr gehalten")),
      skyline,
      h("p", { class: "analyse-text" }, `Jede Säule ein Kauf, ihre Höhe die Haltedauer. Erreicht sie die Linie, wird sie golden. Bisher über ein Jahr gehalten: ${zahl(hf.anteilFrei, 0)} % deines Bestands.`),
      h("p", { class: "fussnote" }, "Nach § 23 EStG sind Gewinne aus dem Verkauf privat gehaltener Kryptowerte nach mehr als einem Jahr Haltedauer steuerfrei. Dies ist eine reine Datumsrechnung je Kauf und keine Steuerberatung."));
  }

  // -------------------------------------------------------------------
  // Kostenbasis je Kauf
  // -------------------------------------------------------------------
  function kostenbasis() {
    const kaeufe = z.kaeufe.filter((k) => k.gezaehlt).reverse();
    if (!kaeufe.length) return null;
    const hf = new Map(haltefrist(z.kaeufe, z.jetzt).tranchen.map((t) => [t.montag, t]));
    const kurs = z.aktuell?.kurs;
    let offen = false;
    const liste = h("div", { class: "tranchen" });
    const mehr = h("button", { type: "button", class: "knopf knopf--leise knopf--breit impuls", onclick: () => { offen = !offen; zeichnen(true); } });
    function zeichnen(animiert = false) {
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
            h("span", { class: t?.frei ? "ist-reif-text" : "" }, t?.frei ? "steuerfrei" : `steuerfrei ab ${datum(t.freiAb)}`)));
      }));
      if (animiert && offen) fokus([...liste.children].slice(5), { abstand: 24, hub: 8 });
      mehr.textContent = offen ? "Weniger anzeigen" : `Alle ${kaeufe.length} Käufe anzeigen`;
      mehr.hidden = kaeufe.length <= 5;
    }
    zeichnen();
    return karte("Kostenbasis je Kauf", h("p", { class: "analyse-text" }, "Jeder Kauf mit Kurs, Menge, Gebühr und seinem heutigen Wert."), liste, mehr);
  }

  let restSig = "";
  return {
    el,
    aktualisiere({ ersteMal = false } = {}) {
      if (ersteMal) ladeUndZeige(true); else kursKopf();
      if (!z.summe.anzahl) {
        fuelle(rest, leer({ titel: "Die Analyse wartet auf den ersten Kauf", text: "Sobald es Käufe gibt, siehst du hier Schwankung, Erholung, Haltefristen und mehr.", symbol: "analyse" }));
        return;
      }
      // Nur neu aufbauen, wenn sich die Grundlage geändert hat (sonst flackern die Bilder)
      const sig = [z.summe.anzahl, z.summe.btc.toFixed(8), z.tage?.punkte?.length, Math.round((z.aktuell?.kurs ?? 0) / 50)].join("|");
      if (sig === restSig) return;
      restSig = sig;
      const karten = [ringe(), schwankung(), tauchgang(), mosaik(), reifegrad(), kostenbasis()].filter(Boolean);
      fuelle(rest, karten);
      if (ersteDarstellung) beimSichtbarWerden(karten);
      if (besucht) ersteDarstellung = false;
    },
    neuZeichnen() { ladeUndZeige(false); },
    betreten() { besucht = true; fokus([el.querySelector(".seiten-kopf"), kursKarte], { abstand: 80 }); },
  };
}
