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

import { h, fuelle, icon, wenigBewegung } from "../dom.js";
import { Feder, imTakt, klemme, mische } from "../bewegung/feder.js";
import { ziehe } from "../bewegung/geste.js";
import { entfalte, fensterBreite } from "../teile/fenster.js";
import { tick } from "../teile/haptik.js";
import { toast } from "../teile/meldung.js";
import { baumGeometrie, zeichneBaum, ringBei, hintergrundbild } from "../jahresringe.js";
import { sats, anzahl, datumLang, datum, euro } from "../format.js";
import { heuteBerlin } from "../zeit.js";
import { kopfPlus } from "./gemeinsam.js";

/** Leinwand mit lebendigem Baum: wächst/schrumpft federnd, der jüngste Ring atmet. */
function baumBild(groesse) {
  const leinwand = h("canvas", { class: "baum-leinwand", "aria-hidden": "true" });
  const ctx = leinwand.getContext("2d");
  const dpr = Math.min(2.5, devicePixelRatio || 1);
  leinwand.width = Math.round(groesse * dpr); leinwand.height = Math.round(groesse * dpr);
  leinwand.style.width = `${groesse}px`; leinwand.style.height = `${groesse}px`;
  const vorrat = document.createElement("canvas");
  vorrat.width = leinwand.width; vorrat.height = leinwand.height;
  const vctx = vorrat.getContext("2d");
  let geo = null; let hervor = null; let vorratOk = false; let atem = 0.5;
  const R = groesse * 0.44; const c = groesse / 2;

  const wuchs = new Feder(0, { art: "raum", genau: 0.002, beiWert: () => { vorratOk = false; male(); } });

  function male() {
    if (!geo || !geo.n) { ctx.clearRect(0, 0, leinwand.width, leinwand.height); return; }
    const sichtbar = klemme(wuchs.wert, 0, geo.n);
    if (!vorratOk) {
      vctx.setTransform(1, 0, 0, 1, 0, 0); vctx.clearRect(0, 0, vorrat.width, vorrat.height);
      vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (sichtbar > 0.05) zeichneBaum(vctx, geo, { cx: c, cy: c, R, sichtbar: Math.max(1, sichtbar), hervor, ohneGlut: true });
      vorratOk = true;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, leinwand.width, leinwand.height);
    ctx.drawImage(vorrat, 0, 0);
    if (sichtbar > 0.05) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); zeichneBaum(ctx, geo, { cx: c, cy: c, R, sichtbar: Math.max(1, sichtbar), atem, nurGlut: true }); }
  }

  // Atmen: 15 Bilder pro Sekunde genügen, nur solange sichtbar
  let sichtbarImBild = false; let abmelden = null; let letztes = 0;
  const atmen = (an) => {
    if (an && !abmelden && !wenigBewegung()) {
      abmelden = imTakt((t) => {
        if (t - letztes < 66) return;
        letztes = t; atem = 0.5 + 0.5 * Math.sin(t / 1400); male();
      });
    } else if (!an && abmelden) { abmelden(); abmelden = null; }
  };
  new IntersectionObserver(([e]) => { sichtbarImBild = e.isIntersecting; atmen(sichtbarImBild && !document.hidden); }).observe(leinwand);
  document.addEventListener("visibilitychange", () => atmen(sichtbarImBild && !document.hidden));

  return {
    leinwand,
    daten(kaeufe) {
      const n = geo?.n ?? 0;
      geo = baumGeometrie(kaeufe);
      vorratOk = false;
      if (wuchs.ziel === n || wuchs.ziel > geo.n) wuchs.springe(geo.n); else male();
    },
    /** Wie viele Ringe zu sehen sind (Kommazahl erlaubt), federnd. */
    wachse(n, { sofort = false } = {}) { if (sofort) wuchs.springe(n); else wuchs.zu(n); },
    hervorheben(i) { if (i === hervor) return; hervor = i; vorratOk = false; male(); },
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
  const bild = baumBild(offen ? L.G : L.klein.g);
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
  const zeige = () => {
    const gez = z.kaeufe.filter((k) => k.gezaehlt);
    const bis = zeit == null ? gez : gez.filter((k) => k.ts <= zeit);
    ringe.textContent = String(bis.length);
    unter.textContent = `${sats(bis.reduce((s, k) => s + k.btc, 0) * 1e8)} sats`;
    bild.wachse(bis.length);
  };
  return {
    el, bild, fortschritt, text,
    aktualisiere() { bild.daten(z.kaeufe.filter((k) => k.gezaehlt)); zeige(); },
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
  const unten = h("div", { class: "baum-unten" }, leiste, info, exportKnopf,
    h("p", { class: "fussnote" }, "Die Fläche jedes Rings entspricht den sats dieses Kaufs. In günstigen Wochen gab es für dieselben 15 € mehr – der Ring wird breiter."));

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
      toast("Bild gespeichert", { art: "erfolg" });
    } finally { exportKnopf.disabled = false; }
  }

  const inhalt = h("div", { class: "fenster-baum" }, kopf.el, unten);
  const aenderung = () => { kopf.aktualisiere(); baueStriche(); zeigeInfo(null); pos.springe(Math.max(0, n() - 1)); };
  app.beiAenderung.add(aenderung);
  requestAnimationFrame(() => pos.springe(Math.max(0, n() - 1)));

  return entfalte({
    herkunft, inhalt, titel: "Dein Baum", hintergrund: app.heuteEl,
    beiFortschritt: (p) => kopf.fortschritt(p),
    beimSchliessen: () => app.beiAenderung.delete(aenderung),
  });
}
