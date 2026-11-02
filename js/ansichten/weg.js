// =====================================================================
// weg.js – "Weg": Dein Baum (jeder Kauf ein Ring), dein Anteil an allen
// Bitcoin, die Netzwerkuhr seit deinem ersten Kauf, Meilensteine und
// ein ruhiger Blick aufs Umfeld.
// =====================================================================

import { h, svg, fuelle, icon, wenigBewegung } from "../dom.js";
import { lebendigerBaum, hintergrundbild } from "../jahresringe.js";
import { meilensteine, zielName } from "../kennzahlen.js";
import { SPARRATE_EUR } from "../konfig.js";
import { holeBlockZurZeit } from "../kurse.js";
import { Zaehlwerk } from "../ui/zaehlwerk.js";
import { beimSichtbarWerden, feder, fokus } from "../ui/federwerk.js";
import { toast } from "../ui/toast.js";
import { euro, sats, ganz, anzahl, datumMonatKurz, datumLang, zahl, monatsname, vorZeit, datum } from "../format.js";
import { datumBerlin, zerlege, heuteBerlin } from "../zeit.js";
import { veraenderung, skelett } from "./gemeinsam.js";

const MENSCHEN = 8.2e9;                 // Weltbevölkerung 2026 (UN, gerundet)
const SATS_GESAMT = 21_000_000 * 1e8;   // alle Bitcoin, die es je geben wird
const FAIRER_ANTEIL = SATS_GESAMT / MENSCHEN;

const karte = (titel, ...inhalt) => h("section", { class: "karte karte--glanz weg-karte" }, titel ? h("h2", { class: "label" }, titel) : null, ...inhalt);

function stimmungText(w) {
  if (w < 25) return "Extreme Angst";
  if (w < 45) return "Angst";
  if (w < 55) return "Neutral";
  if (w < 75) return "Gier";
  return "Extreme Gier";
}

export function erstelleWeg(app) {
  const z = app.zustand;

  // ---- Der Baum ----
  const leinwand = h("canvas", { class: "baum", role: "img", "aria-label": "Dein Baum: jeder Kauf ist ein Ring" });
  const infoTitel = h("span", { class: "baum-info-titel" });
  const infoText = h("span", { class: "baum-info-text" });
  const info = h("div", { class: "baum-info", "aria-live": "polite" }, infoTitel, infoText);
  let ruheText = ["", ""];
  const setzeInfo = (titel, text) => {
    if (infoTitel.textContent === titel && infoText.textContent === text) return;
    infoTitel.textContent = titel; infoText.textContent = text;
    if (!wenigBewegung()) info.animate([{ opacity: 0.2, filter: "blur(4px)", transform: "translateY(4px)" }, { opacity: 1, filter: "blur(0)", transform: "none" }], { duration: 260, easing: "ease-out" });
  };
  const baum = lebendigerBaum(leinwand, {
    beimBeruehren: (kauf) => {
      if (!kauf) { setzeInfo(...ruheText); return; }
      setzeInfo(`Kauf Nr. ${kauf.nr} · ${datumLang(kauf.kaufdatum)}`, `${sats(kauf.btc * 1e8)} sats für ${euro(kauf.brutto)} · ${kauf.status === "eingetragen" ? "eingetragen" : "geschätzt"} · ${kauf.boerse}`);
    },
  });
  const exportKnopf = h("button", { type: "button", class: "knopf knopf--klein impuls baum-export", onclick: () => exportieren() }, icon("sicherung", { groesse: 16, strich: 2 }), h("span", null, "Als Hintergrundbild sichern"));
  const buehne = h("section", { class: "baum-buehne" },
    h("div", { class: "baum-halo", "aria-hidden": "true" }),
    leinwand,
    h("div", { class: "baum-dunst", "aria-hidden": "true" }, h("span"), h("span")),
    info);

  async function exportieren() {
    const kauf = z.kaeufe.filter((k) => k.gezaehlt);
    if (!kauf.length) return;
    exportKnopf.disabled = true;
    try {
      const s = z.summe;
      const blob = await hintergrundbild(kauf, { zeilen: ["Jeder Ring ein Montag.", `${anzahl(kauf.length, "Ring", "Ringe")} · ${sats(s.sats)} sats`, `seit ${datum(kauf[0].montag)}`] });
      const name = `mein-baum-${heuteBerlin()}.png`;
      const datei = new File([blob], name, { type: "image/png" });
      if (navigator.canShare?.({ files: [datei] }) && matchMedia("(pointer: coarse)").matches) {
        try { await navigator.share({ files: [datei], title: "Mein Baum" }); return; } catch (e) { if (e.name === "AbortError") return; }
      }
      const url = URL.createObjectURL(blob);
      const a = h("a", { href: url, download: name, class: "unsichtbar" });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast("Bild gespeichert. In der Galerie als Hintergrund festlegen.", { art: "erfolg" });
    } finally { exportKnopf.disabled = false; }
  }

  // ---- Dein Anteil an allen Bitcoin ----
  const anteilZahl = h("span", { class: "anteil-zahl" });
  const anteilWerk = new Zaehlwerk(anteilZahl, (n) => [["ganz", n == null ? "–" : String(Math.round(n))], ["einheit", " %"]], { einrollen: true });
  const anteilBogen = svg("circle", { cx: 60, cy: 60, r: 50, class: "anteil-bogen", pathLength: 100 });
  const anteilUeber = svg("circle", { cx: 60, cy: 60, r: 40, class: "anteil-ueber", pathLength: 100 });
  const anteilTitel = h("p", { class: "anteil-titel" });
  const anteilText = h("p", { class: "analyse-text" });
  const anteilKarte = karte("Dein Anteil an allen Bitcoin",
    h("div", { class: "anteil" },
      svg("svg", { viewBox: "0 0 120 120", class: "anteil-ring", "aria-hidden": "true" },
        svg("circle", { cx: 60, cy: 60, r: 50, class: "anteil-spur" }), anteilBogen,
        svg("circle", { cx: 60, cy: 60, r: 40, class: "anteil-spur anteil-spur--innen" }), anteilUeber),
      h("div", { class: "anteil-mitte" }, anteilZahl, h("span", { class: "anteil-unter" }, "deines fairen Anteils"))),
    anteilTitel, anteilText,
    h("p", { class: "fussnote" }, "Fairer Anteil = 21 Mio. Bitcoin (alle, die es je geben wird) geteilt durch rund 8,2 Mrd. Menschen ≈ 256.000 sats pro Kopf."));

  // ---- Netzwerkuhr ----
  const uhrZahl = h("span", { class: "zahl-mittel" });
  const uhrWerk = new Zaehlwerk(uhrZahl, (n) => [["ganz", n == null ? "–" : ganz(n)], ["einheit", " Blöcke"]], { einrollen: true });
  const uhrText = h("p", { class: "analyse-text" });
  const netzKarte = karte("Seit deinem ersten Kauf", uhrZahl, uhrText);

  const meilen = h("div");
  const markt = h("div");
  const el = h("div", { class: "seite-inhalt" },
    h("header", { class: "seiten-kopf" }, h("p", { class: "seiten-titel serif" }, "Dein Baum"), h("p", { class: "seiten-unter" }, "Jeder Kauf ist ein Ring. Je günstiger die Woche, desto breiter wächst er.")),
    buehne, h("div", { class: "baum-aktionen" }, exportKnopf), anteilKarte, netzKarte, meilen, markt);
  beimSichtbarWerden([anteilKarte, netzKarte]);

  // Der Anteil-Ring füllt sich erst, wenn er ins Bild kommt
  let anteilGezeigt = false;
  new IntersectionObserver((ee) => { if (ee.some((e) => e.isIntersecting) && !anteilGezeigt) { anteilGezeigt = true; zeigeAnteil(true); } }, { threshold: 0.4 }).observe(anteilKarte);

  function zeigeAnteil(animiert = false) {
    const s = z.summe;
    const prozent = (s.sats / FAIRER_ANTEIL) * 100;
    anteilTitel.textContent = prozent >= 100 ? (prozent >= 200 ? "Doppelt so viel wie dein fairer Anteil" : "Mehr als dein fairer Anteil") : "Auf dem Weg zu deinem fairen Anteil";
    anteilText.textContent = prozent >= 100
      ? `Würde man alle Bitcoin gerecht auf alle Menschen verteilen, bekäme jeder rund ${sats(FAIRER_ANTEIL)} sats. Du hast schon ${sats(s.sats)} – das ${zahl(prozent / 100, 1)}-Fache. Und es wächst jede Woche.`
      : `Würde man alle Bitcoin gerecht auf alle Menschen verteilen, bekäme jeder rund ${sats(FAIRER_ANTEIL)} sats. Du hast schon ${zahl(prozent, 0)} % davon – noch ${sats(FAIRER_ANTEIL - s.sats)} sats.`;
    if (!anteilGezeigt) return;
    anteilWerk.setze(prozent);
    const voll = Math.min(100, prozent); const ueber = Math.max(0, Math.min(100, prozent - 100));
    const setze = () => {
      anteilBogen.style.setProperty("stroke-dashoffset", String(100 - voll));
      anteilUeber.style.setProperty("stroke-dashoffset", String(100 - ueber));
    };
    if (animiert) requestAnimationFrame(() => requestAnimationFrame(setze)); else setze();
  }

  // ---- Netzwerkuhr ----
  let startBlock = null; let startGeholt = false;
  async function zeigeNetz() {
    const erster = z.kaeufe.find((k) => k.gezaehlt);
    const jetzt = z.markt?.block?.hoehe;
    if (!erster) { uhrText.textContent = "Beginnt mit dem ersten Kauf."; return; }
    if (startBlock == null && !startGeholt) {
      startGeholt = true;
      try { startBlock = await holeBlockZurZeit(erster.ts); } catch { startBlock = null; }
    }
    let bloecke; let geschaetzt = false;
    if (startBlock != null && jetzt) bloecke = jetzt - startBlock;
    else { bloecke = Math.round(((Date.now() - erster.ts) / 86_400_000) * 144); geschaetzt = true; }
    uhrWerk.setze(bloecke);
    const neu = bloecke * 3.125;
    uhrText.textContent = `${geschaetzt ? "Rund so viele" : "So viele"} Blöcke hat das Bitcoin-Netzwerk seit deinem ersten Kauf am ${datum(erster.montag)} gefunden – etwa alle zehn Minuten einer, Tag und Nacht. Dabei sind rund ${ganz(neu)} neue Bitcoin entstanden. Dein Plan läuft im selben Takt mit.`;
  }

  // ---- Meilensteine ----
  function zeigeMeilensteine() {
    const m = meilensteine(z.kaeufe, z.aktuell?.kurs, SPARRATE_EUR);
    const n = m.naechstes;
    const kopf = h("div", { class: "meilenstein-kopf" },
      h("p", { class: "zahl-mittel" }, h("span", { class: "z-ganz" }, sats(m.sats)), h("span", { class: "z-einheit" }, "sats")),
      h("p", { class: "text-2" }, m.sats ? `${zahl(m.sats / 1e6, 2)} % eines ganzen Bitcoin` : "Der erste Kauf startet alles"));
    const ausblick = n ? [
      h("div", { class: "fortschritt fortschritt--gross" }, h("span", { class: "fortschritt-fuellung", style: { "--anteil": String(n.fortschritt) } })),
      h("div", { class: "fortschritt-beschriftung" },
        h("span", null, `Nächstes Ziel: ${zielName(n.ziel)} sats`),
        h("span", { class: "text-3" }, `${zahl(n.fortschritt * 100, 0)} %`)),
      h("p", { class: "analyse-text" }, `Noch ${sats(n.fehlt)} sats${n.kaeufeNoch ? ` – beim heutigen Kurs etwa ${anzahl(n.kaeufeNoch, "Kauf", "Käufe")}` : ""}.${n.danach ? ` Danach wartet ${zielName(n.danach)}.` : ""}`),
    ] : [h("p", { class: "analyse-text" }, "Alle Sats-Ziele erreicht. Bemerkenswert.")];

    const punkte = [
      ...m.erreicht.map((e) => ({ titel: `${zielName(e.ziel)} sats`, unter: `erreicht am ${datumMonatKurz(e.am)} · Kauf Nr. ${e.kaufNr}`, art: "erreicht" })),
      ...(n ? [{ titel: `${zielName(n.ziel)} sats`, unter: n.kaeufeNoch ? `in etwa ${anzahl(n.kaeufeNoch, "Kauf", "Käufen")}` : "als Nächstes", art: "naechstes" }] : []),
      ...(n?.danach ? [{ titel: `${zielName(n.danach)} sats`, unter: "danach", art: "spaeter" }] : []),
    ];
    const pfad = h("ol", { class: "pfad" }, punkte.map((p, i) => h("li", { class: `pfad-punkt pfad-punkt--${p.art}`, style: { "--i": String(i) } },
      h("span", { class: "pfad-marke", "aria-hidden": "true" }),
      h("span", { class: "pfad-titel" }, p.titel), h("span", { class: "pfad-unter" }, p.unter))));

    const w = m.naechsteWoche;
    const wochen = h("div", { class: "wochen-serie" },
      h("p", { class: "zahl-mittel" }, h("span", { class: "z-ganz" }, ganz(m.wochen)), h("span", { class: "z-einheit" }, m.wochen === 1 ? "Woche" : "Wochen")),
      h("p", { class: "text-2" }, "in Folge, ohne Unterbrechung"),
      h("div", { class: "wochen-punkte", "aria-hidden": "true" }, Array.from({ length: Math.min(52, Math.max(m.wochen, w?.ziel ?? m.wochen)) }, (_, i) => h("span", { class: i < m.wochen ? "an" : "", style: { "--i": String(i) } }))),
      w ? h("p", { class: "analyse-text" }, `Nächster Halt: ${w.ziel} Wochen – noch ${anzahl(w.noch, "Woche", "Wochen")}.`) : null);

    const k1 = karte("Meilensteine", kopf, ...ausblick, pfad);
    const k2 = karte("Beständigkeit", wochen);
    fuelle(meilen, k1, k2);
    // Einlauf nur beim ersten Mal – spätere Aktualisierungen bleiben still
    if (ersteMeilen) beimSichtbarWerden([k1, k2]); else meilen.classList.add("still");
    ersteMeilen = false;
  }
  let ersteMeilen = true;

  // ---- Umfeld ----
  let nadelGezeigt = false;
  function zeigeMarkt() {
    const a = z.aktuell;
    const s = z.markt?.stimmung; const b = z.markt?.block;
    const satsFuer15 = a?.kurs ? (SPARRATE_EUR / a.kurs) * 1e8 : null;
    const heute = karte("Bitcoin heute",
      h("div", { class: "markt-zeile" },
        h("p", { class: "zahl-mittel" }, a ? euro(a.kurs, 0) : skelett("6em")),
        a?.aenderung24h != null ? veraenderung(null, a.aenderung24h, { klein: true }) : null),
      h("dl", { class: "werte-liste" },
        h("div", null, h("dt", null, "24 h Hoch"), h("dd", null, a?.hoch24h ? euro(a.hoch24h, 0) : "–")),
        h("div", null, h("dt", null, "24 h Tief"), h("dd", null, a?.tief24h ? euro(a.tief24h, 0) : "–")),
        h("div", null, h("dt", null, "Für 15 € gibt es"), h("dd", null, satsFuer15 ? `${sats(satsFuer15)} sats` : "–")),
        h("div", null, h("dt", null, "Stand"), h("dd", null, a ? vorZeit(a.zeit) : "–"))));

    let stimmung = null;
    if (s) {
      const nadel = svg("g", { class: "tacho-nadel" },
        svg("line", { x1: 64, y1: 60, x2: 64, y2: 16, class: "tacho-zeiger-linie" }),
        svg("circle", { cx: 64, cy: 60, r: 5, class: "tacho-nabe" }));
      const ziel = -90 + (s.wert / 100) * 180;
      nadel.style.setProperty("transform", `rotate(${nadelGezeigt ? ziel : -90}deg)`);
      const tacho = svg("svg", { viewBox: "0 0 128 70", class: "tacho", "aria-hidden": "true" },
        svg("defs", null, svg("linearGradient", { id: "tacho-verlauf", x1: 0, x2: 1, y1: 0, y2: 0 },
          svg("stop", { offset: "0", style: { "stop-color": "var(--minus)" } }), svg("stop", { offset: "0.5", style: { "stop-color": "var(--text-3)" } }), svg("stop", { offset: "1", style: { "stop-color": "var(--plus)" } }))),
        svg("path", { d: "M12,60 A52,52 0 0 1 116,60", class: "tacho-spur" }),
        svg("path", { d: "M12,60 A52,52 0 0 1 116,60", class: "tacho-bogen", stroke: "url(#tacho-verlauf)" }),
        nadel);
      stimmung = karte("Marktstimmung",
        h("div", { class: "stimmung" }, tacho,
          h("div", { class: "stimmung-text" }, h("p", { class: "zahl-mittel" }, String(s.wert)), h("p", { class: "text-2" }, stimmungText(s.wert)))),
        h("p", { class: "analyse-text" }, "Fear & Greed Index (0 = extreme Angst, 100 = extreme Gier). Die Stimmung schwankt – dein Plan bleibt derselbe."));
      if (!nadelGezeigt) {
        new IntersectionObserver((ee, b2) => {
          if (!ee.some((e) => e.isIntersecting)) return;
          b2.disconnect(); nadelGezeigt = true;
          const f = feder("gummi");
          nadel.style.setProperty("transition", `transform ${f.dauer + 500}ms ${f.kurve}`);
          requestAnimationFrame(() => nadel.style.setProperty("transform", `rotate(${ziel}deg)`));
        }, { threshold: 0.5 }).observe(stimmung);
      }
    }

    let halving = null;
    if (b) {
      const EPOCHE = 210_000;
      const naechstes = Math.ceil((b.hoehe + 1) / EPOCHE) * EPOCHE;
      const fehlt = naechstes - b.hoehe;
      const anteil = (b.hoehe % EPOCHE) / EPOCHE;
      const wann = new Date(b.zeit + fehlt * 10 * 60_000);
      const { jahr, monat } = zerlege(datumBerlin(wann.getTime()));
      halving = karte("Nächstes Halving",
        h("p", { class: "zahl-mittel" }, `${monatsname(monat)} ${jahr}`, h("span", { class: "text-3 zahl-zusatz" }, " (ca.)")),
        h("div", { class: "fortschritt" }, h("span", { class: "fortschritt-fuellung fortschritt-fuellung--ruhig", style: { "--anteil": String(anteil) } })),
        h("dl", { class: "werte-liste" },
          h("div", null, h("dt", null, "Aktueller Block"), h("dd", null, ganz(b.hoehe))),
          h("div", null, h("dt", null, "Halving bei Block"), h("dd", null, ganz(naechstes))),
          h("div", null, h("dt", null, "Noch"), h("dd", null, `${ganz(fehlt)} Blöcke`)),
          h("div", null, h("dt", null, "Etwa"), h("dd", null, `${ganz(fehlt / 144)} Tage`))),
        h("p", { class: "analyse-text" }, "Alle 210.000 Blöcke halbiert sich die Menge neuer Bitcoin. Ein Block entsteht etwa alle zehn Minuten."));
    }
    fuelle(markt, h("h2", { class: "abschnitt-titel" }, "Umfeld"), heute, stimmung, halving);
    if (ersterMarkt) beimSichtbarWerden([heute, stimmung, halving].filter(Boolean)); else markt.classList.add("still");
    ersterMarkt = false;
  }
  let ersterMarkt = true;

  let baumSig = "";
  return {
    el,
    aktualisiere() {
      const kauf = z.kaeufe.filter((k) => k.gezaehlt);
      const sig = kauf.map((k) => `${k.montag}:${k.btc.toFixed(8)}`).join();
      if (sig !== baumSig) { baumSig = sig; baum.setze(kauf); }
      ruheText = kauf.length
        ? [`${anzahl(kauf.length, "Ring", "Ringe")} · ${sats(z.summe.sats)} sats`, "Fahr mit dem Finger über die Ringe."]
        : ["Noch kein Ring", "Mit dem ersten Kauf beginnt dein Baum zu wachsen."];
      setzeInfo(...ruheText);
      zeigeAnteil();
      zeigeNetz();
      zeigeMeilensteine();
      zeigeMarkt();
    },
    betreten() { fokus([buehne, el.querySelector(".seiten-kopf")], { abstand: 90 }); },
  };
}
