// =====================================================================
// nebel.js – Der Nebel hinter der App.
//
// Der Nebel ist kein Bild, sondern eine Rechnung auf der Grafikkarte
// (WebGL): zwei Schichten verwirbeltes Rauschen, die verschieden schnell
// treiben, dazu warmes Licht, das leise flackert. Weil das Feld unendlich
// ist, gibt es keine Kanten: Scrollen und Zeitreise verschieben nur den Blick.
//
// Zwei Durchgänge, damit es weich bleibt und wenig kostet:
//   1. Der Nebel wird in einem Viertel der Auflösung gerechnet (er ist weich).
//   2. Dieses kleine Bild wird von der Grafikkarte selbst bikubisch, also
//      ganz weich, auf den Bildschirm hochgerechnet – nie vom Browser
//      vergrößert (das ergäbe sichtbare Kästchen). Im selben Schritt kommt
//      feines, laufendes Filmkorn dazu.
// In Ruhe 15 Bilder pro Sekunde (der Nebel treibt langsam, das sieht man
// nicht), beim Scrollen und bei der Zeitreise 30. Ist ein Fenster offen
// oder die App im Hintergrund, steht er still.
//
// Ohne WebGL gibt es den Ersatz: zwei einmal gerechnete, weich
// auslaufende Bilder, die nur verschoben werden.
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

const AUFLOESUNG = 4;          // ein Nebelpunkt je 4 × 4 Bildschirmpunkte (danach weich hochgerechnet)
const SCHAERFE = 1;            // Ausgabe in Bildschirmpunkten (weich hochgerechnet – Nebel und Korn brauchen nicht mehr)
const RUHE_MS = 1000 / 15;     // in Ruhe 15 Bilder pro Sekunde …
const BEWEGT_MS = 1000 / 30;   // … beim Scrollen und bei der Zeitreise 30
const KORN = 0.055;            // Stärke des Filmkorns

// ---------------------------------------------------------------------
// WebGL
// ---------------------------------------------------------------------

const ECKEN = `
attribute vec2 aOrt;
varying vec2 vUv;
void main() { vUv = aOrt * 0.5 + 0.5; gl_Position = vec4(aOrt, 0.0, 1.0); }`;

const FLAECHE = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform vec2 uAufl;
uniform float uZeit;
uniform vec2 uVersatz;
uniform float uEnergie;
uniform vec3 uWarm;
uniform vec3 uKuehl;
uniform vec3 uLicht;
uniform vec3 uGrund;
uniform float uWaerme;

float zufall(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float rausch(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(zufall(i), zufall(i + vec2(1.0, 0.0)), u.x), mix(zufall(i + vec2(0.0, 1.0)), zufall(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  mat2 dreh = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * rausch(p); p = dreh * p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = vUv;
  float seite = uAufl.x / uAufl.y;
  vec2 p = vec2(uv.x * seite, uv.y);
  float t = uZeit;

  // Hinten: groß, langsam, wenig Parallaxe
  vec2 q1 = p * 1.55 + vec2(uVersatz.x * 0.18, -uVersatz.y * 0.32) + vec2(t * 0.011, t * 0.0035);
  vec2 w1 = vec2(fbm(q1), fbm(q1 + vec2(5.2, 1.3)));
  float n1 = fbm(q1 + 2.6 * w1 + vec2(t * 0.018, -t * 0.006));

  // Vorn: feiner, schneller, stärkere Parallaxe
  vec2 q2 = p * 2.6 + vec2(uVersatz.x * 0.46, -uVersatz.y * 0.78) + vec2(-t * 0.019, t * 0.007);
  vec2 w2 = vec2(fbm(q2 + vec2(1.7, 9.2)), fbm(q2 + vec2(8.3, 2.8)));
  float n2 = fbm(q2 + 2.1 * w2);

  // Flackern: langsames, unregelmäßiges Atmen des Lichts
  float flackern = 0.88 + 0.12 * rausch(vec2(t * 1.7, 3.1)) + 0.05 * rausch(vec2(t * 6.3, 7.7));

  // Glut 1: hinter der großen Zahl (oben links), wandert beim Scrollen mit nach oben
  vec2 g1 = vec2(0.24 * seite + 0.05 * sin(t * 0.07), 0.86 + uVersatz.y * 0.42);
  vec2 d1 = (p - g1) * vec2(0.9, 1.5);
  float glut1 = exp(-dot(d1, d1) * 2.0);
  // Glut 2: tiefer rechts, treibt langsam
  vec2 g2 = vec2(0.86 * seite + 0.09 * cos(t * 0.05), 0.36 + 0.05 * sin(t * 0.031) + uVersatz.y * 0.22);
  vec2 d2 = p - g2;
  float glut2 = exp(-dot(d2, d2) * 3.2);
  // Glut 3: ganz unten, ein schwacher Abendhorizont
  float glut3 = smoothstep(0.42, 0.0, uv.y) * 0.55;

  float waerme = clamp((glut1 * 1.3 + glut2 * 0.85 + glut3 * 0.6 + (w1.x - 0.55) * 0.8) * uWaerme, 0.0, 1.0);
  vec3 farbe = mix(uKuehl, uWarm, waerme);
  // Lichtkanten: wo der Nebel dicht wird, fängt er das Licht
  float kante = smoothstep(0.55, 0.86, n1) * 0.75 + smoothstep(0.6, 0.9, n2) * 0.55;
  farbe = mix(farbe, uLicht, clamp(kante * 0.5, 0.0, 1.0));

  // Wolken: deutlich abgegrenzte Schwaden statt gleichmäßigem Dunst
  float wolke1 = smoothstep(0.38, 0.78, n1);
  float wolke2 = smoothstep(0.46, 0.84, n2);
  float dichte = wolke1 * 0.7 + wolke2 * 0.5;
  float licht = (0.42 + glut1 * 1.25 + glut2 * 0.8 + glut3 * 0.7) * flackern * (0.82 + uEnergie * 0.8);
  vec3 c = mix(uGrund, farbe, clamp(dichte * licht * 0.6, 0.0, 0.72));
  // Glut direkt als Licht obendrauf
  c += uWarm * (glut1 * 0.13 + glut2 * 0.06 + glut3 * 0.04) * flackern * (0.7 + uEnergie * 1.3);

  // Vignette: Ränder sinken ins Dunkel
  vec2 v = uv - vec2(0.5, 0.55);
  c *= clamp(1.0 - dot(v * vec2(1.1, 0.9), v * vec2(1.1, 0.9)) * 0.95, 0.0, 1.0);

  gl_FragColor = vec4(c, 1.0);
}`;

// Zweiter Durchgang: bikubisch hochrechnen (B-Spline aus vier weichen Abgriffen) und Korn dazu
const HOCH = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uBild;
uniform sampler2D uRausch;
uniform vec2 uQuelle;
uniform vec2 uKornVersatz;
uniform float uKorn;

vec3 bikubisch(vec2 uv) {
  vec2 st = uv * uQuelle - 0.5;
  vec2 i = floor(st); vec2 f = st - i;
  vec2 f2 = f * f; vec2 f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 s0 = w0 + w1; vec2 s1 = w2 + w3;
  vec2 h0 = (i - 0.5 + w1 / s0) / uQuelle;
  vec2 h1 = (i + 1.5 + w3 / s1) / uQuelle;
  vec3 a = texture2D(uBild, vec2(h0.x, h0.y)).rgb * s0.x + texture2D(uBild, vec2(h1.x, h0.y)).rgb * s1.x;
  vec3 b = texture2D(uBild, vec2(h0.x, h1.y)).rgb * s0.x + texture2D(uBild, vec2(h1.x, h1.y)).rgb * s1.x;
  return a * s0.y + b * s1.y;
}

void main() {
  vec3 c = bikubisch(vUv);
  // Filmkorn (zugleich gegen Farbstufen): im tiefen Dunkel etwas leiser
  float n = texture2D(uRausch, gl_FragCoord.xy / 128.0 + uKornVersatz).r - 0.5;
  float hell = dot(c, vec3(0.333));
  c += n * uKorn * (0.45 + 0.55 * smoothstep(0.0, 0.2, hell));
  gl_FragColor = vec4(c, 1.0);
}`;

function baueProgramm(gl, flaeche) {
  const shader = (art, text) => {
    const s = gl.createShader(art);
    gl.shaderSource(s, text);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "Shader");
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, shader(gl.VERTEX_SHADER, ECKEN));
  gl.attachShader(p, shader(gl.FRAGMENT_SHADER, flaeche));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "Programm");
  return p;
}

function webglNebel(behaelter, farben) {
  const leinwand = h("canvas", { class: "nebel-gl" });
  const gl = leinwand.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "low-power" });
  if (!gl) return null;
  let nebelProg; let hochProg;
  try { nebelProg = baueProgramm(gl, FLAECHE); hochProg = baueProgramm(gl, HOCH); } catch (e) { console.warn("Nebel:", e); return null; }

  // Eine Fläche über den ganzen Bildschirm, für beide Durchgänge
  const puffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, puffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const flaeche = (prog) => {
    const ort = gl.getAttribLocation(prog, "aOrt");
    gl.enableVertexAttribArray(ort);
    gl.vertexAttribPointer(ort, 2, gl.FLOAT, false, 0, 0);
  };

  // Durchgang 1: Nebel in kleiner Auflösung → Textur
  gl.useProgram(nebelProg);
  const u = (n) => gl.getUniformLocation(nebelProg, n);
  const uAufl = u("uAufl"); const uZeit = u("uZeit"); const uVersatz = u("uVersatz"); const uEnergie = u("uEnergie");
  const farbe = (n, f) => gl.uniform3f(u(n), f[0] / 255, f[1] / 255, f[2] / 255);
  farbe("uWarm", farben.warm); farbe("uKuehl", farben.kuehl); farbe("uLicht", farben.licht); farbe("uGrund", GRUND);
  gl.uniform1f(u("uWaerme"), farben.waerme ?? 1);
  const klein = gl.createTexture();
  const rahmen = gl.createFramebuffer();

  // Rauschen für das Korn: einmal ausgewürfelt, 128 × 128, kachelt sich nahtlos
  const rausch = gl.createTexture();
  const werte = new Uint8Array(128 * 128 * 4);
  for (let i = 0; i < werte.length; i++) werte[i] = (Math.random() * 256) | 0;
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, rausch);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 128, 128, 0, gl.RGBA, gl.UNSIGNED_BYTE, werte);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

  // Durchgang 2: weich hochrechnen + Korn
  gl.useProgram(hochProg);
  const v = (n) => gl.getUniformLocation(hochProg, n);
  const uQuelle = v("uQuelle"); const uKornVersatz = v("uKornVersatz");
  gl.uniform1i(v("uBild"), 0);
  gl.uniform1i(v("uRausch"), 1);
  gl.uniform1f(v("uKorn"), wenigBewegung() ? KORN * 0.6 : KORN);

  behaelter.replaceChildren(leinwand);

  let B = 0; let H = 0; let ZB = 0; let ZH = 0;
  const mass = () => {
    const b = Math.max(16, Math.ceil(innerWidth / AUFLOESUNG));
    const hh = Math.max(16, Math.ceil(innerHeight / AUFLOESUNG));
    const skala = Math.min(devicePixelRatio || 1, SCHAERFE);
    const zb = Math.round(innerWidth * skala); const zh = Math.round(innerHeight * skala);
    if (b === B && hh === H && zb === ZB && zh === ZH) return;
    B = b; H = hh; ZB = zb; ZH = zh;
    leinwand.width = ZB; leinwand.height = ZH;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, klein);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, B, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, rahmen);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, klein, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(nebelProg); gl.uniform2f(uAufl, B, H);
    gl.useProgram(hochProg); gl.uniform2f(uQuelle, B, H);
  };
  mass();

  const start = performance.now() - Math.random() * 400_000;   // jeder Start beginnt woanders im Nebel
  const versatz = [0, 0]; let energie = 0; let energieZiel = 0;
  let zuletzt = 0; let verloren = false; let geplant = false; let uhr = 0; let bewegtBis = 0;
  const still = wenigBewegung();

  const male = (jetzt) => {
    if (verloren) return;
    energie += (energieZiel - energie) * 0.12;
    // 1. Nebel klein
    gl.bindFramebuffer(gl.FRAMEBUFFER, rahmen);
    gl.viewport(0, 0, B, H);
    gl.useProgram(nebelProg); flaeche(nebelProg);
    gl.uniform1f(uZeit, ((jetzt - start) / 1000) % 100_000);
    gl.uniform2f(uVersatz, versatz[0], versatz[1]);
    gl.uniform1f(uEnergie, energie);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // 2. weich groß, mit Korn
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, ZB, ZH);
    gl.useProgram(hochProg); flaeche(hochProg);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, klein);
    gl.uniform2f(uKornVersatz, still ? 0 : Math.random(), still ? 0 : Math.random());
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const laeuft = () => !document.hidden && !document.documentElement.classList.contains("hat-ebene");

  // Getaktet über eine Uhr statt über jedes Bild: In Ruhe wacht die Seite nur 15-mal pro Sekunde auf
  const plane = () => {
    if (geplant || still || verloren || !laeuft()) return;
    geplant = true;
    const jetzt = performance.now();
    const abstand = jetzt < bewegtBis ? BEWEGT_MS : RUHE_MS;
    uhr = setTimeout(() => requestAnimationFrame((t) => {
      geplant = false;
      if (!laeuft()) return;
      zuletzt = t; male(t); plane();
    }), Math.max(0, zuletzt + abstand - jetzt - 3));
  };
  const schneller = () => {
    bewegtBis = performance.now() + 700;
    if (geplant && performance.now() - zuletzt < BEWEGT_MS) return;
    clearTimeout(uhr); geplant = false; plane();
  };

  // Läuft wieder an, sobald die App sichtbar ist oder die letzte Ebene zugeht
  document.addEventListener("visibilitychange", plane);
  new MutationObserver(plane).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  addEventListener("resize", () => { mass(); male(performance.now()); });
  // Grafikkarte weg (selten, z. B. nach langer Zeit im Hintergrund): Nebel bleibt einfach stehen
  leinwand.addEventListener("webglcontextlost", (e) => { e.preventDefault(); verloren = true; behaelter.classList.remove("ist-bereit"); });

  male(performance.now());
  requestAnimationFrame(() => behaelter.classList.add("ist-bereit"));
  plane();

  return {
    ziehe({ scrollAnteil, zeitAnteil } = {}) {
      if (scrollAnteil != null) versatz[1] = scrollAnteil;
      if (zeitAnteil != null) versatz[0] = zeitAnteil;
      if (still) male(performance.now()); else schneller();
    },
    licht(e) {
      const ziel = Math.max(0, Math.min(1, e));
      if (Math.abs(ziel - energieZiel) > 0.05) schneller();
      energieZiel = ziel;
    },
  };
}

// ---------------------------------------------------------------------
// Ersatz ohne WebGL: einmal gerechnet, weich auslaufend, nur verschoben
// ---------------------------------------------------------------------

function zufallsquelle(saat) {
  let a = saat >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function rauschfeld(saat) {
  const z = zufallsquelle(saat); const N = 64; const g = new Float32Array(N * N);
  for (let i = 0; i < g.length; i++) g[i] = z();
  const at = (x, y) => g[((y & (N - 1)) * N) + (x & (N - 1))];
  const glatt = (t) => t * t * (3 - 2 * t);
  const wert = (x, y) => {
    const xi = Math.floor(x); const yi = Math.floor(y); const xf = glatt(x - xi); const yf = glatt(y - yi);
    const a = at(xi, yi); const b = at(xi + 1, yi); const c = at(xi, yi + 1); const d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y) => { let v = 0; let amp = 0.5; for (let o = 0; o < 5; o++) { v += amp * wert(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 9.2; amp *= 0.5; } return v; };
}

function maleNebel(leinwand, { saat, farben, dichte, glutOrt }) {
  const B = 112; const H = 224;
  leinwand.width = B; leinwand.height = H;
  const ctx = leinwand.getContext("2d");
  const bild = ctx.createImageData(B, H);
  const f = rauschfeld(saat);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < B; x++) {
      const u = x / B; const v = y / H;
      const px = u * 2.1; const py = v * 4.2;
      const qx = f(px, py); const qy = f(px + 5.2, py + 1.3);
      const n = f(px + 2.6 * qx, py + 2.6 * qy);
      const nebel = Math.max(0, n - 0.32) * 1.9;
      const glut = Math.max(0, 1 - Math.hypot((u - glutOrt[0]) * 1.1, (v - glutOrt[1]) * 0.7) * 1.55);
      const mischung = Math.min(1, glut * 1.2 + qx * 0.25);
      const hell = Math.max(0, n - 0.62) * 2.2;
      // Weich zum Rand auslaufen: keine sichtbaren Kanten, wenn das Bild verschoben wird
      const rand = Math.min(1, Math.min(u, 1 - u) * 5) * Math.min(1, Math.min(v, 1 - v) * 5);
      const i = (y * B + x) * 4;
      for (let k = 0; k < 3; k++) bild.data[i + k] = Math.min(255, farben.kuehl[k] + (farben.warm[k] - farben.kuehl[k]) * mischung + farben.licht[k] * hell * 0.5);
      bild.data[i + 3] = Math.min(255, 255 * dichte * nebel * nebel * (0.55 + glut * 0.8) * rand * rand);
    }
  }
  ctx.putImageData(bild, 0, 0);
}

function ersatz(behaelter, farben) {
  const a = h("canvas", { class: "nebel-bild" });
  const b = h("canvas", { class: "nebel-bild" });
  const schichtA = h("div", { class: "nebel-schicht nebel-schicht--hinten" }, h("div", { class: "nebel-trieb nebel-trieb--a" }, a));
  const schichtB = h("div", { class: "nebel-schicht nebel-schicht--vorn" }, h("div", { class: "nebel-trieb nebel-trieb--b" }, b));
  behaelter.replaceChildren(schichtA, schichtB);
  (globalThis.requestIdleCallback ?? ((f) => setTimeout(f, 60)))(() => {
    maleNebel(a, { saat: 20260608, farben, dichte: 0.62, glutOrt: [0.3, 0.22] });
    maleNebel(b, { saat: 15, farben, dichte: 0.42, glutOrt: [0.7, 0.45] });
    behaelter.classList.add("ist-bereit");
  }, { timeout: 400 });
  let scroll = 0; let zeit = 0; let geplant = false;
  const begrenzt = (x, max) => Math.max(-max, Math.min(max, x));
  const setze = () => {
    geplant = false;
    // Verschiebung begrenzt: Die Schichten sind groß genug, dass nie ein Rand ins Bild kommt
    schichtA.style.transform = `translate3d(${(zeit * -18).toFixed(1)}px, ${begrenzt(scroll * -60, 70).toFixed(1)}px, 0)`;
    schichtB.style.transform = `translate3d(${(zeit * -42).toFixed(1)}px, ${begrenzt(scroll * -140, 110).toFixed(1)}px, 0)`;
  };
  return {
    ziehe({ scrollAnteil = scroll, zeitAnteil = zeit } = {}) {
      scroll = scrollAnteil; zeit = zeitAnteil;
      if (!geplant) { geplant = true; requestAnimationFrame(setze); }
    },
    licht() {},
  };
}

/**
 * Baut den Nebel in den Behälter. Rückgabe: { ziehe({ scrollAnteil, zeitAnteil }), licht(energie) }.
 * scrollAnteil: 0 … n (wie viele Bildschirmhöhen gescrollt), zeitAnteil: −1 … 1 (Zeitreise).
 */
export function baueNebel(behaelter) {
  const zeit = tageszeit();
  const farben = STIMMUNG[zeit];
  behaelter.dataset.tageszeit = zeit;
  let n = null;
  try { n = webglNebel(behaelter, farben); } catch (e) { console.warn("Nebel:", e); n = null; }
  if (n) { behaelter.classList.add("nebel--gl"); return n; }
  return ersatz(behaelter, farben);
}
