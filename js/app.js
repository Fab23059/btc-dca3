// =====================================================================
// app.js – Die Steuerzentrale. Startet die App, hält den Zustand,
// verbindet Ansichten, Netz und Speicher.
//
// Ablauf beim Start:
//   1. Daten der alten App übernehmen (nur lesen) und eigene Daten laden
//   2. Sofort mit dem letzten bekannten Stand anzeigen (auch offline)
//   3. Im Hintergrund frische Kurse holen und alles nachziehen
//
// Oberfläche: eine Startseite, aus der sich Fenster entfalten
// (Käufe, Baum, Zahlen, Einstellungen, Eintragen). Siehe GESTALTUNG.md.
// =====================================================================

import { $, icon, fuelle } from "./dom.js";
import { SPARRATE_EUR, ZEITPLAN } from "./konfig.js";
import { ladeEintraege, ladeEinstellungen, lies, schreibe, SCHLUESSEL } from "./speicher.js";
import { abgleichMitAlterApp } from "./abgleich.js";
import { sparwochen, kaeufeBerechnen, zusammenfassung, kaufkurseZusammenfuehren } from "./rechnen.js";
import { meilensteine, SATS_ZIELE, WOCHEN_ZIELE, zielName } from "./kennzahlen.js";
import {
  holeAktuell, letzterBekannterKurs, ladeKaufkurse, ladeAltkurse, ergaenzeKaufkurse,
  holeReihe, holeTagesreihe, holeStimmung, holeBlockhoehe, holeAllzeithoch, ladeMarkt, speichereMarkt,
} from "./kurse.js";
import { zeitpunkt, anzahl, datumMonatKurz, euro, gruss } from "./format.js";
import { heuteBerlin } from "./zeit.js";
import { datumLang } from "./format.js";
import { Feder } from "./bewegung/feder.js";
import { druckAktivieren } from "./bewegung/geste.js";
import { baueNebel } from "./bewegung/nebel.js";
import { statusAnbinden, setzeStatus, toast } from "./teile/meldung.js";
import { erstelleHeute } from "./ansichten/heute.js";
import { oeffneKaeufe } from "./ansichten/kaeufe.js";
import { oeffneBaum } from "./ansichten/baum.js";
import { oeffneZahlen } from "./ansichten/zahlen.js";
import { oeffneMarkt } from "./ansichten/markt.js";
import { oeffneEintragen } from "./eintragen.js";
import { oeffneRechenweg } from "./rechenweg.js";
import { oeffneEinstellungen } from "./einstellungen.js";
import { planeErinnerung } from "./benachrichtigung.js";
import { feiern } from "./teile/funken.js";

// Nie in einem fremden Rahmen laufen (Schutz vor untergeschobenen Klicks).
if (window.top !== window.self) {
  document.documentElement.replaceChildren();
  throw new Error("Eingebettet – Start abgebrochen.");
}

// ---------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------

const zustand = {
  jetzt: Date.now(),
  eintraege: {},
  kaufkurse: {},
  aktuell: null,
  aktuellFrisch: false,
  reihen: {},
  tage: null,
  markt: {},
  wochen: [],
  kaeufe: [],
  summe: null,
  abgleich: null,
  laedt: false,
  offline: !navigator.onLine,
  letzteAktualisierung: 0,
};

function ladeLokal() {
  zustand.eintraege = ladeEintraege();
  zustand.kaufkurse = kaufkurseZusammenfuehren(ladeAltkurse(), ladeKaufkurse());
  zustand.aktuell ??= letzterBekannterKurs();
  zustand.markt = ladeMarkt();
}

function neuBerechnen() {
  zustand.jetzt = Date.now();
  zustand.wochen = sparwochen(ZEITPLAN, zustand.jetzt);
  zustand.kaeufe = kaeufeBerechnen({ wochen: zustand.wochen, eintraege: zustand.eintraege, kaufkurse: zustand.kaufkurse, jetzt: zustand.jetzt, sparrate: SPARRATE_EUR });
  zustand.summe = zusammenfassung(zustand.kaeufe, zustand.aktuell?.kurs ?? null);
}

// ---------------------------------------------------------------------
// Die App nach außen (für die Ansichten)
// ---------------------------------------------------------------------

const heuteEl = $("#heute");
let heute = null;
let nebel = null;

const app = {
  zustand,
  heuteEl,
  /** Alle sichtbaren Fenster-Köpfe (Kacheln und offene Fenster) – sie reisen mit durch die Zeit. */
  koepfe: new Set(),
  /** Wer neu zeichnen will, wenn sich Einträge ändern. */
  beiAenderung: new Set(),
  oeffneKaeufe: (herkunft) => oeffneKaeufe(app, herkunft),
  oeffneBaum: (herkunft) => oeffneBaum(app, herkunft),
  oeffneZahlen: (herkunft) => oeffneZahlen(app, herkunft),
  oeffneMarkt: (herkunft) => oeffneMarkt(app, herkunft),
  eintragen: (montag, herkunft = null) => oeffneEintragen({
    zustand, montag, beiAenderung: nachAenderung,
    herkunft: herkunft ?? document.querySelector(".stapel .kachel"),
    hintergrund: herkunft ? null : heuteEl,
  }),
  oeffneRechenweg: (art, quelle, zeitraum) => oeffneRechenweg(art, quelle, zustand, zeitraum ?? heute?.zeitraum ?? "gesamt"),
  oeffneEinstellungen: (abschnitt) => oeffneEinstellungen({ zustand, beiAenderung: nachAenderung, abschnitt, app, herkunft: $("#knopf-einstellungen") }),
  setzeEffekte: (an) => effekte(an),
  aktualisieren: (o) => aktualisieren(o),

  /** Bewegung B3: Zeitreise – alle Köpfe und der Nebel gehen mit. */
  zeitreise(info) {
    for (const k of app.koepfe) { try { k.zeitreise?.(info); } catch (e) { console.error(e); } }
    nebel?.ziehe({ zeitAnteil: info ? info.anteil - 1 : 0 });
    if (info) app.licht(0.55);
  },

  /** Regel 6: Licht entsteht durch Bewegung. Die Glut hinter der Zahl folgt der Energie. */
  licht(energie) {
    const ziel = 0.22 + 0.6 * Math.min(1, energie);
    if (ziel > glut.wert) glut.springe(ziel);
    glut.zu(0.22);
  },
};

const glutEl = $("#glut");
const glut = new Feder(0.22, { art: "ruhig", genau: 0.002, beiWert: (x) => {
  glutEl.style.opacity = x.toFixed(3);
  nebel?.licht((x - 0.22) / 0.6);
} });

// ---------------------------------------------------------------------
// Kopfzeile: Gruß → Datum; beim Scrollen der Wert
// ---------------------------------------------------------------------

const kopfLinks = $("#kopf-links");
let kopfArt = "";
function kopfText(art) {
  if (art === kopfArt && art !== "wert") return;
  kopfArt = art;
  let text;
  if (art === "gruss") { const n = ladeEinstellungen().name; text = `${gruss()}${n ? `, ${n}` : ""}`; }
  else if (art === "wert") text = zustand.summe?.wert != null ? euro(zustand.summe.wert) : "";
  else text = datumLang(heuteBerlin());
  if (kopfLinks.textContent === text) return;
  kopfLinks.classList.toggle("kopf-wert", art === "wert");
  kopfLinks.textContent = text;
  kopfLinks.animate([{ opacity: 0, transform: "translate3d(0, 6px, 0)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,.9,.25,1)" });
}
let grussBis = Date.now() + 4200;

const kopfEl = $("#kopf");
let kopfDeckung = "";
function beimScrollen() {
  const y = heuteEl.scrollTop;
  // Nur an der Kopfzeile setzen – an der Wurzel würde jedes Scrollbild die ganze Seite neu berechnen
  const deckung = Math.min(1, y / 40).toFixed(2);
  if (deckung !== kopfDeckung) { kopfDeckung = deckung; kopfEl.style.setProperty("--kopf-deckung", deckung); }
  nebel?.ziehe({ scrollAnteil: y / innerHeight });
  if (y > 190) kopfText("wert");
  else kopfText(Date.now() < grussBis ? "gruss" : "datum");
}

// ---------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------

function zeigeStatus() {
  const a = zustand.aktuell;
  if (zustand.laedt && !a) setzeStatus("Lädt", "laedt");
  else if (zustand.laedt) setzeStatus("Aktualisiert", "laedt");
  else if (zustand.aktuellFrisch && a) setzeStatus(`Live · ₿ ${euro(a.kurs, 0)}`, "live");
  else if (a) setzeStatus(`₿ ${euro(a.kurs, 0)} · ${zeitpunkt(a.zeit)}`, "alt");
  else setzeStatus("Offline", "alt");
}

let geplant = false;
function rendern({ ersteMal = false } = {}) {
  if (geplant && !ersteMal) return;
  geplant = true;
  requestAnimationFrame(() => {
    geplant = false;
    neuBerechnen();
    zeigeStatus();
    try { heute.aktualisiere({ ersteMal }); } catch (e) { console.error("Ansicht heute:", e); }
    for (const f of app.beiAenderung) { try { f(); } catch (e) { console.error(e); } }
    if (kopfArt === "wert") kopfText("wert");
    pruefeMeilensteine();
    pruefeNeuenKauf();
  });
}

function nachAenderung() {
  zustand.eintraege = ladeEintraege();
  neuBerechnen();
  heute.aktualisiere();
  for (const f of app.beiAenderung) { try { f(); } catch (e) { console.error(e); } }
}

// ---------------------------------------------------------------------
// Netz
// ---------------------------------------------------------------------

let laufend = null;
async function aktualisieren({ erzwingen = false } = {}) {
  if (laufend) return laufend;
  zustand.laedt = true;
  zeigeStatus();
  const ersterKauf = zustand.wochen[0]?.ts ?? Date.now();
  const merke = (p) => p.then(() => rendern());
  laufend = Promise.allSettled([
    merke(holeAktuell().then((a) => { zustand.aktuell = a; zustand.aktuellFrisch = true; })),
    merke(ergaenzeKaufkurse(zustand.wochen).then((r) => { zustand.kaufkurse = kaufkurseZusammenfuehren(ladeAltkurse(), r.kurse); })),
    merke(holeTagesreihe(ersterKauf, { erzwingen }).then((r) => { zustand.tage = r; })),
    merke(holeReihe("monat", { erzwingen }).then((r) => { zustand.reihen.monat = r; })),
    merke(holeReihe("tag", { erzwingen }).then((r) => { zustand.reihen.tag = r; })),
    holeAllzeithoch().catch(() => null),
    merke(holeStimmung().then((s) => { speichereMarkt({ stimmung: s }); zustand.markt = ladeMarkt(); })),
    merke(holeBlockhoehe().then((b) => { speichereMarkt({ block: b }); zustand.markt = ladeMarkt(); })),
  ]).then((ergebnisse) => {
    const kursFehlt = ergebnisse[0].status === "rejected";
    zustand.aktuellFrisch = !kursFehlt;
    zustand.offline = kursFehlt;
    zustand.letzteAktualisierung = Date.now();
    if (kursFehlt && erzwingen) toast(navigator.onLine ? "Keine Kursquelle antwortet" : "Keine Verbindung", { art: "fehler", dauer: 4500 });
  }).finally(() => {
    zustand.laedt = false;
    laufend = null;
    rendern();
  });
  return laufend;
}

/** Nur den aktuellen Kurs nachladen (jede Minute, solange die App sichtbar ist). */
async function kursTick() {
  if (document.hidden || laufend) return;
  try { zustand.aktuell = await holeAktuell(); zustand.aktuellFrisch = true; rendern(); } catch { zustand.aktuellFrisch = false; zeigeStatus(); }
}

// ---------------------------------------------------------------------
// Montagabend, 20:50: Ist die App gerade offen, wenn der Sparplan kauft,
// meldet die Statuszeile es und die Glut leuchtet auf.
// ---------------------------------------------------------------------
let letzterBlick = Date.now();
function pruefeNeuenKauf() {
  const jetzt = zustand.jetzt;
  const neu = zustand.kaeufe.find((k) => k.ts > letzterBlick && k.ts <= jetzt);
  letzterBlick = Math.max(letzterBlick, jetzt);
  if (!neu) return;
  app.licht(1);
  feiern({ staerke: 0.6 });
  toast("Dein Sparplan hat gekauft", { art: "erfolg", dauer: 7000, aktion: { text: "Eintragen", los: () => app.eintragen(neu.montag) } });
}

// ---------------------------------------------------------------------
// Meilensteine (einmal je Meilenstein)
// ---------------------------------------------------------------------
function pruefeMeilensteine() {
  const s = zustand.summe;
  if (!s?.anzahl || zustand.laedt || s.ohneKurs.length) return;
  const m = meilensteine(zustand.kaeufe, zustand.aktuell?.kurs, SPARRATE_EUR);
  const erreicht = [...SATS_ZIELE.filter((z) => m.sats >= z).map((z) => `s${z}`), ...WOCHEN_ZIELE.filter((w) => m.wochen >= w).map((w) => `w${w}`)];
  const gefeiert = lies(SCHLUESSEL.gefeiert);
  // Erster Start (auch nach der Übernahme aus der alten App): nichts nachfeiern
  if (!Array.isArray(gefeiert) || zustand.abgleich?.erstmalig) {
    if (zustand.abgleich) zustand.abgleich.erstmalig = false;
    schreibe(SCHLUESSEL.gefeiert, [...new Set([...(Array.isArray(gefeiert) ? gefeiert : []), ...erreicht])]);
    return;
  }
  const neu = erreicht.filter((x) => !gefeiert.includes(x));
  if (!neu.length) return;
  schreibe(SCHLUESSEL.gefeiert, [...new Set([...gefeiert, ...erreicht])]);
  const top = neu[neu.length - 1];
  app.licht(1);
  setTimeout(() => feiern({ staerke: 1 }), 300);
  toast(top[0] === "s" ? `${zielName(Number(top.slice(1)))} sats erreicht` : `${top.slice(1)} Wochen ohne Pause`, { art: "erfolg", dauer: 6000 });
}

// ---------------------------------------------------------------------
// Atmosphäre
// ---------------------------------------------------------------------
function effekte(an) {
  document.documentElement.classList.toggle("ruhig", !an);
  if (an && !nebel) nebel = baueNebel($("#nebel"));
}

// ---------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------
function start() {
  druckAktivieren();
  statusAnbinden({ el: $("#status"), kopfLinks });
  // Antippen der Statuszeile holt sofort frische Kurse (wie "Aktualisieren" in der alten App)
  $("#status").addEventListener("click", () => { if (!zustand.laedt) { app.licht(0.6); aktualisieren({ erzwingen: true }); } });
  const knopf = $("#knopf-einstellungen");
  fuelle(knopf, icon("zahnrad", { groesse: 19, strich: 1.6 }));
  knopf.addEventListener("click", () => app.oeffneEinstellungen());

  const einst = ladeEinstellungen();
  effekte(einst.effekte);
  try {
    zustand.abgleich = abgleichMitAlterApp({ aktiv: einst.altAbgleich });
  } catch (e) {
    console.error(e);
    toast("Abgleich mit der alten App fehlgeschlagen", { art: "fehler", dauer: 8000 });
  }
  ladeLokal();
  neuBerechnen();

  heute = erstelleHeute(app);
  fuelle($("#heute-inhalt"), heute.el);
  heute.ptrAnbinden(heuteEl);
  heuteEl.addEventListener("scroll", beimScrollen, { passive: true });
  kopfText("gruss");
  setTimeout(() => beimScrollen(), 4300);

  rendern({ ersteMal: true });
  document.documentElement.dataset.bereit = "1";

  const b = zustand.abgleich;
  const erstmalig = Boolean(b?.erstmalig);   // wird beim Prüfen der Meilensteine zurückgesetzt – vorher merken
  if (b?.uebernommen?.length) {
    const n = b.uebernommen.length;
    setTimeout(() => toast(erstmalig
      ? `${anzahl(n, "Kauf", "Käufe")} übernommen`
      : `${anzahl(n, "neuer Kauf", "neue Käufe")} übernommen${n <= 2 ? ` (${b.uebernommen.map(datumMonatKurz).join(", ")})` : ""}`, { art: "erfolg", dauer: 6000 }), 1400);
  }

  aktualisieren();
  setInterval(kursTick, 30_000);
  setInterval(() => aktualisieren(), 10 * 60_000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - zustand.letzteAktualisierung > 60_000) aktualisieren();
  });
  addEventListener("online", () => aktualisieren());
  addEventListener("offline", () => { zustand.aktuellFrisch = false; zeigeStatus(); });

  planeErinnerung(() => aktualisieren());

  // Aus einer Benachrichtigung geöffnet? → direkt zum Eintragen
  const param = new URLSearchParams(location.search).get("eintragen");
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    history.replaceState(null, "", location.pathname);
    setTimeout(() => app.eintragen(zustand.kaeufe.some((k) => k.montag === param) ? param : null), 700);
  }

  // Den Browser bitten, die Daten dauerhaft aufzubewahren
  navigator.storage?.persist?.().catch(() => {});

  if ("serviceWorker" in navigator) {
    // Trusted Types: Die einzige erlaubte Skript-Adresse ist "sw.js" – sonst nichts.
    const richtlinie = globalThis.trustedTypes?.createPolicy("dca3-sw", {
      createScriptURL: (u) => { if (u !== "sw.js") throw new Error("Nur sw.js ist erlaubt."); return u; },
    });
    navigator.serviceWorker.register(richtlinie ? richtlinie.createScriptURL("sw.js") : "sw.js", { scope: "./" }).catch((e) => console.warn("Service Worker:", e));
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.art === "eintragen" && /^\d{4}-\d{2}-\d{2}$/.test(e.data.montag ?? "")) app.eintragen(e.data.montag);
    });
  }
}

start();
