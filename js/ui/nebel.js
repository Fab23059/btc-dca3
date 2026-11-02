// =====================================================================
// nebel.js – Die Atmosphäre: ein langsam ziehender, leuchtender Nebel
// hinter der ganzen App, wie Morgendunst über einer Landschaft.
//
//   * berechnet auf der Grafikkarte (WebGL), in niedriger Auflösung und
//     mit 30 Bildern pro Sekunde – sparsam für Akku und Gerät
//   * Farben folgen der Tageszeit in Deutschland (Morgen, Tag, Abend, Nacht)
//   * neigt sich mit dem Handy (Gyroskop) und zieht beim Scrollen mit
//   * pausiert, wenn die App nicht sichtbar ist; bei "Bewegung reduzieren"
//     steht er still
// =====================================================================

import { wenigBewegung } from "../dom.js";
import { berlinTeile } from "../zeit.js";

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAGMENT = `
precision mediump float;
uniform vec2 u_aufl;
uniform float u_zeit;
uniform vec2 u_neigung;
uniform float u_scroll;
uniform vec3 u_warm;
uniform vec3 u_kuehl;
uniform vec3 u_licht;
uniform vec3 u_grund;
uniform float u_staerke;
uniform vec2 u_glutort;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float rauschen(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * rauschen(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_aufl;
  float seiten = u_aufl.x / u_aufl.y;
  vec2 p = vec2(uv.x * seiten, uv.y) * 1.35 + u_neigung * 0.22 + vec2(0.0, u_scroll * 0.35);
  float t = u_zeit * 0.016;
  // verwirbelter Nebel (Domain Warping): Rauschen, das sich selbst verbiegt
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t * 0.8));
  vec2 r = vec2(fbm(p + 3.2 * q + vec2(1.7, 9.2) + t * 0.55), fbm(p + 3.2 * q + vec2(8.3, 2.8) - t * 0.35));
  float n = fbm(p + 2.4 * r);
  // warme Glut dort, wo die große Zahl steht; kühler Dunst nach unten
  float glut = smoothstep(0.95, 0.0, distance(vec2(uv.x * seiten, uv.y), vec2(u_glutort.x * seiten, u_glutort.y)));
  vec3 farbe = mix(u_kuehl, u_warm, clamp(glut * 1.25 + r.x * 0.25, 0.0, 1.0)) * (n * n * 1.7);
  farbe += u_licht * smoothstep(0.62, 0.95, n) * 0.4 * (0.35 + glut);
  // Lichtschleier von oben (wie Licht, das durch Dunst fällt)
  farbe += u_warm * 0.18 * smoothstep(0.35, 1.0, uv.y) * smoothstep(0.3, 0.9, q.y);
  gl_FragColor = vec4(u_grund + farbe * u_staerke, 1.0);
}`;

/** Farbstimmungen je Tageszeit (Morgen, Tag, Abend, Nacht) */
const STIMMUNGEN = {
  morgen: { warm: [0.62, 0.36, 0.26], kuehl: [0.20, 0.25, 0.34], licht: [0.95, 0.80, 0.62], staerke: 0.23 },
  tag:    { warm: [0.58, 0.38, 0.20], kuehl: [0.17, 0.19, 0.24], licht: [0.92, 0.82, 0.66], staerke: 0.19 },
  abend:  { warm: [0.70, 0.36, 0.13], kuehl: [0.21, 0.14, 0.29], licht: [1.00, 0.70, 0.40], staerke: 0.25 },
  nacht:  { warm: [0.46, 0.26, 0.14], kuehl: [0.10, 0.12, 0.26], licht: [0.70, 0.62, 0.90], staerke: 0.20 },
};

export function tageszeit(ts = Date.now()) {
  const st = berlinTeile(ts).stunde;
  if (st >= 5 && st < 10) return "morgen";
  if (st >= 10 && st < 17) return "tag";
  if (st >= 17 && st < 22) return "abend";
  return "nacht";
}

export function starteNebel(leinwand, { holeScroll = () => 0 } = {}) {
  const gl = leinwand.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: "low-power" });
  if (!gl) return null;

  const shader = (art, quelle) => {
    const s = gl.createShader(art);
    gl.shaderSource(s, quelle);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const puffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, puffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const u = (n) => gl.getUniformLocation(prog, n);
  const U = { aufl: u("u_aufl"), zeit: u("u_zeit"), neigung: u("u_neigung"), scroll: u("u_scroll"), warm: u("u_warm"), kuehl: u("u_kuehl"), licht: u("u_licht"), grund: u("u_grund"), staerke: u("u_staerke"), glutort: u("u_glutort") };
  gl.uniform3f(U.grund, 11 / 255, 11 / 255, 13 / 255);

  // Auflösung: ein Drittel – Nebel ist weich, das spart viel Rechenzeit
  const groesse = () => {
    const f = 0.34;
    leinwand.width = Math.max(64, Math.round(innerWidth * f));
    leinwand.height = Math.max(64, Math.round(innerHeight * f));
    gl.viewport(0, 0, leinwand.width, leinwand.height);
    gl.uniform2f(U.aufl, leinwand.width, leinwand.height);
  };
  groesse();
  addEventListener("resize", groesse);

  // Stimmung (sanft überblendet, wenn die Tageszeit wechselt)
  let stimmung = { ...STIMMUNGEN[tageszeit()] };
  let ziel = stimmung;
  const setzeStimmung = () => {
    const s = stimmung;
    gl.uniform3f(U.warm, ...s.warm); gl.uniform3f(U.kuehl, ...s.kuehl); gl.uniform3f(U.licht, ...s.licht);
    gl.uniform1f(U.staerke, s.staerke * intensitaet);
  };
  let intensitaet = 1;
  const mische = (a, b, k) => a.map((x, i) => x + (b[i] - x) * k);
  setInterval(() => { ziel = STIMMUNGEN[tageszeit()]; }, 60_000);

  // Neigung: Gyroskop (Handy) oder Mauszeiger (Computer), sanft geglättet
  const neigung = { x: 0, y: 0, zx: 0, zy: 0 };
  const geschrieben = { x: 0, y: 0 };
  addEventListener("deviceorientation", (e) => {
    if (e.gamma == null || e.beta == null) return;
    neigung.zx = Math.max(-1, Math.min(1, e.gamma / 30));
    neigung.zy = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
  }, { passive: true });
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    neigung.zx = (e.clientX / innerWidth - 0.5) * 1.2;
    neigung.zy = (e.clientY / innerHeight - 0.5) * 1.2;
  }, { passive: true });

  let glutort = [0.28, 0.82];
  let scroll = 0;
  const t0 = performance.now();
  let letztes = 0; let laeuft = true; let raf = 0;

  const bild = (jetzt) => {
    raf = requestAnimationFrame(bild);
    if (jetzt - letztes < 33) return;    // höchstens ~30 Bilder pro Sekunde
    letztes = jetzt;
    neigung.x += (neigung.zx - neigung.x) * 0.05;
    neigung.y += (neigung.zy - neigung.y) * 0.05;
    scroll += (holeScroll() - scroll) * 0.08;
    stimmung = { warm: mische(stimmung.warm, ziel.warm, 0.01), kuehl: mische(stimmung.kuehl, ziel.kuehl, 0.01), licht: mische(stimmung.licht, ziel.licht, 0.01), staerke: stimmung.staerke + (ziel.staerke - stimmung.staerke) * 0.01 };
    setzeStimmung();
    gl.uniform1f(U.zeit, (jetzt - t0) / 1000);
    gl.uniform2f(U.neigung, neigung.x, neigung.y);
    gl.uniform1f(U.scroll, scroll);
    gl.uniform2f(U.glutort, glutort[0], glutort[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // Neigung auch für glänzende Flächen bereitstellen (CSS-Variablen) –
    // nur bei spürbarer Änderung, damit die Karten nicht ständig neu gezeichnet werden
    if (Math.abs(neigung.x - geschrieben.x) > 0.01 || Math.abs(neigung.y - geschrieben.y) > 0.01) {
      geschrieben.x = neigung.x; geschrieben.y = neigung.y;
      document.documentElement.style.setProperty("--neigung-x", neigung.x.toFixed(3));
      document.documentElement.style.setProperty("--neigung-y", neigung.y.toFixed(3));
    }
  };

  const start = () => {
    if (wenigBewegung()) { setzeStimmung(); gl.uniform1f(U.zeit, 40); gl.drawArrays(gl.TRIANGLES, 0, 3); return; }
    if (!laeuft) { laeuft = true; }
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(bild);
  };
  const stopp = () => { laeuft = false; cancelAnimationFrame(raf); };
  document.addEventListener("visibilitychange", () => (document.hidden ? stopp() : start()));
  start();
  leinwand.classList.add("ist-bereit");

  return {
    /** Wo die warme Glut sitzen soll (0..1, von links unten) */
    glutNach(x, y) { glutort = [x, y]; },
    /** Gesamtstärke (z. B. gedämpft, wenn ein Dialog offen ist) */
    staerke(k) { intensitaet = k; },
    stopp, start,
  };
}
