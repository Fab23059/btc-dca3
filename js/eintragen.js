// =====================================================================
// eintragen.js – Einen Kauf eintragen.
//
// Bewegung zuerst: Die Zeile des Kaufs entfaltet sich zum Formular (B1)
// und faltet sich nach dem Speichern in genau diese Zeile zurück – die
// dann schon ihren neuen Stand zeigt.
//
// Kauftag + Menge ODER Kurs genügt – das Fehlende rechnet die App aus
// und zeigt es live beim Tippen. Der automatisch geholte Kurs des Tages
// steht als Vorschlag bereit; Übernehmen ist ein Tipp.
// =====================================================================

import { h, svg, fuelle } from "./dom.js";
import { entfalte } from "./teile/fenster.js";
import { toast } from "./teile/meldung.js";
import { tick } from "./teile/haptik.js";
import { kaufZeile, markiereFrisch } from "./ansichten/kaeufe.js";
import { feiern } from "./teile/funken.js";
import { setzeEintrag, loescheEintrag, ladeEintraege, speichereEintraege } from "./speicher.js";
import { holeKursZumZeitpunkt } from "./kurse.js";
import { SPARRATE_EUR, ZEITPLAN, GRENZEN } from "./konfig.js";
import { phaseVon } from "./rechnen.js";
import { montagVon, istDatum, heuteBerlin, berlinZeitpunkt } from "./zeit.js";
import { euro, btc as btcFmt, sats, zahl, prozent, datumLang, datumMonatKurz, uhrzeit, leseZahl } from "./format.js";


const ERSTER_MONTAG = ZEITPLAN[0].erster;

/** Öffnet den Dialog. montag = null → der passendste offene Montag. */
export function oeffneEintragen({ zustand, montag = null, beiAenderung, herkunft = null, hintergrund = null }) {
  const heute = heuteBerlin();
  const eintraege = ladeEintraege();
  if (!montag) {
    const offen = [...zustand.kaeufe].reverse().find((k) => k.status === "geschaetzt" || k.status === "ohneKurs" || (k.status === "ausstehend" && k.montag === heute));
    montag = offen?.montag ?? zustand.kaeufe[zustand.kaeufe.length - 1]?.montag ?? ERSTER_MONTAG;
  }
  const urspruenglich = montag;
  const vorhanden = eintraege[montag] ?? null;

  // ---- Felder ----
  const datumFeld = h("input", { type: "date", class: "feld-eingabe", id: "ein-datum", min: ERSTER_MONTAG, max: heute, value: vorhanden?.datum ?? montag, required: true });
  const btcFeld = h("input", { type: "text", inputmode: "decimal", autocomplete: "off", spellcheck: "false", class: "feld-eingabe", id: "ein-btc", placeholder: "0,00024512", value: vorhanden?.btc != null ? zahl(vorhanden.btc, 8) : "" });
  const kursFeld = h("input", { type: "text", inputmode: "decimal", autocomplete: "off", spellcheck: "false", class: "feld-eingabe", id: "ein-kurs", placeholder: "z. B. 61.234,56", value: vorhanden?.kurs != null ? zahl(vorhanden.kurs, 2) : "" });

  const datumHilfe = h("p", { class: "feld-hilfe" });
  const btcHilfe = h("p", { class: "feld-hilfe" });
  const kursHilfe = h("p", { class: "feld-hilfe" });
  const vorschlag = h("div", { class: "vorschlag-bereich" });
  const rechnung = h("div", { class: "rechnung", "aria-live": "polite" });

  const feld = (fuer, titel, eingabe, einheit, hilfe, extra = null) => h("div", { class: "feld" },
    h("label", { class: "feld-label", for: fuer }, titel),
    h("div", { class: "feld-rahmen" }, eingabe, einheit ? h("span", { class: "feld-einheit" }, einheit) : null),
    hilfe, extra);

  const speichern = h("button", { type: "button", class: "knopf knopf--glut knopf--breit tippbar", onclick: () => sichern() }, h("span", null, "Speichern"));
  const entfernen = vorhanden ? h("button", { type: "button", class: "knopf knopf--leise knopf--gefahr knopf--breit", onclick: () => entfernenFragen() }, "Eintrag entfernen") : null;

  const formular = h("form", { class: "formular", novalidate: true, onsubmit: (e) => { e.preventDefault(); sichern(); } },
    h("p", { class: "formular-titel" }, vorhanden ? "Kauf bearbeiten" : "Kauf eintragen"),
    h("p", { class: "formular-unter" }, "So, wie er in Bitvavo steht. Menge oder Kurs genügt."),
    feld("ein-btc", "Gekaufte Menge", btcFeld, "BTC", btcHilfe),
    feld("ein-kurs", "Kurs", kursFeld, "€", kursHilfe, vorschlag),
    feld("ein-datum", "Kauftag", datumFeld, null, datumHilfe),
    rechnung,
    h("div", { class: "formular-fuss" }, speichern, entfernen));

  // Der Kopf ist dieselbe Zeile wie in der Liste – daraus entfaltet sich das Fenster
  const kauf = zustand.kaeufe.find((k) => k.montag === montag);
  let kopf = kauf ? kaufZeile(kauf) : null;
  kopf?.classList.add("kauf-zeile--kopf");
  let statusEl = kopf?.querySelector(".kz-status");
  let fortschritt = 1;
  const finde = () => (herkunft?.isConnected ? herkunft : null) ?? document.querySelector(`.fenster .kauf-zeile[data-montag="${montag}"]`) ?? herkunft;
  const sheet = entfalte({
    herkunft: () => finde(), radius: 0, mitPlus: false, hintergrund,
    titel: vorhanden ? "Kauf bearbeiten" : "Kauf eintragen",
    inhalt: h("div", { class: "fenster-kauf" }, kopf, formular),
    beiFortschritt: (p) => { fortschritt = p; if (statusEl) statusEl.style.transform = `translate3d(${(-48 * p).toFixed(1)}px, 0, 0)`; },
  });

  // ---- Vorschlag: Marktkurs zur Kaufzeit ----
  let vorschlagKurs = null;
  let vorschlagFuer = null;
  async function ladeVorschlag(m) {
    if (vorschlagFuer === m) return;
    vorschlagFuer = m;
    vorschlagKurs = null;
    const p = phaseVon(ZEITPLAN, m);
    if (!p) { fuelle(vorschlag); return; }
    const ts = berlinZeitpunkt(m, p.stunde, p.minute);
    if (ts > Date.now()) {
      // Noch vor der geplanten Kaufzeit: Bitvavo hat vielleicht schon gekauft – der Kurs von jetzt hilft beim Prüfen
      const a = zustand.aktuell;
      if (a?.kurs) zeigeVorschlag(a.kurs, a.zeit, a.quelle, "jetzt");
      else fuelle(vorschlag, h("p", { class: "feld-hilfe" }, `Geplant ist der Kauf um ${uhrzeit(ts)} Uhr.`));
      return;
    }
    const bekannt = zustand.kaufkurse[m];
    if (bekannt) { zeigeVorschlag(bekannt.kurs, ts, bekannt.quelle); return; }
    fuelle(vorschlag, h("span", { class: "vorschlag vorschlag--laedt" }, h("span", { class: "skelett", style: { width: "11em", height: "1em" } })));
    try {
      const r = await holeKursZumZeitpunkt(ts);
      if (vorschlagFuer === m) zeigeVorschlag(r.kurs, ts, r.quelle);
    } catch {
      if (vorschlagFuer === m) fuelle(vorschlag, h("p", { class: "feld-hilfe" }, "Kein Vorschlag – keine Kursquelle erreichbar."));
    }
  }
  let vorschlagJetzt = false;
  function zeigeVorschlag(kurs, ts, quelle, art = "kaufzeit") {
    vorschlagKurs = kurs;
    vorschlagJetzt = art === "jetzt";
    fuelle(vorschlag, h("button", { type: "button", class: "vorschlag tippbar", onclick: () => { kursFeld.value = zahl(kurs, 2); tick(); pruefen(); } },
      h("span", { class: "vorschlag-text" }, h("span", { class: "vorschlag-titel" }, art === "jetzt" ? `Kurs jetzt, ${uhrzeit(ts)} Uhr` : "Vorschlag"), ` ${euro(kurs)}`),
      h("span", { class: "vorschlag-quelle" }, `Marktkurs ${uhrzeit(ts)} Uhr${quelle ? ` · ${quelle}` : ""}`),
      h("span", { class: "vorschlag-los" }, "Übernehmen")));
    pruefen();
  }

  // ---- Live-Prüfung ----
  let ergebnis = null;
  function setzeHilfe(el, text, art = "") {
    el.textContent = text ?? "";
    el.className = `feld-hilfe${art ? ` feld-hilfe--${art}` : ""}`;
    el.parentElement.classList.toggle("hat-fehler", art === "fehler");
  }

  function pruefen() {
    ergebnis = null;
    let ok = true;

    // Kauftag → Sparwoche
    const tag = datumFeld.value;
    let wocheMontag = null; let phase = null;
    if (!istDatum(tag)) { setzeHilfe(datumHilfe, "Bitte einen Tag wählen.", "fehler"); ok = false; }
    else if (tag > heute) { setzeHilfe(datumHilfe, "Dieser Tag liegt in der Zukunft.", "fehler"); ok = false; }
    else if (tag < ERSTER_MONTAG) { setzeHilfe(datumHilfe, `Der Sparplan begann erst am ${datumLang(ERSTER_MONTAG, true)}.`, "fehler"); ok = false; }
    else {
      wocheMontag = montagVon(tag);
      phase = phaseVon(ZEITPLAN, wocheMontag);
      if (!phase) { setzeHilfe(datumHilfe, "In dieser Woche war kein Sparplan-Kauf vorgesehen.", "fehler"); ok = false; }
      else {
        const anderer = wocheMontag !== urspruenglich && eintraege[wocheMontag];
        setzeHilfe(datumHilfe, tag === wocheMontag
          ? `Sparwoche ${datumMonatKurz(wocheMontag)} · ${phase.boerse}${anderer ? " · ersetzt den vorhandenen Eintrag" : ""}`
          : `Gehört zur Sparwoche vom ${datumLang(wocheMontag)}${anderer ? " · ersetzt den vorhandenen Eintrag" : ""}`, anderer ? "warnung" : "");
        ladeVorschlag(wocheMontag);
      }
    }

    const netto = SPARRATE_EUR * (1 - (phase?.gebuehr ?? 0.0025));
    const b = leseZahl(btcFeld.value, "btc");
    const k = leseZahl(kursFeld.value, "kurs");
    const markt = vorschlagKurs;

    // Menge
    if (b === null) setzeHilfe(btcHilfe, "");
    else if (Number.isNaN(b)) { setzeHilfe(btcHilfe, "Das ist keine Zahl. Beispiel: 0,00024512", "fehler"); ok = false; }
    // "0", "0," oder "0,000" ist beim Tippen nur ein Anfang – erst beim Verlassen des Felds meckern
    else if (b <= 0 && document.activeElement === btcFeld && /^\s*0*([.,]0*)?\s*$/.test(btcFeld.value)) { setzeHilfe(btcHilfe, ""); ok = false; }
    else if (b <= 0) { setzeHilfe(btcHilfe, "Bitte eine Menge größer als 0.", "fehler"); ok = false; }
    else {
      const impliziert = netto / b;
      if (b >= 1000 && Number.isInteger(b)) {
        setzeHilfe(btcHilfe, `Sind das ${sats(b)} sats? Dann wären es ${zahl(b / 1e8, 8)} BTC.`, "fehler"); ok = false;
        btcHilfe.append(" ", h("button", { type: "button", class: "hilfe-knopf", onclick: () => { btcFeld.value = zahl(b / 1e8, 8); tick(); pruefen(); } }, "Umrechnen"));
      } else if (b > GRENZEN.btcMax || impliziert < 1000 || impliziert > 10_000_000) {
        setzeHilfe(btcHilfe, `Das ergäbe einen Kurs von ${euro(impliziert, 0)} – steht das Komma an der richtigen Stelle?`, "fehler"); ok = false;
      } else if (markt && k === null && Math.abs(impliziert / markt - 1) > 0.05) {
        setzeHilfe(btcHilfe, `= ${sats(b * 1e8)} sats · ergibt ${euro(impliziert, 0)} je BTC, ${vorschlagJetzt ? "der Kurs liegt gerade bei" : "der Marktkurs lag bei"} ${euro(markt, 0)}. Stimmt die Menge?`, "warnung");
      } else setzeHilfe(btcHilfe, `= ${sats(b * 1e8)} sats`);
    }

    // Kurs
    if (k === null) setzeHilfe(kursHilfe, "");
    else if (Number.isNaN(k)) { setzeHilfe(kursHilfe, "Das ist keine Zahl. Beispiel: 61.234,56", "fehler"); ok = false; }
    else if (k < GRENZEN.kursMin || k > GRENZEN.kursMax) { setzeHilfe(kursHilfe, "Dieser Kurs ist nicht plausibel.", "fehler"); ok = false; }
    else if (markt && Math.abs(k / markt - 1) > 0.25) setzeHilfe(kursHilfe, `Weicht um ${prozent(Math.abs(k / markt - 1) * 100, 0).replace("+", "")} vom Marktkurs dieses Tages ab – Tippfehler?`, "warnung");
    else setzeHilfe(kursHilfe, "");

    // Rechnung: das Fehlende ergänzen
    const bOk = typeof b === "number" && b > 0 && !btcHilfe.parentElement.classList.contains("hat-fehler");
    const kOk = typeof k === "number" && k > 0 && !kursHilfe.parentElement.classList.contains("hat-fehler");
    const zeile = (titel, wert, erkl) => h("div", { class: "rechnung-zeile" }, h("span", { class: "rechnung-titel" }, titel), h("span", { class: "rechnung-wert" }, wert), erkl ? h("span", { class: "rechnung-erkl" }, erkl) : null);
    if (bOk && kOk) {
      const summe = b * k;
      const passt = Math.abs(summe / netto - 1) <= 0.03;
      fuelle(rechnung, zeile("Menge × Kurs", euro(summe), passt ? `passt zu ${euro(SPARRATE_EUR)} abzüglich ${zahl((phase?.gebuehr ?? 0) * 100, 2)} % Gebühr` : `erwartet wären etwa ${euro(netto)} – bitte prüfen`));
      rechnung.classList.toggle("rechnung--warnung", !passt);
      ergebnis = { btc: b, kurs: k };
    } else if (bOk) {
      fuelle(rechnung, zeile("Kurs ergibt sich", euro(netto / b), `${euro(netto)} netto ÷ ${btcFmt(b)} BTC`));
      rechnung.classList.remove("rechnung--warnung");
      ergebnis = { btc: b };
    } else if (kOk) {
      fuelle(rechnung, zeile("Menge ergibt sich", `${btcFmt(netto / k)} BTC`, `${euro(netto)} netto ÷ Kurs · ${sats((netto / k) * 1e8)} sats`));
      rechnung.classList.remove("rechnung--warnung");
      ergebnis = { kurs: k };
    } else {
      fuelle(rechnung, h("p", { class: "rechnung-leer" }, "Trag die Menge aus Bitvavo ein – den Kurs rechnet die App selbst aus. Oder übernimm den vorgeschlagenen Marktkurs."));
      rechnung.classList.remove("rechnung--warnung");
    }
    if (!ergebnis) ok = false;
    if (ok && ergebnis) ergebnis = { ...ergebnis, montag: wocheMontag, datum: tag !== wocheMontag ? tag : undefined };
    else ergebnis = null;
    speichern.disabled = !ergebnis;
    return ok;
  }

  // Eingefügt (z. B. "+ 0.00022552 BTC" aus Bitvavo) oder beim Verlassen des Felds:
  // gleich in die saubere Schreibweise bringen, damit man sieht, was die App verstanden hat
  const aufraeumen = (f, art) => {
    const n = leseZahl(f.value, art);
    if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return;
    const sauber = art === "btc" ? zahl(n, 8) : zahl(n, 2);
    if (f.value.trim() !== sauber && /[^0-9.,]/.test(f.value.trim())) { f.value = sauber; tick(); }
  };
  for (const [f, art] of [[btcFeld, "btc"], [kursFeld, "kurs"]]) {
    f.addEventListener("input", (e) => { if (e.inputType === "insertFromPaste" || e.inputType === "insertReplacementText") aufraeumen(f, art); });
    f.addEventListener("blur", () => { aufraeumen(f, art); pruefen(); });
  }
  for (const f of [datumFeld, btcFeld, kursFeld]) f.addEventListener("input", pruefen);
  datumFeld.addEventListener("change", pruefen);
  btcFeld.addEventListener("blur", pruefen);
  pruefen();
  // Auf dem Handy nicht sofort die Tastatur öffnen (sie würde das Entfalten stören)
  if (!vorhanden && matchMedia("(pointer: fine)").matches) setTimeout(() => btcFeld.focus({ preventScroll: true }), 650);
  // Fokus: Die Linie unter dem Feld zündet an der Stelle, an der getippt wurde
  for (const f of [btcFeld, kursFeld, datumFeld]) {
    f.addEventListener("pointerdown", (e) => {
      const r = f.parentElement.getBoundingClientRect();
      f.parentElement.style.setProperty("--zuend-x", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    });
  }

  // ---- Speichern / Entfernen ----
  function sichern() {
    if (!pruefen() || !ergebnis) return;
    const { montag: m, ...daten } = ergebnis;
    // Vor der geplanten Kaufzeit eingetragen? Dann gilt dieser Moment als Kaufzeit
    // (spätestens jetzt hat Bitvavo gekauft). Beim Bearbeiten bleibt der erste Zeitpunkt.
    const plan = phaseVon(ZEITPLAN, m);
    const geplant = plan ? berlinZeitpunkt(m, plan.stunde, plan.minute) : 0;
    if (m === urspruenglich && vorhanden?.zeit != null) daten.zeit = vorhanden.zeit;
    else if (geplant > Date.now()) daten.zeit = Date.now();
    try {
      // Wurde der Kauftag in eine andere Woche verschoben, den alten Eintrag entfernen
      if (vorhanden && m !== urspruenglich) {
        const alle = ladeEintraege();
        delete alle[urspruenglich];
        speichereEintraege(alle, `Kauf ${urspruenglich} nach ${m} verschoben`);
      }
      setzeEintrag(m, daten);
    } catch (e) {
      toast(`Nicht gespeichert: ${e.message}`, { art: "fehler", dauer: 7000 });
      return;
    }
    tick(10);
    // Der Knopf verwandelt sich in einen leuchtenden Haken, Funken sprühen, dann schließt sich das Sheet
    const r = speichern.getBoundingClientRect();
    feiern({ x: r.left + r.width / 2, y: r.top + r.height / 2, staerke: 0.35 });
    speichern.classList.add("ist-fertig");
    speichern.append(h("span", { class: "knopf-haken", "aria-hidden": "true" }, svg("svg", { viewBox: "0 0 24 24" }, svg("path", { d: "M5 12.5l4.5 4.5L19 7.5", pathLength: 1 }))));
    speichern.disabled = false; speichern.style.setProperty("pointer-events", "none");
    setTimeout(() => {
      markiereFrisch(m);
      beiAenderung?.();       // Liste zeigt schon den neuen Stand …
      // … und der Kopf des Fensters auch – so landet es auf der neuen Zeile
      const neu = zustand.kaeufe.find((k) => k.montag === m);
      if (neu && kopf) {
        const ersatz = kaufZeile(neu);
        ersatz.classList.add("kauf-zeile--kopf");
        kopf.replaceWith(ersatz); kopf = ersatz;
        statusEl = kopf.querySelector(".kz-status");
        statusEl.style.transform = `translate3d(${(-48 * fortschritt).toFixed(1)}px, 0, 0)`;
      }
      sheet.schliessen();     // … und das Fenster faltet sich in die neue Zeile
      toast(`Kauf vom ${datumMonatKurz(m)} gespeichert`, { art: "erfolg" });
    }, 560);
  }

  let bestaetigen = null;
  function entfernenFragen() {
    if (!bestaetigen) {
      entfernen.textContent = "Wirklich entfernen?";
      entfernen.classList.add("ist-scharf");
      bestaetigen = setTimeout(() => { entfernen.textContent = "Eintrag entfernen"; entfernen.classList.remove("ist-scharf"); bestaetigen = null; }, 4000);
      return;
    }
    clearTimeout(bestaetigen);
    let alt;
    try { alt = loescheEintrag(urspruenglich); } catch (e) { toast(`Nicht entfernt: ${e.message}`, { art: "fehler" }); return; }
    beiAenderung?.();
    sheet.schliessen();
    toast(`Eintrag vom ${datumMonatKurz(urspruenglich)} entfernt`, {
      aktion: { text: "Rückgängig", los: () => {
        try { setzeEintrag(urspruenglich, alt, alt.herkunft ?? "neu"); beiAenderung?.(); toast("Wiederhergestellt", { art: "erfolg" }); } catch (e) { toast(e.message, { art: "fehler" }); }
      } },
    });
  }
  return sheet;
}

