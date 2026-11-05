// =====================================================================
// markt.js – Das Fenster "Bitcoin": der Kurs, live.
//
// Kopf (auch als Kachel ganz oben auf der Startseite): der Kurs als
// Zählwerk, die Veränderung in 24 Stunden, ein glühender 24-h-Verlauf
// und der Abstand zu deinem Ø-Kaufpreis. Bei der Zeitreise zeigt er den
// Kurs von damals.
//
// Im Fenster: Kursverlauf (1 Stunde bis alles) mit deinen Käufen,
// Marktdaten, Allzeithoch, wie viel geschürft ist, Marktstimmung,
// Halving-Countdown und Schlagzeilen.
// =====================================================================

import { h, svg, fuelle, wenigBewegung } from "../dom.js";
import { Ziffern } from "../bewegung/ziffern.js";
import { Feder, klemme } from "../bewegung/feder.js";
import { entfalte } from "../teile/fenster.js";
import { kurslinie } from "../teile/kurslinie.js";
import { tick } from "../teile/haptik.js";
import { SPARRATE_EUR } from "../konfig.js";
import { holeReihe, ladeAllzeithoch, holeAllzeithoch, holeNachrichten, ladeMarkt } from "../kurse.js";
import { euro, zahl, sats, ganz, uhrzeit, datum, datumLang, vorZeit, monatsname, wochentagKurz, MINUS } from "../format.js";
import { datumBerlin, zerlege } from "../zeit.js";
import { euroTeile, ganzTeile, kopfPlus } from "./gemeinsam.js";

const BEREICHE = [
  ["stunde", "1S"], ["tag", "1T"], ["woche", "1W"], ["monat", "1M"], ["jahr", "1J"], ["jahre5", "5J"], ["max", "Max"],
];
const BEREICH_SATZ = { stunde: "in 1 Stunde", tag: "in 24 Stunden", woche: "in 7 Tagen", monat: "in 30 Tagen", jahr: "in 12 Monaten", jahre5: "in 5 Jahren", max: "seit Beginn der Daten" };

export function stimmungWort(w) {
  if (w < 25) return "extreme Angst";
  if (w < 45) return "Angst";
  if (w < 55) return "neutral";
  if (w < 75) return "Gier";
  return "extreme Gier";
}

const mrd = (n) => (n == null ? "–" : `${zahl(n / 1e9, n >= 1e12 ? 0 : 1)} Mrd. €`);
const relativ = (kurs, ref) => (kurs != null && ref ? (kurs / ref - 1) * 100 : null);

/** Der kleine 24-h-Verlauf: glühende Linie, die sich beim Erscheinen einzeichnet. */
function funke() {
  const pfad = svg("path", { class: "mk-funke-linie", d: "", pathLength: 1 });
  const schein = svg("path", { class: "mk-funke-schein", d: "" });
  const flaeche = svg("path", { class: "mk-funke-flaeche", d: "" });
  const ende = svg("circle", { class: "mk-funke-ende", r: 3, cx: -10, cy: -10 });
  const el = svg("svg", { class: "mk-funke", viewBox: "0 0 150 64", preserveAspectRatio: "none", "aria-hidden": "true" },
    svg("defs", null, svg("linearGradient", { id: "mk-verlauf", x1: 0, y1: 0, x2: 0, y2: 1 },
      svg("stop", { offset: "0", "stop-color": "rgb(255,138,42)", "stop-opacity": "0.35" }),
      svg("stop", { offset: "1", "stop-color": "rgb(255,138,42)", "stop-opacity": "0" }))),
    flaeche, schein, pfad, ende);
  let signatur = "";
  return {
    el,
    setze(punkte) {
      if (!punkte || punkte.length < 2) return;
      const sig = `${punkte.length}|${punkte[0].t}|${punkte[punkte.length - 1].c}`;
      if (sig === signatur) return;
      const neu = !signatur;
      signatur = sig;
      const a = punkte[0].t; const b = punkte[punkte.length - 1].t;
      let lo = Infinity; let hi = -Infinity;
      for (const p of punkte) { lo = Math.min(lo, p.c); hi = Math.max(hi, p.c); }
      const X = (t) => ((t - a) / (b - a || 1)) * 146 + 2;
      const Y = (c) => 6 + (1 - (c - lo) / (hi - lo || 1)) * 52;
      const schritt = Math.max(1, Math.floor(punkte.length / 120));
      let d = "";
      for (let i = 0; i < punkte.length; i += schritt) d += `${d ? "L" : "M"}${X(punkte[i].t).toFixed(1)},${Y(punkte[i].c).toFixed(1)}`;
      const l = punkte[punkte.length - 1];
      d += `L${X(l.t).toFixed(1)},${Y(l.c).toFixed(1)}`;
      pfad.setAttribute("d", d); schein.setAttribute("d", d);
      flaeche.setAttribute("d", `${d}L148,64L2,64Z`);
      ende.setAttribute("cx", X(l.t).toFixed(1)); ende.setAttribute("cy", Y(l.c).toFixed(1));
      el.classList.toggle("ist-runter", l.c < punkte[0].c);
      if (neu && !wenigBewegung()) { el.classList.remove("zeichnet"); void el.getBoundingClientRect(); el.classList.add("zeichnet"); }
    },
  };
}

export function marktKopf(app) {
  const z = app.zustand;
  const unter = h("p", { class: "fkopf-unter" });
  const zahlEl = h("span", { class: "mk-zahl" });
  const werk = new Ziffern(zahlEl, { teile: euroTeile({ stellen: 0 }), beiEnergie: (e) => app.licht(e * 0.6), beschreibung: (t) => `Bitcoin-Kurs ${t}` });
  const zeile = h("p", { class: "mk-zeile" });
  const f = funke();
  const fussL = h("span", { class: "mk-fuss-links" });
  const fussR = h("span", { class: "mk-fuss-rechts zahl" });
  const live = h("span", { class: "live-punkt", "aria-hidden": "true" });
  const el = h("div", { class: "fkopf fkopf--markt" },
    h("h2", { class: "fkopf-titel" }, "Bitcoin", live), unter, kopfPlus(),
    h("div", { class: "mk-kurs" }, zahlEl), zeile,
    h("div", { class: "mk-funke-halter" }, f.el),
    h("p", { class: "mk-fuss" }, fussL, fussR));
  let zeit = null; let kursDamals = null; let erstes = true;

  const zeige = () => {
    const a = z.aktuell;
    const s = z.summe;
    live.classList.toggle("ist-live", Boolean(z.aktuellFrisch && a));
    if (!a) { werk.setze(null); fuelle(unter, "Kurs wird geladen"); fuelle(zeile); return; }
    f.setze(z.reihen.tag?.punkte);
    if (zeit != null && kursDamals != null) {
      werk.eilig = true;
      werk.setze(kursDamals);
      unter.textContent = `Kurs am ${datumLang(datumBerlin(zeit))}`;
      const r = relativ(a.kurs, kursDamals);
      fuelle(zeile, veraenderungProzent(r), h("span", { class: "mk-zeile-zusatz" }, "bis heute"));
      fussL.textContent = `Für 15 € gab es ${sats((SPARRATE_EUR / kursDamals) * 1e8)} sats`;
      fussR.textContent = "";
      return;
    }
    werk.eilig = false;
    werk.setze(a.kurs, { einrollen: erstes });
    erstes = false;
    unter.textContent = z.aktuellFrisch ? `Live · ${uhrzeit(a.zeit)} Uhr · ${a.quelle ?? ""}` : `Stand ${datum(datumBerlin(a.zeit))}, ${uhrzeit(a.zeit)} Uhr`;
    fuelle(zeile, veraenderungProzent(a.aenderung24h), h("span", { class: "mk-zeile-zusatz" }, "in 24 Stunden"));
    const r = relativ(a.kurs, s?.durchschnitt);
    if (r != null) {
      fussL.textContent = `Ø Kaufpreis ${euro(s.durchschnitt, 0)}`;
      fussR.textContent = `${r >= 0 ? "+" : MINUS}${zahl(Math.abs(r), 1)} % ${r >= 0 ? "darüber" : "darunter"}`;
      fussR.classList.toggle("ist-plus", r >= 0); fussR.classList.toggle("ist-minus", r < 0);
    } else { fussL.textContent = `1 € = ${sats(1e8 / a.kurs)} sats`; fussR.textContent = ""; }
  };
  return {
    el,
    aktualisiere() { zeige(); },
    zeitreise(info) { zeit = info?.t ?? null; kursDamals = info?.kurs ?? null; zeige(); },
  };
}

function veraenderungProzent(p) {
  if (p == null || !Number.isFinite(p)) return h("span", { class: "text-3" }, "–");
  const art = p > 0.005 ? "plus" : p < -0.005 ? "minus" : "null";
  return h("span", { class: `veraenderung veraenderung--${art}` },
    h("span", { class: "veraenderung-pfeil", "aria-hidden": "true" }, art === "plus" ? "▲" : art === "minus" ? "▼" : "•"),
    h("span", { class: "zahl" }, `${p > 0 ? "+" : p < 0 ? MINUS : ""}${zahl(Math.abs(p), 2)} %`));
}

/** Fear & Greed als Halbkreis mit federndem Zeiger. */
function stimmungsUhr(wert) {
  const R = 78; const CX = 96; const CY = 92;
  const bogen = (von, bis) => {
    const p = (w) => { const a = Math.PI * (1 - w / 100); return [CX + R * Math.cos(a), CY - R * Math.sin(a)]; };
    const [x1, y1] = p(von); const [x2, y2] = p(bis);
    return `M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)}`;
  };
  const zeiger = svg("g", { class: "uhr-zeiger" },
    svg("line", { x1: CX, y1: CY, x2: CX, y2: CY - R + 14, class: "uhr-nadel" }),
    svg("circle", { cx: CX, cy: CY, r: 5.5, class: "uhr-nabe" }));
  const el = svg("svg", { class: "uhr", viewBox: "0 0 192 104", "aria-hidden": "true" },
    svg("defs", null, svg("linearGradient", { id: "uhr-verlauf", x1: 0, y1: 0, x2: 1, y2: 0 },
      svg("stop", { offset: "0", "stop-color": "#E36F5B" }), svg("stop", { offset: "0.5", "stop-color": "#A0988E" }), svg("stop", { offset: "1", "stop-color": "#7FD39A" }))),
    svg("path", { d: bogen(0, 100), class: "uhr-spur" }),
    svg("path", { d: bogen(0, 100), class: "uhr-bogen" }),
    ...[0, 25, 50, 75, 100].map((w) => { const a = Math.PI * (1 - w / 100); return svg("line", { x1: CX + (R + 9) * Math.cos(a), y1: CY - (R + 9) * Math.sin(a), x2: CX + (R + 4) * Math.cos(a), y2: CY - (R + 4) * Math.sin(a), class: "uhr-strich" }); }),
    zeiger);
  const feder = new Feder(-90, { antwort: 1.1, daempfung: 0.42, genau: 0.05, beiWert: (g) => zeiger.setAttribute("transform", `rotate(${g.toFixed(2)} ${CX} ${CY})`) });
  feder.springe(-90);
  return { el, los: () => { const ziel = -90 + (klemme(wert, 0, 100) / 100) * 180; if (wenigBewegung()) feder.springe(ziel); else feder.zu(ziel); } };
}

function balken(anteil, art = "glut") {
  const fuellung = h("span", { class: "zb-fuellung" });
  const el = h("span", { class: ["zb", `zb--${art}`], "aria-hidden": "true" }, fuellung);
  const f = new Feder(0, { art: "raum", genau: 0.001, beiWert: (x) => { fuellung.style.transform = `scaleX(${x.toFixed(4)})`; } });
  return { el, los: () => (wenigBewegung() ? f.springe(klemme(anteil)) : f.zu(klemme(anteil))) };
}

const abschnitt = (titel, ...inhalt) => h("section", { class: "zahl-abschnitt" }, h("h3", { class: "zahl-abschnitt-titel" }, titel), ...inhalt);
const gross = (...t) => h("p", { class: "zahl-gross zahl" }, ...t);
const satz = (...t) => h("p", { class: "zahl-satz" }, ...t);
const einheit = (t) => h("span", { class: "zahl-einheit" }, t);
const feld = (titel, wert, unter = null) => h("div", { class: "mk-feld" }, h("span", { class: "zk-titel" }, titel), h("span", { class: "mk-feld-wert zahl" }, wert), unter ? h("span", { class: "mk-feld-unter" }, unter) : null);

export function oeffneMarkt(app, herkunft) {
  const z = app.zustand;
  const kopf = marktKopf(app);
  let bereich = "monat";

  // ---- Kursverlauf ----
  const info = h("p", { class: "mk-info" });
  const linieEl = h("div", { class: "kurslinie", "data-eigene-geste": "" });
  const lin = kurslinie(linieEl, { beimScrubben: (i) => zeigeInfo(i), beiAnkunft: () => { app.licht(0.8); tick(6); } });
  const marke = h("span", { class: "zeitraum-marke", "aria-hidden": "true" });
  const knoepfe = BEREICHE.map(([wert, text]) => h("button", { type: "button", class: "zeitraum-wahl zeitraum-wahl--klein", "aria-pressed": String(wert === bereich), "data-wert": wert, onclick: () => waehle(wert) }, text));
  const wahl = h("div", { class: "zeitraum zeitraum--markt", role: "group", "aria-label": "Zeitraum des Kursverlaufs" }, ...knoepfe, marke);
  const markeFeder = new Feder(0, { art: "zeiger", genau: 0.2, beiWert: (x, v) => { marke.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0) scaleX(${(1 + Math.min(2.6, Math.abs(v) / 700)).toFixed(3)})`; } });
  const markeZiel = () => { const k = knoepfe.find((b) => b.dataset.wert === bereich); return k ? k.offsetLeft + k.offsetWidth / 2 - 3 : 0; };
  new ResizeObserver(() => markeFeder.springe(markeZiel())).observe(wahl);
  let reihe = null; let laedt = 0;

  function zeigeInfo(i) {
    if (i) {
      const tag = datumBerlin(i.t);
      const feiner = bereich === "stunde" || bereich === "tag" || bereich === "woche" || bereich === "monat";
      fuelle(info, h("span", { class: "mk-info-zeit" }, `${wochentagKurz(tag)}, ${datum(tag)}${feiner ? `, ${uhrzeit(i.t)}` : ""}`),
        h("strong", { class: "zahl" }, euro(i.c, 0)),
        i.marke ? h("span", { class: "mk-info-kauf" }, `Kauf ${i.marke.nr} · ${sats(i.marke.btc * 1e8)} sats`) : null);
      return;
    }
    const p = reihe?.punkte;
    if (!p || p.length < 2) { fuelle(info, h("span", { class: "text-3" }, laedt ? "Lädt …" : "Gerade nicht abrufbar")); return; }
    const erster = p[0].c; const letzter = z.aktuell?.kurs ?? p[p.length - 1].c;
    fuelle(info, veraenderungProzent((letzter / erster - 1) * 100), h("span", { class: "mk-zeile-zusatz" }, BEREICH_SATZ[bereich]),
      reihe.veraltet ? h("span", { class: "mk-info-alt" }, `Stand ${uhrzeit(reihe.zeit)}`) : null);
  }

  async function ladeBereich({ aufziehen = true } = {}) {
    const meins = ++laedt;
    zeigeInfo(null);
    try {
      const r = await holeReihe(bereich);
      if (meins !== laedt) return;
      reihe = r;
      const punkte = [...r.punkte];
      const a = z.aktuell;
      if (a?.kurs && a.zeit > punkte[punkte.length - 1].t) punkte.push({ t: a.zeit, c: a.kurs });
      const marken = z.kaeufe.filter((k) => k.gezaehlt).map((k) => ({ t: k.ts, c: k.marktkurs, daten: k }));
      lin.zeige(punkte, { marken, referenz: z.summe?.durchschnitt ?? null, aufziehen });
    } catch {
      if (meins === laedt) reihe = null;
    } finally {
      if (meins === laedt) { laedt = 0; zeigeInfo(null); }
    }
  }

  function waehle(wert) {
    if (wert === bereich) { ladeBereich(); return; }
    bereich = wert;
    tick(6);
    for (const b of knoepfe) b.setAttribute("aria-pressed", String(b.dataset.wert === wert));
    markeFeder.zu(markeZiel());
    app.licht(0.6);
    ladeBereich();
  }

  // ---- Abschnitte ----
  const koerper = h("div", { class: "zahlen-koerper markt-koerper" });
  const laeufer = [];
  let gelaufen = false;

  function baue() {
    laeufer.length = 0;
    const a = z.aktuell;
    const teile = [];

    // Marktdaten
    if (a?.kurs) {
      const ath = ladeAllzeithoch();
      const vomAth = ath ? relativ(a.kurs, Math.max(ath.wert, a.kurs)) : null;
      teile.push(abschnitt("Markt heute",
        h("div", { class: "mk-raster" },
          feld("24 h Hoch", a.hoch24h ? euro(a.hoch24h, 0) : "–"),
          feld("24 h Tief", a.tief24h ? euro(a.tief24h, 0) : "–"),
          feld("Allzeithoch", ath ? euro(Math.max(ath.wert, a.kurs), 0) : "–", ath?.tag ? `am ${datum(ath.tag)}` : null),
          feld("Abstand zum Hoch", vomAth != null ? (vomAth > -0.05 ? "Allzeithoch!" : `${MINUS}${zahl(Math.abs(vomAth), 1)} %`) : "–"),
          feld("Für 1 €", `${sats(1e8 / a.kurs)} sats`),
          feld(`Für ${SPARRATE_EUR} €`, `${sats((SPARRATE_EUR / a.kurs) * 1e8)} sats`),
          feld("Marktwert", mrd(a.marktwert)),
          feld("Umsatz 24 h", mrd(a.volumen24h)))));
      if (a.umlauf) {
        const anteil = a.umlauf / 21_000_000;
        const b = balken(anteil);
        laeufer.push(b);
        teile.push(abschnitt("Geschürft",
          gross(zahl(anteil * 100, 2), einheit(" % aller Bitcoin")),
          b.el,
          satz(`${zahl(a.umlauf / 1e6, 3)} Mio. von 21 Mio. Bitcoin sind im Umlauf. Es werden nie mehr – die restlichen ${zahl((21_000_000 - a.umlauf) / 1e6, 2)} Mio. kommen bis etwa 2140 dazu, immer langsamer.`)));
      }
    }

    // Marktstimmung
    const st = ladeMarkt().stimmung;
    if (st) {
      const uhr = stimmungsUhr(st.wert);
      laeufer.push(uhr);
      const werk = h("span", { class: "zahl" });
      const ziff = new Ziffern(werk, { teile: ganzTeile("") });
      ziff.setze(0, { sofort: true });
      laeufer.push({ los: () => ziff.setze(st.wert) });
      teile.push(abschnitt("Marktstimmung",
        h("div", { class: "uhr-halter" }, uhr.el, h("p", { class: "uhr-wert" }, werk, h("span", { class: "uhr-wort" }, stimmungWort(st.wert)))),
        satz(`Fear & Greed Index: 0 ist extreme Angst, 100 extreme Gier.${st.gestern != null ? ` Gestern ${st.gestern}` : ""}${st.woche != null ? `, vor einer Woche ${st.woche}` : ""}${st.gestern != null ? "." : ""} Die Stimmung schwankt – dein Plan bleibt derselbe.`)));
    }

    // Halving
    const blk = ladeMarkt().block;
    if (blk?.hoehe) {
      const H = blk.hoehe;
      const epoche = Math.floor(H / 210_000);
      const naechstes = (epoche + 1) * 210_000;
      const rest = naechstes - H;
      const wann = datumBerlin(blk.zeit + rest * 600_000);
      const { jahr, monat } = zerlege(wann);
      const tage = Math.round((rest * 600_000) / 86_400_000);
      const belohnung = 50 / 2 ** epoche;
      const b = balken((H % 210_000) / 210_000);
      laeufer.push(b);
      const werk = h("span", { class: "zahl" });
      const ziff = new Ziffern(werk, { teile: ganzTeile("") });
      ziff.setze(Math.max(0, rest - 5000), { sofort: true });
      laeufer.push({ los: () => ziff.setze(rest) });
      teile.push(abschnitt("Nächstes Halving",
        gross(werk, einheit(" Blöcke")),
        b.el,
        satz(`Noch etwa ${ganz(tage)} Tage, voraussichtlich im ${monatsname(monat)} ${jahr}. Dann sinkt die Belohnung je Block von ${zahl(belohnung, belohnung < 1 ? 4 : 3)} auf ${zahl(belohnung / 2, belohnung < 2 ? 5 : 4)} BTC – neue Bitcoin werden noch knapper.`),
        h("p", { class: "fussnote" }, `Aktueller Block ${ganz(H)} · Halving bei Block ${ganz(naechstes)} · etwa alle zehn Minuten ein Block.`)));
    }

    // Schlagzeilen
    const liste = h("div", { class: "nachrichten" });
    teile.push(abschnitt("Schlagzeilen", liste, h("p", { class: "fussnote" }, "Englischsprachige Nachrichten über CryptoCompare. Öffnen sich im Browser.")));
    zeigeNachrichten(liste, ladeMarkt().nachrichten);
    holeNachrichten().then((n) => zeigeNachrichten(liste, n)).catch(() => { if (!liste.childElementCount) liste.closest(".zahl-abschnitt")?.remove(); });

    fuelle(koerper, ...teile);
    if (gelaufen) laeufer.forEach((x) => x.los());
  }

  function zeigeNachrichten(liste, n) {
    if (!n?.liste?.length) return;
    fuelle(liste, ...n.liste.slice(0, 6).map((x) => h("a", { class: "nachricht tippbar", href: x.adresse, target: "_blank", rel: "noopener noreferrer" },
      h("span", { class: "nachricht-titel" }, x.titel),
      h("span", { class: "nachricht-meta" }, [x.quelle, x.zeit ? vorZeit(x.zeit) : null].filter(Boolean).join(" · ")))));
  }

  const inhalt = h("div", { class: "fenster-markt" }, kopf.el,
    h("section", { class: "mk-verlauf" }, wahl, info, linieEl),
    koerper);

  kopf.aktualisiere();
  baue();
  holeAllzeithoch().then(() => baue()).catch(() => {});
  const aenderung = () => { kopf.aktualisiere(); };
  app.beiAenderung.add(aenderung);

  return entfalte({
    herkunft, inhalt, titel: "Bitcoin", hintergrund: app.heuteEl,
    beiFortschritt: (p) => {
      if (p > 0.6 && !gelaufen) {
        gelaufen = true;
        markeFeder.springe(markeZiel());
        ladeBereich();
        laeufer.forEach((x, i) => setTimeout(x.los, 120 + i * 90));
      }
    },
    beimSchliessen: () => { app.beiAenderung.delete(aenderung); laedt = -1; },
  });
}
