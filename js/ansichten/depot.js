// =====================================================================
// depot.js – Die Startseite: Gruß, Depotwert, Verlauf, Kennzahlen,
// die Uhr bis zum nächsten Kauf und ein Blick auf deinen Baum.
// =====================================================================

import { h, fuelle, icon, wenigBewegung } from "../dom.js";
import { Zaehlwerk } from "../ui/zaehlwerk.js";
import { segment } from "../ui/segment.js";
import { sparkline, kloetzchen } from "../ui/sparkline.js";
import { beimSichtbarWerden } from "../ui/federwerk.js";
import { wertDiagramm, wochenDiagramm, satsDiagramm, diagrammeVerfuegbar } from "../diagramme.js";
import { wertverlauf, wochenZerlegung, zeitraumErgebnis, kursBei, naechsterKauf } from "../rechnen.js";
import { euro, prozent, sats, anzahl, datumLang, datumMonatKurz, uhrzeit, gruss } from "../format.js";
import { datumBerlin } from "../zeit.js";
import { ZEITPLAN } from "../konfig.js";
import { ladeEinstellungen } from "../speicher.js";
import { baumGeometrie, zeichneBaum } from "../jahresringe.js";
import { euroDarstellung, btcDarstellung, veraenderung, hinweis, leer } from "./gemeinsam.js";

const TAG = 86_400_000;
export const ZEITRAEUME = {
  woche: { text: "Woche", tage: 7, satz: "in den letzten 7 Tagen" },
  monat: { text: "Monat", tage: 30, satz: "in den letzten 30 Tagen" },
  jahr: { text: "Jahr", tage: 365, satz: "in den letzten 12 Monaten" },
  gesamt: { text: "Gesamt", tage: null, satz: "seit dem ersten Kauf" },
};

/** Kursreihe und Startkurs passend zum Zeitraum. */
export function zeitraumDaten(z, zr) {
  const jetzt = z.jetzt;
  const def = ZEITRAEUME[zr];
  const startTs = def.tage ? jetzt - def.tage * TAG : -Infinity;
  const stunden = z.reihen.monat?.punkte ?? [];
  const tage = z.tage?.punkte ?? [];
  let kurse; let kursZuBeginn = null;
  if (zr === "woche" || zr === "monat") {
    kurse = stunden.length ? stunden : tage;
    kursZuBeginn = kursBei(stunden, startTs) ?? kursBei(tage, startTs);
  } else {
    kurse = tage.length ? tage : stunden;
    if (def.tage) kursZuBeginn = kursBei(tage, startTs);
  }
  return { startTs, kurse, kursZuBeginn };
}

export function erstelleDepot(app) {
  const z = app.zustand;
  let zeitraum = "gesamt";
  let ansicht = "wert";
  let scrubbt = false;
  let letzteSignatur = "";

  // ---- Gruß ----
  const grussEl = h("p", { class: "gruss serif" });

  // ---- Hauptzahl ----
  const label = h("span", { class: "held-label label" }, "Depotwert");
  const zahlEl = h("span", { class: "held-zahl zahl-gross" });
  const hauptzahl = new Zaehlwerk(zahlEl, euroDarstellung(), { glimmen: true, einrollen: true });
  const zeile = h("span", { class: "held-zeile" });
  const held = h("button", { type: "button", class: "held", "aria-label": "So entsteht der Depotwert", onclick: () => app.oeffneRechenweg("wert", held) },
    label, zahlEl, zeile);

  // ---- Diagramm ----
  const leinwand = {
    wert: h("canvas", { class: "diagramm-canvas", role: "img", "aria-label": "Wert deines Depots und deine Einzahlungen im Verlauf" }),
    wochen: h("canvas", { class: "diagramm-canvas", role: "img", "aria-label": "Einzahlung und Kursbewegung je Woche", hidden: true }),
    sats: h("canvas", { class: "diagramm-canvas", role: "img", "aria-label": "Dein Bestand in Satoshi im Verlauf", hidden: true }),
  };
  const kapsel = h("span", { class: "scrub-kapsel", "aria-hidden": "true" });
  const puls = h("span", { class: "diagramm-puls", "aria-hidden": "true" });
  const flaeche = h("div", { class: "diagramm-flaeche" }, leinwand.wert, leinwand.wochen, leinwand.sats, puls, kapsel);
  const erklaerung = h("p", { class: "diagramm-erklaerung" });
  const REIHENFOLGE = ["wert", "wochen", "sats"];
  const ansichtWahl = segment({
    name: "Diagramm-Ansicht", klein: true, aktiv: ansicht,
    optionen: [{ wert: "wert", text: "Wert" }, { wert: "wochen", text: "Wochen" }, { wert: "sats", text: "Sats" }],
    beiWahl: (w) => {
      // gerichteter Wisch: die neue Ansicht kommt von der Seite, auf der ihr Knopf liegt
      const richtung = REIHENFOLGE.indexOf(w) > REIHENFOLGE.indexOf(ansicht) ? 1 : -1;
      ansicht = w;
      zeichneDiagramm(true);
      if (!wenigBewegung()) leinwand[w].animate([{ opacity: 0, transform: `translateX(${richtung * 36}px)`, filter: "blur(6px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 520, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    },
  });
  const zeitWahl = segment({
    name: "Zeitraum", aktiv: zeitraum,
    optionen: Object.entries(ZEITRAEUME).map(([wert, d]) => ({ wert, text: d.text })),
    beiWahl: (w) => { zeitraum = w; zeigeKopf(); zeichneDiagramm(true); },
  });

  let diagramme = null;
  const beimScrubben = (p, pos) => {
    scrubbt = p != null;
    hauptzahl.eilig = scrubbt;
    flaeche.classList.toggle("wird-gescrubbt", scrubbt);
    if (p) { zeigeScrub(p); setzeKapsel(p, pos); } else { kapsel.classList.remove("ist-sichtbar"); zeigeKopf(); }
  };
  // Der Herzschlag gehört nur zur gerade sichtbaren Linie – verborgene
  // Diagramme melden sich beim Größenwechsel auch, die werden ignoriert.
  const pulsVon = (art) => (pos) => { if (art === ansicht) setzePuls(pos); };
  const setzePuls = (pos) => {
    if (!pos) { puls.classList.remove("ist-sichtbar"); return; }
    puls.style.setProperty("left", `${pos.x}px`);
    puls.style.setProperty("top", `${pos.y}px`);
    puls.classList.add("ist-sichtbar");
  };
  if (diagrammeVerfuegbar()) {
    diagramme = {
      wert: wertDiagramm(leinwand.wert, beimScrubben, pulsVon("wert")),
      wochen: wochenDiagramm(leinwand.wochen, beimScrubben),
      sats: satsDiagramm(leinwand.sats, beimScrubben, pulsVon("sats")),
    };
  }

  function setzeKapsel(p, pos) {
    if (!pos) return;
    let text;
    if (ansicht === "wochen") text = `ab ${datumMonatKurz(p.montag)}`;
    else if (p.jetzt) text = "Jetzt";
    else text = `${datumMonatKurz(datumBerlin(p.t))}${zeitraum === "woche" || p.kauf ? ` · ${uhrzeit(p.t)}` : ""}`;
    kapsel.textContent = text;
    const b = flaeche.clientWidth;
    const breite = kapsel.offsetWidth || 80;
    kapsel.style.setProperty("left", `${Math.max(breite / 2 + 4, Math.min(b - breite / 2 - 4, pos.x))}px`);
    kapsel.classList.toggle("ist-kauf", Boolean(p.kauf));
    kapsel.classList.add("ist-sichtbar");
  }

  const diagramm = h("div", { class: "diagramm" },
    h("div", { class: "diagramm-kopf" }, ansichtWahl.el),
    flaeche, erklaerung);

  // ---- Hinweise, Kennzahlen, Uhr, Baum ----
  const hinweise = h("div", { class: "hinweise" });
  const kennzahlen = h("div", { class: "raster-2 kennzahlen" });
  const kacheln = {};
  const kachel = (art, titel, darstellen, klasse = "") => {
    const wert = h("span", { class: ["kennzahl-wert", klasse] });
    const unter = h("span", { class: "kennzahl-unter" });
    const grafik = h("span", { class: "kennzahl-grafik" });
    const el = h("button", { type: "button", class: "karte karte--glanz kennzahl tippbar impuls", onclick: (e) => app.oeffneRechenweg(art, e.currentTarget) },
      h("span", { class: "label" }, titel), wert, unter, grafik);
    kacheln[art] = { el, zahl: new Zaehlwerk(wert, darstellen, { einrollen: true }), unter, grafik };
    return el;
  };
  kennzahlen.append(
    kachel("investiert", "Investiert", euroDarstellung()),
    kachel("bestand", "Bestand · BTC", btcDarstellung(), "kennzahl-wert--btc"),
    kachel("durchschnitt", "Ø Kaufpreis", euroDarstellung(false, 0)),
    kachel("kurs", "Bitcoin", euroDarstellung(false, 0)),
  );

  // Die Uhr bis zum nächsten Kauf: tickt sekundengenau wie ein mechanisches Werk
  const uhrZiel = h("p", { class: "uhr-ziel" });
  const uhrZahl = h("span", { class: "uhr-zahl" });
  const uhr = new Zaehlwerk(uhrZahl, (sek) => {
    if (sek == null) return [["ganz", "–"]];
    const t = Math.floor(sek / 86400); const st = Math.floor((sek % 86400) / 3600);
    const m = Math.floor((sek % 3600) / 60); const s = Math.floor(sek % 60);
    const zz = (x) => String(x).padStart(2, "0");
    return [["ganz", String(t)], ["einheit", " T "], ["ganz", zz(st)], ["trenner", ":"], ["ganz", zz(m)], ["trenner", ":"], ["ganz", zz(s)]];
  });
  const uhrKarte = h("section", { class: "karte karte--glanz uhr-karte" },
    h("div", { class: "uhr-kopf" }, h("span", { class: "label" }, "Nächster Kauf"), h("span", { class: "uhr-lampe", "aria-hidden": "true" })),
    uhrZahl, uhrZiel);

  const baumLeinwand = h("canvas", { class: "baum-vorschau", "aria-hidden": "true" });
  const baumText = h("span", { class: "baum-vorschau-text" });
  const baumKarte = h("button", { type: "button", class: "karte karte--glanz baum-karte tippbar impuls", onclick: () => app.wechsleSeite(3) },
    baumLeinwand, h("span", { class: "baum-vorschau-inhalt" }, h("span", { class: "label" }, "Dein Baum"), baumText, h("span", { class: "baum-vorschau-los" }, "Ansehen", icon("pfeilRechts", { groesse: 16, strich: 2 }))));

  const fuss = h("p", { class: "fusszeile" });
  const unten = h("div", { class: "depot-unten" }, uhrKarte, baumKarte);

  const el = h("div", { class: "seite-inhalt" }, grussEl, held, diagramm, h("div", { class: "zeitraum" }, zeitWahl.el), hinweise, kennzahlen, unten, fuss);
  beimSichtbarWerden([kennzahlen, unten]);

  // -------------------------------------------------------------------

  function zeigeKopf() {
    if (scrubbt) return;
    const s = z.summe;
    label.textContent = "Depotwert";
    hauptzahl.darstellen = euroDarstellung();
    hauptzahl.setze(s.anzahl ? s.wert : null);
    if (!s.anzahl) { fuelle(zeile, h("span", { class: "text-3" }, "Noch kein Kauf")); return; }
    if (s.wert == null) { fuelle(zeile, h("span", { class: "skelett", style: { width: "9em", height: "1em" } })); return; }
    const d = zeitraumDaten(z, zeitraum);
    const r = zeitraum === "gesamt"
      ? { veraenderung: s.gv, prozent: s.gvProzent }
      : zeitraumErgebnis({ kaeufe: z.kaeufe, aktuellerKurs: z.aktuell?.kurs, jetzt: z.jetzt, startTs: d.startTs, kursZuBeginn: d.kursZuBeginn });
    fuelle(zeile,
      r ? veraenderung(r.veraenderung, r.prozent) : h("span", { class: "text-3" }, "Kurs zu Beginn noch nicht geladen"),
      h("span", { class: "held-zeitraum" }, ZEITRAEUME[zeitraum].satz));
  }

  function zeigeScrub(p) {
    if (ansicht === "wochen") {
      label.textContent = `Woche ab ${datumMonatKurz(p.montag)}${p.laufend ? " · läuft" : ""}`;
      hauptzahl.darstellen = euroDarstellung(true);
      hauptzahl.setze(p.kurseffekt);
      fuelle(zeile, h("span", { class: "text-2" }, `Einzahlung ${euro(p.einzahlung)}`), h("span", { class: "text-3" }, ` · Kursbewegung ${prozent(p.prozent)}`));
      return;
    }
    const tag = datumBerlin(p.t);
    label.textContent = p.jetzt ? "Jetzt" : datumLang(tag);
    hauptzahl.darstellen = euroDarstellung();
    hauptzahl.setze(p.wert);
    if (ansicht === "sats") {
      fuelle(zeile, h("span", { class: "text-2" }, `${sats(p.btc * 1e8)} sats`), p.kauf ? h("span", { class: "text-3" }, ` · Kauf Nr. ${p.kauf.nr}: +${sats(p.kauf.btc * 1e8)}`) : null);
      return;
    }
    fuelle(zeile,
      veraenderung(p.wert - p.investiert, p.investiert > 0 ? ((p.wert - p.investiert) / p.investiert) * 100 : null, { klein: true }),
      h("span", { class: "held-zeitraum" }, p.kauf ? `Kauf Nr. ${p.kauf.nr} · investiert ${euro(p.investiert, 0)}` : `investiert ${euro(p.investiert, 0)}`));
  }

  function zeichneDiagramm(einzeichnen) {
    flaeche.classList.remove("ist-leer");
    flaeche.querySelector(".leer")?.remove();
    setzePuls(null);
    const s = z.summe;
    if (!diagramme) { flaeche.append(leer({ titel: "Diagramm nicht verfügbar", text: "Die Diagramm-Bibliothek konnte nicht geladen werden. Die Zahlen oben stimmen trotzdem.", symbol: "info" })); flaeche.classList.add("ist-leer"); return; }
    if (!s.anzahl) {
      flaeche.classList.add("ist-leer");
      flaeche.append(leer({ titel: "Hier wächst dein Verlauf", text: "Mit dem ersten Kauf beginnt die Linie. Jede Woche kommt eine Stufe dazu.", symbol: "depot" }));
      return;
    }
    const d = zeitraumDaten(z, zeitraum);
    erklaerung.textContent = "";
    for (const [name, c] of Object.entries(leinwand)) c.hidden = name !== ansicht;
    for (const dg of Object.values(diagramme)) dg.ende();
    if (ansicht === "wochen") {
      let w = wochenZerlegung(z.kaeufe, z.aktuell?.kurs, z.jetzt);
      if (d.startTs > -Infinity) w = w.filter((x) => x.bis > d.startTs);
      diagramme.wochen.zeige(w, { einzeichnen });
      erklaerung.textContent = "Grau: deine Einzahlung – jede Woche genau gleich groß. Farbig: was der Kurs in dieser Woche mit deinem ganzen Bestand gemacht hat.";
    } else {
      const punkte = wertverlauf({ kaeufe: z.kaeufe, kurse: d.kurse, aktuellerKurs: z.aktuell?.kurs, jetzt: z.jetzt, von: d.startTs });
      if (punkte.length < 2) { flaeche.classList.add("ist-leer"); flaeche.append(leer({ titel: "Kurse werden geladen", text: "Sobald der Verlauf da ist, erscheint er hier.", symbol: "depot" })); return; }
      if (ansicht === "sats") {
        diagramme.sats.zeige(punkte, { einzeichnen });
        erklaerung.textContent = "Dein Bestand in Satoshi (1 BTC = 100 Mio sats). Er wächst mit jedem Kauf – egal, wie der Kurs steht.";
      } else {
        diagramme.wert.zeige(punkte, { einzeichnen });
        erklaerung.textContent = "Die graue Treppe sind deine Einzahlungen: jede Stufe 15 €. Die Linie ist der Wert. Die Fläche dazwischen ist dein Gewinn oder Verlust.";
      }
    }
  }

  function zeigeKennzahlen() {
    const s = z.summe;
    const kauf = z.kaeufe.filter((k) => k.gezaehlt);
    let summe = 0; let lauf = 0;
    const satsVerlauf = kauf.map((k) => (summe += k.btc * 1e8));
    const avgVerlauf = kauf.map((k, i) => { lauf += k.btc; return ((i + 1) * 15) / lauf; });
    const woche = (z.reihen.monat?.punkte ?? []).filter((p) => p.t >= z.jetzt - 7 * TAG).map((p) => p.c);
    const geschaetzt = s.geschaetzt.length;
    const ae = z.aktuell?.aenderung24h;

    kacheln.investiert.zahl.setze(s.investiert);
    fuelle(kacheln.investiert.unter, `${anzahl(s.anzahl, "Kauf", "Käufe")} à 15 €${geschaetzt ? ` · ${geschaetzt} geschätzt` : ""}`);
    fuelle(kacheln.investiert.grafik, kloetzchen(s.anzahl));
    kacheln.bestand.zahl.setze(s.btc);
    fuelle(kacheln.bestand.unter, `${sats(s.sats)} sats`);
    fuelle(kacheln.bestand.grafik, sparkline(satsVerlauf, { farbe: "var(--akzent)", stufen: true }));
    kacheln.durchschnitt.zahl.setze(s.durchschnitt);
    fuelle(kacheln.durchschnitt.unter, "inkl. Gebühren");
    fuelle(kacheln.durchschnitt.grafik, sparkline(avgVerlauf, { farbe: "var(--text-2)", flaeche: false }));
    kacheln.kurs.zahl.setze(z.aktuell?.kurs ?? null);
    fuelle(kacheln.kurs.unter, ae != null ? veraenderung(null, ae, { klein: true }) : (z.aktuell ? "24 h: –" : "lädt …"), ae != null ? h("span", { class: "text-3" }, " 24 h") : null);
    fuelle(kacheln.kurs.grafik, sparkline(woche, { farbe: "var(--text-2)" }));
  }

  function zeigeHinweise() {
    const s = z.summe;
    const liste = [];
    for (const k of s.ausstehend) {
      liste.push(hinweis({
        symbol: "uhr", titel: `Heute ${String(k.stunde).padStart(2, "0")}:${String(k.minute).padStart(2, "0")} Uhr kauft dein Sparplan`,
        text: "Bis dahin zählt diese Woche noch nicht mit – die Zahlen oben sind schon richtig.",
      }));
    }
    if (s.geschaetzt.length) {
      const neuester = s.geschaetzt[s.geschaetzt.length - 1];
      liste.push(hinweis({
        symbol: "stift", art: "aktion",
        titel: s.geschaetzt.length === 1 ? `Kauf vom ${datumMonatKurz(neuester.montag)} ist geschätzt` : `${s.geschaetzt.length} Käufe sind geschätzt`,
        text: "Trag die echte Menge aus Bitvavo ein, dann stimmt es aufs Satoshi.",
        aktion: h("button", { type: "button", class: "knopf knopf--klein knopf--primaer impuls", onclick: (e) => app.eintragen(neuester.montag, e.currentTarget) }, h("span", null, "Eintragen")),
      }));
    }
    if (s.ohneKurs.length) {
      liste.push(hinweis({ symbol: "offline", titel: `${anzahl(s.ohneKurs.length, "Kauf wartet", "Käufe warten")} auf einen Kurs`, text: "Sie zählen mit, sobald eine Kursquelle antwortet – oder du trägst sie selbst ein." }));
    }
    if (z.abgleich?.abweichungen?.length) {
      liste.push(hinweis({
        symbol: "info", titel: "Abweichung zur alten App",
        text: `Für ${z.abgleich.abweichungen.map((m) => datumMonatKurz(m)).join(", ")} stehen in der alten App andere Werte. Hier gilt dein Eintrag.`,
        aktion: h("button", { type: "button", class: "knopf knopf--klein impuls", onclick: () => app.oeffneEinstellungen("daten") }, h("span", null, "Ansehen")),
      }));
    }
    fuelle(hinweise, liste);
  }

  // Uhr bis zum nächsten Kauf
  let naechster = null;
  function zeigeUhr() {
    naechster = naechsterKauf(ZEITPLAN, Date.now());
    uhrZiel.textContent = naechster ? `${datumLang(naechster.montag)} · ${uhrzeit(naechster.ts)} Uhr` : "Kein weiterer Kauf geplant";
    if (naechster) uhr.setze(Math.floor(Math.max(0, (naechster.ts - Date.now()) / 1000)), { sofort: true });
  }
  setInterval(() => {
    if (document.hidden || !naechster) return;
    const rest = Math.max(0, (naechster.ts - Date.now()) / 1000);
    uhr.setze(Math.floor(rest));
    if (rest <= 0) zeigeUhr();
  }, 1000);

  // Baum-Vorschau
  let baumSig = "";
  function zeigeBaum() {
    const kauf = z.kaeufe.filter((k) => k.gezaehlt);
    baumText.textContent = kauf.length ? `${anzahl(kauf.length, "Ring", "Ringe")} – einer für jeden Kauf.` : "Wächst mit dem ersten Kauf.";
    const sig = kauf.map((k) => k.btc.toFixed(8)).join();
    if (sig === baumSig || !kauf.length) return;
    baumSig = sig;
    requestAnimationFrame(() => {
      const r = baumLeinwand.getBoundingClientRect();
      if (!r.width) { baumSig = ""; return; }
      const dpr = Math.min(2, devicePixelRatio || 1);
      baumLeinwand.width = r.width * dpr; baumLeinwand.height = r.height * dpr;
      const ctx = baumLeinwand.getContext("2d");
      ctx.scale(dpr, dpr);
      zeichneBaum(ctx, baumGeometrie(kauf), { cx: r.width / 2, cy: r.height / 2, R: Math.min(r.width, r.height) * 0.44, atem: 0.8 });
    });
  }

  function zeigeFuss() {
    const a = z.aktuell;
    fuss.textContent = a ? `Kurs: ${a.quelle} · ${z.aktuellFrisch ? "Stand" : "zuletzt"} ${uhrzeit(a.zeit)} Uhr · Keine Anlageberatung.` : "Keine Anlageberatung.";
  }

  return {
    el,
    aktualisiere({ ersteMal = false } = {}) {
      const name = ladeEinstellungen().name;
      grussEl.textContent = `${gruss()}${name ? `, ${name}` : ""}.`;
      zeigeKopf();
      zeigeKennzahlen();
      zeigeHinweise();
      zeigeUhr();
      zeigeBaum();
      zeigeFuss();
      const sig = [z.summe.anzahl, z.summe.btc, z.reihen.monat?.zeit, z.tage?.punkte?.length, z.aktuell?.kurs].join("|");
      if (sig !== letzteSignatur) {
        const neu = !letzteSignatur || ersteMal;
        letzteSignatur = sig;
        if (!scrubbt) zeichneDiagramm(neu);
      }
    },
    get zeitraum() { return zeitraum; },
  };
}
