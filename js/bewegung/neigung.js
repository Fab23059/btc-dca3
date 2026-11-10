// =====================================================================
// neigung.js – Licht in der Hand.
//
// Regel 6 sagt: Licht entsteht durch Bewegung. Bisher war damit die
// Bewegung AUF dem Bildschirm gemeint. Diese Datei nimmt die Bewegung
// des Handys selbst dazu: Kippst du es, wandert das Licht – über das
// Holz deines Baums (streiflicht.js) und über geprägte Münzen
// (praegung.js).
//
// So bleibt es ruhig und sparsam:
//   * Die Haltung, in der du das Handy gerade hältst, gilt als "gerade".
//     Sie wandert langsam mit, damit das Licht nie am Rand festhängt.
//   * Der Lagesensor wird nur abgehört, solange jemand zuhört UND die
//     App sichtbar ist. Zittern der Hand wird verschluckt.
//   * Zwei Federn glätten die Werte. Stehen sie, wird nichts gemeldet –
//     also auch nichts neu gezeichnet.
//   * Ohne Sensor (oder ohne Erlaubnis) folgt das Licht dem Finger.
//   * "Bewegung reduzieren": Das Licht steht fest oben rechts.
// =====================================================================

import { wenigBewegung } from "../dom.js";
import { Feder, imTakt, klemme } from "./feder.js";

/** Ruhelage: Licht von oben rechts – wie in den Kacheln und Fenstern. */
const RUHE = Object.freeze({ x: 0.5, y: -0.55 });
const GRAD = 20;            // so viel Kippen ergibt den vollen Ausschlag
const TOTZONE = 0.012;      // kleinere Änderungen sind Zittern
const MITWANDERN = 0.004;   // so schnell wird die aktuelle Haltung zu "gerade"

const hoerer = new Set();
let gemeldet = false;
function melde() {
  if (gemeldet) return;
  gemeldet = true;
  // Beide Federn melden im selben Bild – die Hörer bekommen es genau einmal
  const ab = imTakt(() => { ab(); gemeldet = false; const l = licht(); for (const f of hoerer) f(l); });
}
const fx = new Feder(RUHE.x, { antwort: 0.36, daempfung: 0.95, genau: 0.002, beiWert: melde });
const fy = new Feder(RUHE.y, { antwort: 0.36, daempfung: 0.95, genau: 0.002, beiWert: melde });

/** Wo das Licht gerade steht: x und y von −1 bis 1 (y nach unten positiv), dazu das Tempo. */
export function licht() {
  return { x: fx.wert, y: fy.wert, tempo: Math.hypot(fx.tempo, fy.tempo) };
}

function ziel(x, y) {
  x = klemme(x, -1, 1); y = klemme(y, -1, 1);
  if (Math.abs(x - fx.ziel) < TOTZONE && Math.abs(y - fy.ziel) < TOTZONE) return;
  fx.zu(x); fy.zu(y);
}

// ---- Lagesensor ----
let lauscht = false;
let erlaubt = null;                 // null = noch nicht gefragt
let nullB = null; let nullG = null; // die Haltung, die als "gerade" gilt
let fingerAktiv = false;

function beiLage(e) {
  if (e.beta == null || e.gamma == null || fingerAktiv) return;
  if (nullB == null) { nullB = e.beta; nullG = e.gamma; }
  nullB += (e.beta - nullB) * MITWANDERN;
  nullG += (e.gamma - nullG) * MITWANDERN;
  ziel(RUHE.x + ((e.gamma - nullG) / GRAD) * 0.95, RUHE.y + ((e.beta - nullB) / GRAD) * 0.95);
}

function schalte() {
  const soll = hoerer.size > 0 && !document.hidden && erlaubt !== false && !wenigBewegung() && "DeviceOrientationEvent" in globalThis;
  if (soll === lauscht) return;
  lauscht = soll;
  if (soll) { nullB = nullG = null; addEventListener("deviceorientation", beiLage, { passive: true }); }
  else removeEventListener("deviceorientation", beiLage);
}
document.addEventListener("visibilitychange", schalte);

/**
 * Manche Browser geben den Lagesensor erst nach einer Rückfrage frei.
 * Diese Funktion gehört deshalb an einen Tipp des Nutzers (z. B. den
 * Schalter "Licht folgt der Hand" in den Einstellungen).
 * Gibt true zurück, wenn das Licht der Hand folgen darf.
 */
export async function neigungErlauben() {
  const E = globalThis.DeviceOrientationEvent;
  if (!E) { erlaubt = false; return false; }
  if (typeof E.requestPermission === "function") {
    try { erlaubt = (await E.requestPermission()) === "granted"; } catch { erlaubt = false; }
  } else erlaubt = true;
  schalte();
  return erlaubt;
}

/** Zuhören. f bekommt { x, y, tempo }, sobald sich das Licht bewegt. Gibt "Abmelden" zurück. */
export function beiLicht(f) {
  hoerer.add(f);
  schalte();
  f(licht());
  return () => { hoerer.delete(f); schalte(); };
}

/**
 * Ersatz ohne Sensor: Über diesem Element folgt das Licht dem Finger
 * (oder der Maus). Lässt man los, kehrt es in die Ruhelage zurück.
 */
export function fingerlicht(el) {
  const folge = (e) => {
    if (wenigBewegung()) return;
    const r = el.getBoundingClientRect();
    fingerAktiv = true;
    ziel(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  };
  const los = () => { fingerAktiv = false; if (!lauscht) ziel(RUHE.x, RUHE.y); };
  el.addEventListener("pointerdown", folge, { passive: true });
  el.addEventListener("pointermove", folge, { passive: true });
  for (const t of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(t, los, { passive: true });
  return () => { el.removeEventListener("pointerdown", folge); el.removeEventListener("pointermove", folge); };
}
