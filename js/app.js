// =====================================================================
// app.js – Die Steuerzentrale. Startet die App, hält den Zustand,
// verbindet Ansichten, Netz und Speicher.
//
// Ablauf beim Start:
//   1. Daten der alten App übernehmen (nur lesen) und eigene Daten laden
//   2. Sofort mit dem letzten bekannten Stand anzeigen (auch offline)
//   3. Im Hintergrund frische Kurse holen und alles nachziehen
// =====================================================================

import { h, $, $$, icon, fuelle } from "./dom.js";
import { SPARRATE_EUR, ZEITPLAN } from "./konfig.js";
import { ladeEintraege, ladeEinstellungen, lies, schreibe, SCHLUESSEL } from "./speicher.js";
import { abgleichMitAlterApp } from "./abgleich.js";
import { sparwochen, kaeufeBerechnen, zusammenfassung } from "./rechnen.js";
import { meilensteine, SATS_ZIELE, WOCHEN_ZIELE, zielName } from "./kennzahlen.js";
import {
  holeAktuell, letzterBekannterKurs, ladeKaufkurse, ladeAltkurse, ergaenzeKaufkurse,
  holeReihe, holeTagesreihe, holeStimmung, holeBlockhoehe, ladeMarkt, speichereMarkt,
} from "./kurse.js";
import { uhrzeit, zeitpunkt, anzahl, datumMonatKurz } from "./format.js";
import { toast } from "./ui/toast.js";
import { ziehenZumAktualisieren } from "./ui/ptr.js";
import { erstelleDepot } from "./ansichten/depot.js";
import { erstelleKaeufe } from "./ansichten/kaeufe.js";
import { erstelleAnalyse } from "./ansichten/analyse.js";
import { erstelleWeg } from "./ansichten/weg.js";
import { oeffneEintragen } from "./eintragen.js";
import { oeffneRechenweg } from "./rechenweg.js";
import { oeffneEinstellungen } from "./einstellungen.js";
import { planeErinnerung } from "./benachrichtigung.js";
import { feiern } from "./ui/feier.js";

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
  zustand.kaufkurse = { ...ladeAltkurse(), ...ladeKaufkurse() };
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
// Oberfläche
// ---------------------------------------------------------------------

const SEITEN = [
  { id: "depot", titel: "Depot", symbol: "depot" },
  { id: "kaeufe", titel: "Käufe", symbol: "kaeufe" },
  { id: "analyse", titel: "Analyse", symbol: "analyse" },
  { id: "weg", titel: "Weg", symbol: "weg" },
];

const app = {
  zustand,
  eintragen: (montag, quelle) => oeffneEintragen({ zustand, montag, beiAenderung: nachAenderung }),
  oeffneRechenweg: (art, quelle) => oeffneRechenweg(art, quelle, zustand, ansichten.depot.zeitraum),
  oeffneEinstellungen: (abschnitt) => oeffneEinstellungen({ zustand, beiAenderung: nachAenderung, abschnitt }),
  wechsleSeite: (i) => zeigeSeite(i, true),
  ladeReihe: async (name) => {
    try { zustand.reihen[name] = await holeReihe(name); } catch (e) { zustand.reihen[name] ??= null; throw e; }
    return zustand.reihen[name];
  },
  aktualisieren: (o) => aktualisieren(o),
};

let ansichten = null;
let aktiveSeite = 0;
const pager = $("#pager");
const kopfTitel = $("#kopf-titel");
const kopfStatus = $("#kopf-status");
const kopf = $("#kopf");

function baueOberflaeche() {
  ansichten = {
    depot: erstelleDepot(app),
    kaeufe: erstelleKaeufe(app),
    analyse: erstelleAnalyse(app),
    weg: erstelleWeg(app),
  };
  for (const s of SEITEN) fuelle($(`#seite-${s.id}`), ansichten[s.id].el);

  // Tableiste mit gleitendem Indikator, der dem Wischen folgt
  const tabs = $("#tabs");
  const indikator = h("span", { class: "tab-indikator", "aria-hidden": "true" });
  fuelle(tabs, indikator, ...SEITEN.map((s, i) => h("button", {
    type: "button", class: "tab tippbar", role: "tab", id: `tab-${s.id}`, "aria-controls": `seite-${s.id}`,
    onclick: () => zeigeSeite(i, true),
  }, icon(s.symbol, { groesse: 22, klasse: "tab-symbol" }), h("span", { class: "tab-text" }, s.titel))));

  pager.addEventListener("scroll", () => {
    const b = pager.clientWidth || 1;
    const pos = pager.scrollLeft / b;
    tabs.style.setProperty("--pos", String(pos));
    const i = Math.round(pos);
    if (i !== aktiveSeite) markiereSeite(i);
  }, { passive: true });

  $("#knopf-einstellungen").addEventListener("click", () => app.oeffneEinstellungen());

  // Kopfzeile wird beim Scrollen zu Milchglas
  for (const s of $$(".seite")) {
    s.addEventListener("scroll", () => { if ($$(".seite")[aktiveSeite] === s) kopf.classList.toggle("ist-gescrollt", s.scrollTop > 4); }, { passive: true });
  }
  ziehenZumAktualisieren($$(".seite"), () => aktualisieren({ erzwingen: true }));
  markiereSeite(0);
}

function markiereSeite(i) {
  aktiveSeite = i;
  SEITEN.forEach((s, k) => {
    const t = $(`#tab-${s.id}`);
    t.setAttribute("aria-selected", String(k === i));
    t.classList.toggle("ist-aktiv", k === i);
    $(`#seite-${s.id}`).toggleAttribute("inert", k !== i);
  });
  kopfTitel.textContent = SEITEN[i].titel;
  kopf.classList.toggle("ist-gescrollt", ($$(".seite")[i]?.scrollTop ?? 0) > 4);
}

function zeigeSeite(i, sanft) {
  pager.scrollTo({ left: i * pager.clientWidth, behavior: sanft && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });
  markiereSeite(i);
}

function zeigeStatus() {
  const a = zustand.aktuell;
  let text; let art;
  if (zustand.laedt && !a) { text = "Lädt …"; art = "laedt"; }
  else if (zustand.laedt) { text = "Aktualisiert …"; art = "laedt"; }
  else if (zustand.aktuellFrisch && a) { text = `Live · ${uhrzeit(a.zeit)}`; art = "live"; }
  else if (a) { text = `Stand ${zeitpunkt(a.zeit)}`; art = "alt"; }
  else { text = "Offline"; art = "alt"; }
  fuelle(kopfStatus, h("span", { class: `status-punkt status-punkt--${art}`, "aria-hidden": "true" }), text);
  kopfStatus.setAttribute("aria-label", art === "alt" ? `Keine Verbindung, ${text}` : text);
}

let geplant = false;
function rendern({ ersteMal = false } = {}) {
  if (geplant && !ersteMal) return;
  geplant = true;
  requestAnimationFrame(() => {
    geplant = false;
    neuBerechnen();
    zeigeStatus();
    for (const [name, v] of Object.entries(ansichten)) {
      try { v.aktualisiere({ ersteMal }); } catch (e) { console.error(`Ansicht ${name}:`, e); }
    }
    pruefeMeilensteine();
  });
}

function nachAenderung() {
  zustand.eintraege = ladeEintraege();
  rendern();
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
    merke(ergaenzeKaufkurse(zustand.wochen).then((r) => { zustand.kaufkurse = { ...ladeAltkurse(), ...r.kurse }; })),
    merke(holeTagesreihe(ersterKauf, { erzwingen }).then((r) => { zustand.tage = r; })),
    merke(holeReihe("monat", { erzwingen }).then((r) => { zustand.reihen.monat = r; })),
    merke(holeStimmung().then((s) => { speichereMarkt({ stimmung: s }); zustand.markt = ladeMarkt(); })),
    merke(holeBlockhoehe().then((b) => { speichereMarkt({ block: b }); zustand.markt = ladeMarkt(); })),
  ]).then((ergebnisse) => {
    const kursFehlt = ergebnisse[0].status === "rejected";
    zustand.aktuellFrisch = !kursFehlt;
    zustand.offline = kursFehlt;
    zustand.letzteAktualisierung = Date.now();
    if (kursFehlt && erzwingen) toast(navigator.onLine ? "Keine Kursquelle antwortet gerade. Du siehst den letzten Stand." : "Keine Verbindung. Du siehst den letzten Stand.", { dauer: 5000 });
  }).finally(() => {
    zustand.laedt = false;
    laufend = null;
    rendern();
    ansichten.analyse.neuZeichnen?.();
  });
  return laufend;
}

/** Nur den aktuellen Kurs nachladen (jede Minute, solange die App sichtbar ist). */
async function kursTick() {
  if (document.hidden || laufend) return;
  try { zustand.aktuell = await holeAktuell(); zustand.aktuellFrisch = true; rendern(); } catch { zustand.aktuellFrisch = false; zeigeStatus(); }
}

// ---------------------------------------------------------------------
// Meilensteine feiern (einmal je Meilenstein)
// ---------------------------------------------------------------------

function pruefeMeilensteine() {
  const s = zustand.summe;
  // Nur mit vollständigen Daten prüfen – sonst würde ein halb geladener Stand etwas "neu" erreichen.
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
  feiern(top[0] === "s" ? `${zielName(Number(top.slice(1)))} sats erreicht` : `${top.slice(1)} Wochen ohne Unterbrechung`);
}

// ---------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------

function start() {
  const einst = ladeEinstellungen();
  try {
    zustand.abgleich = abgleichMitAlterApp({ aktiv: einst.altAbgleich });
  } catch (e) {
    console.error(e);
    toast(`Abgleich mit der alten App fehlgeschlagen: ${e.message}`, { art: "fehler", dauer: 8000 });
  }
  ladeLokal();
  neuBerechnen();
  const b = zustand.abgleich;
  const erstmalig = Boolean(b?.erstmalig);
  baueOberflaeche();
  rendern({ ersteMal: true });
  document.documentElement.dataset.bereit = "1";

  if (b?.uebernommen?.length) {
    const n = b.uebernommen.length;
    setTimeout(() => toast(erstmalig
      ? `Willkommen! ${anzahl(n, "Kauf", "Käufe")} aus der alten App übernommen.`
      : `${anzahl(n, "neuer Kauf", "neue Käufe")} aus der alten App übernommen${n <= 3 ? ` (${b.uebernommen.map(datumMonatKurz).join(", ")})` : ""}.`, { art: "erfolg", dauer: 6000 }), 900);
  }

  aktualisieren();
  setInterval(kursTick, 60_000);
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
    setTimeout(() => app.eintragen(zustand.kaeufe.some((k) => k.montag === param) ? param : null), 500);
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
