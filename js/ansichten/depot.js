// =====================================================================
// depot.js – Die Startseite: Depotwert, Verlauf, Kennzahlen.
// =====================================================================

import { h, fuelle } from "../dom.js";
import { Zahl } from "../ui/zahl.js";
import { segment } from "../ui/segment.js";
import { sparkline, kloetzchen } from "../ui/sparkline.js";
import { wertDiagramm, wochenDiagramm, satsDiagramm, diagrammeVerfuegbar } from "../diagramme.js";
import { wertverlauf, wochenZerlegung, zeitraumErgebnis, kursBei } from "../rechnen.js";
import { euro, prozent, sats, anzahl, datumLang, datumMonatKurz, uhrzeit } from "../format.js";
import { datumBerlin } from "../zeit.js";
import { ZITATE, zitatDesTages } from "../zitate.js";
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

  // ---- Hauptzahl ----
  const label = h("span", { class: "held-label label" }, "Depotwert");
  const zahlEl = h("span", { class: "held-zahl zahl-gross" });
  const hauptzahl = new Zahl(zahlEl, euroDarstellung());
  const zeile = h("span", { class: "held-zeile" });
  const held = h("button", { type: "button", class: "held tippbar", "aria-label": "So entsteht der Depotwert", onclick: () => app.oeffneRechenweg("wert", held) },
    h("span", { class: "held-aurora", "aria-hidden": "true" }, h("span"), h("span"), h("span")),
    label, zahlEl, zeile);

  // ---- Diagramm ----
  // Je Ansicht eine eigene Zeichenfläche; sichtbar ist immer nur eine.
  const leinwand = {
    wert: h("canvas", { class: "diagramm-canvas", role: "img", "aria-label": "Wert deines Depots und deine Einzahlungen im Verlauf" }),
    wochen: h("canvas", { class: "diagramm-canvas", role: "img", "aria-label": "Einzahlung und Kursbewegung je Woche", hidden: true }),
    sats: h("canvas", { class: "diagramm-canvas", role: "img", "aria-label": "Dein Bestand in Satoshi im Verlauf", hidden: true }),
  };
  const flaeche = h("div", { class: "diagramm-flaeche" }, leinwand.wert, leinwand.wochen, leinwand.sats);
  const erklaerung = h("p", { class: "diagramm-erklaerung" });
  const ansichtWahl = segment({
    name: "Diagramm-Ansicht", klein: true, aktiv: ansicht,
    optionen: [{ wert: "wert", text: "Wert" }, { wert: "wochen", text: "Wochen" }, { wert: "sats", text: "Sats" }],
    beiWahl: (w) => { ansicht = w; zeichneDiagramm(true); },
  });
  const zeitWahl = segment({
    name: "Zeitraum", aktiv: zeitraum,
    optionen: Object.entries(ZEITRAEUME).map(([wert, d]) => ({ wert, text: d.text })),
    beiWahl: (w) => { zeitraum = w; zeigeKopf(); zeichneDiagramm(true); },
  });

  let diagramme = null;
  const beimScrubben = (p) => { scrubbt = p != null; if (p) zeigeScrub(p); else zeigeKopf(); };
  if (diagrammeVerfuegbar()) {
    diagramme = { wert: wertDiagramm(leinwand.wert, beimScrubben), wochen: wochenDiagramm(leinwand.wochen, beimScrubben), sats: satsDiagramm(leinwand.sats, beimScrubben) };
  }

  const diagramm = h("div", { class: "diagramm" },
    h("div", { class: "diagramm-kopf" }, ansichtWahl.el),
    flaeche, erklaerung);

  // ---- Hinweise, Kennzahlen, Zitat ----
  const hinweise = h("div", { class: "hinweise" });
  const kennzahlen = h("div", { class: "raster-2 kennzahlen" });
  const zitatText = h("span", { class: "zitat-klein-text" });
  const zitatAutor = h("span", { class: "zitat-klein-autor" });
  const zitat = h("button", { type: "button", class: "zitat-klein tippbar", "aria-label": "Zum Gedanken des Tages", onclick: () => app.wechsleSeite(3) }, zitatText, zitatAutor);
  const fuss = h("p", { class: "fusszeile" });

  const el = h("div", { class: "seite-inhalt" }, held, diagramm, h("div", { class: "zeitraum" }, zeitWahl.el), hinweise, kennzahlen, zitat, fuss);

  // -------------------------------------------------------------------

  let vorzeichenAn = false;
  function mitVorzeichen(an) {
    if (an === vorzeichenAn) return;
    vorzeichenAn = an;
    hauptzahl.darstellen = euroDarstellung(an);
    hauptzahl.zeichne(hauptzahl.wert);
  }

  function zeigeKopf() {
    if (scrubbt) return;
    const s = z.summe;
    label.textContent = "Depotwert";
    mitVorzeichen(false);
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
      mitVorzeichen(true);
      hauptzahl.setze(p.kurseffekt, { sofort: true });
      fuelle(zeile, h("span", { class: "text-2" }, `Einzahlung ${euro(p.einzahlung)}`), h("span", { class: "text-3" }, ` · Kursbewegung ${prozent(p.prozent)}`));
      return;
    }
    const tag = datumBerlin(p.t);
    const zeitText = p.jetzt ? "Jetzt" : `${datumLang(tag)}${zeitraum === "woche" || zeitraum === "monat" || p.kauf ? `, ${uhrzeit(p.t)}` : ""}`;
    if (ansicht === "sats") {
      label.textContent = zeitText;
      hauptzahl.setze(p.wert, { sofort: true });
      fuelle(zeile, h("span", { class: "text-2" }, `${sats(p.btc * 1e8)} sats`), p.kauf ? h("span", { class: "text-3" }, ` · Kauf Nr. ${p.kauf.nr}: +${sats(p.kauf.btc * 1e8)}`) : null);
      return;
    }
    label.textContent = zeitText;
    hauptzahl.setze(p.wert, { sofort: true });
    fuelle(zeile,
      veraenderung(p.wert - p.investiert, p.investiert > 0 ? ((p.wert - p.investiert) / p.investiert) * 100 : null, { klein: true }),
      h("span", { class: "held-zeitraum" }, p.kauf ? `Kauf Nr. ${p.kauf.nr} · investiert ${euro(p.investiert, 0)}` : `investiert ${euro(p.investiert, 0)}`));
  }

  function zeichneDiagramm(einzeichnen) {
    flaeche.classList.remove("ist-leer");
    flaeche.querySelector(".leer")?.remove();
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
        diagramme.wert.zeige(punkte, { mitUhrzeit: false, einzeichnen });
        erklaerung.textContent = "Die graue Treppe sind deine Einzahlungen: jede Stufe 15\u00A0€. Die Linie ist der Wert. Die Fläche dazwischen ist dein Gewinn oder Verlust.";
      }
    }
  }

  function zeigeKennzahlen() {
    const s = z.summe;
    const kauf = z.kaeufe.filter((k) => k.gezaehlt);
    const kachel = (art, titel, wertEl, unter, grafik) => h("button", { type: "button", class: "karte kennzahl tippbar", onclick: (e) => app.oeffneRechenweg(art, e.currentTarget) },
      h("span", { class: "label" }, titel), wertEl, h("span", { class: "kennzahl-unter" }, unter), grafik ? h("span", { class: "kennzahl-grafik" }, grafik) : null);

    const inv = h("span", { class: "kennzahl-wert" }); new Zahl(inv, euroDarstellung()).setze(s.investiert);
    const best = h("span", { class: "kennzahl-wert kennzahl-wert--btc" }); new Zahl(best, btcDarstellung()).setze(s.btc);
    const avg = h("span", { class: "kennzahl-wert" }); new Zahl(avg, euroDarstellung(false, 0)).setze(s.durchschnitt);
    const kurs = h("span", { class: "kennzahl-wert" }); new Zahl(kurs, euroDarstellung(false, 0)).setze(z.aktuell?.kurs ?? null);

    let summe = 0; let lauf = 0;
    const satsVerlauf = kauf.map((k) => (summe += k.btc * 1e8));
    const avgVerlauf = kauf.map((k, i) => { lauf += k.btc; return ((i + 1) * 15) / lauf; });
    const woche = (z.reihen.monat?.punkte ?? []).filter((p) => p.t >= z.jetzt - 7 * TAG).map((p) => p.c);

    const geschaetzt = s.geschaetzt.length;
    const ae = z.aktuell?.aenderung24h;
    fuelle(kennzahlen,
      kachel("investiert", "Investiert", inv, `${anzahl(s.anzahl, "Kauf", "Käufe")} à 15 €${geschaetzt ? ` · ${geschaetzt} geschätzt` : ""}`, kloetzchen(s.anzahl)),
      kachel("bestand", "Bestand", best, `${sats(s.sats)} sats`, sparkline(satsVerlauf, { farbe: "var(--akzent)", stufen: true })),
      kachel("durchschnitt", "Ø Kaufpreis", avg, "inkl. Gebühren", sparkline(avgVerlauf, { farbe: "var(--text-2)", flaeche: false })),
      kachel("kurs", "Bitcoin", kurs, ae != null ? veraenderung(null, ae, { klein: true }) : (z.aktuell ? "24 h: –" : "lädt …"), sparkline(woche, { farbe: "var(--text-2)" })),
    );
    if (ae != null) kennzahlen.lastElementChild.querySelector(".kennzahl-unter").append(h("span", { class: "text-3" }, " 24 h"));
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
        aktion: h("button", { type: "button", class: "knopf knopf--klein knopf--primaer", onclick: (e) => app.eintragen(neuester.montag, e.currentTarget) }, "Eintragen"),
      }));
    }
    if (s.ohneKurs.length) {
      liste.push(hinweis({ symbol: "offline", titel: `${anzahl(s.ohneKurs.length, "Kauf wartet", "Käufe warten")} auf einen Kurs`, text: "Sie zählen mit, sobald eine Kursquelle antwortet – oder du trägst sie selbst ein." }));
    }
    if (z.abgleich?.abweichungen?.length) {
      liste.push(hinweis({
        symbol: "info", titel: "Abweichung zur alten App",
        text: `Für ${z.abgleich.abweichungen.map((m) => datumMonatKurz(m)).join(", ")} stehen in der alten App andere Werte. Hier gilt dein Eintrag.`,
        aktion: h("button", { type: "button", class: "knopf knopf--klein", onclick: () => app.oeffneEinstellungen("daten") }, "Ansehen"),
      }));
    }
    fuelle(hinweise, liste);
  }

  function zeigeZitat() {
    const i = zitatDesTages(datumBerlin(z.jetzt));
    zitatText.textContent = `„${ZITATE[i].t}“`;
    zitatAutor.textContent = ZITATE[i].a;
  }

  function zeigeFuss() {
    const a = z.aktuell;
    fuss.textContent = a ? `Kurs: ${a.quelle} · ${z.aktuellFrisch ? "Stand" : "zuletzt"} ${uhrzeit(a.zeit)} Uhr · Keine Anlageberatung.` : "Keine Anlageberatung.";
  }

  return {
    el,
    aktualisiere({ ersteMal = false } = {}) {
      zeigeKopf();
      zeigeKennzahlen();
      zeigeHinweise();
      zeigeZitat();
      zeigeFuss();
      // Diagramm nur neu einzeichnen, wenn sich die Grundlage geändert hat
      const sig = [z.summe.anzahl, z.summe.btc, z.reihen.monat?.zeit, z.tage?.punkte?.length, z.aktuell?.kurs].join("|");
      if (sig !== letzteSignatur) {
        const neu = !letzteSignatur || ersteMal;
        letzteSignatur = sig;
        if (!scrubbt) zeichneDiagramm(neu);
      }
    },
    /** Für die Detailansicht "So rechnet die App" */
    get zeitraum() { return zeitraum; },
  };
}
