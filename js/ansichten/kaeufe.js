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

import { h, svg, icon, fuelle } from "../dom.js";
import { entfalte } from "../teile/fenster.js";
import { btc as btcFmt, sats, euro, anzahl, datumMonatKurz, monatsname, wochentagKurz, uhrzeit, datumLang } from "../format.js";
import { zerlege as zerlegeDatum } from "../zeit.js";
import { kopfPlus } from "./gemeinsam.js";

/** Ernte als SVG: ein Balken je Kauf. */
function ernte() {
  const el = svg("svg", { class: "ernte", viewBox: "0 0 100 40", preserveAspectRatio: "none", "aria-hidden": "true" });
  let balken = [];
  return {
    el,
    setze(kaeufe) {
      const gez = kaeufe.filter((k) => k.gezaehlt);
      // Höhe ab einem Sockel, damit günstige Wochen sichtbar herausragen
      const max = Math.max(...gez.map((k) => k.btc), 1e-12);
      const min = Math.min(...gez.map((k) => k.btc), max);
      const sockel = min * 0.72;
      const n = Math.max(gez.length, 12);
      const b = 100 / n;
      balken = gez.map((k, i) => {
        const hoehe = 5 + ((k.btc - sockel) / Math.max(1e-12, max - sockel)) * 35;
        return { ts: k.ts, el: svg("rect", { x: (i * b + b * 0.18).toFixed(3), y: (40 - hoehe).toFixed(3), width: (b * 0.64).toFixed(3), height: hoehe.toFixed(3), rx: Math.min(0.8, b * 0.2), class: `ernte-balken ernte-balken--${k.status}` }) };
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
    fuelle(links, `${s.eingetragen} eingetragen`, geschaetzt ? h("span", { class: "kk-offen" }, ` · ${geschaetzt} geschätzt`) : null);
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
  geschaetzt: { text: "geschätzt", symbol: "schaetzung" },
  ausstehend: { text: "ausstehend", symbol: "uhr" },
  ohneKurs: { text: "ohne Kurs", symbol: "schaetzung" },
};

// Zuletzt gespeicherter Kauf: Seine Zeile glüht beim Neuaufbau kurz auf
let frisch = { montag: null, bis: 0 };
export function markiereFrisch(montag) { frisch = { montag, bis: Date.now() + 2500 }; }

/** Eine Zeile – gleich aufgebaut wie der Kopf des Eintragen-Fensters. */
export function kaufZeile(k, { beiTipp } = {}) {
  const { tag } = zerlegeDatum(k.montag);
  const st = STATUS[k.status];
  const menge = k.btc != null ? h("span", { class: "kz-menge zahl" }, btcFmt(k.btc), h("span", { class: "kz-einheit" }, " BTC")) : h("span", { class: "kz-menge kz-menge--leer" }, k.status === "ausstehend" ? `${uhrzeit(k.ts)} Uhr` : "Kurs fehlt");
  const unter = k.btc != null ? h("span", { class: "kz-unter zahl" }, `${sats(k.btc * 1e8)} sats · ${euro(k.kurs, 0)}`) : h("span", { class: "kz-unter" }, k.boerse ?? "");
  const kinder = [
    h("span", { class: "kz-datum" }, h("span", { class: "kz-tag zahl" }, String(tag)), h("span", { class: "kz-wochentag" }, wochentagKurz(k.montag))),
    h("span", { class: "kz-mitte" }, menge, unter),
    h("span", { class: `kz-status kz-status--${k.status}` }, icon(st.symbol, { groesse: 15, strich: 2 }), h("span", null, st.text)),
  ];
  if (!beiTipp || k.status === "ausstehend") return h("div", { class: "kauf-zeile", "data-montag": k.montag }, kinder);
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
  const inhalt = h("div", { class: "fenster-kaeufe" }, kopf.el, hinweis, liste);

  function baueListe() {
    kopf.aktualisiere();
    const s = z.summe;
    if (s.geschaetzt.length) {
      const aeltester = s.geschaetzt[0];
      fuelle(hinweis, h("p", { class: "kauf-hinweis-text" },
        `${anzahl(s.geschaetzt.length, "Kauf ist", "Käufe sind")} nur geschätzt. Trag die echte Menge aus Bitvavo ein, dann stimmt alles aufs Satoshi.`));
      hinweis.hidden = false;
      hinweis.dataset.montag = aeltester.montag;
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
      ...g.kaeufe.map((k) => kaufZeile(k, { beiTipp: (el) => app.eintragen(k.montag, el) })))));
  }
  baueListe();
  app.koepfe.add(kopf);
  const beobachter = () => baueListe();
  app.beiAenderung.add(beobachter);

  return entfalte({
    herkunft, inhalt, titel: "Käufe", hintergrund: app.heuteEl,
    beimSchliessen: () => { app.koepfe.delete(kopf); app.beiAenderung.delete(beobachter); },
  });
}
