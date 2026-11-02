// =====================================================================
// einstellungen.js – Einstellungen: Sicherung, Abgleich mit der alten App,
// Erinnerungen, Darstellung, Speicher und "Über".
// =====================================================================

import { h, icon } from "./dom.js";
import { oeffneSheet } from "./ui/sheet.js";
import { toast } from "./ui/toast.js";
import { haptikAn } from "./ui/haptik.js";
import {
  SCHLUESSEL, lies, ladeEintraege, ladeEinstellungen, speichereEinstellung, ladeStatus, setzeStatus,
  ladeSicherungen, speichereEintraege, pruefeEintraege,
} from "./speicher.js";
import { leseSicherungsdatei, uebernimmSicherung, nimmAltenWert } from "./abgleich.js";
import { liesAlteEintraege } from "./altdaten.js";
import { ladeKaufkurse } from "./kurse.js";
import { APP_VERSION, SPARRATE_EUR, ZEITPLAN } from "./konfig.js";
import { datum, datumMonatKurz, zeitpunkt, vorZeit, anzahl, btc as btcFmt, euro } from "./format.js";
import { heuteBerlin } from "./zeit.js";
import { oeffnePushEinrichtung, erinnerungUmschalten } from "./benachrichtigung.js";

function schalter(an, beiWechsel, label) {
  const k = h("button", { type: "button", role: "switch", "aria-checked": String(an), "aria-label": label, class: "schalter", onclick: () => {
    an = !an; k.setAttribute("aria-checked", String(an)); beiWechsel(an);
  } }, h("span", { class: "schalter-knopf" }));
  return k;
}

const zeile = (titel, unter, rechts, onclick = null) => {
  const tag = onclick ? "button" : "div";
  return h(tag, { class: ["listen-zeile", onclick && "tippbar"], ...(onclick ? { type: "button", onclick } : {}) },
    h("span", { class: "listen-text" }, h("span", { class: "listen-titel" }, titel), unter ? h("span", { class: "listen-unter" }, unter) : null),
    rechts);
};
const gruppe = (titel, ...zeilen) => h("section", { class: "listen-gruppe" }, h("h3", { class: "label" }, titel), h("div", { class: "karte karte--liste" }, zeilen));

/** Sicherung als Datei herunterladen (oder teilen, wenn das Gerät es anbietet). */
export async function exportieren() {
  const daten = {
    format: "btc-sparplan", version: 1, app: APP_VERSION,
    exportiert: new Date().toISOString(),
    hinweis: "Sicherung deiner BTC-Sparplan-App. In der App unter Einstellungen → Sicherung einlesen wiederherstellbar.",
    sparplan: { sparrate: SPARRATE_EUR, zeitplan: ZEITPLAN },
    eintraege: ladeEintraege(),
    kaufkurse: ladeKaufkurse(),
    tageskurse: lies(SCHLUESSEL.tageskurse, {})?.kurse ?? {},
  };
  const name = `btc-sparplan-sicherung-${heuteBerlin()}.json`;
  const blob = new Blob([JSON.stringify(daten, null, 2)], { type: "application/json" });
  const datei = new File([blob], name, { type: "application/json" });
  if (navigator.canShare?.({ files: [datei] }) && matchMedia("(pointer: coarse)").matches) {
    try { await navigator.share({ files: [datei], title: "BTC-Sparplan Sicherung" }); setzeStatus({ letzterExport: Date.now() }); return true; } catch (e) { if (e.name === "AbortError") return false; }
  }
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: name, class: "unsichtbar" });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  setzeStatus({ letzterExport: Date.now() });
  return true;
}

function importieren(beiAenderung) {
  const eingabe = h("input", { type: "file", accept: ".json,application/json", class: "unsichtbar" });
  document.body.append(eingabe);
  eingabe.addEventListener("change", async () => {
    const f = eingabe.files?.[0];
    eingabe.remove();
    if (!f) return;
    if (f.size > 2_000_000) { toast("Die Datei ist zu groß für eine Sicherung.", { art: "fehler" }); return; }
    let vorschau;
    try { vorschau = leseSicherungsdatei(await f.text()); } catch (e) { toast(e.message, { art: "fehler", dauer: 6000 }); return; }
    zeigeImportVorschau(vorschau, beiAenderung);
  });
  eingabe.click();
}

function zeigeImportVorschau(v, beiAenderung) {
  let ueberschreiben = false;
  const knopf = h("button", { type: "button", class: "knopf knopf--primaer knopf--breit" });
  const beschriften = () => {
    const n = v.neu.length + (ueberschreiben ? v.abweichend.length : 0);
    knopf.textContent = n ? `${anzahl(n, "Kauf", "Käufe")} übernehmen` : "Nichts zu übernehmen";
    knopf.disabled = n === 0 && !Object.keys(v.tage).length;
  };
  const sheet = oeffneSheet({
    titel: "Sicherung einlesen",
    untertitel: `${v.art === "alt" ? "Sicherung der alten App" : "Sicherung dieser App"}${v.exportiert ? ` vom ${v.exportiert.slice(0, 10).split("-").reverse().join(".")}` : ""}`,
    inhalt: h("div", { class: "detail-stapel" },
      h("div", { class: "formel" },
        h("div", { class: "formel-zeile" }, h("span", { class: "formel-links" }, "Neue Käufe"), h("span", { class: "formel-rechts" }, String(v.neu.length))),
        h("div", { class: "formel-zeile" }, h("span", { class: "formel-links" }, "Schon identisch vorhanden"), h("span", { class: "formel-rechts" }, String(v.gleich.length))),
        h("div", { class: "formel-zeile" }, h("span", { class: "formel-links" }, "Abweichend von deinen Einträgen"), h("span", { class: "formel-rechts" }, String(v.abweichend.length))),
        v.fehler.length ? h("div", { class: "formel-zeile" }, h("span", { class: "formel-links" }, "Nicht lesbar"), h("span", { class: "formel-rechts" }, String(v.fehler.length))) : null),
      v.abweichend.length ? zeile("Abweichende ebenfalls übernehmen", `Betrifft ${v.abweichend.map(datumMonatKurz).join(", ")}. Sonst bleiben deine Einträge.`, schalter(false, (an) => { ueberschreiben = an; beschriften(); }, "Abweichende übernehmen")) : null,
      v.fehler.length ? h("p", { class: "fussnote" }, `Nicht lesbar: ${v.fehler.map((f) => `${f.montag} (${f.grund})`).join("; ")}`) : null,
      h("p", { class: "fussnote" }, "Vor dem Übernehmen legt die App automatisch einen Schnappschuss deiner jetzigen Einträge an.")),
    fuss: knopf,
  });
  beschriften();
  knopf.addEventListener("click", () => {
    try {
      const n = uebernimmSicherung(v, { abweichendeUeberschreiben: ueberschreiben });
      sheet.schliessen();
      beiAenderung();
      toast(n ? `${anzahl(n, "Kauf", "Käufe")} übernommen` : "Kursdaten übernommen", { art: "erfolg" });
    } catch (e) { toast(`Fehlgeschlagen: ${e.message}`, { art: "fehler" }); }
  });
}

function zeigeSchnappschuesse(beiAenderung) {
  const liste = ladeSicherungen();
  const sheet = oeffneSheet({
    titel: "Automatische Schnappschüsse",
    untertitel: "Vor jeder Änderung merkt sich die App den vorherigen Stand.",
    inhalt: liste.length ? h("div", { class: "karte karte--liste" }, liste.map((s) => {
      const n = Object.keys(pruefeEintraege(s.eintraege).gueltig).length;
      return zeile(`${zeitpunkt(s.zeit)} Uhr`, `vor: ${s.grund} · ${anzahl(n, "Eintrag", "Einträge")}`,
        h("button", { type: "button", class: "knopf knopf--klein", onclick: () => {
          try {
            speichereEintraege(pruefeEintraege(s.eintraege).gueltig, `Schnappschuss vom ${zeitpunkt(s.zeit)} wiederhergestellt`);
            sheet.schliessen(); beiAenderung(); toast("Stand wiederhergestellt", { art: "erfolg" });
          } catch (e) { toast(e.message, { art: "fehler" }); }
        } }, "Zurückholen"));
    })) : h("p", { class: "analyse-text" }, "Noch keine Schnappschüsse."),
  });
}

export function oeffneEinstellungen({ zustand, beiAenderung, abschnitt = null, app = null }) {
  const e = ladeEinstellungen();
  const status = ladeStatus();
  const abgleich = lies(SCHLUESSEL.abgleich, {}) || {};
  const alt = liesAlteEintraege();
  const eintraege = ladeEintraege();

  // Abweichungen zur alten App
  const abweichungen = (abgleich.abweichungen ?? []).filter((m) => alt.gueltig[m] && eintraege[m]);
  const abw = abweichungen.map((m) => {
    const a = alt.gueltig[m]; const n = eintraege[m];
    const txt = (x) => [x.btc != null ? `${btcFmt(x.btc)} BTC` : null, x.kurs != null ? euro(x.kurs, 0) : null].filter(Boolean).join(" · ");
    return zeile(`Abweichung ${datum(m)}`, `Hier: ${txt(n)} — alte App: ${txt(a)}`,
      h("button", { type: "button", class: "knopf knopf--klein", onclick: () => { nimmAltenWert(m); sheet.schliessen(); beiAenderung(); toast(`Wert der alten App für ${datumMonatKurz(m)} übernommen`); } }, "Alten nehmen"));
  });

  const speicherZeile = zeile("Dauerhafter Speicher", "Wird geprüft …", null);
  navigator.storage?.persisted?.().then((ja) => {
    speicherZeile.querySelector(".listen-unter").textContent = ja
      ? "Erteilt – der Browser löscht deine Daten nicht von sich aus."
      : "Nicht erteilt – installiere die App auf dem Startbildschirm, dann wird der Speicher meist dauerhaft. Sichere trotzdem regelmäßig.";
  });

  const inhalt = h("div", { class: "einstellungen" },
    gruppe("Erinnerungen",
      zeile("Hinweis bei fehlenden Käufen", "In der App und als Benachrichtigung, solange die App läuft.", schalter(e.erinnerung, (an) => { speichereEinstellung("erinnerung", an); erinnerungUmschalten(an); }, "Erinnerung")),
      zeile("Push aufs Handy", "Montagabend eine Nachricht, auch wenn die App geschlossen ist.", icon("pfeilRechts", { groesse: 18 }), () => oeffnePushEinrichtung())),
    gruppe("Deine Daten",
      zeile("Sicherung speichern", status.letzterExport ? `Zuletzt ${vorZeit(status.letzterExport)}` : "Noch nie gesichert – einmal im Monat ist eine gute Gewohnheit.", icon("sicherung", { groesse: 18 }), async () => { if (await exportieren()) toast("Sicherung erstellt", { art: "erfolg" }); }),
      zeile("Sicherung einlesen", "Aus dieser oder der alten App. Du siehst vorher, was sich ändert.", icon("laden", { groesse: 18 }), () => { sheet.schliessen(); importieren(beiAenderung); }),
      zeile("Schnappschüsse", `${anzahl(ladeSicherungen().length, "automatischer Stand", "automatische Stände")} zum Zurückholen`, icon("pfeilRechts", { groesse: 18 }), () => zeigeSchnappschuesse(beiAenderung)),
      speicherZeile),
    gruppe("Alte App",
      zeile("Neue Käufe aus der alten App übernehmen", alt.vorhanden
        ? `Zuletzt geprüft ${abgleich.zeit ? vorZeit(abgleich.zeit) : "–"} · insgesamt ${anzahl(abgleich.gesamtUebernommen ?? 0, "Eintrag", "Einträge")} übernommen. Die alte App wird nur gelesen, nie verändert.`
        : "In diesem Browser wurden keine Daten der alten App gefunden.",
      schalter(e.altAbgleich, (an) => speichereEinstellung("altAbgleich", an), "Abgleich mit alter App")),
      ...abw,
      alt.fehler.length ? zeile("Nicht lesbare Einträge der alten App", alt.fehler.map((f) => `${f.montag}: ${f.grund}`).join("; "), null) : null),
    gruppe("Darstellung",
      zeile("Dein Name", "Für den Gruß auf der Startseite.", h("input", { type: "text", class: "listen-eingabe", value: e.name, maxlength: 24, autocomplete: "off", "aria-label": "Dein Name", onchange: (ev) => { speichereEinstellung("name", ev.target.value); beiAenderung(); } })),
      zeile("Atmosphäre", "Nebel, Lichtleck und lebendes Filmkorn. Aus spart etwas Akku.", schalter(e.effekte, (an) => { speichereEinstellung("effekte", an); app?.setzeEffekte(an); }, "Atmosphäre")),
      zeile("Feines Vibrieren", "Beim Fahren über Käufe, Ringe und beim Speichern.", schalter(e.haptik, (an) => { speichereEinstellung("haptik", an); haptikAn(an); }, "Haptik")),
      zeile("Begrüßung erneut ansehen", "Das kurze Intro vom ersten Start.", icon("pfeilRechts", { groesse: 18 }), () => { sheet.schliessen(); setTimeout(() => app?.spieleIntro(), 450); })),
    gruppe("Über diese App",
      zeile("Version", `${APP_VERSION} · Daten seit ${status.migriert ? datum(new Date(status.migriert).toISOString().slice(0, 10)) : "heute"} in dieser App`, null),
      zeile("Kursquellen", "CryptoCompare, Coinbase, CoinGecko · Stimmung: alternative.me · Blöcke: mempool.space. Keine Konten, keine Schlüssel, keine Weitergabe deiner Daten.", null),
      zeile("Schriften & Bibliotheken", "Inter und Instrument Serif (SIL Open Font License), Chart.js 4.4.3 (MIT). Alles liegt im Repository selbst.", null),
      zeile("Hinweis", "Diese App zeigt Zahlen und rechnet nach. Sie ist keine Anlage- und keine Steuerberatung.", null)));

  const sheet = oeffneSheet({ titel: "Einstellungen", inhalt });
  if (abschnitt === "daten") setTimeout(() => inhalt.querySelector(".listen-gruppe:nth-child(3)")?.scrollIntoView({ behavior: "smooth", block: "start" }), 450);
  return sheet;
}

