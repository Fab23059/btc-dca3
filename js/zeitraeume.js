// =====================================================================
// zeitraeume.js – Die vier Zeiträume (Woche, Monat, Jahr, Alles) und
// welche Kursreihe zu welchem Zeitraum gehört.
// =====================================================================

import { kursBei } from "./rechnen.js";

const TAG = 86_400_000;

export const ZEITRAEUME = {
  woche: { text: "Woche", tage: 7, satz: "in 7 Tagen" },
  monat: { text: "Monat", tage: 30, satz: "in 30 Tagen" },
  jahr: { text: "Jahr", tage: 365, satz: "in 12 Monaten" },
  gesamt: { text: "Alles", tage: null, satz: "seit dem ersten Kauf" },
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
