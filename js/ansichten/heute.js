// =====================================================================
// heute.js – Die Startseite. Oben der Wert, darunter die Linie (das
// Bedienelement der Zeitreise), darunter die Fenster als Kacheln.
//
// Alles hier ist auf Bewegung gebaut:
//   * Die große Zahl ist ein Zählwerk.
//   * Die Linie fließt beim Zeitraumwechsel, der Punkt darunter federt mit.
//   * Fährt der Finger über die Linie, reist die ganze Seite in die Zeit.
//   * Ziehen nach unten aktualisiert (Gummiband + 52 Striche, einer pro Woche).
// =====================================================================

import { h, svg, fuelle, wenigBewegung } from "../dom.js";
import { Ziffern } from "../bewegung/ziffern.js";
import { Feder, gummi, klemme } from "../bewegung/feder.js";
import { linie } from "../teile/linie.js";
import { kachel } from "../teile/fenster.js";
import { tick } from "../teile/haptik.js";
import { ZEITRAEUME, zeitraumDaten } from "../zeitraeume.js";
import { wertverlauf, zeitraumErgebnis, naechsterKauf } from "../rechnen.js";
import { ZEITPLAN } from "../konfig.js";
import { euro, datumLang, datumMonatKurz, uhrzeit, wochentagKurz } from "../format.js";
import { datumBerlin } from "../zeit.js";
import { euroTeile, veraenderung, skelett } from "./gemeinsam.js";
import { kaeufeKopf } from "./kaeufe.js";
import { baumKopf } from "./baum.js";
import { zahlenKopf } from "./zahlen.js";

const TAG = 86_400_000;

export function erstelleHeute(app) {
  const z = app.zustand;
  let zeitraum = "gesamt";
  let reist = false;
  let ersteDaten = true;
  let signatur = "";

  // ---- Wert ----
  const label = h("p", { class: "held-label" }, "Depotwert");
  const zahlEl = h("span", { class: "held-zahl" });
  const zahl = new Ziffern(zahlEl, { teile: euroTeile(), beiEnergie: (e) => app.licht(e), beschreibung: (t) => `Depotwert ${t}` });
  const zeile = h("p", { class: "held-zeile" });
  const held = h("button", { type: "button", class: "held tippbar", "aria-label": "So entsteht der Depotwert", onclick: () => !reist && app.oeffneRechenweg("wert", held, zeitraum) },
    label, zahlEl, zeile);

  // ---- Linie ----
  const linieEl = h("div", { class: "linie", "data-eigene-geste": "" });
  const lin = linie(linieEl, { beimScrubben: (info) => zeitreise(info) });

  // ---- Zeitraum: vier Wörter, ein Punkt, der federnd hinüberspringt ----
  const marke = h("span", { class: "zeitraum-marke", "aria-hidden": "true" });
  const knoepfe = Object.entries(ZEITRAEUME).map(([wert, d]) => h("button", {
    type: "button", class: "zeitraum-wahl", "aria-pressed": String(wert === zeitraum), "data-wert": wert,
    onclick: () => waehle(wert),
  }, d.text));
  const zeitraumEl = h("div", { class: "zeitraum", role: "group", "aria-label": "Zeitraum" }, ...knoepfe, marke);
  const markeFeder = new Feder(0, { art: "zeiger", genau: 0.2, beiWert: (x, v) => {
    marke.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0) scaleX(${(1 + Math.min(2.2, Math.abs(v) / 900)).toFixed(3)})`;
  } });
  const markeZiel = () => {
    const k = knoepfe.find((b) => b.dataset.wert === zeitraum);
    return k ? k.offsetLeft + k.offsetWidth / 2 - 3 : 0;
  };
  new ResizeObserver(() => markeFeder.springe(markeZiel())).observe(zeitraumEl);

  function waehle(wert) {
    if (wert === zeitraum) return;
    zeitraum = wert;
    tick(6);
    for (const b of knoepfe) b.setAttribute("aria-pressed", String(b.dataset.wert === wert));
    markeFeder.zu(markeZiel());
    zeigeKopf();
    zeichneLinie({ fliessen: true });
  }

  // ---- Takt bis zum nächsten Kauf ----
  const taktText = h("span", { class: "takt-text" });
  const taktZeit = h("span", { class: "takt-zeit zahl" });
  const taktFuellung = h("span", { class: "takt-fuellung" });
  const takt = h("div", { class: "takt" },
    h("div", { class: "takt-zeile" }, taktText, taktZeit),
    h("div", { class: "takt-balken", "aria-hidden": "true" }, taktFuellung));
  function zeigeTakt() {
    const nk = naechsterKauf(ZEITPLAN, Date.now());
    if (!nk) { takt.hidden = true; return; }
    const rest = Math.max(0, nk.ts - Date.now());
    const tage = Math.floor(rest / TAG); const std = Math.floor((rest % TAG) / 3_600_000); const min = Math.floor((rest % 3_600_000) / 60_000);
    taktText.textContent = `Nächster Kauf · ${wochentagKurz(nk.montag)}, ${datumMonatKurz(nk.montag)} · ${uhrzeit(nk.ts)}`;
    taktZeit.textContent = tage ? `in ${tage} T ${std} Std` : std ? `in ${std} Std ${min} Min` : `in ${min} Min`;
    taktFuellung.style.transform = `scaleX(${klemme(1 - rest / (7 * TAG)).toFixed(4)})`;
  }
  setInterval(zeigeTakt, 20_000);

  // ---- Fenster als Kacheln ----
  const koepfe = { kaeufe: kaeufeKopf(app), baum: baumKopf(app), zahlen: zahlenKopf(app) };
  const kacheln = {
    kaeufe: kachel({ kopf: koepfe.kaeufe.el, label: "Käufe öffnen", beiTipp: (el) => app.oeffneKaeufe(el) }),
    baum: kachel({ kopf: koepfe.baum.el, label: "Deinen Baum öffnen", beiTipp: (el) => app.oeffneBaum(el) }),
    zahlen: kachel({ kopf: koepfe.zahlen.el, label: "Zahlen öffnen", beiTipp: (el) => app.oeffneZahlen(el) }),
  };
  for (const k of Object.values(koepfe)) app.koepfe.add(k);
  const stapel = h("div", { class: "stapel" }, ...Object.values(kacheln).map((k) => k.el));

  const fuss = h("p", { class: "fuss" });

  // ---- Ziehen zum Aktualisieren ----
  const ring = ringZeichen();
  const ringHalter = h("div", { class: "auffrischen", "aria-hidden": "true" }, ring.el);

  const inhalt = h("div", { class: "heute-stapel" }, held, linieEl, zeitraumEl, takt, stapel, fuss);
  const el = h("div", null, ringHalter, inhalt);

  // -------------------------------------------------------------------

  function zeigeKopf() {
    if (reist) return;
    const s = z.summe;
    label.textContent = "Depotwert";
    zahl.eilig = false;
    if (!s.anzahl) { zahl.setze(null); fuelle(zeile, h("span", { class: "text-3" }, "Noch kein Kauf")); return; }
    if (s.wert == null) { zahl.setze(null); fuelle(zeile, skelett("11em")); return; }
    zahl.setze(s.wert, { einrollen: ersteDaten });
    const d = zeitraumDaten(z, zeitraum);
    const r = zeitraum === "gesamt"
      ? { veraenderung: s.gv, prozent: s.gvProzent }
      : zeitraumErgebnis({ kaeufe: z.kaeufe, aktuellerKurs: z.aktuell?.kurs, jetzt: z.jetzt, startTs: d.startTs, kursZuBeginn: d.kursZuBeginn });
    fuelle(zeile,
      r ? veraenderung(r.veraenderung, r.prozent) : h("span", { class: "text-3" }, "Kurs zu Beginn wird geladen"),
      h("span", { class: "held-zeitraum" }, ZEITRAEUME[zeitraum].satz));
  }

  function zeichneLinie({ fliessen = true, aufziehen = false } = {}) {
    const s = z.summe;
    if (!s.anzahl) { lin.zeige(null); return; }
    const d = zeitraumDaten(z, zeitraum);
    const punkte = wertverlauf({ kaeufe: z.kaeufe, kurse: d.kurse, aktuellerKurs: z.aktuell?.kurs, jetzt: z.jetzt, von: d.startTs });
    lin.zeige(punkte, { fliessen, aufziehen });
    if (punkte.length > 1) lin.achsen(datumMonatKurz(datumBerlin(punkte[0].t)), "Jetzt");
  }

  /** Bewegung B3: Die ganze Seite reist in den Moment unter dem Finger. */
  function zeitreise(info) {
    if (!info) {
      reist = false;
      app.zeitreise(null);
      zeigeKopf();
      return;
    }
    reist = true;
    const p = info.punkt;
    zahl.eilig = true;
    label.textContent = p.jetzt ? "Jetzt" : datumLang(datumBerlin(info.t));
    zahl.setze(p.wert);
    fuelle(zeile,
      veraenderung(p.wert - p.investiert, p.investiert > 0 ? ((p.wert - p.investiert) / p.investiert) * 100 : null),
      h("span", { class: "held-zeitraum" }, p.kauf ? `Kauf ${p.kauf.nr} · ${euro(p.investiert, 0)} eingezahlt` : `${euro(p.investiert, 0)} eingezahlt`));
    app.zeitreise({ t: Math.min(info.t, z.jetzt), anteil: info.anteil });
  }

  function zeigeFuss() {
    const a = z.aktuell;
    fuss.textContent = a ? `Bitcoin ${euro(a.kurs, 0)} · ${a.quelle}, ${uhrzeit(a.zeit)} Uhr · Keine Anlageberatung` : "Keine Anlageberatung";
  }

  /** Bewegung B8: Beim ersten Mal steigen die Kacheln nacheinander auf. */
  function aufgang() {
    if (wenigBewegung()) return;
    const teile = [linieEl, zeitraumEl, takt, ...Object.values(kacheln).map((k) => k.el)];
    teile.forEach((t, i) => {
      t.style.opacity = "0";
      const f = new Feder(46, { art: "raum", genau: 0.05, beiWert: (y) => {
        t.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
        t.style.opacity = String(klemme(1 - y / 46));
      } });
      setTimeout(() => f.zu(0).then(() => { t.style.removeProperty("transform"); t.style.removeProperty("opacity"); }), 140 + i * 70);
    });
  }

  // ---- Ziehen zum Aktualisieren (nur ganz oben) ----
  const zug = new Feder(0, { art: "gummi", genau: 0.3, beiWert: (y) => {
    inhalt.style.transform = y > 0.3 ? `translate3d(0, ${y.toFixed(1)}px, 0)` : "";
    ring.setze(klemme(y / 76));
    ringHalter.style.opacity = String(klemme(y / 30));
  } });
  let laedt = false;
  function ptrAnbinden(rolle) {
    let start = null;
    rolle.addEventListener("touchstart", (e) => {
      if (rolle.scrollTop > 0 || laedt || e.touches.length > 1) { start = null; return; }
      start = { y: e.touches[0].clientY, x: e.touches[0].clientX, aktiv: false, gemeldet: false };
    }, { passive: true });
    rolle.addEventListener("touchmove", (e) => {
      if (!start) return;
      const dy = e.touches[0].clientY - start.y; const dx = e.touches[0].clientX - start.x;
      if (!start.aktiv) {
        if (dy < 6 || Math.abs(dx) > dy || rolle.scrollTop > 0 || e.target.closest("[data-eigene-geste]")) { if (Math.abs(dy) > 6 || Math.abs(dx) > 6) start = null; return; }
        start.aktiv = true; zug.halte();
      }
      e.preventDefault();
      const y = gummi(dy, 160);
      zug.springe(y);
      if (y > 76 && !start.gemeldet) { tick(10); start.gemeldet = true; }
      if (y < 76) start.gemeldet = false;
    }, { passive: false });
    const ende = async () => {
      if (!start?.aktiv) { start = null; return; }
      const ausloesen = zug.wert > 76;
      start = null;
      if (!ausloesen) { zug.zu(0); return; }
      laedt = true;
      zug.zu(64);
      ring.dreht(true);
      try { await app.aktualisieren({ erzwingen: true }); } finally {
        ring.dreht(false); laedt = false; zug.zu(0);
      }
    };
    rolle.addEventListener("touchend", ende);
    rolle.addEventListener("touchcancel", ende);
  }

  return {
    el,
    ptrAnbinden,
    get zeitraum() { return zeitraum; },
    aktualisiere({ ersteMal = false } = {}) {
      const s = z.summe;
      zeigeKopf();
      zeigeTakt();
      zeigeFuss();
      for (const k of Object.values(koepfe)) k.aktualisiere();
      // Linie nur neu, wenn sich die Daten wirklich geändert haben
      const sig = `${z.kaeufe.length}|${s.anzahl}|${s.btc}|${z.aktuell?.kurs}|${z.tage?.punkte?.length}|${z.reihen.monat?.punkte?.length}`;
      if (sig !== signatur && !reist) {
        const erste = ersteDaten && s.wert != null;
        signatur = sig;
        zeichneLinie({ fliessen: !erste, aufziehen: erste });
        if (erste) { ersteDaten = false; }
      }
      if (ersteMal) { markeFeder.springe(markeZiel()); aufgang(); }
    },
  };
}

/** Das Zeichen beim Aktualisieren: 52 Striche (ein Jahr), die mit dem Zug aufleuchten. */
function ringZeichen() {
  const striche = Array.from({ length: 52 }, (_, i) => {
    const w = (i / 52) * Math.PI * 2 - Math.PI / 2;
    return svg("line", { x1: 50 + Math.cos(w) * 36, y1: 50 + Math.sin(w) * 36, x2: 50 + Math.cos(w) * 46, y2: 50 + Math.sin(w) * 46, class: "ring-strich" });
  });
  const el = svg("svg", { viewBox: "0 0 100 100", class: "ring", "aria-hidden": "true" }, ...striche);
  let zuletzt = -1;
  return {
    el,
    setze(anteil) {
      const n = Math.round(anteil * 52);
      if (n === zuletzt) return;
      zuletzt = n;
      striche.forEach((s, i) => s.classList.toggle("an", i < n));
    },
    dreht(an) { el.classList.toggle("dreht", an); },
  };
}

