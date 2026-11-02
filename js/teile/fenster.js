// =====================================================================
// fenster.js – Fenster, die sich entfalten (Bewegung B1/B2).
//
// Ein Fenster wächst aus der Stelle, an der man getippt hat – einer
// Kachel, einer Zeile, einem Knopf – auf den ganzen Bildschirm. Der
// Inhalt steht dabei still, nur der Rahmen öffnet sich (Lage + Ausschnitt).
// Zurück faltet es sich exakt dorthin zurück.
//
// Mit dem Finger lässt sich ein offenes Fenster nach unten ziehen: Es
// schrumpft auf seinem Rückweg unter dem Finger. Loslassen entscheidet
// nach Schwung, ob es zufällt oder wieder aufgeht.
//
// Das ganze Fenster hängt an EINER Zahl: dem Fortschritt p (0 = Kachel,
// 1 = offen). Alles andere wird daraus berechnet – auch Bewegungen im
// Inhalt (beiFortschritt), z. B. der Baum, der beim Öffnen groß wird.
// =====================================================================

import { h, icon, wenigBewegung } from "../dom.js";
import { Feder, wurfweite, klemme, mische } from "../bewegung/feder.js";
import { ziehe } from "../bewegung/geste.js";
import { ebeneAnmelden } from "./ebenen.js";
import { tick } from "./haptik.js";

const FENSTER_FEDER = { antwort: 0.46, daempfung: 0.9 };

/** Breite, in der Fenster gebaut werden (die Kacheln zeigen sie verkleinert). */
export const fensterBreite = () => Math.min(innerWidth, 560);
const fensterLinks = () => Math.max(0, (innerWidth - fensterBreite()) / 2);

/**
 * Eine Kachel = die verkleinerte Ansicht des Fenster-Kopfs.
 * kopf: Element in voller Fensterbreite gebaut. hoehe: Kopfhöhe im Fenster.
 */
export function kachel({ kopf, hoehe = 200, label, beiTipp }) {
  const buehne = h("div", { class: "kachel-buehne" }, kopf);
  const el = h("button", { type: "button", class: "kachel tippbar", "aria-label": label, onclick: (e) => beiTipp(el, e) }, buehne);
  const mass = () => {
    const b = el.clientWidth || fensterBreite() - 32;
    const s = b / fensterBreite();
    buehne.style.width = `${fensterBreite()}px`;
    buehne.style.transform = `scale(${s})`;
    el.style.height = `${Math.round(hoehe * s)}px`;
  };
  new ResizeObserver(mass).observe(el);
  requestAnimationFrame(mass);
  return { el, mass };
}

/**
 * Öffnet ein Fenster aus einer Herkunft.
 * @returns {{ el, rolle, schliessen }}
 */
export function entfalte({ herkunft, radius = 28, inhalt, titel, beiFortschritt = null, beimSchliessen = null, hintergrund = null, kopfHoehe = 200, mitPlus = true }) {
  const H = () => innerHeight;
  const B = fensterBreite;

  const zu = h("button", { type: "button", class: "fenster-zu tippbar", "aria-label": "Schließen", onclick: () => anfrage() },
    h("span", { class: "fenster-zu-kreuz", "aria-hidden": "true" }, icon("plus", { groesse: 20, strich: 1.8 })));
  const innen = h("div", { class: "fenster-inhalt" }, inhalt);
  const rolle = h("div", { class: "fenster-rolle" }, innen);
  const fenster = h("section", { class: "fenster", role: "dialog", "aria-modal": "true", "aria-label": titel, tabindex: "-1" }, rolle, zu);
  const schleier = h("div", { class: "fenster-schleier", "aria-hidden": "true" });
  const ebene = h("div", { class: "fenster-ebene" }, schleier, fenster);
  document.body.append(ebene);

  // Herkunft vermessen (wird beim Schließen erneut vermessen – sie kann sich verschoben haben)
  // Herkunft darf eine Funktion sein: Wird die Liste neu gebaut, faltet sich das Fenster in die NEUE Zeile.
  const quelle = () => { const e = typeof herkunft === "function" ? herkunft() : herkunft; return e?.isConnected ? e : null; };
  let versteckt = quelle();
  let r0 = null;
  const vermesse = () => {
    const r = quelle()?.getBoundingClientRect() ?? null;
    r0 = r && r.width > 0 ? { x: r.left, y: r.top, b: r.width, h: r.height, rad: radius } : { x: innerWidth / 2 - 20, y: H() / 2 - 20, b: 40, h: 40, rad: 20 };
  };
  vermesse();
  const sicherOben = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sicher-oben-px")) || 0;

  let offen = true;
  let p = 0;
  const hintergrundUrsprung = () => {
    if (!hintergrund) return;
    hintergrund.style.transformOrigin = `50% ${hintergrund.scrollTop + H() * 0.42}px`;
  };
  hintergrundUrsprung();

  /** Alles aus p berechnen – das ist die ganze Bewegung. */
  const setze = (wert) => {
    p = wert;
    const q = klemme(p, -0.05, 1);
    const s0 = r0.b / B();
    const s = mische(s0, 1, q);
    const x = mische(r0.x, fensterLinks(), q);
    const y = mische(r0.y, 0, q);
    const sichtbar = mische(r0.h, H(), q) / s;          // sichtbare Höhe in Fensterkoordinaten
    const rad = mische(r0.rad, 0, klemme(q * 1.15)) / s;
    fenster.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${s.toFixed(5)})`;
    fenster.style.clipPath = `inset(0 0 ${Math.max(0, H() - sichtbar).toFixed(1)}px 0 round ${rad.toFixed(1)}px)`;
    // Inhalt rückt beim Öffnen unter der Statusleiste hervor
    const unterLeiste = (sicherOben * klemme(q)).toFixed(1);
    innen.style.transform = `translate3d(0, ${unterLeiste}px, 0)`;
    schleier.style.opacity = String(klemme(q) * 0.62);
    zu.style.transform = `translate3d(0, ${unterLeiste}px, 0)`;
    if (!mitPlus) zu.style.opacity = String(klemme((q - 0.45) / 0.4));
    zu.firstChild.style.transform = `rotate(${(45 * klemme(q)).toFixed(1)}deg)`;
    if (hintergrund) hintergrund.style.transform = `scale(${(1 - 0.05 * klemme(q)).toFixed(4)})`;
    beiFortschritt?.(q);
  };

  const feder = new Feder(0, { ...FENSTER_FEDER, genau: 0.0008, beiWert: (x) => setze(x) });
  fenster.style.width = `${B()}px`;
  fenster.style.height = `${H()}px`;
  versteckt?.style.setProperty("visibility", "hidden");
  hintergrund?.classList.add("tritt-zurueck");
  setze(0);

  // Öffnen
  requestAnimationFrame(() => {
    ebene.classList.add("ist-offen");
    feder.zu(1).then(() => { if (offen) rolle.classList.add("darf-rollen"); });
    fenster.focus({ preventScroll: true });
  });

  // Schließen
  let wurfTempo = null;   // Tempo des Fingers, wenn per Wurf geschlossen wird
  const anfrage = ebeneAnmelden(ebene, () => falte());
  function falte() {
    const tempo = wurfTempo; wurfTempo = null;
    if (!offen && feder.ziel === 0) return;
    offen = false;
    rolle.classList.remove("darf-rollen");
    ebene.classList.remove("ist-offen");
    beimSchliessen?.();
    const neu = quelle();
    if (neu && neu !== versteckt) { versteckt?.style.removeProperty("visibility"); neu.style.setProperty("visibility", "hidden"); versteckt = neu; }
    vermesse();
    hintergrundUrsprung();
    feder.zu(0, tempo != null ? { tempo } : {}).then(() => {
      versteckt?.style.removeProperty("visibility");
      if (hintergrund) { hintergrund.style.removeProperty("transform"); hintergrund.classList.remove("tritt-zurueck"); }
      ebene.remove();
    });
  }

  // ---- Falten mit dem Finger (B2) ----
  // Reichweite: Wie weit muss der Finger, damit das Fenster ganz zu ist?
  const reichweite = () => klemme(r0.y + r0.h * 0.5, H() * 0.38, H() * 0.8);
  let zug = null;
  const zugStart = () => {
    zug = { p0: p };
    feder.halte();
    rolle.classList.remove("darf-rollen");
    fenster.classList.add("wird-gezogen");
  };
  const zugBewege = (dy) => {
    if (!zug) return;
    const roh = zug.p0 - Math.max(0, dy) / reichweite();
    setze(roh < 0 ? roh * 0.3 : roh);
  };
  const zugEnde = (vy) => {
    if (!zug) return;
    zug = null;
    fenster.classList.remove("wird-gezogen");
    const tempo = -vy / reichweite();
    const ziel = p + wurfweite(tempo * reichweite(), 0.996) / reichweite();
    if (ziel < 0.62) { tick(8); wurfTempo = tempo; anfrage(); }
    else { feder.zu(1, { tempo }).then(() => { if (offen) rolle.classList.add("darf-rollen"); }); }
  };

  // Touch: nur ziehen, wenn ganz oben gescrollt und nach unten gezogen wird
  let t0 = null;
  fenster.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1 || !offen) { t0 = null; return; }
    const t = e.touches[0];
    t0 = { x: t.clientX, y: t.clientY, oben: rolle.scrollTop <= 0, verlauf: [{ y: t.clientY, t: e.timeStamp }] };
  }, { passive: true });
  fenster.addEventListener("touchmove", (e) => {
    if (!t0) return;
    const t = e.touches[0];
    const dy = t.clientY - t0.y; const dx = t.clientX - t0.x;
    t0.verlauf.push({ y: t.clientY, t: e.timeStamp });
    if (t0.verlauf.length > 6) t0.verlauf.shift();
    if (!zug) {
      if (!t0.oben || rolle.scrollTop > 0 || dy < 8 || Math.abs(dx) > dy) { if (Math.abs(dy) > 8 || Math.abs(dx) > 8) t0 = null; return; }
      if (e.target.closest?.("[data-eigene-geste]")) { t0 = null; return; }
      zugStart();
    }
    e.preventDefault();
    zugBewege(dy - 8);
  }, { passive: false });
  const touchEnde = () => {
    if (!t0) return;
    const v = t0.verlauf; const a = v[0]; const b = v[v.length - 1];
    const vy = b && a && b.t > a.t ? ((b.y - a.y) / (b.t - a.t)) * 1000 : 0;
    t0 = null;
    zugEnde(vy);
  };
  fenster.addEventListener("touchend", touchEnde);
  fenster.addEventListener("touchcancel", touchEnde);

  // Maus: am Kopf greifen
  ziehe(fenster, {
    achse: "y",
    darf: (e) => e.pointerType === "mouse" && rolle.scrollTop <= 0 && !e.target.closest("button, input, a, [data-eigene-geste]") && e.clientY < kopfHoehe + 40,
    start: () => zugStart(),
    bewege: ({ dy }) => zugBewege(dy),
    ende: ({ vy }) => zugEnde(vy),
  });

  rolle.addEventListener("scroll", () => fenster.classList.toggle("ist-gerollt", rolle.scrollTop > 6), { passive: true });
  if (wenigBewegung()) rolle.classList.add("darf-rollen");
  return { el: fenster, rolle, inhalt: innen, schliessen: () => offen && anfrage() };
}
