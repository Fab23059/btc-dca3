// =====================================================================
// kaeufe.js – Das Fenster "Käufe".
//
// Kopf (auch als Kachel auf der Startseite): die Ernte – jeder Kauf ein
// Balken, so hoch wie die sats, die es dafür gab. Bei der Zeitreise
// verblassen die Käufe, die "noch nicht passiert" sind.
//
// Darunter: alle Sparwochen. Eine Zeile antippen → sie entfaltet sich
// zum Eintragen (Bewegung B1, aus genau dieser Zeile).
// =====================================================================

import { h, svg, icon, fuelle, wenigBewegung } from "../dom.js";
import { entfalte } from "../teile/fenster.js";
import { funkenflug } from "../teile/funkenflug.js";
import { btc as btcFmt, sats, euro, zahl, anzahl, datumMonatKurz, monatsname, wochentagKurz, uhrzeit, datumLang, euroMitVorzeichen, prozent, MINUS } from "../format.js";
import { zerlege as zerlegeDatum, heuteBerlin } from "../zeit.js";
import { kopfPlus } from "./gemeinsam.js";

/** Ernte als SVG: ein Balken je Kauf. */
function ernte() {
  const el = svg("svg", { class: "ernte", viewBox: "0 0 100 40", preserveAspectRatio: "none", "aria-hidden": "true" });
  let balken = [];
  let erstes = true;
  return {
    el,
    setze(kaeufe) {
      if (erstes && kaeufe.some((k) => k.gezaehlt)) { erstes = false; el.classList.add("waechst"); setTimeout(() => el.classList.remove("waechst"), 2600); }
      const gez = kaeufe.filter((k) => k.gezaehlt);
      // Höhe ab einem Sockel, damit günstige Wochen sichtbar herausragen
      const max = Math.max(...gez.map((k) => k.btc), 1e-12);
      const min = Math.min(...gez.map((k) => k.btc), max);
      const sockel = min * 0.72;
      const n = Math.max(gez.length, 12);
      const b = 100 / n;
      balken = gez.map((k, i) => {
        const hoehe = 5 + ((k.btc - sockel) / Math.max(1e-12, max - sockel)) * 35;
        return { ts: k.ts, el: svg("rect", { x: (i * b + b * 0.18).toFixed(3), y: (40 - hoehe).toFixed(3), width: (b * 0.64).toFixed(3), height: hoehe.toFixed(3), rx: Math.min(0.8, b * 0.2), class: `ernte-balken ernte-balken--${k.status}`, style: { "--i": String(i) } }) };
      });
      el.replaceChildren(...balken.map((x) => x.el));
    },
    zeitreise(t) { for (const x of balken) x.el.classList.toggle("ist-zukunft", t != null && x.ts > t); },
  };
}

export function kaeufeKopf(app) {
  const z = app.zustand;
  const unter = h("p", { class: "fkopf-unter" });
  const e = ernte();
  const links = h("span", { class: "kk-links" });
  const rechts = h("span", { class: "kk-rechts zahl" });
  const el = h("div", { class: "fkopf fkopf--kaeufe" },
    h("h2", { class: "fkopf-titel" }, "Käufe"), unter, kopfPlus(),
    h("div", { class: "kk-ernte" }, e.el),
    h("p", { class: "kk-fuss" }, links, rechts));
  let letzteZeit = null;
  const zeige = (t) => {
    const s = z.summe;
    const gez = z.kaeufe.filter((k) => k.gezaehlt && (t == null || k.ts <= t));
    if (!s.anzahl) { unter.textContent = "Noch kein Kauf"; fuelle(links); fuelle(rechts); return; }
    unter.textContent = t == null ? `${anzahl(s.anzahl, "Kauf", "Käufe")} seit ${datumMonatKurz(z.kaeufe[0].montag)}` : `${anzahl(gez.length, "Kauf", "Käufe")} bis hierhin`;
    const geschaetzt = s.geschaetzt.length;
    fuelle(links, `${s.eingetragen} eingetragen`, s.automatisch ? ` · ${s.automatisch} automatisch` : null, geschaetzt ? h("span", { class: "kk-offen" }, ` · ${geschaetzt} offen`) : null);
    const satsSumme = gez.reduce((a, k) => a + k.btc, 0) * 1e8;
    rechts.textContent = `${sats(satsSumme)} sats`;
  };
  return {
    el,
    aktualisiere() { e.setze(z.kaeufe); e.zeitreise(letzteZeit); zeige(letzteZeit); },
    zeitreise(info) { letzteZeit = info?.t ?? null; e.zeitreise(letzteZeit); zeige(letzteZeit); },
  };
}

const STATUS = {
  eingetragen: { text: "eingetragen", symbol: "haken" },
  automatisch: { text: "automatisch", symbol: "haken" },
  geschaetzt: { text: "eintragen", symbol: "schaetzung" },
  ausstehend: { text: "ausstehend", symbol: "uhr" },
  ohneKurs: { text: "ohne Kurs", symbol: "schaetzung" },
};

// Zuletzt gespeicherter Kauf: Seine Zeile glüht beim Neuaufbau kurz auf
let frisch = { montag: null, bis: 0 };
// B10: Das offene Fenster "Käufe" und ob Ernte und Bilanz gerade auf den Funken warten
let offenesFenster = null;
let wartetAufFunke = false;
export function markiereFrisch(montag) {
  frisch = { montag, bis: Date.now() + 2500 };
  wartetAufFunke = Boolean(offenesFenster) && !wenigBewegung() && !document.documentElement.classList.contains("ruhig");
  // Sicherheitsnetz: Kommt kein Funke, zeigen Ernte und Bilanz den neuen Stand trotzdem
  if (wartetAufFunke) setTimeout(() => { if (wartetAufFunke) { wartetAufFunke = false; offenesFenster?.zeigeStand(); } }, 4000);
}

/**
 * B10 im Fenster "Käufe": Der Funke springt von der frisch gespeicherten Zeile zur Ernte
 * und weiter zur Bilanz. Erst wenn er ankommt, zeigen sie den neuen Stand.
 * (Ist das Fenster nicht offen, passiert hier nichts – dann fliegt er nur auf der Startseite.)
 */
export async function funkeImFenster(montag, zustand) {
  const f = offenesFenster;
  if (!f || !wartetAufFunke) { wartetAufFunke = false; return; }
  const gez = zustand.kaeufe.filter((k) => k.gezaehlt);
  const i = Math.max(0, gez.findIndex((k) => k.montag === montag));
  await funkenflug({
    von: () => f.liste.querySelector(`.kauf-zeile[data-montag="${montag}"] .kz-status`),
    stationen: [
      { ziel: () => f.kopf.el.querySelector(".kk-ernte"), anker: [(i + 0.5) / Math.max(gez.length, 12), 0.7], zuenden: () => f.kopf.aktualisiere(), halt: 200 },
      { ziel: () => f.bilanz, anker: [0.25, 0.62], zuenden: () => f.baueBilanz() },
    ],
  });
  wartetAufFunke = false;
}

/**
 * Eine Zeile – gleich aufgebaut wie der Kopf des Eintragen-Fensters.
 * Mit aktuellem Kurs zeigt sie rechts, was aus diesem einen Kauf geworden ist.
 */
export function kaufZeile(k, { beiTipp, kurs = null, rang = null } = {}) {
  const { tag } = zerlegeDatum(k.montag);
  // Heute ist Kauftag, aber noch vor der geplanten Zeit: trotzdem schon eintragbar
  // (Bitvavo kauft manchmal früher)
  const heuteOffen = k.status === "ausstehend" && k.montag === heuteBerlin();
  const st = heuteOffen ? { text: "eintragen", symbol: "uhr" } : STATUS[k.status];
  const menge = k.btc != null ? h("span", { class: "kz-menge zahl" }, btcFmt(k.btc), h("span", { class: "kz-einheit" }, " BTC")) : h("span", { class: "kz-menge kz-menge--leer" }, k.status === "ausstehend" ? `${heuteOffen ? "heute, " : ""}${uhrzeit(k.ts)} Uhr` : "Kurs fehlt");
  const unter = k.btc != null ? h("span", { class: "kz-unter zahl" }, `${sats(k.btc * 1e8)} sats · ${euro(k.kurs, 0)}${k.frueh ? ` · zählt seit ${uhrzeit(k.ts)} Uhr` : ""}`) : h("span", { class: "kz-unter" }, heuteOffen && beiTipp ? `${k.boerse} · schon gekauft? Antippen` : k.boerse ?? "");
  const statusEl = h("span", { class: `kz-status kz-status--${k.status}` }, icon(st.symbol, { groesse: 14, strich: 2.2 }), h("span", null, st.text));
  let rechts = statusEl;
  if (kurs != null && k.gezaehlt && k.btc != null) {
    const wert = k.btc * kurs;
    const gv = wert - k.brutto;
    const p = (gv / k.brutto) * 100;
    const art = gv > 0.004 ? "plus" : gv < -0.004 ? "minus" : "null";
    rechts = h("span", { class: "kz-rechts" },
      h("span", { class: `kz-gv kz-gv--${art} zahl` }, `${p > 0 ? "+" : p < 0 ? MINUS : ""}${zahl(Math.abs(p), 1)} %`),
      h("span", { class: "kz-wert zahl" }, euro(wert)),
      statusEl);
  }
  const kinder = [
    h("span", { class: "kz-datum" }, h("span", { class: "kz-tag zahl" }, String(tag)), h("span", { class: "kz-wochentag" }, wochentagKurz(k.montag))),
    h("span", { class: "kz-mitte" }, menge, unter, rang ? h("span", { class: `kz-rang kz-rang--${rang}` }, rang === "bester" ? "Günstigster Kauf" : "Teuerster Kauf") : null),
    rechts,
  ];
  if (!beiTipp || (k.status === "ausstehend" && !heuteOffen)) return h("div", { class: "kauf-zeile", "data-montag": k.montag }, kinder);
  const istFrisch = frisch.montag === k.montag && Date.now() < frisch.bis;
  const el = h("button", { type: "button", class: ["kauf-zeile", "tippbar", istFrisch && "ist-frisch"], "data-montag": k.montag, "aria-label": `Kauf vom ${datumLang(k.montag)} – ${st.text}`, onclick: () => beiTipp(el) }, kinder);
  return el;
}

/** Das offene Fenster. */
export function oeffneKaeufe(app, herkunft) {
  const z = app.zustand;
  const kopf = kaeufeKopf(app);
  const liste = h("div", { class: "kauf-liste" });
  const hinweis = h("div", { class: "kauf-hinweis" });
  const bilanz = h("section", { class: "bilanz" });
  const inhalt = h("div", { class: "fenster-kaeufe" }, kopf.el, bilanz, hinweis, liste);

  function baueBilanz() {
    const s = z.summe;
    const kurs = z.aktuell?.kurs ?? null;
    const feld = (titel, wert, art = "") => h("div", { class: ["bilanz-feld", art && `bilanz-feld--${art}`] }, h("span", { class: "bilanz-titel" }, titel), h("span", { class: "bilanz-wert zahl" }, wert));
    const gvArt = s.gv == null ? "" : s.gv >= 0 ? "plus" : "minus";
    fuelle(bilanz,
      feld("Investiert", euro(s.investiert)),
      feld("Wert jetzt", s.wert != null ? euro(s.wert) : "–"),
      feld("Gewinn / Verlust", s.gv != null ? `${euroMitVorzeichen(s.gv)}` : "–", gvArt),
      feld("in Prozent", s.gvProzent != null ? prozent(s.gvProzent) : "–", gvArt),
      feld("BTC gesamt", `${btcFmt(s.btc)}`),
      feld("Ø Kaufpreis", s.durchschnitt ? euro(s.durchschnitt) : "–"),
      feld("Aktueller Kurs", kurs ? euro(kurs) : "–", kurs && s.durchschnitt ? (kurs >= s.durchschnitt ? "plus" : "minus") : ""),
      feld("Käufe", `${s.anzahl}`));
  }

  function baueListe() {
    // Nach dem Speichern eines Kaufs warten Ernte und Bilanz auf den Funken (B10)
    if (!wartetAufFunke) { kopf.aktualisiere(); baueBilanz(); }
    const s = z.summe;
    const kurs = z.aktuell?.kurs ?? null;
    const gez = z.kaeufe.filter((k) => k.gezaehlt && k.kurs != null);
    const bester = gez.length > 2 ? gez.reduce((a, k) => (k.kurs < a.kurs ? k : a)) : null;
    const teuerster = gez.length > 2 ? gez.reduce((a, k) => (k.kurs > a.kurs ? k : a)) : null;
    if (s.geschaetzt.length) {
      const neuester = s.geschaetzt[s.geschaetzt.length - 1];
      fuelle(hinweis, h("p", { class: "kauf-hinweis-text" },
        `Dein Kauf vom ${datumMonatKurz(neuester.montag)} zählt schon mit – gerechnet mit dem Marktkurs zur Kaufminute. Trag die echte Menge aus ${neuester.boerse ?? "der Börse"} ein, dann stimmt er aufs Satoshi.`),
        h("button", { type: "button", class: "kauf-hinweis-los tippbar", onclick: (e) => app.eintragen(neuester.montag, e.currentTarget) }, "Jetzt eintragen"));
      hinweis.hidden = false;
      hinweis.dataset.montag = neuester.montag;
    } else hinweis.hidden = true;

    const gruppen = new Map();
    for (const k of [...z.kaeufe].reverse()) {
      const { jahr, monat } = zerlegeDatum(k.montag);
      const schl = `${jahr}-${monat}`;
      if (!gruppen.has(schl)) gruppen.set(schl, { titel: `${monatsname(monat)} ${jahr}`, kaeufe: [] });
      gruppen.get(schl).kaeufe.push(k);
    }
    fuelle(liste, ...[...gruppen.values()].map((g) => h("section", { class: "kauf-monat" },
      h("h3", { class: "kauf-monat-titel" }, g.titel),
      ...g.kaeufe.map((k) => kaufZeile(k, { kurs, rang: k === bester ? "bester" : k === teuerster ? "teuerster" : null, beiTipp: (el) => app.eintragen(k.montag, el) })))));
  }
  baueListe();
  // Beim Öffnen gleiten die ersten Zeilen nacheinander herein
  liste.querySelectorAll(".kauf-zeile").forEach((z, i) => { if (i < 14) z.style.setProperty("--i", String(i)); });
  liste.classList.add("steigt-auf");
  setTimeout(() => liste.classList.remove("steigt-auf"), 1800);
  app.koepfe.add(kopf);
  const beobachter = () => baueListe();
  app.beiAenderung.add(beobachter);
  const dieses = { kopf, liste, bilanz, baueBilanz, zeigeStand: () => { kopf.aktualisiere(); baueBilanz(); } };
  offenesFenster = dieses;

  return entfalte({
    herkunft, inhalt, titel: "Käufe", hintergrund: app.heuteEl,
    beimSchliessen: () => {
      app.koepfe.delete(kopf); app.beiAenderung.delete(beobachter);
      if (offenesFenster === dieses) { offenesFenster = null; wartetAufFunke = false; }
    },
  });
}
