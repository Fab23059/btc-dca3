// =====================================================================
// zahlen.js – Das Fenster "Zahlen": was dein Plan geleistet hat,
// nachgerechnet und ruhig gesetzt. Keine Kärtchen-Wand, sondern
// Typografie mit je einer kleinen Grafik.
//
// Bewegung: Der Kopf rollt bei der Zeitreise mit (alle vier Zahlen zum
// damaligen Stand). Beim Öffnen laufen die Balken einmal auf.
// Jede Zahl lässt sich antippen und zeigt ihre Rechnung.
// =====================================================================

import { h, svg, fuelle, wenigBewegung } from "../dom.js";
import { Ziffern } from "../bewegung/ziffern.js";
import { Feder } from "../bewegung/feder.js";
import { entfalte } from "../teile/fenster.js";
import { SPARRATE_EUR } from "../konfig.js";
import { durchhalten, haltefrist, rueckgang, meilensteine, zielName, dcaBilanz, SATS_ZIELE, WOCHEN_ZIELE } from "../kennzahlen.js";
import { holeBlockZurZeit } from "../kurse.js";
import { euro, sats, zahl, ganz, anzahl, datumLang, datumMonatKurz, datum, monatsname, MINUS } from "../format.js";
import { datumBerlin, zerlege } from "../zeit.js";
import { euroTeile, ganzTeile, kopfPlus } from "./gemeinsam.js";

const MENSCHEN = 8.2e9;                       // Weltbevölkerung 2026 (UN, gerundet)
const FAIRER_ANTEIL = (21_000_000 * 1e8) / MENSCHEN;

/** 231.599 → "232k", 1.234.000 → "1,23 Mio" */
const kurzSats = (n) => (n >= 1e6 ? `${zahl(n / 1e6, 2)} Mio` : `${Math.ceil(n / 1000)}k`);

/** Stand zu einem Zeitpunkt (für Kopf und Zeitreise). */
function standBis(z, t) {
  const gez = z.kaeufe.filter((k) => k.gezaehlt && (t == null || k.ts <= t));
  const btc = gez.reduce((s, k) => s + k.btc, 0);
  const investiert = gez.reduce((s, k) => s + k.brutto, 0);
  const wochen = z.kaeufe.filter((k) => k.status !== "ausstehend" && (t == null || k.ts <= t)).length;
  return { investiert, sats: btc * 1e8, durchschnitt: btc > 0 ? investiert / btc : null, wochen };
}

export function zahlenKopf(app, { offen = false } = {}) {
  const z = app.zustand;
  const feld = (titel, teile, art) => {
    const wert = h("span", { class: "zk-wert" });
    const werk = new Ziffern(wert, { teile });
    const el = offen
      ? h("button", { type: "button", class: "zk-feld tippbar", "aria-label": `${titel} – Rechnung zeigen`, onclick: (e) => app.oeffneRechenweg(art, e.currentTarget) }, h("span", { class: "zk-titel" }, titel), wert)
      : h("span", { class: "zk-feld" }, h("span", { class: "zk-titel" }, titel), wert);
    return { el, werk };
  };
  const f = {
    investiert: feld("Eingezahlt", euroTeile({ stellen: 0 }), "investiert"),
    sats: feld("Bestand", ganzTeile(" sats"), "bestand"),
    durchschnitt: feld("Ø Kaufpreis", euroTeile({ stellen: 0 }), "durchschnitt"),
    wochen: feld("Wochen in Folge", ganzTeile(""), "investiert"),
  };
  const el = h("div", { class: "fkopf fkopf--zahlen" },
    h("h2", { class: "fkopf-titel" }, "Zahlen"),
    h("p", { class: "fkopf-unter" }, "Nachgerechnet, nicht bewertet"),
    kopfPlus(),
    h("div", { class: "zk-raster" }, ...Object.values(f).map((x) => x.el)));
  let zeit = null; let erstes = true;
  const zeige = () => {
    const s = standBis(z, zeit);
    for (const x of Object.values(f)) x.werk.eilig = zeit != null;
    const o = { einrollen: erstes && offen };
    f.investiert.werk.setze(s.investiert, o);
    f.sats.werk.setze(s.sats, o);
    f.durchschnitt.werk.setze(s.durchschnitt, o);
    f.wochen.werk.setze(s.wochen, o);
    erstes = false;
  };
  return {
    el,
    aktualisiere() { zeige(); },
    zeitreise(info) { zeit = info?.t ?? null; zeige(); },
  };
}

/** Ein Balken, der beim Öffnen einmal aufläuft (nur transform). */
function balken(anteil, { marke = null, art = "" } = {}) {
  const fuellung = h("span", { class: "zb-fuellung" });
  const el = h("span", { class: ["zb", art && `zb--${art}`], "aria-hidden": "true" }, fuellung,
    marke != null ? h("span", { class: "zb-marke", style: { left: `${Math.min(100, marke * 100)}%` } }) : null);
  const ziel = Math.max(0, Math.min(1, anteil));
  const f = new Feder(0, { art: "raum", genau: 0.001, beiWert: (x) => { fuellung.style.transform = `scaleX(${x.toFixed(4)})`; } });
  return { el, los: () => (wenigBewegung() ? f.springe(ziel) : f.zu(ziel)) };
}

const abschnitt = (titel, ...inhalt) => h("section", { class: "zahl-abschnitt" }, h("h3", { class: "zahl-abschnitt-titel" }, titel), ...inhalt);
const gross = (...t) => h("p", { class: "zahl-gross zahl" }, ...t);
const satz = (...t) => h("p", { class: "zahl-satz" }, ...t);
const klein = (...t) => h("p", { class: "fussnote" }, ...t);

export function oeffneZahlen(app, herkunft) {
  const z = app.zustand;
  const kopf = zahlenKopf(app, { offen: true });
  const koerper = h("div", { class: "zahlen-koerper" });
  const inhalt = h("div", { class: "fenster-zahlen" }, kopf.el, koerper);
  const laeufer = [];

  function baue() {
    laeufer.length = 0;
    kopf.aktualisiere();
    const s = z.summe;
    const teile = [];

    // ---- Durchhalten ----
    const d = durchhalten(z.kaeufe, z.jetzt);
    const m = meilensteine(z.kaeufe, z.aktuell?.kurs, SPARRATE_EUR);
    const punkte = z.kaeufe.map((k) => h("span", { class: `wochenpunkt wochenpunkt--${k.status}` }));
    teile.push(abschnitt("Durchhalten",
      gross(`${d.wochenInFolge}`, h("span", { class: "zahl-einheit" }, d.wochenInFolge === 1 ? " Woche" : " Wochen")),
      h("div", { class: "wochenpunkte", "aria-hidden": "true" }, punkte),
      satz(d.seit ? `Seit ${datumLang(d.seit, true)} keine Woche ausgelassen.` : "Beginnt mit dem ersten Kauf.",
        m.naechsteWoche ? ` Nächster Halt: ${m.naechsteWoche.ziel} Wochen, noch ${m.naechsteWoche.noch}.` : "")));

    // ---- Verteilt gekauft (DCA-Bilanz) ----
    const bil = dcaBilanz(z.kaeufe, z.aktuell?.kurs, z.jetzt);
    if (bil && bil.anzahl >= 2) {
      const besser = (bil.vorteil ?? bil.vorteilSats) >= 0;
      teile.push(abschnitt("Verteilt gekauft",
        bil.vorteil != null
          ? gross(`${bil.vorteil >= 0 ? "+" : MINUS}${zahl(Math.abs(bil.vorteil), 2)}`, h("span", { class: "zahl-einheit" }, " € durch Verteilen"))
          : gross(`${besser ? "+" : MINUS}${sats(Math.abs(bil.vorteilSats))}`, h("span", { class: "zahl-einheit" }, " sats durch Verteilen")),
        satz(`Hättest du alle ${euro(bil.investiert, 0)} gleich am ${datumLang(bil.erster.montag)} auf einmal gekauft, hättest du ${sats(bil.einmalBtc * 1e8)} sats${bil.einmalWert != null ? ` – heute ${euro(bil.einmalWert)} wert` : ""}. Mit deinem Sparplan sind es ${sats(bil.btc * 1e8)} sats${bil.wert != null ? `, also ${euro(bil.wert)}` : ""}. ${besser ? "Verteilt zu kaufen hat sich bisher gelohnt." : "Bisher wäre die Einmalanlage vorn gewesen – das dreht sich oft, wenn der Kurs zwischendurch fällt."}`),
        h("div", { class: "mk-raster" },
          h("div", { class: "mk-feld" }, h("span", { class: "zk-titel" }, "Käufe"), h("span", { class: "mk-feld-wert zahl" }, ganz(bil.anzahl))),
          h("div", { class: "mk-feld" }, h("span", { class: "zk-titel" }, "Tage dabei"), h("span", { class: "mk-feld-wert zahl" }, ganz(bil.tage))),
          h("div", { class: "mk-feld" }, h("span", { class: "zk-titel" }, "Günstigster Kauf"), h("span", { class: "mk-feld-wert zahl" }, euro(bil.guenstigster.kurs, 0)), h("span", { class: "mk-feld-unter" }, `am ${datumMonatKurz(bil.guenstigster.montag)}`)),
          h("div", { class: "mk-feld" }, h("span", { class: "zk-titel" }, "Teuerster Kauf"), h("span", { class: "mk-feld-wert zahl" }, euro(bil.teuerster.kurs, 0)), h("span", { class: "mk-feld-unter" }, `am ${datumMonatKurz(bil.teuerster.montag)}`)))));
    }

    // ---- Fairer Anteil ----
    if (s.anzahl) {
      const p = (s.sats / FAIRER_ANTEIL) * 100;
      const b = balken(Math.min(1, p / Math.max(100, Math.ceil(p / 100) * 100)), { marke: 100 / Math.max(100, Math.ceil(p / 100) * 100), art: "glut" });
      laeufer.push(b);
      teile.push(abschnitt("Dein Anteil an allen Bitcoin",
        gross(zahl(p, 0), h("span", { class: "zahl-einheit" }, " %")),
        b.el,
        satz(p >= 100
          ? `Würde man alle Bitcoin gerecht auf alle Menschen verteilen, bekäme jeder rund ${sats(FAIRER_ANTEIL)} sats. Du hast das ${zahl(p / 100, 1)}-Fache.`
          : `Würde man alle Bitcoin gerecht auf alle Menschen verteilen, bekäme jeder rund ${sats(FAIRER_ANTEIL)} sats. Du hast ${zahl(p, 0)} % davon.`),
        klein("21 Mio. Bitcoin geteilt durch rund 8,2 Mrd. Menschen.")));
    }

    // ---- Meilensteine ----
    if (m.naechstes) {
      const b = balken(m.naechstes.fortschritt);
      laeufer.push(b);
      teile.push(abschnitt("Nächster Meilenstein",
        gross(zielName(m.naechstes.ziel), h("span", { class: "zahl-einheit" }, " sats")),
        b.el,
        satz(`Noch ${sats(m.naechstes.fehlt)} sats${m.naechstes.kaeufeNoch ? ` – beim heutigen Kurs etwa ${anzahl(m.naechstes.kaeufeNoch, "Kauf", "Käufe")}` : ""}.`),
        m.erreicht.length ? h("ol", { class: "meilen" }, ...m.erreicht.slice(-4).reverse().map((e) => h("li", null, h("span", { class: "zahl" }, `${zielName(e.ziel)} sats`), h("span", null, `${datumMonatKurz(e.am)} · Kauf ${e.kaufNr}`)))) : null));
    }

    // ---- Abzeichen ----
    if (s.anzahl) {
      const ring = (titel, einheit, anteil, art, unter) => {
        const U = 2 * Math.PI * 23;
        const bogen = svg("circle", { cx: 30, cy: 30, r: 23, class: "abz-bogen", "stroke-dasharray": `${U}`, "stroke-dashoffset": `${U}` });
        laeufer.push({ los: () => { bogen.style.strokeDashoffset = `${(U * (1 - anteil)).toFixed(2)}`; } });
        return h("div", { class: `abz abz--${art}` },
          svg("svg", { class: "abz-ring", viewBox: "0 0 60 60", "aria-hidden": "true" }, svg("circle", { cx: 30, cy: 30, r: 23, class: "abz-spur" }), bogen),
          h("span", { class: "abz-wert zahl" }, titel), h("span", { class: "abz-einheit" }, einheit),
          unter ? h("span", { class: "abz-unter" }, unter) : null);
      };
      const erreichtAm = new Map(m.erreicht.map((e) => [e.ziel, e.am]));
      const satsZiele = SATS_ZIELE.filter((x, i) => x <= (m.naechstes?.ziel ?? Infinity) || i < 1);
      const wochenZiele = WOCHEN_ZIELE.filter((w) => w <= (m.naechsteWoche?.ziel ?? Infinity));
      const zuletztSats = satsZiele.slice(-6);
      const zuletztWochen = wochenZiele.slice(-4);
      const ringe = [
        ...zuletztSats.map((x) => {
          const da = m.sats >= x;
          return ring(zielName(x), "sats", da ? 1 : x === m.naechstes?.ziel ? m.naechstes.fortschritt : 0, da ? "da" : "naechstes", da && erreichtAm.get(x) ? datumMonatKurz(erreichtAm.get(x)) : da ? "" : `noch ${kurzSats(Math.max(0, x - m.sats))}`);
        }),
        ...zuletztWochen.map((w) => {
          const da = m.wochen >= w;
          const vorher = WOCHEN_ZIELE[WOCHEN_ZIELE.indexOf(w) - 1] ?? 0;
          return ring(`${w}`, "Wochen", da ? 1 : Math.max(0, (m.wochen - vorher) / (w - vorher)), da ? "da" : "naechstes", da ? "geschafft" : `noch ${w - m.wochen}`);
        }),
      ];
      teile.push(abschnitt("Abzeichen",
        h("div", { class: "abzeichen" }, ...ringe),
        satz(`${anzahl(m.erreicht.length + m.wochenErreicht.length, "Abzeichen", "Abzeichen")} gesammelt. Jedes neue wird gefeiert, sobald es fällt.`)));
    }

    // ---- Haltefrist ----
    const hf = haltefrist(z.kaeufe, z.jetzt);
    if (hf.tranchen.length) {
      const b = balken(hf.anteilFrei / 100 || 0.002);
      laeufer.push(b);
      teile.push(abschnitt("Haltefrist",
        hf.naechste
          ? gross(`${hf.naechste.tageBis}`, h("span", { class: "zahl-einheit" }, hf.naechste.tageBis === 1 ? " Tag" : " Tage"))
          : gross("100", h("span", { class: "zahl-einheit" }, " %")),
        b.el,
        satz(hf.naechste
          ? `Bis der erste noch offene Kauf (${datumMonatKurz(hf.naechste.kaufdatum)}) ein Jahr gehalten ist – am ${datum(hf.naechste.freiAb)}. Bisher über ein Jahr gehalten: ${zahl(hf.anteilFrei, 0)} % deines Bestands.`
          : "Dein ganzer Bestand ist länger als ein Jahr gehalten."),
        klein("Nach § 23 EStG sind Gewinne aus dem Verkauf privat gehaltener Kryptowerte nach mehr als einem Jahr Haltedauer steuerfrei. Reine Datumsrechnung je Kauf, keine Steuerberatung.")));
    }

    // ---- Tiefpunkt und Erholung ----
    const tage = [...(z.tage?.punkte ?? [])];
    const erster = z.kaeufe.find((k) => k.gezaehlt);
    if (erster && tage.length >= 10) {
      if (z.aktuell?.kurs) tage.push({ t: z.aktuell.zeit, c: z.aktuell.kurs });
      const r = rueckgang(tage.filter((p) => p.t >= erster.ts), z.kaeufe);
      if (r && r.tiefe < 0) {
        teile.push(abschnitt("Tiefpunkt und Erholung",
          gross(`${zahl(r.aufgeholtProzent, 0)}`, h("span", { class: "zahl-einheit" }, " % aufgeholt")),
          satz(`Vom ${datumMonatKurz(r.hochTag)} bis zum ${datumMonatKurz(r.tiefTag)} fiel der Kurs um ${zahl(Math.abs(r.tiefe), 1)} %.`,
            r.erholtTag ? ` Am ${datumMonatKurz(r.erholtTag)} war alles wieder aufgeholt.` : ` Seit dem Tiefpunkt sind ${zahl(r.aufgeholtProzent, 0)} % davon aufgeholt.`,
            ` Währenddessen hast du ${anzahl(r.kaeufeWaehrenddessen, "Mal", "Mal")} weitergekauft.`)));
      }
    }

    // ---- Netzwerk ----
    const netzGross = gross("–");
    const netzSatz = satz("");
    teile.push(abschnitt("Seit deinem ersten Kauf", netzGross, netzSatz));
    zeigeNetz(netzGross, netzSatz);

    fuelle(koerper, ...teile);
    if (gelaufen) laeufer.forEach((b) => b.los());
  }

  let startBlock = null; let startGeholt = false;
  async function zeigeNetz(grossEl, satzEl) {
    const erster = z.kaeufe.find((k) => k.gezaehlt);
    const b = z.markt?.block;
    if (!erster) { satzEl.textContent = "Beginnt mit dem ersten Kauf."; return; }
    if (startBlock == null && !startGeholt) {
      startGeholt = true;
      try { startBlock = await holeBlockZurZeit(erster.ts); } catch { startBlock = null; }
    }
    let bloecke; let geschaetzt = false;
    if (startBlock != null && b?.hoehe) bloecke = b.hoehe - startBlock;
    else { bloecke = Math.round(((Date.now() - erster.ts) / 86_400_000) * 144); geschaetzt = true; }
    fuelle(grossEl, ganz(bloecke), h("span", { class: "zahl-einheit" }, " Blöcke"));
    let halving = "";
    if (b?.hoehe) {
      const naechstes = Math.ceil((b.hoehe + 1) / 210_000) * 210_000;
      const wann = datumBerlin(b.zeit + (naechstes - b.hoehe) * 600_000);
      const { jahr, monat } = zerlege(wann);
      halving = ` Das nächste Halving – dann halbiert sich die Menge neuer Bitcoin – kommt etwa im ${monatsname(monat)} ${jahr}.`;
    }
    satzEl.textContent = `${geschaetzt ? "Rund so viele" : "So viele"} Blöcke hat das Bitcoin-Netzwerk seit dem ${datum(erster.montag)} gefunden, etwa alle zehn Minuten einen. Dein Plan läuft im selben Takt mit.${halving}`;
  }

  let gelaufen = false;
  baue();
  const aenderung = () => baue();
  app.beiAenderung.add(aenderung);
  app.koepfe.add(kopf);

  return entfalte({
    herkunft, inhalt, titel: "Zahlen", hintergrund: app.heuteEl,
    beiFortschritt: (p) => { if (p > 0.6 && !gelaufen) { gelaufen = true; laeufer.forEach((b, i) => setTimeout(b.los, i * 80)); } },
    beimSchliessen: () => { app.beiAenderung.delete(aenderung); app.koepfe.delete(kopf); },
  });
}

