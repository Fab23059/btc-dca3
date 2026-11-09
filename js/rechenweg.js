// =====================================================================
// rechenweg.js – "So entsteht diese Zahl": Jede Kennzahl lässt sich
// antippen und zeigt ihre Rechnung mit den echten Werten. Dazu eine
// Gegenprobe des aktuellen Kurses bei zwei unabhängigen Quellen.
// =====================================================================

import { h, fuelle } from "./dom.js";
import { oeffneTablett } from "./teile/tablett.js";
import { gegenprobe } from "./kurse.js";
import { zeitraumErgebnis } from "./rechnen.js";
import { euro, euroMitVorzeichen, prozent, btc as btcFmt, sats, zahl, anzahl, uhrzeit, zeitpunkt } from "./format.js";
import { ZEITRAEUME, zeitraumDaten } from "./zeitraeume.js";
import { skelett } from "./ansichten/gemeinsam.js";

const formel = (...zeilen) => h("div", { class: "formel" }, zeilen);
const fz = (links, rechts, art = "") => h("div", { class: ["formel-zeile", art && `formel-zeile--${art}`] }, h("span", { class: "formel-links" }, links), h("span", { class: "formel-rechts" }, rechts));
const absatz = (...t) => h("p", { class: "absatz" }, ...t);

function kursQuelle(z) {
  const a = z.aktuell;
  if (!a) return absatz("Noch kein Kurs geladen.");
  return absatz(`Aktueller Kurs von ${a.quelle}, abgerufen um ${uhrzeit(a.zeit)} Uhr${z.aktuellFrisch ? "" : " (letzter bekannter Stand – gerade keine Verbindung)"}.`);
}

function gegenprobeBlock() {
  const ziel = h("div", { class: "gegenprobe" }, skelett("70%"));
  gegenprobe().then((g) => {
    const zeilen = [fz("CryptoCompare", g.cryptocompare ? euro(g.cryptocompare) : "nicht erreichbar"), fz("Coinbase", g.coinbase ? euro(g.coinbase) : "nicht erreichbar")];
    if (g.cryptocompare && g.coinbase) zeilen.push(fz("Abweichung", prozent(Math.abs(g.coinbase / g.cryptocompare - 1) * 100, 2).replace("+", ""), "summe"));
    fuelle(ziel, formel(...zeilen), absatz(`Abgefragt um ${uhrzeit(g.zeit)} Uhr. Kleine Abweichungen sind normal – jede Börse hat ihren eigenen Kurs.`));
  });
  return h("section", { class: "abschnitt" }, h("h3", { class: "abschnitt-titel" }, "Gegenprobe des Kurses"), ziel);
}

export function oeffneRechenweg(art, quelle, z, zeitraum = "gesamt") {
  const s = z.summe;
  const kurs = z.aktuell?.kurs;
  const gez = z.kaeufe.filter((k) => k.gezaehlt);
  const geschaetzt = gez.filter((k) => k.status !== "eingetragen").length;   // automatisch erfasst (inkl. frisch, noch nicht eingetragen)
  const btcEin = gez.filter((k) => k.status === "eingetragen").reduce((a, k) => a + k.btc, 0);
  const btcGes = gez.filter((k) => k.status !== "eingetragen").reduce((a, k) => a + k.btc, 0);
  let titel; let inhalt;

  if (art === "wert") {
    const d = zeitraumDaten(z, zeitraum);
    const r = zeitraum !== "gesamt" ? zeitraumErgebnis({ kaeufe: z.kaeufe, aktuellerKurs: kurs, jetzt: z.jetzt, startTs: d.startTs, kursZuBeginn: d.kursZuBeginn }) : null;
    titel = "Depotwert";
    inhalt = [
      formel(fz("Bestand", `${btcFmt(s.btc)} BTC`), fz("× aktueller Kurs", euro(kurs)), fz("= Depotwert", euro(s.wert), "summe")),
      kursQuelle(z),
      h("h3", { class: "abschnitt-titel abschnitt" }, "Gewinn / Verlust gesamt"),
      formel(fz("Depotwert", euro(s.wert)), fz("− investiert", euro(s.investiert)), fz("= Gewinn/Verlust", euroMitVorzeichen(s.gv), "summe"), fz("÷ investiert", prozent(s.gvProzent))),
      r ? h("h3", { class: "abschnitt-titel abschnitt" }, `Zeitraum: ${ZEITRAEUME[zeitraum].text}`) : null,
      r ? formel(
        fz("Wert zu Beginn", euro(r.wertAnfang)),
        fz("+ Einzahlungen im Zeitraum", euro(r.einzahlungen)),
        fz("Wert heute", euro(r.wertEnde)),
        fz("Veränderung ohne Einzahlungen", euroMitVorzeichen(r.veraenderung), "summe"),
        fz("÷ (Wert zu Beginn + Einzahlungen)", prozent(r.prozent))) : null,
      r ? absatz("Neue Einzahlungen zählen nie als Gewinn. Sonst sähe eine Woche, in der der Kurs fiel, nur wegen der 15\u00A0€ wie eine Gewinnwoche aus.") : null,
      s.ausstehend.length ? absatz(`Nicht enthalten: ${anzahl(s.ausstehend.length, "ausstehender Kauf", "ausstehende Käufe")} – sie zählen nach der Kaufzeit oder sobald du sie einträgst.`) : null,
      gegenprobeBlock(),
    ];
  } else if (art === "investiert") {
    titel = "Investiert";
    inhalt = [
      formel(fz("Käufe", ganzText(s.anzahl)), fz("× Sparrate", euro(15)), fz("= investiert", euro(s.investiert), "summe")),
      absatz("Gezählt wird brutto, also inklusive Gebühr: Pro Woche gehen 15\u00A0€ vom Konto ab. Die Gebühr steckt im Ø Kaufpreis."),
      absatz(`Davon ${anzahl(s.eingetragen, "Kauf", "Käufe")} mit deinen eingetragenen Werten${geschaetzt ? ` und ${geschaetzt} automatisch erfasst (Marktkurs zur Kaufminute, wie in der alten App)` : ""}.`),
      s.ausstehend.length ? absatz("Ein ausstehender Kauf (Kaufzeit noch nicht erreicht, noch nichts eingetragen) ist nicht enthalten.") : null,
    ];
  } else if (art === "bestand") {
    titel = "Bestand";
    inhalt = [
      formel(
        fz(`${anzahl(s.eingetragen, "Kauf", "Käufe")} eingetragen`, `${btcFmt(btcEin)} BTC`),
        fz(`${anzahl(geschaetzt, "Kauf", "Käufe")} automatisch`, `${btcFmt(btcGes)} BTC`),
        fz("= Bestand", `${btcFmt(s.btc)} BTC`, "summe"),
        fz("in Satoshi", `${sats(s.sats)} sats`)),
      absatz("Automatische Menge = 15\u00A0€ × (1 − Gebühr) ÷ Marktkurs zur Kaufminute. Binance: 0,40\u00A0% Gebühr, Bitvavo: 0,25\u00A0%."),
      absatz("1 Bitcoin = 100.000.000 Satoshi (sats)."),
    ];
  } else if (art === "durchschnitt") {
    titel = "Ø Kaufpreis";
    inhalt = [
      formel(fz("investiert", euro(s.investiert)), fz("÷ Bestand", `${btcFmt(s.btc)} BTC`), fz("= Ø Kaufpreis", euro(s.durchschnitt), "summe")),
      absatz("Weil die volle Sparrate inklusive Gebühr zählt, ist das dein echter Einstandspreis: Liegt der Bitcoin-Kurs darüber, bist du im Plus."),
      kurs && s.durchschnitt ? absatz(`Aktueller Kurs: ${euro(kurs)}.`) : null,
    ];
  } else {
    titel = "Bitcoin-Kurs";
    const a = z.aktuell;
    inhalt = [
      formel(fz("Kurs", euro(a?.kurs)), fz("Veränderung 24 h", a?.aenderung24h != null ? prozent(a.aenderung24h) : "–"), fz("24 h Hoch", euro(a?.hoch24h)), fz("24 h Tief", euro(a?.tief24h))),
      kursQuelle(z),
      absatz("Reihenfolge der Quellen: CryptoCompare, dann Coinbase, dann CoinGecko. Antwortet keine, zeigt die App den letzten bekannten Stand mit Uhrzeit."),
      gegenprobeBlock(),
    ];
  }
  return oeffneTablett({ titel, untertitel: `So entsteht diese Zahl · Stand ${zeitpunkt(z.jetzt)}`, inhalt: h("div", { class: "rechenweg" }, inhalt) });
}

function ganzText(n) { return zahl(n, 0); }
