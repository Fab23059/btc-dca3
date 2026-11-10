// =====================================================================
// baum.js – Das Fenster "Dein Baum". Jeder Kauf ist ein Jahresring.
//
// Bewegung zuerst:
//   * Beim Öffnen wächst der Baum aus der Kachel auf volle Größe, der Text
//     wandert darunter – alles aus dem einen Fortschritt des Fensters.
//   * Zeitleiste: Mit dem Finger zurück in die Zeit – der Baum schrumpft
//     auf den damaligen Stand, Ring für Ring. Loslassen: Er wächst zurück.
//   * Bei der Zeitreise auf der Startseite wächst der Baum in der Kachel mit.
//   * Der jüngste Ring glüht und atmet – das einzige, was sich in Ruhe bewegt.
// =====================================================================

import { h, fuelle, icon } from "../dom.js";
import { Feder, klemme, mische } from "../bewegung/feder.js";
import { ziehe } from "../bewegung/geste.js";
import { entfalte, fensterBreite } from "../teile/fenster.js";
import { tick } from "../teile/haptik.js";
import { toast } from "../teile/meldung.js";
import { baumGeometrie, zeichneBaum, ringBei, hintergrundbild } from "../jahresringe.js";
import { ringschluss } from "../teile/ringschluss.js";
import { streiflicht, hoehenkarte } from "../teile/streiflicht.js";
import { beiLicht } from "../bewegung/neigung.js";
import { sats, anzahl, datumLang, datum, euro } from "../format.js";
import { haltefrist } from "../kennzahlen.js";
import { SCHLUESSEL, lies, schreibe } from "../speicher.js";
import { heuteBerlin } from "../zeit.js";
import { kopfPlus } from "./gemeinsam.js";

/**
 * Lebendiger Baum: wächst/schrumpft federnd, der jüngste Ring atmet.
 * Zwei Ebenen: der Stamm (nur neu gezeichnet, wenn sich etwas ändert) und
 * der glühende jüngste Ring darüber. Das Atmen ist nur Deckkraft dieser
 * zweiten Ebene – das macht die Grafikkarte allein, ohne neu zu zeichnen.
 *
 * mitRelief (B13, nur im offenen Fenster): Dazwischen liegt eine dritte Ebene,
 * auf der die Grafikkarte das Holz beleuchtet. Das Licht folgt der Hand
 * (neigung.js). Solange der Baum wächst, ruht das Relief.
 */
function baumBild(groesse, { mitRelief = false } = {}) {
  const leinwand = h("div", { class: "baum-leinwand", "aria-hidden": "true" });
  const grund = h("canvas", { class: "baum-ebene" });
  const glut = h("canvas", { class: "baum-ebene baum-glut" });
  const relief = mitRelief ? streiflicht() : null;
  leinwand.append(grund, ...(relief ? [relief.leinwand] : []), glut);
  const ctx = grund.getContext("2d");
  const gctx = glut.getContext("2d");
  const dpr = Math.min(2.5, devicePixelRatio || 1);
  for (const c of [grund, glut]) { c.width = Math.round(groesse * dpr); c.height = Math.round(groesse * dpr); }
  leinwand.style.width = `${groesse}px`; leinwand.style.height = `${groesse}px`;
  let geo = null; let hervor = null;
  const R = groesse * 0.44; const c = groesse / 2;
  let schliesst = null;                       // laufender Ringschluss (B11)
  let karte = null; let karteFuer = -1;       // Höhenkarte fürs Relief, je Ringzahl einmal gerechnet
  const lichtAb = relief ? beiLicht((l) => relief.licht(l.x, l.y)) : null;

  const wuchs = new Feder(0, { art: "raum", genau: 0.002, beiWert: () => male() });
  // B16: So viele innere Ringe sind Kernholz. Kommt einer dazu, wandert die Grenze langsam nach außen.
  const kernholz = new Feder(0, { antwort: 2.2, daempfung: 1, genau: 0.004, beiWert: () => male() });
  const kernJetzt = () => ({ kern: kernholz.wert, kernGlut: kernholz.ruht ? 0 : klemme(Math.abs(kernholz.tempo) * 2.4) });

  /** Relief nur in Ruhe: Wächst oder schrumpft der Baum, zeigt sich das flache Bild. */
  function pflegeRelief(sichtbar) {
    if (!relief) return;
    if (!geo?.n || sichtbar < 1 || !wuchs.ruht || !kernholz.ruht) { relief.leinwand.classList.remove("ist-an"); return; }
    const ringe = Math.ceil(sichtbar);
    if (karteFuer !== ringe) { karte = hoehenkarte(geo, { groesse, cx: c, cy: c, R, dpr, sichtbar }); karteFuer = ringe; }
    relief.zeige(grund, karte);
    relief.leinwand.classList.add("ist-an");
  }

  /**
   * B11: Ein Ring wird sichtbar um den Stamm gezogen, statt einfach zu erscheinen.
   * index = welcher Ring. Ist es ein neuer (der äußerste), zeigt das Bild davor den Stamm
   * ohne ihn. Wurde ein vorhandener Kauf genauer eingetragen, zeigt es den Stamm von vorher
   * (altGeo) – der Ring wird dann mit seiner echten Breite nachgezogen.
   */
  function schliesse(index, startwinkel, altGeo = null) {
    schliesst?.ab();
    const n = geo.n;
    relief?.leinwand.classList.remove("ist-an");
    gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.clearRect(0, 0, glut.width, glut.height);
    const lauf = ringschluss({
      leinwand: grund, dpr, ring: geo.ringe[index], cx: c, cy: c, R, startwinkel,
      zeichne: (x, mitNeu) => (mitNeu || !altGeo
        ? zeichneBaum(x, geo, { cx: c, cy: c, R, sichtbar: mitNeu ? n : n - 1, ohneGlut: true, ...kernJetzt() })
        : zeichneBaum(x, altGeo, { cx: c, cy: c, R, sichtbar: altGeo.n, ohneGlut: true, ...kernJetzt() })),
    });
    schliesst = lauf;
    wuchs.springe(n);
    return lauf.fertig.then(() => { if (schliesst === lauf) { schliesst = null; male(); } });
  }

  function male() {
    if (schliesst) return;                    // solange der Ring gezogen wird, gehört die Leinwand ihm
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, grund.width, grund.height);
    gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.clearRect(0, 0, glut.width, glut.height);
    if (!geo || !geo.n) return;
    const sichtbar = klemme(wuchs.wert, 0, geo.n);
    if (sichtbar <= 0.05) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    zeichneBaum(ctx, geo, { cx: c, cy: c, R, sichtbar: Math.max(1, sichtbar), hervor, ohneGlut: true, ...kernJetzt() });
    if (hervor == null) { gctx.setTransform(dpr, 0, 0, dpr, 0, 0); zeichneBaum(gctx, geo, { cx: c, cy: c, R, sichtbar: Math.max(1, sichtbar), atem: 1, nurGlut: true }); }
    pflegeRelief(sichtbar);
  }

  return {
    leinwand,
    /**
     * Neue Käufe übernehmen. mitRingschluss: Ist genau ein Ring dazugekommen,
     * wird er sichtbar gezogen (B11) – ab startwinkel, falls ein Funke von dort kommt.
     * Ist die Zahl gleich geblieben und ring angegeben (ein Kauf wurde genauer eingetragen),
     * wird dieser Ring nachgezogen.
     * Gibt dann ein Promise zurück, das sich mit dem Schluss des Rings erfüllt.
     */
    daten(kaeufe, { mitRingschluss = false, startwinkel, ring = null } = {}) {
      const alt = geo;
      const n = alt?.n ?? 0;
      geo = baumGeometrie(kaeufe);
      karteFuer = -1;
      if (mitRingschluss && n > 0 && wuchs.ziel === n && wuchs.ruht) {
        if (geo.n === n + 1) return schliesse(n, startwinkel);
        if (geo.n === n && ring != null && ring >= 0 && ring < n) return schliesse(ring, startwinkel, alt);
      }
      if (schliesst) { schliesst.ab(); schliesst = null; }
      if (wuchs.ziel === n || wuchs.ziel > geo.n) wuchs.springe(geo.n); else male();
      return null;
    },
    /** Wie viele Ringe zu sehen sind (Kommazahl erlaubt), federnd. */
    wachse(n, { sofort = false } = {}) {
      if (schliesst) { if (n === geo.n) return; schliesst.ab(); schliesst = null; }
      if (sofort) wuchs.springe(n); else wuchs.zu(n);
    },
    /** B16: So viele innere Ringe sind Kernholz. Ohne "sofort" wandert die Grenze sichtbar nach außen. */
    kern(n, { sofort = false } = {}) {
      if (n === kernholz.ziel) return;
      if (sofort) kernholz.springe(n); else kernholz.zu(n);
    },
    /** Aufräumen, wenn das Fenster zugeht: Lagesensor und Grafikkarte freigeben. */
    frei() { lichtAb?.(); relief?.frei(); },
    get relief() { return relief; },
    hervorheben(i) { if (i === hervor) return; hervor = i; male(); },
    ringUnter(x, y) { return geo ? ringBei(geo, x, y, c, c, R) : null; },
    get anzahl() { return geo?.n ?? 0; },
  };
}

/** Lage von Baum und Text: klein (Kachel) und groß (offenes Fenster). */
function lagen(B) {
  const G = Math.min(B - 40, 360);
  return {
    G,
    // Kachel: Titel links oben (wie bei allen Fenstern), der Baum rechts daneben
    klein: { x: B - 20 - 152, y: 34, g: 152, tx: 20, ty: 22 },
    gross: { x: (B - G) / 2, y: 70, g: G, tx: 22, ty: 70 + G + 22 },
  };
}

export function baumKopf(app, { offen = false } = {}) {
  const z = app.zustand;
  const B = fensterBreite();
  const L = lagen(B);
  const bild = baumBild(offen ? L.G : L.klein.g, { mitRelief: offen });
  const ringe = h("span", { class: "bk-zahl zahl" });
  const unter = h("span", { class: "bk-unter zahl" });
  const text = h("div", { class: "bk-text" },
    h("h2", { class: "fkopf-titel" }, "Dein Baum"),
    h("p", { class: "fkopf-unter" }, "Jeder Kauf ein Ring"),
    h("p", { class: "bk-ringe" }, ringe, h("span", { class: "bk-ringe-wort" }, " Ringe")),
    unter);
  const el = h("div", { class: ["fkopf", "fkopf--baum", offen && "fkopf--offen"] }, bild.leinwand, text, kopfPlus());
  if (offen) el.style.height = `${L.gross.ty + 120}px`;

  /** Fenster-Fortschritt p: Baum und Text wandern zwischen klein und groß. */
  const fortschritt = (p) => {
    const a = L.klein; const b = L.gross;
    const g = mische(a.g, b.g, p);
    bild.leinwand.style.transform = `translate3d(${mische(a.x, b.x, p).toFixed(2)}px, ${mische(a.y, b.y, p).toFixed(2)}px, 0) scale(${(g / L.G).toFixed(4)})`;
    text.style.transform = `translate3d(${mische(a.tx, b.tx, p).toFixed(2)}px, ${mische(a.ty, b.ty, p).toFixed(2)}px, 0)`;
    // Der Text taucht unterwegs kurz ab, damit er nicht über den wachsenden Stamm streicht
    text.style.opacity = (1 - Math.sin(Math.PI * Math.min(1, Math.max(0, p))) * 0.92).toFixed(3);
  };
  if (offen) fortschritt(0);
  else {
    bild.leinwand.style.transform = `translate3d(${L.klein.x}px, ${L.klein.y}px, 0)`;
    text.style.transform = `translate3d(${L.klein.tx}px, ${L.klein.ty}px, 0)`;
  }

  let zeit = null;
  let kernErstmals = true;
  /** B16: Wie viele Käufe waren zu diesem Zeitpunkt länger als ein Jahr gehalten? */
  const kernBei = (t) => haltefrist(z.kaeufe, t ?? z.jetzt).tranchen.filter((x) => x.frei).length;
  const zeigeKern = () => {
    const kern = kernBei(zeit);
    if (zeit != null) { bild.kern(kern, { sofort: true }); return; }
    if (kernErstmals && z.kaeufe.some((k) => k.gezaehlt)) {
      kernErstmals = false;
      // Ist seit dem letzten Besuch genau ein Ring verkernt, wandert die Grenze vor deinen Augen nach außen
      const gesehen = offen ? null : lies(SCHLUESSEL.kernGesehen);
      if (Number.isInteger(gesehen) && kern === gesehen + 1) { bild.kern(gesehen, { sofort: true }); setTimeout(() => bild.kern(kern), 2600); }
      else bild.kern(kern, { sofort: true });
    } else bild.kern(kern);
    if (!offen && !kernErstmals) schreibe(SCHLUESSEL.kernGesehen, kern);
  };
  const zeige = () => {
    const gez = z.kaeufe.filter((k) => k.gezaehlt);
    const bis = zeit == null ? gez : gez.filter((k) => k.ts <= zeit);
    ringe.textContent = String(bis.length);
    unter.textContent = `${sats(bis.reduce((s, k) => s + k.btc, 0) * 1e8)} sats`;
    bild.wachse(bis.length);
    zeigeKern();
  };
  return {
    el, bild, fortschritt, text, kernBei,
    /** o.mitRingschluss / o.startwinkel: siehe baumBild.daten(). Gibt ggf. das Promise des Ringschlusses zurück. */
    aktualisiere(o) { const lauf = bild.daten(z.kaeufe.filter((k) => k.gezaehlt), o); zeige(); return lauf; },
    zeitreise(info) { zeit = info?.t ?? null; zeige(); },
    setzeZeit(t) { zeit = t; zeige(); },
  };
}

export function oeffneBaum(app, herkunft) {
  const z = app.zustand;
  const kopf = baumKopf(app, { offen: true });
  kopf.aktualisiere();
  const gez = () => z.kaeufe.filter((k) => k.gezaehlt);

  // ---- Zeitleiste: ein Strich je Kauf, ein Zeiger zum Ziehen ----
  const striche = h("div", { class: "zeitleiste-striche" });
  const zeiger = h("span", { class: "zeitleiste-zeiger", "aria-hidden": "true" });
  const leiste = h("div", { class: "zeitleiste", "data-eigene-geste": "", role: "slider", tabindex: "0", "aria-label": "Zeitleiste deines Baums" }, striche, zeiger);
  const info = h("p", { class: "baum-info" });
  const exportKnopf = h("button", { type: "button", class: "knopf knopf--breit tippbar", onclick: () => exportieren() }, icon("teilen", { groesse: 18 }), h("span", null, "Als Hintergrundbild sichern"));
  const kernHinweis = h("p", { class: "baum-kern" });
  const unten = h("div", { class: "baum-unten" }, leiste, info, exportKnopf, kernHinweis,
    h("p", { class: "fussnote" }, "Die Fläche jedes Rings entspricht den sats dieses Kaufs. In günstigen Wochen gab es für dieselben 15 € mehr – der Ring wird breiter."));
  /** B16: Was Kernholz ist – und wann der nächste Ring dazukommt. Reine Datumsrechnung. */
  const zeigeKernHinweis = () => {
    const hf = haltefrist(z.kaeufe, z.jetzt);
    const kern = hf.tranchen.filter((x) => x.frei).length;
    if (!hf.tranchen.length) { kernHinweis.textContent = ""; return; }
    kernHinweis.textContent = kern
      ? `${anzahl(kern, "Ring ist", "Ringe sind")} Kernholz: Diese Käufe hältst du länger als ein Jahr.${hf.naechste ? ` Der nächste kommt am ${datum(hf.naechste.freiAb)} dazu.` : ""}`
      : `Am ${datum(hf.naechste.freiAb)} dunkelt der innerste Ring zu Kernholz nach. Dann hältst du deinen ersten Kauf länger als ein Jahr.`;
  };
  zeigeKernHinweis();

  const n = () => gez().length;
  const baueStriche = () => fuelle(striche, ...gez().map((k, i) => h("span", { class: `zeitleiste-strich zeitleiste-strich--${k.status}`, style: { left: `${(i / Math.max(1, n() - 1)) * 100}%` } })));
  baueStriche();
  const zeigeInfo = (i) => {
    const k = gez()[i];
    if (i == null || !k) { info.textContent = `${anzahl(n(), "Ring", "Ringe")} · Fahr über die Zeitleiste oder den Stamm.`; return; }
    fuelle(info, h("strong", null, `Kauf ${k.nr} · ${datumLang(k.kaufdatum)}`), h("span", null, ` · ${sats(k.btc * 1e8)} sats für ${euro(k.brutto, 0)}${k.status === "geschaetzt" ? " · noch nicht eingetragen" : k.status === "automatisch" ? " · automatisch erfasst" : ""}`));
  };
  zeigeInfo(null);

  // Zeiger-Feder: Lage auf der Leiste in Käufen (0 … n-1)
  const pos = new Feder(Math.max(0, n() - 1), { art: "zeiger", genau: 0.01, beiWert: (x) => {
    const anteil = n() > 1 ? x / (n() - 1) : 1;
    zeiger.style.transform = `translate3d(${(anteil * leiste.clientWidth).toFixed(1)}px, 0, 0)`;
  } });
  let gezogen = null;
  ziehe(leiste, {
    achse: "x", sofort: true, schwelle: 2,
    start: ({ x }) => { pos.halte(); zieheNach(x); },
    bewege: ({ x }) => zieheNach(x),
    ende: () => {
      gezogen = null;
      pos.zu(Math.max(0, n() - 1));
      kopf.bild.hervorheben(null);
      kopf.setzeZeit(null);
      zeigeInfo(null);
    },
  });
  function zieheNach(x) {
    const r = leiste.getBoundingClientRect();
    const a = klemme((x - r.left) / r.width);
    const i = Math.round(a * (n() - 1));
    pos.springe(a * (n() - 1));
    if (i !== gezogen) {
      gezogen = i; tick(4);
      const k = gez()[i];
      kopf.setzeZeit(k?.ts ?? null);
      kopf.bild.hervorheben(i);
      zeigeInfo(i);
    }
  }

  // Finger auf dem Stamm: Ring unter dem Finger leuchtet auf
  let ringZuvor = null;
  ziehe(kopf.bild.leinwand, {
    achse: "frei", sofort: true, schwelle: 0,
    start: (p) => fahre(p), bewege: (p) => fahre(p),
    ende: () => { ringZuvor = null; kopf.bild.hervorheben(null); zeigeInfo(null); },
  });
  kopf.bild.leinwand.setAttribute("data-eigene-geste", "");
  function fahre({ x, y }) {
    const r = kopf.bild.leinwand.getBoundingClientRect();
    const s = parseFloat(kopf.bild.leinwand.style.width) / r.width;
    const i = kopf.bild.ringUnter((x - r.left) * s, (y - r.top) * s);
    if (i === ringZuvor) return;
    ringZuvor = i;
    kopf.bild.hervorheben(i);
    zeigeInfo(i);
    if (i != null) tick(4);
  }

  async function exportieren() {
    const kauf = gez();
    if (!kauf.length) return;
    exportKnopf.disabled = true;
    try {
      const s = z.summe;
      const blob = await hintergrundbild(kauf, { kern: kopf.kernBei(null), zeilen: ["Jeder Ring ein Montag.", `${anzahl(kauf.length, "Ring", "Ringe")} · ${sats(s.sats)} sats`, `seit ${datum(kauf[0].montag)}`] });
      const name = `mein-baum-${heuteBerlin()}.png`;
      const datei = new File([blob], name, { type: "image/png" });
      if (navigator.canShare?.({ files: [datei] }) && matchMedia("(pointer: coarse)").matches) {
        try { await navigator.share({ files: [datei], title: "Mein Baum" }); return; } catch (e) { if (e.name === "AbortError") return; }
      }
      const url = URL.createObjectURL(blob);
      const a = h("a", { href: url, download: name, class: "unsichtbar" });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast("Bild gespeichert", { art: "erfolg" });
    } finally { exportKnopf.disabled = false; }
  }

  const inhalt = h("div", { class: "fenster-baum" }, kopf.el, unten);
  const aenderung = () => { kopf.aktualisiere(); baueStriche(); zeigeInfo(null); zeigeKernHinweis(); pos.springe(Math.max(0, n() - 1)); };
  app.beiAenderung.add(aenderung);
  requestAnimationFrame(() => pos.springe(Math.max(0, n() - 1)));

  return entfalte({
    herkunft, inhalt, titel: "Dein Baum", hintergrund: app.heuteEl,
    beiFortschritt: (p) => kopf.fortschritt(p),
    beimSchliessen: () => { app.beiAenderung.delete(aenderung); kopf.bild.frei(); },
  });
}
