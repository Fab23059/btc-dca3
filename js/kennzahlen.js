// =====================================================================
// kennzahlen.js – Die tiefere Analyse: Schwankung, Rückgang und Erholung,
// Wochenrückblick, Haltefrist, Durchhalten, Meilensteine.
//
// Leitlinie: Alles beschreibt, nichts bewertet. Es gibt keine Rechnung
// "was wäre wenn" und keinen Vergleich mit anderen Entscheidungen.
// =====================================================================

import { heuteBerlin, datumBerlin, jahrestag, plusTage, tageZwischen } from "./zeit.js";

/**
 * Schwankung (Volatilität) aus Tagesschlusskursen seit dem ersten Kauf.
 * Dein Depot besteht zu 100 % aus Bitcoin – seine Schwankung ist deshalb
 * die Schwankung des Bitcoin-Kurses, unabhängig von deinen Einzahlungen.
 */
export function volatilitaet(tagespunkte) {
  if (!tagespunkte || tagespunkte.length < 15) return null;
  const r = [];
  for (let i = 1; i < tagespunkte.length; i++) {
    const a = tagespunkte[i - 1].c; const b = tagespunkte[i].c;
    if (a > 0 && b > 0) r.push(Math.log(b / a));
  }
  if (r.length < 14) return null;
  const mittel = r.reduce((s, x) => s + x, 0) / r.length;
  const varianz = r.reduce((s, x) => s + (x - mittel) ** 2, 0) / (r.length - 1);
  const tag = Math.sqrt(varianz);
  return {
    tagProzent: tag * 100,                      // typische Tagesbewegung
    jahrProzent: tag * Math.sqrt(365) * 100,    // aufs Jahr hochgerechnet (Bitcoin handelt an 365 Tagen)
    tage: r.length,
  };
}

/**
 * Größter Rückgang seit dem ersten Kauf – und wie lange es dauerte, ihn aufzuholen.
 * Gemessen an der Wertentwicklung pro investiertem Euro (zeitgewichtet),
 * also ohne dass deine Einzahlungen das Bild verfälschen.
 */
export function rueckgang(punkte, kaeufe) {
  if (!punkte || punkte.length < 3) return null;
  let hoch = punkte[0]; let besterAbstand = 0; let best = null;
  for (const p of punkte) {
    if (p.c > hoch.c) hoch = p;
    const abstand = p.c / hoch.c - 1;
    if (abstand < besterAbstand) { besterAbstand = abstand; best = { hoch, tief: p }; }
  }
  if (!best || besterAbstand > -0.01) return { tiefe: 0 };
  const { hoch: h, tief: t } = best;
  const erholt = punkte.find((p) => p.t > t.t && p.c >= h.c) ?? null;
  const letzter = punkte[punkte.length - 1];
  const ende = erholt ? erholt.t : letzter.t;
  const gez = kaeufe.filter((k) => k.gezaehlt && k.ts > h.t && k.ts <= ende);
  return {
    tiefe: besterAbstand * 100,
    hochTag: datumBerlin(h.t), hochKurs: h.c,
    tiefTag: datumBerlin(t.t), tiefKurs: t.c,
    erholtTag: erholt ? datumBerlin(erholt.t) : null,
    wochenBisErholt: erholt ? Math.max(1, Math.round((erholt.t - t.t) / (7 * 86_400_000))) : null,
    aufgeholtProzent: erholt ? 100 : Math.max(0, Math.min(100, ((letzter.c - t.c) / (h.c - t.c)) * 100)),
    kaeufeWaehrenddessen: gez.length,
  };
}

/** Die Woche mit der stärksten und der schwächsten Kursbewegung – rein beschreibend. */
export function wochenRueckblick(zerlegung) {
  const fertig = zerlegung.filter((w) => !w.laufend && w.kurseffekt != null);
  if (fertig.length < 2) return null;
  let staerkste = fertig[0]; let schwaechste = fertig[0];
  for (const w of fertig) {
    if (w.kurseffekt > staerkste.kurseffekt) staerkste = w;
    if (w.kurseffekt < schwaechste.kurseffekt) schwaechste = w;
  }
  return { staerkste, schwaechste, anzahl: fertig.length };
}

/**
 * Haltefrist nach § 23 EStG: Gewinne aus privaten Veräußerungsgeschäften sind
 * steuerfrei, wenn zwischen Kauf und Verkauf mehr als ein Jahr liegt.
 * Frist: beginnt am Tag nach dem Kauf, endet mit Ablauf des Jahrestags.
 * Ein Verkauf ist also ab dem Tag NACH dem Jahrestag außerhalb der Frist.
 * (Reine Datumsrechnung – keine Steuerberatung.)
 */
export function haltefrist(kaeufe, jetzt) {
  const heute = heuteBerlin(jetzt);
  const gez = kaeufe.filter((k) => k.gezaehlt);
  const gesamt = gez.reduce((s, k) => s + k.btc, 0);
  const tranchen = gez.map((k) => {
    const freiAb = plusTage(jahrestag(k.kaufdatum), 1);
    return { montag: k.montag, kaufdatum: k.kaufdatum, btc: k.btc, freiAb, frei: freiAb <= heute, tageBis: Math.max(0, tageZwischen(heute, freiAb)) };
  });
  const btcFrei = tranchen.filter((t) => t.frei).reduce((s, t) => s + t.btc, 0);
  const offen = tranchen.filter((t) => !t.frei);
  const naechste = offen.length ? offen[0] : null;
  return {
    tranchen,
    btcFrei,
    anteilFrei: gesamt > 0 ? (btcFrei / gesamt) * 100 : 0,
    naechste,
    alleFreiAb: offen.length ? offen[offen.length - 1].freiAb : null,
  };
}

/** Durchhalte-Kennzahlen. */
export function durchhalten(kaeufe, jetzt) {
  const vergangen = kaeufe.filter((k) => k.status !== "ausstehend");
  const gez = kaeufe.filter((k) => k.gezaehlt);
  const erster = vergangen[0];
  return {
    wochenInFolge: vergangen.length,          // jede vergangene Sparwoche wurde gekauft
    kaeufe: gez.length,
    tage: erster ? tageZwischen(erster.montag, heuteBerlin(jetzt)) : 0,
    sats: gez.reduce((s, k) => s + k.btc, 0) * 1e8,
    seit: erster ? erster.montag : null,
  };
}

export const SATS_ZIELE = [50_000, 100_000, 200_000, 300_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000, 7_500_000, 10_000_000, 21_000_000];
export const WOCHEN_ZIELE = [4, 8, 12, 26, 52, 78, 104, 156, 208, 260, 520];

/**
 * Meilensteine mit dem Datum, an dem sie erreicht wurden, und dem nächsten Ziel.
 * Der Ausblick rechnet mit dem heutigen Kurs – als grobe Orientierung.
 */
export function meilensteine(kaeufe, aktuellerKurs, sparrate) {
  const gez = kaeufe.filter((k) => k.gezaehlt);
  const sats = gez.reduce((s, k) => s + k.btc, 0) * 1e8;
  const erreicht = [];
  let summe = 0; let zielIdx = 0;
  for (const k of gez) {
    summe += k.btc * 1e8;
    while (zielIdx < SATS_ZIELE.length && summe >= SATS_ZIELE[zielIdx]) {
      erreicht.push({ ziel: SATS_ZIELE[zielIdx], am: k.kaufdatum, kaufNr: k.nr });
      zielIdx++;
    }
  }
  const naechstesZiel = SATS_ZIELE[zielIdx] ?? null;
  const vorheriges = zielIdx > 0 ? SATS_ZIELE[zielIdx - 1] : 0;
  const letzteGebuehr = gez.length ? gez[gez.length - 1].gebuehr : 0;
  const satsProKauf = aktuellerKurs ? ((sparrate * (1 - letzteGebuehr)) / aktuellerKurs) * 1e8 : null;
  const fehlt = naechstesZiel ? naechstesZiel - sats : 0;

  const wochen = kaeufe.filter((k) => k.status !== "ausstehend").length;
  const wochenErreicht = WOCHEN_ZIELE.filter((w) => wochen >= w);
  const naechsteWoche = WOCHEN_ZIELE.find((w) => wochen < w) ?? null;

  return {
    sats,
    erreicht,
    naechstes: naechstesZiel ? {
      ziel: naechstesZiel,
      fehlt,
      fortschritt: Math.max(0, Math.min(1, (sats - vorheriges) / (naechstesZiel - vorheriges))),
      kaeufeNoch: satsProKauf ? Math.ceil(fehlt / satsProKauf) : null,
      danach: SATS_ZIELE[zielIdx + 1] ?? null,
    } : null,
    satsProKauf,
    wochen,
    wochenErreicht,
    naechsteWoche: naechsteWoche ? { ziel: naechsteWoche, noch: naechsteWoche - wochen } : null,
  };
}

/** Kurze Beschriftung für Sats-Ziele: 500k, 1 Mio, 21 Mio */
export function zielName(z) {
  if (z >= 1_000_000) return `${(z / 1_000_000).toLocaleString("de-DE")} Mio`;
  return `${(z / 1000).toLocaleString("de-DE")}k`;
}

/**
 * DCA-Bilanz: Was hat das Verteilen gebracht?
 * Vergleich: alles Eingezahlte auf einmal zum ersten Kauf (gleiche Gebühr, gleicher Kurs).
 */
export function dcaBilanz(kaeufe, aktuellerKurs, jetzt) {
  const gez = kaeufe.filter((k) => k.gezaehlt && k.btc > 0 && k.kurs > 0);
  if (!gez.length) return null;
  const investiert = gez.reduce((s, k) => s + k.brutto, 0);
  const btc = gez.reduce((s, k) => s + k.btc, 0);
  const erster = gez[0];
  const einmalBtc = (investiert * (1 - erster.gebuehr)) / erster.kurs;
  const guenstigster = gez.reduce((a, k) => (k.kurs < a.kurs ? k : a));
  const teuerster = gez.reduce((a, k) => (k.kurs > a.kurs ? k : a));
  const hatKurs = typeof aktuellerKurs === "number" && Number.isFinite(aktuellerKurs);
  const wert = hatKurs ? btc * aktuellerKurs : null;
  const einmalWert = hatKurs ? einmalBtc * aktuellerKurs : null;
  return {
    anzahl: gez.length,
    tage: Math.max(1, Math.round((jetzt - erster.ts) / 86_400_000)),
    investiert, btc, einmalBtc, wert, einmalWert,
    vorteil: hatKurs ? wert - einmalWert : null,
    vorteilSats: (btc - einmalBtc) * 1e8,
    guenstigster, teuerster, erster,
  };
}
