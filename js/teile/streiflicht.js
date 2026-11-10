// =====================================================================
// streiflicht.js – Das Holz fängt Licht (Bewegung B13).
//
// Der Baum war bisher ein flaches Bild. Mit Streiflicht bekommt er eine
// Oberfläche: Jede Ringgrenze ist eine feine Rille, jede Faser eine
// Unebenheit. Wandert das Licht (neigung.js: Handy kippen oder mit dem
// Finger darüberfahren), glänzen die Rillen auf der einen Seite auf und
// fallen auf der anderen in den Schatten – wie bei einer geölten
// Baumscheibe, die man im Fensterlicht dreht.
//
// So funktioniert es:
//   1. Das vorhandene Bild des Stamms (jahresringe.js) bleibt die Farbe.
//   2. Dazu entsteht einmalig eine "Höhenkarte": dasselbe Holz noch
//      einmal in Grautönen, hell = hoch, dunkel = tief.
//   3. Die Grafikkarte (WebGL) rechnet aus beiden und der Lichtrichtung
//      das beleuchtete Bild. Das kostet pro Bild fast nichts.
//
// Gerechnet wird nur, wenn sich das Licht bewegt oder der Baum sich
// ändert. In Ruhe steht ein fertiges Bild.
// Ohne WebGL gibt streiflicht() null zurück – dann bleibt der Baum,
// wie er war.
// =====================================================================

import { h } from "../dom.js";

const TAU = Math.PI * 2;

function ringPfad(ctx, ring, cx, cy, R) {
  const N = ring.r.length;
  ctx.beginPath();
  for (let p = 0; p <= N; p++) {
    const i = p % N; const th = (i / N) * TAU; const rr = ring.r[i] * R;
    const x = cx + ring.mitte.x * R + Math.cos(th) * rr; const y = cy + ring.mitte.y * R + Math.sin(th) * rr;
    if (p) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/**
 * Die Höhenkarte des Stamms: Grauwert = Höhe (128 = Holzfläche).
 * geo kommt aus baumGeometrie(); sichtbar = wie viele Ringe zu sehen sind.
 * groesse, cx, cy, R wie beim Zeichnen des Baums (in Punkten), dpr = Bildpunkte je Punkt.
 */
export function hoehenkarte(geo, { groesse, cx, cy, R, dpr = 1, sichtbar = geo.n }) {
  const c = document.createElement("canvas");
  c.width = c.height = Math.round(groesse * dpr);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, c.width, c.height);          // außerhalb: tief → der Rand bekommt eine Kante
  const anzahl = Math.min(geo.ringe.length, Math.max(0, Math.ceil(sichtbar)));
  if (!anzahl) return c;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const letzter = anzahl - 1;

  // Holzfläche: von außen nach innen, jeder Ring eine Spur anders hoch (Frühholz liegt minimal höher)
  for (let i = letzter; i >= 0; i--) {
    const g = 150 + (i % 2 ? 7 : 0);
    ringPfad(ctx, geo.ringe[i], cx, cy, R);
    ctx.fillStyle = `rgb(${g}, ${g}, ${g})`; ctx.fill();
  }
  ctx.save();
  ringPfad(ctx, geo.ringe[letzter], cx, cy, R); ctx.clip();
  // Fasern: feine Kratzer entlang der Ringe
  ctx.lineWidth = Math.max(0.5, R * 0.003);
  for (const f of geo.fasern) {
    const ring = geo.ringe[Math.min(letzter, Math.floor(f.ring * (letzter + 1)))];
    const p = Math.floor((f.w / TAU) * ring.r.length) % ring.r.length;
    const g = f.hell ? 172 : 128;
    ctx.strokeStyle = `rgba(${g}, ${g}, ${g}, 0.55)`;
    ctx.beginPath(); ctx.arc(cx + ring.mitte.x * R, cy + ring.mitte.y * R, ring.r[p] * R * (0.9 + f.tief * 0.09), f.w, f.w + f.l); ctx.stroke();
  }
  // Markstrahlen: flache Rinnen von innen nach außen
  ctx.lineWidth = Math.max(0.6, R * 0.004);
  ctx.strokeStyle = "rgba(118, 118, 118, 0.5)";
  for (const s of geo.strahlen) {
    const r1 = s.von * R * geo.ringe[letzter].anteil; const r2 = s.bis * R * geo.ringe[letzter].anteil;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(s.w) * r1, cy + Math.sin(s.w) * r1); ctx.lineTo(cx + Math.cos(s.w) * r2, cy + Math.sin(s.w) * r2); ctx.stroke();
  }
  ctx.restore();
  // Ringgrenzen (Spätholz): die Rillen. Nie breiter als ein Drittel des Ringabstands.
  for (let i = 0; i <= letzter; i++) {
    const ring = geo.ringe[i];
    const abstand = (ring.anteil - (i ? geo.ringe[i - 1].anteil : 0)) * R;
    ringPfad(ctx, ring, cx, cy, R);
    ctx.lineWidth = Math.max(0.8, Math.min(R * 0.016, abstand * 0.34));
    ctx.strokeStyle = i === letzter ? "rgb(40, 40, 40)" : "rgb(84, 84, 84)";
    ctx.stroke();
  }
  // Das Mark: eine kleine Kuppe in der Mitte
  const m = geo.ringe[0];
  ctx.fillStyle = "rgb(210, 210, 210)";
  ctx.beginPath(); ctx.arc(cx + m.mitte.x * R, cy + m.mitte.y * R, Math.max(1.6, R * 0.014), 0, TAU); ctx.fill();

  // Einmal weichzeichnen, damit die Kanten rund werden (einmalig, nicht pro Bild).
  // Kann der Browser das nicht, bleibt die Karte etwas härter – auch gut.
  if ("filter" in ctx) {
    const weich = document.createElement("canvas");
    weich.width = c.width; weich.height = c.height;
    const w = weich.getContext("2d");
    w.filter = `blur(${(Math.max(0.7, R * 0.006) * dpr).toFixed(2)}px)`;
    w.drawImage(c, 0, 0);
    return weich;
  }
  return c;
}

const ECKEN = `
attribute vec2 aOrt;
varying vec2 vUv;
void main() { vUv = aOrt * 0.5 + 0.5; gl_Position = vec4(aOrt, 0.0, 1.0); }`;

const FLAECHE = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uFarbe;   // das gezeichnete Holz
uniform sampler2D uHoehe;   // die Höhenkarte
uniform vec2 uPunkt;        // Größe eines Bildpunkts
uniform vec3 uLicht;        // Richtung zum Licht (x rechts, y oben, z zum Betrachter)
uniform float uStaerke;     // 0 = flach wie bisher, 1 = volles Relief

void main() {
  vec4 farbe = texture2D(uFarbe, vUv);
  float l = texture2D(uHoehe, vUv - vec2(uPunkt.x, 0.0)).r;
  float r = texture2D(uHoehe, vUv + vec2(uPunkt.x, 0.0)).r;
  float u = texture2D(uHoehe, vUv - vec2(0.0, uPunkt.y)).r;
  float o = texture2D(uHoehe, vUv + vec2(0.0, uPunkt.y)).r;
  vec3 n = normalize(vec3((l - r) * 5.5, (u - o) * 5.5, 1.0));
  vec3 L = normalize(uLicht);

  // Streulicht: eine ebene Fläche bleibt genau so hell wie im Original
  float streu = max(dot(n, L), 0.0) / L.z;
  // Glanz: nur dort, wo die Fläche dem Licht entgegenkippt (ebene Stellen glänzen nicht zusätzlich)
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float glanz = max(0.0, pow(max(dot(n, H), 0.0), 26.0) - pow(H.z, 26.0));
  // Ein weicher Schein wandert mit dem Licht über die ganze Scheibe
  vec2 fleck = vec2(0.5) + L.xy * 0.42;
  float schein = exp(-dot(vUv - fleck, vUv - fleck) * 7.0);

  vec3 c = farbe.rgb * mix(1.0, 0.5 + 0.62 * streu, uStaerke);
  c += vec3(1.0, 0.80, 0.58) * farbe.a * uStaerke * (glanz * 0.85 + schein * 0.085);
  gl_FragColor = vec4(c, farbe.a);
}`;

/**
 * Baut die Reliefansicht. Gibt null zurück, wenn WebGL fehlt.
 *
 * @returns {{ leinwand, zeige(farbe, hoehe), licht(x, y), staerke(wert), frei() }}
 *   zeige:   neues Holzbild + Höhenkarte übernehmen (beides Leinwände gleicher Größe)
 *   licht:   Lichtrichtung setzen, x/y von −1 bis 1 wie in neigung.js (y nach unten positiv)
 *   staerke: 0 … 1, zum weichen Ein- und Ausblenden des Reliefs
 */
export function streiflicht({ klasse = "baum-ebene baum-relief" } = {}) {
  const leinwand = h("canvas", { class: klasse, "aria-hidden": "true" });
  const gl = leinwand.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return null;

  let prog;
  try {
    const shader = (art, text) => {
      const s = gl.createShader(art);
      gl.shaderSource(s, text); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "Shader");
      return s;
    };
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, ECKEN));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FLAECHE));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "Programm");
  } catch (e) {
    console.warn("Streiflicht nicht verfügbar:", e);
    return null;
  }
  gl.useProgram(prog);
  const puffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, puffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aOrt = gl.getAttribLocation(prog, "aOrt");
  gl.enableVertexAttribArray(aOrt);
  gl.vertexAttribPointer(aOrt, 2, gl.FLOAT, false, 0, 0);
  const u = Object.fromEntries(["uFarbe", "uHoehe", "uPunkt", "uLicht", "uStaerke"].map((n) => [n, gl.getUniformLocation(prog, n)]));

  const textur = (einheit) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + einheit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  };
  const tFarbe = textur(0); const tHoehe = textur(1);
  gl.uniform1i(u.uFarbe, 0); gl.uniform1i(u.uHoehe, 1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  let bereit = false;
  let lx = 0.5; let ly = -0.55; let kraft = 1;
  let verloren = false;
  leinwand.addEventListener("webglcontextlost", (e) => { e.preventDefault(); verloren = true; });

  function male() {
    if (!bereit || verloren) return;
    gl.viewport(0, 0, leinwand.width, leinwand.height);
    gl.uniform3f(u.uLicht, lx * 0.9, -ly * 0.9, 0.62);
    gl.uniform1f(u.uStaerke, kraft);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  return {
    leinwand,
    get verfuegbar() { return !verloren; },
    zeige(farbe, hoehe) {
      if (verloren) return;
      if (leinwand.width !== farbe.width || leinwand.height !== farbe.height) { leinwand.width = farbe.width; leinwand.height = farbe.height; }
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tFarbe);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, farbe);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tHoehe);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, hoehe);
      gl.uniform2f(u.uPunkt, 1 / farbe.width, 1 / farbe.height);
      bereit = true;
      male();
    },
    licht(x, y) { lx = x; ly = y; male(); },
    staerke(wert) { kraft = Math.max(0, Math.min(1, wert)); male(); },
    frei() { gl.getExtension("WEBGL_lose_context")?.loseContext(); leinwand.remove(); },
  };
}
