// =====================================================================
// abgleich.js – Übernimmt Käufe aus der alten App und aus Sicherungsdateien.
//
// Grundsatz: Es geht nie etwas verloren.
//   * Neue Einträge der alten App werden übernommen.
//   * Hat die alte App einen Eintrag geändert, den du hier NICHT angefasst
//     hast, wird die Änderung übernommen.
//   * Hast du denselben Montag hier selbst bearbeitet, gewinnt die neue App.
//     Der Unterschied wird als "Abweichung" angezeigt, du entscheidest.
//   * Löschungen in der alten App werden nie übernommen.
// =====================================================================

import { liesAlteEintraege, liesAlteMontagskurse, liesAlteTageskurse, liesAlteGefeiert, liesAlteReihen, altesSicherungsformat } from "./altdaten.js";
import {
  SCHLUESSEL, lies, schreibe, ladeEintraege, speichereEintraege, pruefeEintraege,
  ladeStatus, setzeStatus, reiheSchluessel,
} from "./speicher.js";

/** Sind zwei Einträge inhaltlich gleich (Menge, Kurs, Kauftag)? */
export function gleicherInhalt(a, b) {
  if (!a || !b) return false;
  return (a.btc ?? null) === (b.btc ?? null) && (a.kurs ?? null) === (b.kurs ?? null) && (a.datum ?? null) === (b.datum ?? null);
}

/** Nur die Inhaltsfelder (ohne Herkunft/Zeitstempel). */
function inhalt(e) {
  const o = {};
  if (e.btc != null) o.btc = e.btc;
  if (e.kurs != null) o.kurs = e.kurs;
  if (e.datum != null) o.datum = e.datum;
  return o;
}

/**
 * Reine Rechenfunktion (ohne Speicherzugriff, deshalb testbar).
 * alt          – aktuelle Einträge der alten App
 * schnappschuss – Einträge der alten App beim letzten Abgleich
 * neu          – Einträge dieser App
 */
export function abgleichen({ alt, schnappschuss, neu }) {
  const ergebnis = { ...neu };
  const uebernommen = [];
  const abweichungen = [];
  for (const [montag, a] of Object.entries(alt)) {
    const vorher = schnappschuss[montag];
    if (vorher && gleicherInhalt(vorher, a)) continue;          // in der alten App unverändert
    const n = neu[montag];
    if (!n) {
      ergebnis[montag] = { ...inhalt(a), herkunft: "alt" };
      uebernommen.push(montag);
    } else if (gleicherInhalt(n, a)) {
      // schon identisch – nichts zu tun
    } else if (n.herkunft === "alt") {
      ergebnis[montag] = { ...inhalt(a), herkunft: "alt" };   // hier nie angefasst → Änderung übernehmen
      uebernommen.push(montag);
    } else {
      abweichungen.push(montag);                               // hier bearbeitet → neue App gewinnt
    }
  }
  return { eintraege: ergebnis, uebernommen, abweichungen };
}

/**
 * Wird bei jedem Start aufgerufen. Beim allerersten Start übernimmt sie
 * zusätzlich Kurs-Zwischenspeicher und gefeierte Meilensteine.
 */
export function abgleichMitAlterApp({ aktiv = true } = {}) {
  const status = ladeStatus();
  const bericht = { erstmalig: !status.migriert, uebernommen: [], abweichungen: [], fehler: [], vorhanden: false };

  if (!status.migriert) {
    // Einmalig: Kursdaten der alten App als Startpolster übernehmen (nur in eigene Schlüssel).
    const tage = liesAlteTageskurse();
    if (Object.keys(tage).length) schreibe(SCHLUESSEL.tageskurse, { zeit: 0, kurse: { ...tage, ...(lies(SCHLUESSEL.tageskurse, {})?.kurse ?? {}) } });
    const montage = liesAlteMontagskurse();
    if (Object.keys(montage).length) schreibe(SCHLUESSEL.altkurse, montage);
    const gefeiert = liesAlteGefeiert();
    if (gefeiert.length && !lies(SCHLUESSEL.gefeiert)) schreibe(SCHLUESSEL.gefeiert, gefeiert);
    for (const [name, r] of Object.entries(liesAlteReihen())) {
      // Nur als veralteter Notvorrat; die Zeit 0 sorgt dafür, dass sofort neu geladen wird.
      if (!lies(reiheSchluessel("alt_" + name))) schreibe(reiheSchluessel("alt_" + name), { zeit: 0, punkte: r.punkte });
    }
  }

  if (!aktiv && status.migriert) return bericht;

  const alt = liesAlteEintraege();
  bericht.vorhanden = alt.vorhanden;
  bericht.fehler = alt.fehler;
  const stand = lies(SCHLUESSEL.abgleich, {}) || {};
  const schnappschuss = pruefeEintraege(stand.schnappschuss ?? {}).gueltig;

  if (alt.vorhanden && alt.roh !== stand.roh) {
    const neu = ladeEintraege();
    const r = abgleichen({ alt: alt.gueltig, schnappschuss, neu });
    if (r.uebernommen.length) speichereEintraege(r.eintraege, `Abgleich mit alter App (${r.uebernommen.length})`);
    bericht.uebernommen = r.uebernommen;
    bericht.abweichungen = r.abweichungen;
    schreibe(SCHLUESSEL.abgleich, {
      roh: alt.roh, schnappschuss: alt.gueltig, zeit: Date.now(),
      abweichungen: r.abweichungen, fehler: alt.fehler,
      gesamtUebernommen: (stand.gesamtUebernommen ?? 0) + r.uebernommen.length,
    });
  } else if (!alt.vorhanden && !stand.zeit) {
    schreibe(SCHLUESSEL.abgleich, { roh: null, schnappschuss: {}, zeit: Date.now(), abweichungen: [], fehler: [], gesamtUebernommen: 0 });
  } else {
    // Unverändert seit dem letzten Mal: offene Abweichungen trotzdem weiter melden,
    // solange sie bestehen.
    const neu = ladeEintraege();
    bericht.abweichungen = (stand.abweichungen ?? []).filter((m) => alt.gueltig[m] && neu[m] && !gleicherInhalt(alt.gueltig[m], neu[m]));
  }

  if (!status.migriert) setzeStatus({ migriert: Date.now() });
  return bericht;
}

/** Für eine Abweichung: den Wert der alten App übernehmen (auf ausdrücklichen Wunsch). */
export function nimmAltenWert(montag) {
  const alt = liesAlteEintraege().gueltig[montag];
  if (!alt) return false;
  const alle = ladeEintraege();
  alle[montag] = { ...inhalt(alt), herkunft: "alt" };
  speichereEintraege(alle, `Wert der alten App für ${montag} übernommen`);
  const stand = lies(SCHLUESSEL.abgleich, {}) || {};
  stand.abweichungen = (stand.abweichungen ?? []).filter((m) => m !== montag);
  schreibe(SCHLUESSEL.abgleich, stand);
  return true;
}

// ---------------------------------------------------------------------
// Sicherungsdateien (Import)
// Erkannt werden Dateien dieser App und der alten App (deren Format kennt altdaten.js).
// ---------------------------------------------------------------------

const MAX_DATEIGROESSE = 2_000_000; // 2 MB – eine echte Sicherung ist wenige KB groß

/**
 * Liest eine Sicherungsdatei – entweder aus der alten App
 * ({ btcdca_overrides_v1, btcdca_monday_prices_v4, btcdca_daily_closes_v2 })
 * oder aus dieser App ({ format: "btc-sparplan", eintraege }).
 * Liefert eine Vorschau, ohne etwas zu speichern.
 */
export function leseSicherungsdatei(text) {
  if (typeof text !== "string" || text.length > MAX_DATEIGROESSE) throw new Error("Die Datei ist zu groß für eine Sicherung.");
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error("Die Datei ist keine gültige Sicherung (kein JSON)."); }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("Die Datei ist keine gültige Sicherung.");

  let rohEintraege; let art; let tageRoh;
  const alt = altesSicherungsformat(obj);
  if (obj.format === "btc-sparplan") { rohEintraege = obj.eintraege; tageRoh = obj.tageskurse; art = "neu"; }
  else if (alt) { rohEintraege = alt.eintraege; tageRoh = alt.tageskurse; art = "alt"; }
  else throw new Error("In der Datei wurden keine Käufe gefunden.");

  const { gueltig, fehler } = pruefeEintraege(rohEintraege ?? {});
  const vorhanden = ladeEintraege();
  const neu = []; const gleich = []; const abweichend = [];
  for (const [montag, e] of Object.entries(gueltig)) {
    if (!vorhanden[montag]) neu.push(montag);
    else if (gleicherInhalt(vorhanden[montag], e)) gleich.push(montag);
    else abweichend.push(montag);
  }

  // Tageskurse aus der Datei (alt: btcdca_daily_closes_v2, neu: tageskurse)
  const tage = {};
  if (tageRoh && typeof tageRoh === "object") {
    for (const [tag, k] of Object.entries(tageRoh)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(tag) && typeof k === "number" && Number.isFinite(k) && k >= 100 && k <= 50_000_000) tage[tag] = k;
    }
  }
  return { art, gueltig, fehler, neu, gleich, abweichend, tage, exportiert: typeof obj.exportiert === "string" ? obj.exportiert.slice(0, 40) : null };
}

/** Übernimmt eine gelesene Sicherung. Abweichende Einträge nur, wenn ausdrücklich gewünscht. */
export function uebernimmSicherung(vorschau, { abweichendeUeberschreiben = false } = {}) {
  const alle = ladeEintraege();
  const montage = [...vorschau.neu, ...(abweichendeUeberschreiben ? vorschau.abweichend : [])];
  for (const m of montage) alle[m] = { ...inhalt(vorschau.gueltig[m]), herkunft: "import", geaendert: Date.now() };
  if (montage.length) speichereEintraege(alle, `Import aus Sicherungsdatei (${montage.length})`);
  if (Object.keys(vorschau.tage).length) {
    const vorh = lies(SCHLUESSEL.tageskurse, {}) || {};
    schreibe(SCHLUESSEL.tageskurse, { zeit: vorh.zeit ?? 0, kurse: { ...vorschau.tage, ...(vorh.kurse ?? {}) } });
  }
  return montage.length;
}
