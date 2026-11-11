// =====================================================================
// heute.js – Die Startseite. Oben der Wert, darunter die Linie (das
// Bedienelement der Zeitreise), darunter die Fenster als Kacheln.
//
// Alles hier ist auf Bewegung gebaut:
//   * Die große Zahl ist ein Zählwerk.
//   * Die Linie fließt beim Zeitraumwechsel, der Punkt darunter federt mit.
//   * Fährt der Finger über die Linie, reist die ganze Seite in die Zeit.
//     Ein Tipp auf das Startdatum darunter fährt die Reise von selbst (B14).
//   * Kommt ein Kauf dazu oder wird einer eingetragen, springt ein Funke
//     von Stelle zu Stelle – erst bei seiner Ankunft ändert sie sich (B10).
//   * Ziehen nach unten aktualisiert (Gummiband + 52 Striche, einer pro Woche)
//     und facht dabei die Glut an (B15).
// =====================================================================

import { h, svg, fuelle, wenigBewegung } from "../dom.js";
import { Ziffern } from "../bewegung/ziffern.js";
import { Feder, imTakt, gummi, klemme } from "../bewegung/feder.js";
import { linie } from "../teile/linie.js";
import { kachel } from "../teile/fenster.js";
import { tick } from "../teile/haptik.js";
import { funkenflug, stieben } from "../teile/funkenflug.js";
import { zeitraffer } from "../teile/zeitraffer.js";
import { beiFrei, istFrei } from "../teile/ebenen.js";
import { SCHLUESSEL, lies, schreibe } from "../speicher.js";
import { ZEITRAEUME, zeitraumDaten } from "../zeitraeume.js";
import { wertverlauf, zeitraumErgebnis, naechsterKauf, standBei, zusammenfassung } from "../rechnen.js";
import { ZEITPLAN } from "../konfig.js";
import { euro, sats, btc as btcFmt, anzahl, datumLang, datumMonatKurz, uhrzeit, wochentagKurz } from "../format.js";
import { datumBerlin } from "../zeit.js";
import { euroTeile, ganzTeile, veraenderung, skelett } from "./gemeinsam.js";
import { kaeufeKopf } from "./kaeufe.js";
import { baumKopf } from "./baum.js";
import { zahlenKopf } from "./zahlen.js";
import { marktKopf } from "./markt.js";

const TAG = 86_400_000;

export function erstelleHeute(app) {
  const z = app.zustand;
  let zeitraum = "monat";         // womit die Startseite beginnt: die letzten 30 Tage
  let einheit = "eur";            // "eur": Depotwert in Euro · "btc": Bestand in sats
  let reist = false;
  let ersteDaten = true;
  let signatur = "";

  // ---- Wert ----
  const label = h("p", { class: "held-label" }, "Depotwert");
  const zahlEl = h("span", { class: "held-zahl" });
  const zahl = new Ziffern(zahlEl, { teile: euroTeile(), beiEnergie: (e) => app.licht(e), beschreibung: (t) => `Depotwert ${t}` });
  const zeile = h("p", { class: "held-zeile" });
  const held = h("button", { type: "button", class: "held tippbar", "aria-label": "So entsteht der Depotwert", onclick: () => !reist && app.oeffneRechenweg(einheit === "btc" ? "bestand" : "wert", held, zeitraum) },
    label, zahlEl, zeile);

  // ---- Einheit: € oder ₿ (wie in der alten App) ----
  const einheitKnoepfe = [["eur", "€", "Depotwert in Euro"], ["btc", "₿", "Bestand in Satoshi"]].map(([wert, text, lab]) =>
    h("button", { type: "button", class: "einheit-wahl", "aria-pressed": String(wert === einheit), "aria-label": lab, "data-wert": wert, onclick: () => waehleEinheit(wert) }, text));
  const einheitEl = h("div", { class: "einheit", role: "group", "aria-label": "Einheit" }, h("span", { class: "einheit-pille", "aria-hidden": "true" }), ...einheitKnoepfe);
  const heldRahmen = h("div", { class: "held-rahmen" }, held, einheitEl);
  function waehleEinheit(wert) {
    if (wert === einheit) return;
    einheit = wert;
    tick(6);
    einheitEl.dataset.wert = wert;
    heldRahmen.dataset.einheit = wert;
    for (const b of einheitKnoepfe) b.setAttribute("aria-pressed", String(b.dataset.wert === wert));
    zahl.teile = wert === "btc" ? ganzTeile(" sats") : euroTeile();
    zahl.beschreibung = wert === "btc" ? (t) => `Bestand ${t}` : (t) => `Depotwert ${t}`;
    zeigeKopf();
    zeichneLinie({ aufziehen: true });
    app.licht(0.8);
  }

  // ---- Linie ----
  const linieEl = h("div", { class: "linie", "data-eigene-geste": "" });
  const lin = linie(linieEl, { beimScrubben: (info) => zeitreise(info), beiAnkunft: () => { app.licht(1); tick(8); }, beiStartdatum: () => reiseAnsehen() });

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
    zeichneLinie({ aufziehen: true });
    app.licht(0.7);
  }

  // ---- Takt bis zum nächsten Kauf ----
  const taktText = h("span", { class: "takt-text" });
  const taktZeit = h("span", { class: "takt-zeit zahl" });
  const taktFuellung = h("span", { class: "takt-fuellung" });
  const takt = h("div", { class: "takt" },
    h("div", { class: "takt-zeile" }, taktText, taktZeit),
    h("div", { class: "takt-balken", "aria-hidden": "true" }, taktFuellung));
  function zeigeTakt() {
    let nk = naechsterKauf(ZEITPLAN, Date.now());
    // Schon eingetragen (Bitvavo hat früher gekauft)? Dann zählt der Montag danach
    if (nk && z.eintraege[nk.montag]) nk = naechsterKauf(ZEITPLAN, nk.ts + 1);
    if (!nk) { takt.hidden = true; return; }
    const rest = Math.max(0, nk.ts - Date.now());
    const tage = Math.floor(rest / TAG); const std = Math.floor((rest % TAG) / 3_600_000); const min = Math.floor((rest % 3_600_000) / 60_000);
    const text = `Nächster Kauf · ${wochentagKurz(nk.montag)}, ${datumMonatKurz(nk.montag)} · ${uhrzeit(nk.ts)}`;
    const zeitText = tage ? `in ${tage} T ${std} Std` : std ? `in ${std} Std ${min} Min` : `in ${min} Min`;
    if (taktText.textContent !== text) taktText.textContent = text;
    if (taktZeit.textContent !== zeitText) taktZeit.textContent = zeitText;
    taktFuellung.style.transform = `scaleX(${klemme(1 - rest / (7 * TAG)).toFixed(3)})`;
  }
  // Ruhig: zweimal pro Minute, nur solange man hinsieht
  setInterval(() => { if (!document.hidden) zeigeTakt(); }, 30_000);

  // ---- Fenster als Kacheln ----
  const koepfe = { markt: marktKopf(app), kaeufe: kaeufeKopf(app), baum: baumKopf(app), zahlen: zahlenKopf(app) };
  const kacheln = {
    markt: kachel({ kopf: koepfe.markt.el, label: "Bitcoin-Kurs öffnen", beiTipp: (el) => { stoppeRaffer(); app.oeffneMarkt(el); } }),
    kaeufe: kachel({ kopf: koepfe.kaeufe.el, label: "Käufe öffnen", beiTipp: (el) => { stoppeRaffer(); app.oeffneKaeufe(el); } }),
    baum: kachel({ kopf: koepfe.baum.el, label: "Deinen Baum öffnen", beiTipp: (el) => { stoppeRaffer(); app.oeffneBaum(el); } }),
    zahlen: kachel({ kopf: koepfe.zahlen.el, label: "Zahlen öffnen", beiTipp: (el) => { stoppeRaffer(); app.oeffneZahlen(el); } }),
  };
  for (const k of Object.values(koepfe)) app.koepfe.add(k);
  const stapel = h("div", { class: "stapel" }, ...Object.values(kacheln).map((k) => k.el));

  const fuss = h("p", { class: "fuss" });

  // ---- Ziehen zum Aktualisieren ----
  const ring = ringZeichen();
  const ringHalter = h("div", { class: "auffrischen", "aria-hidden": "true" }, ring.el);

  const inhalt = h("div", { class: "heute-stapel" }, heldRahmen, linieEl, zeitraumEl, takt, stapel, fuss);
  const el = h("div", null, ringHalter, inhalt);

  // -------------------------------------------------------------------

  function zeigeKopf() {
    if (reist) return;
    const s = z.summe;
    label.textContent = einheit === "btc" ? "Bestand" : "Depotwert";
    zahl.eilig = false;
    if (!s.anzahl) { zahl.setze(null); fuelle(zeile, h("span", { class: "text-3" }, "Noch kein Kauf")); return; }
    if (einheit === "btc") {
      zahl.setze(s.sats);
      const d = zeitraumDaten(z, zeitraum);
      const vor = zeitraum === "gesamt" ? { btc: 0 } : standBei(z.kaeufe, d.startTs);
      const neuKaeufe = z.kaeufe.filter((k) => k.gezaehlt && (zeitraum === "gesamt" || k.ts > d.startTs)).length;
      const dazu = (s.btc - vor.btc) * 1e8;
      fuelle(zeile,
        h("span", { class: `veraenderung veraenderung--${dazu > 0 ? "plus" : "null"}` }, h("span", { class: "zahl" }, `+${sats(dazu)} sats`), h("span", { class: "veraenderung-prozent" }, `${btcFmt(s.btc)} BTC`)),
        h("span", { class: "held-zeitraum" }, `${anzahl(neuKaeufe, "Kauf", "Käufe")} ${ZEITRAEUME[zeitraum].satz}`));
      zeile.dataset.zeitraum = zeitraum;
      return;
    }
    if (s.wert == null) { zahl.setze(null); fuelle(zeile, skelett("11em")); return; }
    zahl.setze(s.wert, { einrollen: ersteDaten });
    const d = zeitraumDaten(z, zeitraum);
    const r = zeitraum === "gesamt"
      ? { veraenderung: s.gv, prozent: s.gvProzent }
      : zeitraumErgebnis({ kaeufe: z.kaeufe, aktuellerKurs: z.aktuell?.kurs, jetzt: z.jetzt, startTs: d.startTs, kursZuBeginn: d.kursZuBeginn });
    const vorher = zeile.dataset.zeitraum;
    fuelle(zeile,
      r ? veraenderung(r.veraenderung, r.prozent) : h("span", { class: "text-3" }, "Kurs zu Beginn wird geladen"),
      h("span", { class: "held-zeitraum" }, ZEITRAEUME[zeitraum].satz));
    zeile.dataset.zeitraum = zeitraum;
    if (vorher && vorher !== zeitraum && !wenigBewegung()) {
      [...zeile.children].forEach((k, i) => k.animate(
        [{ opacity: 0, transform: "translate3d(0, 10px, 0)" }, { opacity: 1, transform: "none" }],
        { duration: 520, delay: i * 70, easing: "cubic-bezier(.2,.9,.25,1)", fill: "backwards" }));
    }
  }

  function zeichneLinie({ fliessen = true, aufziehen = false } = {}) {
    const s = z.summe;
    if (!s.anzahl) { lin.zeige(null); return; }
    const d = zeitraumDaten(z, zeitraum);
    let punkte = wertverlauf({ kaeufe: z.kaeufe, kurse: d.kurse, aktuellerKurs: z.aktuell?.kurs, jetzt: z.jetzt, von: d.startTs });
    // In sats: der Bestand als Treppe (er wächst nur mit jedem Kauf)
    if (einheit === "btc") punkte = punkte.map((p) => ({ ...p, euro: p.wert, wert: p.btc * 1e8, investiert: p.btc * 1e8 }));
    lin.zeige(punkte, { fliessen, aufziehen, mitTreppe: einheit !== "btc" });
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
    if (einheit === "btc") {
      zahl.setze(p.wert);
      const wert = p.euro ?? null;
      fuelle(zeile,
        h("span", { class: "veraenderung" }, h("span", { class: "zahl" }, wert != null ? `${euro(wert)} wert` : "")),
        h("span", { class: "held-zeitraum" }, p.kauf ? `Kauf ${p.kauf.nr} · +${sats(p.kauf.btc * 1e8)} sats` : `${btcFmt(p.btc)} BTC`));
    } else {
      zahl.setze(p.wert);
      fuelle(zeile,
        veraenderung(p.wert - p.investiert, p.investiert > 0 ? ((p.wert - p.investiert) / p.investiert) * 100 : null),
        h("span", { class: "held-zeitraum" }, p.kauf ? `Kauf ${p.kauf.nr} · ${euro(p.investiert, 0)} eingezahlt` : `${euro(p.investiert, 0)} eingezahlt`));
    }
    app.zeitreise({ t: Math.min(info.t, z.jetzt), anteil: info.anteil, kurs: p.jetzt ? null : p.kurs });
  }

  function zeigeFuss() {
    const a = z.aktuell;
    fuss.textContent = a ? `Bitcoin ${euro(a.kurs, 0)} · ${a.quelle}, ${uhrzeit(a.zeit)} Uhr · Keine Anlageberatung` : "Keine Anlageberatung";
  }

  /** Bewegung B8: Beim ersten Mal steigen die Kacheln nacheinander auf. */
  function aufgang() {
    if (wenigBewegung()) return;
    aufgangBis = performance.now() + 2400;
    const teile = [linieEl, zeitraumEl, takt, ...Object.values(kacheln).map((k) => k.el)];
    teile.forEach((t, i) => {
      t.style.opacity = "0";
      const weg = 90 + i * 12;
      const f = new Feder(weg, { antwort: 0.62, daempfung: 0.74, genau: 0.05, beiWert: (y) => {
        const a = klemme(1 - y / weg);
        t.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${(0.94 + 0.06 * a).toFixed(4)})`;
        t.style.opacity = String(klemme(a * 1.4));
      } });
      setTimeout(() => {
        if (t.classList.contains("kachel")) { t.classList.remove("glanz"); t.classList.add("glanz"); }
        f.zu(0).then(() => { t.style.removeProperty("transform"); t.style.removeProperty("opacity"); });
      }, 160 + i * 95);
    });
  }

  // ---- Ziehen zum Aktualisieren (nur ganz oben) ----
  const zug = new Feder(0, { art: "gummi", genau: 0.3, beiWert: (y) => {
    inhalt.style.transform = y > 0.3 ? `translate3d(0, ${y.toFixed(1)}px, 0)` : "";
    ring.setze(klemme(y / 76));
    ringHalter.style.opacity = String(klemme(y / 30));
    // B15 Anfachen: Je weiter du ziehst, desto heller glühen Nebel und Zahl – wie Glut unter einem Blasebalg
    if (y > 4) app.licht(klemme(y / 110) * 0.95);
  } });
  /** B15: Funken steigen von dort auf, wo der Ring sitzt. */
  const anfachen = (menge, kraft) => {
    const r = ringHalter.getBoundingClientRect();
    stieben({ x: r.left + r.width / 2, y: r.top + r.height / 2 + 10, menge, kraft, welle: 0, auftrieb: true });
  };
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
      anfachen(26, 0.85);                    // losgelassen: Die Glut ist angefacht, Funken steigen auf
      try { await app.aktualisieren({ erzwingen: true }); } finally {
        ring.dreht(false); laedt = false; zug.zu(0);
        app.licht(1); anfachen(12, 0.6);     // frische Kurse: Sie flammt noch einmal auf
      }
    };
    rolle.addEventListener("touchend", ende);
    rolle.addEventListener("touchcancel", ende);
  }

  // -------------------------------------------------------------------
  // B10 Funkenflug: Ein Kauf ist dazugekommen oder wurde eingetragen.
  // Wert und Kacheln behalten ihren alten Stand, bis der Funke bei ihnen ankommt.
  // -------------------------------------------------------------------
  let gezeigt = null;          // so viele gezählte Käufe zeigen Wert und Kacheln gerade
  let feier = null;            // wartender oder laufender Flug: { von: "takt" | "kaeufe", montag, laeuft }
  let aufgangBis = 0;          // solange steigen die Kacheln noch auf (dann fliegt noch nichts)
  const nachFeier = [];        // was nach dem Flug drankommt (z. B. die Prägung eines Meilensteins)
  const still = () => wenigBewegung() || document.documentElement.classList.contains("ruhig");
  const gezaehlte = () => z.kaeufe.filter((k) => k.gezaehlt);
  const punktIn = (el, [ax, ay]) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width * ax, y: r.top + r.height * ay }; };

  /**
   * Rollt die Startseite weich so weit, dass ein Element ganz zu sehen ist – der Blick folgt
   * dem Funken. Ist es schon zu sehen, passiert nichts.
   */
  function zeigeHer(el) {
    const rolle = app.heuteEl;
    const r = el.getBoundingClientRect();
    const oben = 76; const unten = innerHeight - 20;
    if (!rolle || (r.top >= oben && r.bottom <= unten)) return Promise.resolve();
    const ziel = klemme(rolle.scrollTop + r.top - Math.max(oben, (innerHeight - r.height) / 2), 0, rolle.scrollHeight - rolle.clientHeight);
    if (Math.abs(ziel - rolle.scrollTop) < 2) return Promise.resolve();
    rolle.scrollTo({ top: ziel, behavior: "smooth" });
    return new Promise((ok) => {
      let ruhig = 0; let zuvor = rolle.scrollTop; const start = performance.now();
      const ab = imTakt((t) => {
        const y = rolle.scrollTop;
        ruhig = Math.abs(y - zuvor) < 0.5 ? ruhig + 1 : 0; zuvor = y;
        if ((ruhig > 5 && Math.abs(y - ziel) < 3) || ruhig > 24 || t - start > 1400) { ab(); ok(); }
      });
    });
  }

  /** Den Flug ansetzen: Er startet, sobald die Startseite frei ist und nichts anderes läuft. */
  function plane(spaeter = 640) { beiFrei(() => setTimeout(fliege, spaeter)); }   // 640 ms: bis ein Fenster zurückgefaltet ist

  async function fliege() {
    if (!feier || feier.laeuft) return;
    if (!istFrei() || reist) { plane(700); return; }                     // Fenster offen oder Zeitreise: warten
    const rest = aufgangBis - performance.now();
    if (rest > 0) { plane(rest + 200); return; }
    feier.laeuft = true;
    const gez = gezaehlte();
    const ringNr = gez.findIndex((k) => k.montag === feier.montag);
    let zuletzt = null;        // wo der Funke gerade war – von dort trifft er den Stamm
    let winkel = -Math.PI / 2;
    const merke = (f) => (p) => { zuletzt = p; f(); };
    const stationen = {
      wert: { vorher: () => zeigeHer(held), ziel: zahlEl, anker: [0.2, 0.55], zuenden: merke(() => { zeigeKopf(); koepfe.markt.aktualisiere(); signatur = ""; zeichneLinieWennNeu(); app.licht(0.85); }), halt: 420 },
      kaeufe: { vorher: () => zeigeHer(kacheln.kaeufe.el), ziel: kacheln.kaeufe.el, anker: [0.9, 0.62], zuenden: merke(() => koepfe.kaeufe.aktualisiere()) },
      baum: {
        vorher: () => zeigeHer(kacheln.baum.el),
        // Der Funke trifft den Stamm an der Seite, von der er kommt – dort setzt der Ring an
        ziel: () => {
          const r = koepfe.baum.bild.leinwand.getBoundingClientRect();
          const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
          if (zuletzt) winkel = Math.atan2(zuletzt.y - cy, zuletzt.x - cx);
          return { x: cx + Math.cos(winkel) * r.width * 0.44, y: cy + Math.sin(winkel) * r.width * 0.44 };
        },
        zuenden: merke(() => koepfe.baum.aktualisiere({ mitRingschluss: true, startwinkel: winkel, ring: ringNr >= 0 ? ringNr : null })), halt: 520,
      },
      zahlen: { vorher: () => zeigeHer(kacheln.zahlen.el), ziel: kacheln.zahlen.el, anker: [0.28, 0.62], zuenden: merke(() => koepfe.zahlen.aktualisiere()), halt: 320 },
      takt: { vorher: () => zeigeHer(takt), ziel: taktZeit, zuenden: merke(() => zeigeTakt()) },
    };
    let von; let reihe;
    if (feier.von === "kaeufe") {
      // Von Hand eingetragen: Der Funke kommt aus der Kachel "Käufe" – dort wurde es eingetragen.
      // Er zieht erst nach unten zu Baum und Zahlen, dann hinauf: Countdown, zuletzt der Depotwert.
      await zeigeHer(kacheln.kaeufe.el);
      koepfe.kaeufe.aktualisiere();
      von = () => punktIn(kacheln.kaeufe.el, [0.9, 0.62]);
      reihe = [stationen.baum, stationen.zahlen, stationen.takt, stationen.wert];
    } else {
      // Der Sparplan hat gekauft: Der Funke löst sich vom Countdown und kehrt am Ende dorthin zurück
      await zeigeHer(takt);
      von = taktZeit;
      reihe = [stationen.wert, stationen.kaeufe, stationen.baum, stationen.zahlen, stationen.takt];
    }
    zuletzt = typeof von === "function" ? von() : punktIn(von, [0.5, 0.5]);
    try { await funkenflug({ von, stationen: reihe }); } catch (e) { console.error(e); }
    feier = null;
    zeigeAlles();              // zum Schluss alles auf den neuesten Stand (Kurse können sich inzwischen bewegt haben)
    for (const f of nachFeier.splice(0)) setTimeout(f, 450);
  }

  /** Zeigt den Stand, als gäbe es einen Kauf noch nicht (für den Funkenflug nach dem Öffnen). */
  function zeigeOhne(kauf) {
    const echt = { kaeufe: z.kaeufe, summe: z.summe };
    z.kaeufe = z.kaeufe.map((k) => (k === kauf ? { ...k, gezaehlt: false, status: "ausstehend", nr: null, brutto: 0 } : k));
    z.summe = zusammenfassung(z.kaeufe, z.aktuell?.kurs ?? null);
    try { zeigeKopf(); for (const k of Object.values(koepfe)) k.aktualisiere(); } finally { z.kaeufe = echt.kaeufe; z.summe = echt.summe; }
  }

  function zeichneLinieWennNeu() {
    const s = z.summe;
    // Linie nur neu, wenn sich die Daten wirklich geändert haben
    const sig = `${z.kaeufe.length}|${s.anzahl}|${s.btc}|${z.tage?.punkte?.length}|${z.reihen.monat?.punkte?.length}|${Math.round((z.aktuell?.kurs ?? 0) / 25)}`;
    if (sig !== signatur && !reist) {
      const erste = ersteDaten && s.wert != null;
      signatur = sig;
      zeichneLinie({ fliessen: !erste, aufziehen: erste });
      if (erste) { ersteDaten = false; }
    }
  }

  function zeigeAlles() {
    zeigeKopf();
    zeigeTakt();
    zeigeFuss();
    for (const k of Object.values(koepfe)) k.aktualisiere();
    zeichneLinieWennNeu();
    gezeigt = gezaehlte().length;
    if (z.summe.wert != null && !z.summe.ohneKurs.length) schreibe(SCHLUESSEL.ringeGesehen, gezeigt);
  }

  // -------------------------------------------------------------------
  // B14 Zeitraffer: Die Zeitreise fährt von selbst, vom ersten Kauf bis heute.
  // -------------------------------------------------------------------
  let raffer = null;
  function stoppeRaffer() {
    if (!raffer) return;
    raffer.ab();
    lin.fahreHeim();
  }
  function reiseAnsehen() {
    if (!z.summe?.anzahl || feier?.laeuft) return;
    stoppeRaffer();
    const los = () => {
      const lauf = zeitraffer({
        kaeufe: gezaehlte(), jetzt: z.jetzt,
        beiZeit: ({ anteil }) => lin.fahre(anteil),          // alles Weitere macht die Zeitreise (B3)
        beiEnde: ({ abgebrochen }) => {
          linieEl.classList.remove("laeuft-zeitraffer");
          if (raffer === lauf) raffer = null;
          if (!abgebrochen) { lin.fahre(null); app.licht(1); tick(10); }
        },
      });
      raffer = lauf;
      linieEl.classList.add("laeuft-zeitraffer");
      lauf.start();
    };
    tick(6);
    // Die Reise zeigt immer alles: bei Woche, Monat oder Jahr erst auf "Alles" wechseln und den Kometen abwarten
    if (zeitraum !== "gesamt") { waehle("gesamt"); setTimeout(los, wenigBewegung() ? 0 : 1500); } else los();
  }
  // Greift der Finger in die Linie, endet der Film – die Hand fährt weiter
  let gegriffen = false;
  linieEl.addEventListener("pointerdown", (e) => { if (raffer?.laeuft && !e.target.closest("button")) { raffer.ab(); gegriffen = true; } });
  for (const t of ["pointerup", "pointercancel"]) linieEl.addEventListener(t, () => { if (gegriffen) { gegriffen = false; lin.fahreHeim(); } });

  return {
    el,
    ptrAnbinden,
    get zeitraum() { return zeitraum; },
    /** Die Kachel "Zahlen" – dorthin legt sich eine frisch geprägte Münze (B12). */
    get kachelZahlen() { return kacheln.zahlen.el; },
    /** Von außen: Dieser Kauf wurde gerade von Hand eingetragen. Vor aktualisiere() rufen. */
    merkeEintrag(montag) {
      if (still() || gezeigt == null) return;
      if (feier && !feier.laeuft) { feier.von = "kaeufe"; feier.montag = montag; return; }
      if (feier) return;
      feier = { von: "kaeufe", montag, laeuft: false };
      plane();
    },
    /** Ruft f sofort – oder nach dem Funkenflug, falls gerade einer wartet oder läuft. */
    wennRuhig(f) { if (feier) nachFeier.push(f); else setTimeout(f, 300); },
    aktualisiere({ ersteMal = false } = {}) {
      const s = z.summe;
      const gez = gezaehlte();
      const klar = s.wert != null && !s.ohneKurs.length;
      if (gezeigt == null && klar && gez.length > 1 && !still()) {
        // Erster vollständiger Stand nach dem Öffnen: Ist seit dem letzten Besuch genau ein Kauf
        // dazugekommen, zeigen Wert und Kacheln zuerst den Stand davor – der Funke bringt den neuen.
        const gesehen = lies(SCHLUESSEL.ringeGesehen);
        if (Number.isInteger(gesehen) && gez.length === gesehen + 1) {
          zeigeOhne(gez[gez.length - 1]);
          gezeigt = gesehen;
        }
      }
      // Ein Kauf mehr als angezeigt (20:50 Uhr bei offener App oder seit dem letzten Besuch)?
      if (!feier && gezeigt != null && klar && gez.length === gezeigt + 1 && !still()) {
        feier = { von: "takt", montag: gez[gez.length - 1].montag, laeuft: false };
        plane();
      }
      if (feier) {
        // Wert und Kacheln warten auf den Funken. Nur das Nötigste läuft weiter.
        zeigeFuss();
        zeichneLinieWennNeu();
        if (ersteMal) { zeigeTakt(); markeFeder.springe(markeZiel()); aufgang(); }
        return;
      }
      zeigeAlles();
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

