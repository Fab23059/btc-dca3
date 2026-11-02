// =====================================================================
// rechnen.js – Der Rechenkern. Reine Mathematik, kein Bildschirm, kein Netz.
//
// Jede Zahl, die die App zeigt, entsteht hier. Deshalb ist diese Datei
// mit Tests abgesichert (tests/rechnen.test.mjs) und in PRUEFUNG.md erklärt.
//
// Begriffe:
//   Sparwoche  – ein Montag laut Zeitplan
//   Eintrag    – von dir eingetragene echte Werte (Menge und/oder Kurs)
//   Kaufkurs   – automatisch geholter Marktkurs zur geplanten Kaufzeit
//   Kauf       – eine Sparwoche mit allen berechneten Werten
// =====================================================================

import { berlinZeitpunkt, heuteBerlin, plusTage } from "./zeit.js";

/** Die Phase des Zeitplans, zu der ein Montag gehört (oder null). */
export function phaseVon(zeitplan, montag) {
  for (const p of zeitplan) {
    if (montag >= p.erster && (p.letzter === null || montag <= p.letzter)) return p;
  }
  return null;
}

/** Alle Spar-Montage vom ersten bis einschließlich heute (deutsche Zeit). */
export function sparwochen(zeitplan, jetzt) {
  const heute = heuteBerlin(jetzt);
  const aus = [];
  let montag = zeitplan[0].erster;
  for (let i = 0; i < 5300 && montag <= heute; i++, montag = plusTage(montag, 7)) {
    const p = phaseVon(zeitplan, montag);
    if (!p) continue;
    aus.push({ montag, ts: berlinZeitpunkt(montag, p.stunde, p.minute), gebuehr: p.gebuehr, boerse: p.boerse, stunde: p.stunde, minute: p.minute });
  }
  return aus;
}

/**
 * Der nächste geplante Kauf ab jetzt (für Hinweise und Erinnerungen).
 */
export function naechsterKauf(zeitplan, jetzt) {
  const heute = heuteBerlin(jetzt);
  let montag = zeitplan[0].erster;
  for (let i = 0; i < 5300; i++, montag = plusTage(montag, 7)) {
    const p = phaseVon(zeitplan, montag);
    if (!p) continue;
    const ts = berlinZeitpunkt(montag, p.stunde, p.minute);
    if (montag >= heute && ts > jetzt) return { montag, ts, boerse: p.boerse };
  }
  return null;
}

/**
 * Baut aus Sparwochen, Einträgen und Kaufkursen die Liste aller Käufe.
 *
 * Status je Woche:
 *   "eingetragen" – du hast echte Werte hinterlegt (das ist die Wahrheit)
 *   "geschaetzt"  – Kaufzeit ist vorbei, Werte aus dem Marktkurs berechnet
 *   "ausstehend"  – Kaufzeit noch nicht erreicht → zählt NICHT mit
 *   "ohneKurs"    – Kaufzeit vorbei, aber noch kein Kurs abrufbar → zählt (noch) nicht mit
 *
 * Nur "eingetragen" und "geschaetzt" fließen in Summen und Gewinn/Verlust ein.
 */
export function kaeufeBerechnen({ wochen, eintraege, kaufkurse, jetzt, sparrate }) {
  let kumEur = 0;
  let kumBtc = 0;
  let nr = 0;
  return wochen.map((w) => {
    const e = eintraege[w.montag];
    const markt = kaufkurse[w.montag]?.kurs ?? null;
    const netto = sparrate * (1 - w.gebuehr);
    let status; let btc = null; let kurs = null;

    if (e && (e.btc != null || e.kurs != null)) {
      status = "eingetragen";
      if (e.btc != null && e.kurs != null) { btc = e.btc; kurs = e.kurs; }
      else if (e.btc != null) { btc = e.btc; kurs = netto / e.btc; }
      else { kurs = e.kurs; btc = netto / e.kurs; }
    } else if (jetzt < w.ts) {
      status = "ausstehend";
    } else if (markt != null) {
      status = "geschaetzt";
      kurs = markt;
      btc = netto / markt;
    } else {
      status = "ohneKurs";
    }

    const gezaehlt = status === "eingetragen" || status === "geschaetzt";
    if (gezaehlt) { kumEur += sparrate; kumBtc += btc; nr += 1; }
    return {
      ...w,
      status, gezaehlt,
      nr: gezaehlt ? nr : null,
      btc, kurs,
      marktkurs: markt ?? kurs,                 // Marktkurs zur Kaufzeit (für den Wertverlauf)
      brutto: gezaehlt ? sparrate : 0,
      netto,
      kaufdatum: e?.datum ?? w.montag,          // tatsächlicher Kauftag (für die Haltefrist)
      kumEur: gezaehlt ? kumEur : null,
      kumBtc: gezaehlt ? kumBtc : null,
    };
  });
}

/** Die Kennzahlen oben auf dem Bildschirm. */
export function zusammenfassung(kaeufe, aktuellerKurs) {
  const gezaehlt = kaeufe.filter((k) => k.gezaehlt);
  const investiert = gezaehlt.reduce((s, k) => s + k.brutto, 0);
  const btc = gezaehlt.reduce((s, k) => s + k.btc, 0);
  const hatKurs = typeof aktuellerKurs === "number" && Number.isFinite(aktuellerKurs);
  const wert = hatKurs ? btc * aktuellerKurs : null;
  const gv = wert != null ? wert - investiert : null;
  return {
    anzahl: gezaehlt.length,
    investiert,
    btc,
    sats: btc * 1e8,
    durchschnitt: btc > 0 ? investiert / btc : null,    // Ø Kaufpreis inkl. Gebühren
    wert,
    gv,
    gvProzent: gv != null && investiert > 0 ? (gv / investiert) * 100 : null,
    eingetragen: gezaehlt.filter((k) => k.status === "eingetragen").length,
    geschaetzt: kaeufe.filter((k) => k.status === "geschaetzt"),
    ausstehend: kaeufe.filter((k) => k.status === "ausstehend"),
    ohneKurs: kaeufe.filter((k) => k.status === "ohneKurs"),
  };
}

/** BTC-Bestand und eingezahlte Summe zu einem Zeitpunkt (Käufe bis einschließlich ts). */
export function standBei(kaeufe, ts) {
  let btc = 0; let investiert = 0;
  for (const k of kaeufe) {
    if (k.gezaehlt && k.ts <= ts) { btc += k.btc; investiert += k.brutto; }
  }
  return { btc, investiert };
}

/**
 * Kurs zu einem beliebigen Zeitpunkt aus einer Kursreihe [{t, c}] (aufsteigend),
 * linear zwischen den Nachbarpunkten. Außerhalb der Reihe: null.
 */
export function kursBei(punkte, ts) {
  if (!punkte || !punkte.length || ts < punkte[0].t || ts > punkte[punkte.length - 1].t) return null;
  let lo = 0; let hi = punkte.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (punkte[mid].t <= ts) lo = mid; else hi = mid;
  }
  const a = punkte[lo]; const b = punkte[hi];
  if (b.t === a.t) return b.c;
  return a.c + ((b.c - a.c) * (ts - a.t)) / (b.t - a.t);
}

/**
 * Gewinn/Verlust in einem Zeitraum (Woche, Monat, Jahr).
 *
 * WICHTIG: Gemessen wird die Veränderung von (Wert − Investiert).
 * Die neue Einzahlung im Zeitraum ist also KEIN Gewinn – sonst würde eine
 * Verlustwoche als Gewinnwoche erscheinen, nur weil 15 € dazukamen.
 *
 * Prozent = Veränderung ÷ (Wert zu Beginn + Einzahlungen im Zeitraum),
 * also bezogen auf das Geld, das in diesem Zeitraum im Spiel war.
 * Für "Gesamt" ergibt das genau Gewinn ÷ Investiert.
 */
export function zeitraumErgebnis({ kaeufe, aktuellerKurs, jetzt, startTs, kursZuBeginn }) {
  const ende = standBei(kaeufe, jetzt);
  if (aktuellerKurs == null) return null;
  const gvEnde = ende.btc * aktuellerKurs - ende.investiert;
  const anfang = standBei(kaeufe, startTs);
  let wertAnfang = 0;
  if (anfang.btc > 0) {
    if (kursZuBeginn == null) return null;          // Kurs zu Beginn unbekannt → lieber nichts zeigen
    wertAnfang = anfang.btc * kursZuBeginn;
  }
  const gvAnfang = wertAnfang - anfang.investiert;
  const einzahlungen = ende.investiert - anfang.investiert;
  const basis = wertAnfang + einzahlungen;
  const veraenderung = gvEnde - gvAnfang;
  return {
    veraenderung,
    prozent: basis > 0 ? (veraenderung / basis) * 100 : null,
    einzahlungen,
    wertAnfang,
    wertEnde: ende.btc * aktuellerKurs,
    basis,
  };
}

/**
 * Wertverlauf für das große Diagramm.
 * Liefert Punkte {t, wert, investiert, btc} – an jedem Kaufzeitpunkt mit
 * zwei Punkten (direkt davor / direkt danach), damit jede Einzahlung als
 * klarer, gleich großer Sprung sichtbar wird und nicht im Kursverlauf verschwimmt.
 */
export function wertverlauf({ kaeufe, kurse, aktuellerKurs, jetzt, von }) {
  const gez = kaeufe.filter((k) => k.gezaehlt);
  if (!gez.length) return [];
  const start = Math.max(von ?? -Infinity, gez[0].ts);
  const ereignisse = [];
  for (const p of kurse) if (p.t > start && p.t < jetzt) ereignisse.push({ t: p.t, c: p.c });
  for (const k of gez) if (k.ts >= start) ereignisse.push({ t: k.ts, c: k.marktkurs, kauf: k });
  ereignisse.sort((a, b) => a.t - b.t || (a.kauf ? 1 : -1));

  const aus = [];
  let btc = 0; let investiert = 0;
  for (const k of gez) if (k.ts < start) { btc += k.btc; investiert += k.brutto; }
  if (start > gez[0].ts) {
    const c0 = kursBei(kurse, start);
    if (c0 != null) aus.push({ t: start, wert: btc * c0, investiert, btc, kurs: c0 });
  }
  for (const e of ereignisse) {
    if (e.kauf) {
      aus.push({ t: e.t, wert: btc * e.c, investiert, btc, kurs: e.c, vorKauf: true });
      btc += e.kauf.btc; investiert += e.kauf.brutto;
      aus.push({ t: e.t, wert: btc * e.c, investiert, btc, kurs: e.c, kauf: e.kauf });
    } else {
      aus.push({ t: e.t, wert: btc * e.c, investiert, btc, kurs: e.c });
    }
  }
  if (aktuellerKurs != null) aus.push({ t: jetzt, wert: btc * aktuellerKurs, investiert, btc, kurs: aktuellerKurs, jetzt: true });
  return aus;
}

/**
 * Zerlegt jede Woche in zwei Teile:
 *   einzahlung – deine 15 €, jede Woche exakt gleich
 *   kurseffekt – was der Kurs in dieser Woche mit deinem gesamten Bestand gemacht hat
 *   kosten     – Gebühr/Spread beim Kauf (Einzahlung minus Marktwert der gekauften Menge)
 * Summe aller (einzahlung − kosten + kurseffekt) = heutiger Wert. Exakt.
 */
export function wochenZerlegung(kaeufe, aktuellerKurs, jetzt) {
  const gez = kaeufe.filter((k) => k.gezaehlt);
  const aus = [];
  let bestand = 0;
  for (let i = 0; i < gez.length; i++) {
    const k = gez[i];
    bestand += k.btc;
    const naechster = gez[i + 1];
    const kursEnde = naechster ? naechster.marktkurs : aktuellerKurs;
    const laufend = !naechster;
    const kurseffekt = kursEnde != null ? bestand * (kursEnde - k.marktkurs) : null;
    aus.push({
      montag: k.montag,
      von: k.ts,
      bis: naechster ? naechster.ts : jetzt,
      einzahlung: k.brutto,
      kosten: k.brutto - k.btc * k.marktkurs,
      kurseffekt,
      bestandWert: bestand * k.marktkurs,
      prozent: kurseffekt != null ? ((kursEnde - k.marktkurs) / k.marktkurs) * 100 : null,
      laufend,
    });
  }
  return aus;
}
