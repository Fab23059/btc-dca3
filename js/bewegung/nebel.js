// =====================================================================
// nebel.js – Der Nebel hinter der App.
//
// Zwei Schichten Nebel, die gegeneinander treiben: hinten große, ruhige
// Schwaden, vorn feinerer, hellerer Dunst. Vom vorderen gibt es eine
// angestrahlte Fassung, die genau mitläuft, aber nur dort zu sehen ist, wo
// Licht ist (hinter der Zahl, rechts unten, am Horizont): So verfängt sich
// das Licht im Nebel, und wenn die Glut aufflammt, leuchtet er mit auf.
// Darüber liegen Glut und Vignette (reines CSS, siehe grund.css).
//
// Jede Schicht ist eine nahtlose Kachel, die beim Start einmal gerechnet
// wird – in einem Hintergrund-Thread (nebel-werk.js), in voller
// Genauigkeit, während der Ladebildschirm läuft. Danach bewegt sich nichts
// mehr außer der Lage der fertigen Bilder: Treiben, Scrollen und Zeitreise
// sind reine Verschiebungen, die die Grafikkarte ohne Rechnen erledigt.
// Kein Bild wird neu gemalt, kein Shader läuft, die Oberfläche bleibt frei.
//
// Weil die Kachel nahtlos ist, darf sie unendlich weit wandern: Nach einer
// Kachelbreite springt sie unsichtbar zurück.
//
// Die Farben folgen der Tageszeit in Deutschland.
// =====================================================================

import { h, wenigBewegung } from "../dom.js";
import { berlinTeile } from "../zeit.js";

export function tageszeit(ts = Date.now()) {
  const st = berlinTeile(ts).stunde;
  if (st >= 5 && st < 10) return "morgen";
  if (st >= 10 && st < 17) return "tag";
  if (st >= 17 && st < 22) return "abend";
  return "nacht";
}

// Je Tageszeit: warmer Dunst, kühler Dunst, Lichtkante
const STIMMUNG = {
  morgen: { warm: [240, 146, 96], kuehl: [104, 120, 156], licht: [255, 214, 170], waerme: 0.9 },
  tag: { warm: [226, 146, 82], kuehl: [112, 116, 132], licht: [250, 222, 186], waerme: 0.8 },
  abend: { warm: [246, 122, 40], kuehl: [98, 70, 132], licht: [255, 186, 112], waerme: 1 },
  nacht: { warm: [214, 100, 40], kuehl: [60, 70, 140], licht: [190, 170, 236], waerme: 0.5 },
};
const GRUND = [9, 8, 7];

// Die beiden Schichten. zelle: Größe einer Grundzelle als Anteil der Bildschirmhöhe.
// dichte: gerechnete Bildpunkte je Bildschirmpunkt (der Nebel ist weich, die Grafikkarte
// rechnet ihn beim Anzeigen glatt hoch). treiben: Bildschirmpunkte pro Sekunde (− = nach links).
// scroll/zeit: wie weit die Schicht beim Scrollen bzw. bei der Zeitreise mitgeht.
const SCHICHTEN = [
  { art: "hinten", zelle: 1 / 1.6, dichte: 0.4, treiben: 6.5, scroll: 0.2, zeit: 0.12, saat: 20260608, takt: 0 },
  { art: "vorn", zelle: 1 / 2.6, dichte: 0.45, treiben: -7.5, scroll: 0.34, zeit: 0.22, saat: 15, takt: 1 },
  // Gleiche Lage, gleicher Takt wie "vorn" – nur angestrahlt (in der Lichtmaske)
  { art: "licht", zelle: 1 / 2.6, dichte: 0.45, treiben: -7.5, scroll: 0.34, zeit: 0.22, saat: 15, takt: 1 },
];
const HOECHSTENS = 320_000;    // Bildpunkte je Kachel – mehr sieht man nicht, es kostet nur Zeit

// ---------------------------------------------------------------------
// Rechnen: im Hintergrund-Thread, sonst (sehr alte Browser) in Ruhepausen
// ---------------------------------------------------------------------

// Trusted Types: Die einzige Skript-Adresse, die der Nebel starten darf, ist sein eigener Thread
const WERK = new URL("./nebel-werk.js", import.meta.url).href;
let richtlinie;
function werkAdresse() {
  if (!globalThis.trustedTypes) return WERK;
  richtlinie ??= trustedTypes.createPolicy("dca3-nebel", {
    createScriptURL: (u) => { if (u !== WERK) throw new Error("Nur nebel-werk.js ist erlaubt."); return u; },
  });
  return richtlinie.createScriptURL(WERK);
}

let werkNr = 0;
function rechneImWerk(auftrag) {
  return new Promise((ok, fehler) => {
    let werk;
    try { werk = new Worker(werkAdresse(), { type: "module" }); } catch (e) { fehler(e); return; }
    const nr = ++werkNr;
    werk.onmessage = (e) => {
      werk.terminate();
      if (e.data.fehler) fehler(new Error(e.data.fehler)); else ok(e.data);
    };
    werk.onerror = (e) => { werk.terminate(); fehler(e); };
    werk.postMessage({ nr, auftrag });
  });
}
async function rechneHier(auftrag) {
  // Ohne Hintergrund-Thread: gröber rechnen, damit die Oberfläche nur kurz wartet
  const { rechneKachel } = await import("./nebel-rechnung.js");
  await new Promise((ok) => (globalThis.requestIdleCallback ?? ((f) => setTimeout(f, 50)))(ok, { timeout: 600 }));
  return rechneKachel({ ...auftrag, punkteJeZelle: Math.max(24, Math.round(auftrag.punkteJeZelle / 2)) });
}

// ---------------------------------------------------------------------
// Eine Schicht
// ---------------------------------------------------------------------

/**
 * @param {object} def     eine Zeile aus SCHICHTEN
 * @param {object} farben  Stimmung der Tageszeit
 * @param {boolean} still  Bewegung reduzieren
 * @param {number} phase   0 … 1: wo im Treiben die Schicht beginnt (gleiche Phase = gleiche Lage)
 * @param {number} basis   gemeinsamer Startzeitpunkt aller Schichten (document.timeline)
 */
function baueSchicht(def, farben, still, phase, basis) {
  const bild = h("canvas", { class: "nebel-bild" });
  const trieb = h("div", { class: "nebel-trieb" }, bild);
  const ebene = h("div", { class: `nebel-ebene nebel-ebene--${def.art}` }, trieb);
  let kw = 0; let kh = 0;            // Kachel in Bildschirmpunkten
  let lauf = null;                   // die Treib-Animation
  let scroll = 0; let zeit = 0;

  const lage = () => {
    if (!kw) return;
    const vh = innerHeight;
    // Nach einer ganzen Kachel springt sie zurück – unsichtbar, weil nahtlos
    const x = (((zeit * def.zeit * vh) % kw) + kw) % kw;
    const y = (((scroll * def.scroll * vh) % kh) + kh) % kh;
    ebene.style.transform = `translate3d(${(-x).toFixed(2)}px, ${(-y).toFixed(2)}px, 0)`;
  };

  /** Rechnet die Kachel passend zum Bildschirm und legt sie 3 × 2 aus. */
  async function rechne() {
    const vw = innerWidth; const vh = innerHeight;
    const zelle = vh * def.zelle;
    // Die Kachel muss mindestens den ganzen Bildschirm decken – und ein wenig Abwechslung haben
    const zx = Math.max(2, Math.ceil(vw / zelle));
    const zy = Math.max(2, Math.ceil(vh / zelle));
    const punkte = Math.max(24, Math.min(Math.round(zelle * def.dichte), Math.floor(Math.sqrt(HOECHSTENS / (zx * zy)))));
    const auftrag = { zellenX: zx, zellenY: zy, punkteJeZelle: punkte, art: def.art, saat: def.saat, farben, grund: GRUND };
    let k;
    try { k = await rechneImWerk(auftrag); } catch { k = await rechneHier(auftrag); }

    // 3 Kacheln breit, 2 hoch: So bleibt der Bildschirm bei jeder Verschiebung gedeckt
    bild.width = k.breite * 3; bild.height = k.hoehe * 2;
    const ctx = bild.getContext("2d", { alpha: def.art !== "hinten" });
    ctx.putImageData(new ImageData(k.daten, k.breite, k.hoehe), 0, 0);
    for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 3; sx++) {
      if (sx || sy) ctx.drawImage(bild, 0, 0, k.breite, k.hoehe, sx * k.breite, sy * k.hoehe, k.breite, k.hoehe);
    }
    kw = zx * zelle; kh = zy * zelle;
    bild.style.width = `${(kw * 3).toFixed(2)}px`;
    bild.style.height = `${(kh * 2).toFixed(2)}px`;
    lage();

    lauf?.cancel(); lauf = null;
    if (!still) {
      // Treiben: genau eine Kachelbreite, dann von vorn – endlos und ohne Naht
      const von = def.treiben > 0 ? -kw : 0;
      const bis = def.treiben > 0 ? 0 : -kw;
      const dauer = (kw / Math.abs(def.treiben)) * 1000;
      lauf = trieb.animate(
        [{ transform: `translate3d(${von.toFixed(2)}px, 0, 0)` }, { transform: `translate3d(${bis.toFixed(2)}px, 0, 0)` }],
        { duration: dauer, iterations: Infinity, easing: "linear" },
      );
      // Jeder Start beginnt woanders. Schichten mit gleichem Takt bekommen dieselbe Startzeit –
      // so laufen "vorn" und seine angestrahlte Fassung für immer deckungsgleich.
      lauf.startTime = basis - phase * dauer;
    }
    return { vw, vh };
  }

  return {
    ebene,
    rechne,
    passt: () => kw >= innerWidth && kh >= innerHeight,
    ziehe(s, z) { if (s != null) scroll = s; if (z != null) zeit = z; lage(); },
    pause(an) { if (!lauf) return; if (an) lauf.pause(); else lauf.play(); },
  };
}

/**
 * Baut den Nebel in den Behälter.
 * Rückgabe: { ziehe({ scrollAnteil, zeitAnteil }), licht(energie), bereit: Promise }.
 * scrollAnteil: 0 … n (wie viele Bildschirmhöhen gescrollt), zeitAnteil: −1 … 1 (Zeitreise).
 * bereit erfüllt sich, sobald beide Schichten gerechnet und gezeichnet sind.
 */
export function baueNebel(behaelter) {
  const zeit = tageszeit();
  const farben = STIMMUNG[zeit];
  behaelter.dataset.tageszeit = zeit;
  const still = wenigBewegung();
  const basis = document.timeline.currentTime ?? performance.now();
  const phasen = [Math.random(), Math.random()];
  const schichten = SCHICHTEN.map((d) => baueSchicht(d, farben, still, phasen[d.takt], basis));
  const schein = h("div", { class: "nebel-schein" }, schichten[2].ebene);
  behaelter.replaceChildren(schichten[0].ebene, schichten[1].ebene, schein);
  const vorn = schichten[1].ebene;

  const bereit = Promise.all(schichten.map((s) => s.rechne()))
    .then(() => { behaelter.classList.add("ist-bereit"); })
    .catch((e) => { console.warn("Nebel:", e); });

  // Hinter einem offenen Fenster und im Hintergrund steht der Nebel still
  const ruhe = () => {
    const an = document.hidden || document.documentElement.classList.contains("hat-ebene");
    for (const s of schichten) s.pause(an);
  };
  document.addEventListener("visibilitychange", ruhe);
  new MutationObserver(ruhe).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  // Nach dem Drehen des Handys: nur neu rechnen, wenn die Kachel den Bildschirm nicht mehr deckt
  let uhr = 0;
  addEventListener("resize", () => {
    clearTimeout(uhr);
    uhr = setTimeout(() => { for (const s of schichten) { if (!s.passt()) s.rechne().then(ruhe); else s.ziehe(); } }, 300);
  });

  return {
    bereit,
    ziehe({ scrollAnteil, zeitAnteil } = {}) {
      for (const s of schichten) s.ziehe(scrollAnteil, zeitAnteil);
    },
    /** Energie 0 … 1: Flammt die Glut auf, leuchtet der angestrahlte Nebel mit. Nur Deckkraft – kostet nichts. */
    licht(e) {
      const x = Math.max(0, Math.min(1, e));
      vorn.style.opacity = (0.8 + 0.2 * x).toFixed(3);
      schein.style.opacity = (0.5 + 0.5 * x).toFixed(3);
    },
  };
}
