// =====================================================================
// funkenflug.js – Der Funke springt über (Bewegung B10).
//
// Ein frisch eingetragener Kauf wurde bisher mit Konfetti gefeiert.
// Konfetti sagt nur "Hurra". Der Funkenflug zeigt, WAS der Kauf bewirkt
// hat: Ein Funke löst sich von der gespeicherten Zeile und fliegt der
// Reihe nach zu jeder Stelle, die sich durch diesen Kauf ändert. Erst
// wenn er ankommt, ändert sie sich – die Zahl rollt, der Balken wächst,
// der Ring schließt sich. Das ist der Rechenweg, als Bewegung.
//
//   * Jede Strecke ist eine Feder (kein fester Verlauf). Je schneller
//     der Funke, desto heller der Schweif und desto mehr Funken (Regel 6).
//   * Nichts erscheint aus dem Nichts: Start ist die Zeile, Ende ist die
//     letzte Station – dort verglimmt er.
//   * Gezeichnet wird nur, solange etwas fliegt. Danach verschwindet die
//     Leinwand wieder vollständig.
//   * "Bewegung reduzieren" oder Atmosphäre aus: Die Stationen ändern
//     sich sofort, ohne Flug.
// =====================================================================

import { h, wenigBewegung } from "../dom.js";
import { Feder, imTakt, klemme } from "../bewegung/feder.js";
import { tick } from "./haptik.js";

/** Zeitlupe für Entwickler-Aufnahmen (wie in feder.js); im Alltag immer 1. */
const zeitfaktor = () => {
  const z = Number(globalThis.__ZEITLUPE);
  return Number.isFinite(z) && z >= 1 && z <= 40 ? 1 / z : 1;
};
const still = () => wenigBewegung() || document.documentElement.classList.contains("ruhig");

// ---------------------------------------------------------------------
// Die Bühne: eine Leinwand über allem, die nur lebt, solange etwas glüht
// ---------------------------------------------------------------------
let buehne = null;

function holeBuehne() {
  if (buehne) return buehne;
  const leinwand = h("canvas", { class: "funken-buehne", "aria-hidden": "true" });
  document.body.append(leinwand);
  const ctx = leinwand.getContext("2d");
  const dpr = Math.min(2, devicePixelRatio || 1);
  const mass = () => { leinwand.width = Math.round(innerWidth * dpr); leinwand.height = Math.round(innerHeight * dpr); };
  mass();
  addEventListener("resize", mass);

  const funken = [];      // { x, y, vx, vy, alt, leben, r, zug } – zug: Schwerkraft (negativ = steigt auf)
  const wellen = [];      // { x, y, alt, leben, r }
  const koepfe = new Set(); // fliegende Funken: { x, y, spur: [{x, y, t}], kraft }
  let zuletzt = performance.now();
  let uhr = 0;

  const ab = imTakt((jetzt) => {
    const dt = Math.min(0.05, (jetzt - zuletzt) / 1000) * zeitfaktor();
    zuletzt = jetzt; uhr += dt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round"; ctx.lineJoin = "round";

    // Schweif: zwei Striche je Abschnitt – breit und matt, schmal und hell (kein Weichzeichner)
    for (const k of koepfe) {
      k.spur.push({ x: k.x, y: k.y, t: uhr });
      while (k.spur.length > 2 && uhr - k.spur[0].t > 0.26) k.spur.shift();
      for (let i = 1; i < k.spur.length; i++) {
        const a = k.spur[i - 1]; const b = k.spur[i];
        const jung = 1 - (uhr - b.t) / 0.26;
        if (jung <= 0) continue;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(255, 138, 42, ${(0.22 * jung * k.kraft).toFixed(3)})`; ctx.lineWidth = 11 * jung + 2; ctx.stroke();
        ctx.strokeStyle = `rgba(255, 226, 190, ${(0.9 * jung * k.kraft).toFixed(3)})`; ctx.lineWidth = 2.6 * jung + 0.6; ctx.stroke();
      }
      const hof = ctx.createRadialGradient(k.x, k.y, 0, k.x, k.y, 26);
      hof.addColorStop(0, `rgba(255, 170, 90, ${(0.55 * k.kraft).toFixed(3)})`); hof.addColorStop(1, "rgba(255, 138, 42, 0)");
      ctx.fillStyle = hof; ctx.beginPath(); ctx.arc(k.x, k.y, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255, 240, 222, ${k.kraft.toFixed(3)})`; ctx.beginPath(); ctx.arc(k.x, k.y, 3.4 * k.kraft, 0, Math.PI * 2); ctx.fill();
    }

    // Funken: fliegen, fallen leicht, verglühen
    for (let i = funken.length - 1; i >= 0; i--) {
      const f = funken[i];
      f.alt += dt;
      const rest = 1 - f.alt / f.leben;
      if (rest <= 0) { funken.splice(i, 1); continue; }
      f.vx *= 1 - 2.4 * dt; f.vy = f.vy * (1 - 2.4 * dt) + (f.zug ?? 420) * dt;
      f.x += f.vx * dt; f.y += f.vy * dt;
      ctx.strokeStyle = `rgba(255, ${Math.round(150 + 90 * rest)}, ${Math.round(70 + 110 * rest)}, ${(0.95 * rest).toFixed(3)})`;
      ctx.lineWidth = f.r;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx * 0.02, f.y - f.vy * 0.02); ctx.stroke();
    }

    // Wellen: ein Lichtring läuft von der gezündeten Stelle aus
    for (let i = wellen.length - 1; i >= 0; i--) {
      const w = wellen[i];
      w.alt += dt;
      const p = w.alt / w.leben;
      if (p >= 1) { wellen.splice(i, 1); continue; }
      const aus = 1 - (1 - p) ** 3;
      ctx.strokeStyle = `rgba(255, 214, 170, ${(0.8 * (1 - p)).toFixed(3)})`; ctx.lineWidth = 2.2 * (1 - p) + 0.4;
      ctx.beginPath(); ctx.arc(w.x, w.y, 6 + w.r * aus, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(255, 138, 42, ${(0.4 * (1 - p)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(w.x, w.y, 4 + w.r * 0.55 * aus, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";

    if (!koepfe.size && !funken.length && !wellen.length) { ab(); removeEventListener("resize", mass); leinwand.remove(); buehne = null; }
  });

  buehne = { funken, wellen, koepfe };
  return buehne;
}

/**
 * Ein kleiner Funkenstoß an einer Stelle – ohne Konfetti.
 * menge: Anzahl Funken, kraft: 0.3 … 1.5, welle: Radius des Lichtrings (0 = keiner).
 * auftrieb: true = die Funken steigen wie über einer angefachten Glut nach oben (B15).
 */
export function stieben({ x, y, menge = 18, kraft = 1, welle = 44, auftrieb = false }) {
  if (still()) return;
  const b = holeBuehne();
  for (let i = 0; i < menge; i++) {
    if (auftrieb) {
      const w = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      const v = (60 + Math.random() * 190) * kraft;
      b.funken.push({ x: x + (Math.random() - 0.5) * 46, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, alt: 0, leben: 0.7 + Math.random() * 1.1, r: 0.7 + Math.random() * 1.3, zug: -150 });
      continue;
    }
    const w = Math.random() * Math.PI * 2;
    const v = (90 + Math.random() * 300) * kraft;
    b.funken.push({ x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v - 60 * kraft, alt: 0, leben: 0.35 + Math.random() * 0.7, r: 0.7 + Math.random() * 1.5 });
  }
  if (welle) b.wellen.push({ x, y, alt: 0, leben: 0.6, r: welle });
}

/** Liegt der Punkt im sichtbaren Bildschirm? Zu Unsichtbarem fliegt kein Funke. */
const sichtbar = (p) => p && p.x >= -8 && p.x <= innerWidth + 8 && p.y >= 0 && p.y <= innerHeight;

const mitteVon = (ziel, anker = [0.5, 0.5]) => {
  const z = typeof ziel === "function" ? ziel() : ziel;
  if (!z) return null;
  if (typeof z.x === "number") return { x: z.x, y: z.y };
  const r = z.getBoundingClientRect();
  return r.width || r.height ? { x: r.left + r.width * anker[0], y: r.top + r.height * anker[1] } : null;
};

/**
 * Lässt einen Funken von "von" der Reihe nach zu allen Stationen fliegen.
 *
 * @param {object} o
 *   von        Element, Funktion oder { x, y } – hier löst sich der Funke
 *   stationen  [{ ziel, zuenden, anker, halt }]
 *                ziel:    Element, Funktion (liefert Element) oder { x, y }
 *                zuenden: wird bei Ankunft gerufen, bekommt den Punkt { x, y }
 *                anker:   Stelle im Element, [0…1, 0…1] (Standard: Mitte)
 *                halt:    Millisekunden, die der Funke dort verweilt (Standard 110)
 *                vorher:  optional, () => Promise – wird vor dem Anflug abgewartet (z. B. bis die
 *                         Seite zur Station gerollt ist). Der Funke bleibt solange an seiner Stelle sitzen.
 *   Stationen außerhalb des Bildschirms (z. B. weggescrollt) zünden sofort, ohne Anflug.
 * @returns Promise, das sich erfüllt, wenn die letzte Station gezündet hat
 */
export async function funkenflug({ von, stationen }) {
  let start = mitteVon(von);
  if (still() || !start) { for (const s of stationen) s.zuenden?.(mitteVon(s.ziel, s.anker) ?? start); return; }
  // Liegt der Ursprung außerhalb, kommt der Funke vom Bildschirmrand herein
  start = { x: klemme(start.x, 0, innerWidth), y: klemme(start.y, 0, innerHeight) };

  const b = holeBuehne();
  const kopf = { x: start.x, y: start.y, spur: [], kraft: 0 };
  b.koepfe.add(kopf);
  stieben({ x: start.x, y: start.y, menge: 10, kraft: 0.7, welle: 30 });

  let ort = start;
  let seite = 1;
  let sitz = () => mitteVon(von);      // wo der Funke gerade sitzt – er folgt dem Element, wenn die Seite rollt
  for (const s of stationen) {
    if (s.vorher) {
      const folge = imTakt(() => { const o = sitz(); if (o) { kopf.x = o.x; kopf.y = o.y; } });
      try { await s.vorher(); } catch (e) { console.error(e); } finally { folge(); }
      ort = sitz() ?? ort;
      kopf.x = ort.x; kopf.y = ort.y; kopf.spur.length = 0;
    }
    const z = mitteVon(s.ziel, s.anker);
    if (!sichtbar(z)) { s.zuenden?.(z ?? ort); continue; }
    const dx = z.x - ort.x; const dy = z.y - ort.y;
    const weite = Math.hypot(dx, dy) || 1;
    // Bogen statt Gerade: Der Stützpunkt liegt seitlich der Strecke, abwechselnd links und rechts
    const bauch = Math.min(120, weite * 0.28) * seite; seite = -seite;
    const sx = ort.x + dx / 2 - (dy / weite) * bauch; const sy = ort.y + dy / 2 + (dx / weite) * bauch;
    const a = ort;
    let vorher = 0;
    await new Feder(0, {
      antwort: klemme(weite / 780, 0.4, 0.72), daempfung: 1, genau: 0.004,
      beiWert: (p, tempo) => {
        const q = klemme(p); const r = 1 - q;
        kopf.x = r * r * a.x + 2 * r * q * sx + q * q * z.x;
        kopf.y = r * r * a.y + 2 * r * q * sy + q * q * z.y;
        const fahrt = klemme(Math.abs(tempo) * weite / 1500);          // Tempo in Bildschirmpunkten
        kopf.kraft = 0.55 + 0.45 * fahrt;
        // Unterwegs verliert er Funken – mehr, je schneller er ist
        const strecke = (q - vorher) * weite; vorher = q;
        for (let n = Math.random() < strecke / 9 ? 1 + Math.round(fahrt) : 0; n > 0; n--) {
          b.funken.push({ x: kopf.x, y: kopf.y, vx: (Math.random() - 0.5) * 120 - dx / weite * 60, vy: (Math.random() - 0.5) * 120 - dy / weite * 60, alt: 0, leben: 0.25 + Math.random() * 0.45, r: 0.6 + Math.random() * 1.1 });
        }
      },
    }).zu(1);
    ort = z;
    sitz = () => mitteVon(s.ziel, s.anker);
    stieben({ x: z.x, y: z.y, menge: 9, kraft: 0.55, welle: 38 });
    tick(7);
    s.zuenden?.(z);
    await new Promise((ok) => setTimeout(ok, (s.halt ?? 110) / zeitfaktor()));
  }

  // Am Ende verglimmt der Funke dort, wo er zuletzt gezündet hat
  await new Feder(kopf.kraft, { art: "ruhig", genau: 0.01, beiWert: (x) => { kopf.kraft = Math.max(0, x); } }).zu(0);
  b.koepfe.delete(kopf);
}
