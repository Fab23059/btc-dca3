// =====================================================================
// jahresringe.js – "Dein Baum": Dein Sparplan als Querschnitt eines
// wachsenden Stammes. Jeder Kauf ist ein Ring.
//
//   * Die FLÄCHE jedes Rings entspricht den sats dieses Kaufs. In
//     günstigen Wochen gab es für dieselben 15 € mehr – der Ring wird
//     breiter. Wie bei einem echten Baum werden spätere Ringe schmaler,
//     weil sie sich um einen immer dickeren Stamm legen.
//   * Der jüngste Ring glüht wie Glut und atmet leise.
//   * Mit dem Finger über den Stamm fahren zeigt jeden einzelnen Kauf.
//   * Der Wechsel zu Bitvavo und jeder Jahreswechsel sind als feine
//     Doppellinie eingeschrieben.
//   * Als Hintergrundbild exportierbar (1080 × 2400 Pixel).
// Alles wird selbst gezeichnet – kein Foto, kein Zufall: Derselbe
// Sparplan ergibt immer denselben Baum.
// =====================================================================


const TAU = Math.PI * 2;
const PUNKTE = 300;   // Stützpunkte je Ring

/** Fester Zufall (immer gleiche Zahlen für denselben Startwert) */
function zufallsquelle(saat) {
  let a = saat >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Berechnet die Geometrie: für jeden Ring die Außenkante als Liste von Radien.
 * kaeufe: gezählte Käufe in zeitlicher Reihenfolge.
 */
export function baumGeometrie(kaeufe, saat = 20260608) {
  const z = zufallsquelle(saat);
  const n = kaeufe.length;
  const gesamt = kaeufe.reduce((s, k) => s + k.btc, 0) || 1;
  // gemeinsame Wuchsform (alle Ringe teilen sie – wie bei echtem Holz)
  const form = Array.from({ length: 5 }, (_, j) => ({ a: (0.5 + z()) / (j + 1.6), p: z() * TAU, drift: (z() - 0.5) * 0.012 }));
  const zittern = Array.from({ length: 6 }, (_, j) => ({ a: (0.3 + z()) / (j + 5), p: z() * TAU }));
  const exz = { x: (z() - 0.5) * 0.09, y: (z() - 0.5) * 0.07 };
  let kum = 0;
  const ringe = kaeufe.map((k, i) => {
    kum += k.btc;
    const anteil = Math.sqrt(kum / gesamt);          // Fläche ∝ sats
    const staerke = 0.028 + 0.035 * anteil;          // außen unruhiger
    const r = new Float32Array(PUNKTE);
    const eigen = Array.from({ length: 3 }, () => ({ a: (z() - 0.5) * 0.25, p: z() * TAU, f: 7 + Math.floor(z() * 9) }));
    for (let p = 0; p < PUNKTE; p++) {
      const th = (p / PUNKTE) * TAU;
      let w = 0;
      form.forEach((f, j) => { w += f.a * Math.sin((j + 1) * th + f.p + i * f.drift); });
      zittern.forEach((f, j) => { w += f.a * 0.35 * Math.sin((j + 6) * th + f.p + i * 0.045); });
      eigen.forEach((f) => { w += f.a * 0.06 * Math.sin(f.f * th + f.p); });
      r[p] = anteil * (1 + staerke * w);
    }
    return { kauf: k, anteil, r, mitte: { x: exz.x * anteil, y: exz.y * anteil } };
  });
  // Ringe dürfen sich nie kreuzen: jeder liegt überall außerhalb des vorigen
  for (let i = 1; i < ringe.length; i++) {
    const vor = ringe[i - 1].r; const jetzt = ringe[i].r;
    const luecke = (ringe[i].anteil - ringe[i - 1].anteil) * 0.35;
    for (let p = 0; p < PUNKTE; p++) if (jetzt[p] < vor[p] + luecke) jetzt[p] = vor[p] + luecke;
  }
  const strahlen = Array.from({ length: 34 }, () => ({ w: z() * TAU, von: 0.08 + z() * 0.5, bis: 0.55 + z() * 0.45, a: 0.25 + z() * 0.75 }));
  const fasern = Array.from({ length: 520 }, () => ({ ring: z(), w: z() * TAU, l: 0.03 + z() * 0.16, tief: z(), hell: z() < 0.45, a: 0.025 + z() * 0.05 }));
  const riss = { w: z() * TAU, tiefe: 0.18 + z() * 0.2, knick: (z() - 0.5) * 0.12 };
  return { ringe, strahlen, fasern, riss, n };
}

/** Ein Ring als geschlossener Pfad (Radius 1 = ganzer Stamm). */
function ringPfad(ctx, ring, cx, cy, R, skala = 1) {
  ctx.beginPath();
  for (let p = 0; p <= PUNKTE; p++) {
    const i = p % PUNKTE;
    const th = (i / PUNKTE) * TAU;
    const rr = ring.r[i] * R * skala;
    const x = cx + ring.mitte.x * R + Math.cos(th) * rr;
    const y = cy + ring.mitte.y * R + Math.sin(th) * rr;
    if (p === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * Zeichnet den Baum. sichtbar = wie viele Ringe (für das Wachsen, auch Bruchteile).
 * hervor = Index eines hervorgehobenen Rings (Finger).
 */
export function zeichneBaum(ctx, geo, { cx, cy, R, sichtbar = geo.n, hervor = null, atem = 0.5, mitRinde = true, nurGlut = false, ohneGlut = false }) {
  const { ringe } = geo;
  const anzahl = Math.min(ringe.length, Math.ceil(sichtbar));
  if (!anzahl) return;
  const teil = sichtbar - Math.floor(sichtbar) || 1;
  const letzter = anzahl - 1;
  const wachsSkala = (i) => (i === letzter && sichtbar < ringe.length ? 0.85 + 0.15 * teil : 1);
  if (nurGlut) { glutRing(ctx, ringe[letzter], cx, cy, R, wachsSkala(letzter), atem); return; }

  ctx.save();
  // Rinde: dunkler, rauer Rand mit warmem Schimmer
  if (mitRinde) {
    const aussen = ringe[letzter];
    ctx.save();
    ringPfad(ctx, aussen, cx, cy, R, wachsSkala(letzter) * 1.045);
    ctx.fillStyle = "#0D0A08";
    ctx.shadowColor = "rgba(240, 140, 60, 0.28)";
    ctx.shadowBlur = R * 0.12;
    ctx.fill();
    ctx.restore();
  }
  // Holz: von außen nach innen füllen, jeder Ring eine Spur anders getönt
  for (let i = letzter; i >= 0; i--) {
    const ring = ringe[i];
    const alter = 1 - i / Math.max(1, ringe.length - 1);
    const innen = i > 0 ? ringe[i - 1].anteil : 0;
    const w = 1 - alter;
    ringPfad(ctx, ring, cx, cy, R, wachsSkala(i));
    // Frühholz (innen im Ring, heller) → Spätholz (außen, dunkler) – wie echtes Holz.
    // Bei sehr dichten Ringen genügt eine Fläche (sonst entstehen Keile).
    if ((ring.anteil - innen) * R < 7) {
      ctx.fillStyle = `rgb(${Math.round(36 + 18 * w + (i % 2) * 3)}, ${Math.round(25 + 9 * w + (i % 2) * 2)}, ${Math.round(17 + 3 * w)})`;
      ctx.fill();
      continue;
    }
    const g = ctx.createRadialGradient(cx + ring.mitte.x * R, cy + ring.mitte.y * R, R * innen, cx + ring.mitte.x * R, cy + ring.mitte.y * R, R * ring.anteil);
    g.addColorStop(0, `rgb(${Math.round(44 + 22 * w)}, ${Math.round(30 + 12 * w)}, ${Math.round(20 + 4 * w)})`);
    g.addColorStop(0.7, `rgb(${Math.round(34 + 16 * w)}, ${Math.round(23 + 8 * w)}, ${Math.round(16 + 3 * w)})`);
    g.addColorStop(1, `rgb(${Math.round(20 + 8 * w)}, ${Math.round(14 + 4 * w)}, ${Math.round(10 + 2 * w)})`);
    ctx.fillStyle = g;
    ctx.fill();
  }
  // Fasern: feine, kurze Bögen entlang der Ringe – die Maserung
  ctx.save();
  ringPfad(ctx, ringe[letzter], cx, cy, R, wachsSkala(letzter));
  ctx.clip();
  ctx.lineWidth = Math.max(0.4, R * 0.0018);
  for (const f of geo.fasern) {
    const ring = ringe[Math.min(letzter, Math.floor(f.ring * (letzter + 1)))];
    const p = Math.floor(f.w / TAU * PUNKTE) % PUNKTE;
    const rr = ring.r[p] * R * (0.9 + f.tief * 0.09);
    ctx.strokeStyle = `rgba(${f.hell ? "255, 214, 170" : "0, 0, 0"}, ${f.a})`;
    ctx.beginPath();
    ctx.arc(cx + ring.mitte.x * R, cy + ring.mitte.y * R, rr, f.w, f.w + f.l);
    ctx.stroke();
  }
  ctx.restore();
  // Markstrahlen: feine Linien von innen nach außen
  ctx.save();
  ringPfad(ctx, ringe[letzter], cx, cy, R, wachsSkala(letzter));
  ctx.clip();
  ctx.lineWidth = Math.max(0.5, R * 0.0025);
  for (const s of geo.strahlen) {
    const r1 = s.von * R * ringe[letzter].anteil; const r2 = s.bis * R * ringe[letzter].anteil;
    ctx.strokeStyle = `rgba(255, 200, 150, ${0.03 * s.a})`;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(s.w) * r1, cy + Math.sin(s.w) * r1);
    ctx.lineTo(cx + Math.cos(s.w) * r2, cy + Math.sin(s.w) * r2);
    ctx.stroke();
  }
  ctx.restore();

  // Ringgrenzen (Spätholz) als glimmende Linien – jüngere heißer
  for (let i = 0; i <= letzter; i++) {
    const ring = ringe[i];
    const k = ring.kauf;
    const waerme = Math.pow((i + 1) / ringe.length, 1.6);
    // Linienstärke nie dicker als ein Drittel des Ringabstands (sonst verschwimmt ein alter Baum)
    const abstand = (ring.anteil - (i > 0 ? ringe[i - 1].anteil : 0)) * R;
    const dicht = Math.min(1, abstand / (R * 0.03));
    const breite = Math.max(0.45, Math.min(R * (0.004 + 0.004 * waerme), abstand * 0.32));
    const istHervor = hervor === i;
    const gedimmt = hervor != null && !istHervor;
    let alpha = (0.18 + 0.55 * waerme) * (k.status === "geschaetzt" ? 0.65 : 1) * (0.45 + 0.55 * dicht);
    if (gedimmt) alpha *= 0.45;
    ringPfad(ctx, ring, cx, cy, R, wachsSkala(i));
    ctx.lineWidth = breite;
    if (istHervor) {
      ctx.shadowColor = "rgba(255, 190, 110, 0.95)";
      ctx.shadowBlur = R * 0.05;
      ctx.strokeStyle = "rgba(255, 226, 180, 1)";
      ctx.lineWidth = breite * 2.2;
    } else {
      ctx.shadowColor = `rgba(240, 140, 60, ${0.6 * waerme})`;
      ctx.shadowBlur = R * 0.02 * waerme * dicht;
      ctx.strokeStyle = `rgba(${Math.round(200 + 55 * waerme)}, ${Math.round(120 + 70 * waerme)}, ${Math.round(70 + 40 * waerme)}, ${alpha})`;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Börsenwechsel und Jahreswechsel: feine Doppellinie
    const naechster = ringe[i + 1]?.kauf;
    if (naechster && i < letzter && (naechster.boerse !== k.boerse || naechster.montag.slice(0, 4) !== k.montag.slice(0, 4))) {
      ringPfad(ctx, ring, cx, cy, R, wachsSkala(i) * 1.012);
      ctx.lineWidth = Math.max(0.6, breite * 0.7);
      ctx.strokeStyle = `rgba(255, 236, 214, ${gedimmt ? 0.15 : 0.4})`;
      ctx.stroke();
    }
  }

  // Der jüngste Ring glüht und atmet
  const jung = ringe[letzter];
  if (hervor == null && !ohneGlut) glutRing(ctx, jung, cx, cy, R, wachsSkala(letzter), atem);

  // Das Mark: der allererste Kauf, ein warmer Punkt in der Mitte
  const m = ringe[0];
  ctx.beginPath();
  ctx.arc(cx + m.mitte.x * R, cy + m.mitte.y * R, Math.max(1.4, R * 0.012), 0, TAU);
  ctx.fillStyle = "rgba(255, 210, 160, 0.9)";
  ctx.shadowColor = "rgba(255, 160, 80, 0.9)";
  ctx.shadowBlur = R * 0.04;
  ctx.fill();
  ctx.restore();
}

function glutRing(ctx, ring, cx, cy, R, skala, atem) {
  ctx.save();
  ringPfad(ctx, ring, cx, cy, R, skala);
  ctx.lineWidth = Math.max(1.2, R * 0.011);
  ctx.shadowColor = "rgba(255, 150, 60, 1)";
  ctx.shadowBlur = R * (0.06 + 0.05 * atem);
  ctx.strokeStyle = `rgba(255, ${Math.round(190 + 30 * atem)}, ${Math.round(120 + 40 * atem)}, ${0.75 + 0.25 * atem})`;
  ctx.stroke();
  ctx.restore();
}

/** Welcher Ring liegt unter dem Punkt (x, y)? */
export function ringBei(geo, x, y, cx, cy, R) {
  for (let i = 0; i < geo.ringe.length; i++) {
    const ring = geo.ringe[i];
    const dx = x - (cx + ring.mitte.x * R); const dy = y - (cy + ring.mitte.y * R);
    let th = Math.atan2(dy, dx); if (th < 0) th += TAU;
    const p = Math.round((th / TAU) * PUNKTE) % PUNKTE;
    if (Math.hypot(dx, dy) <= ring.r[p] * R) return i;
  }
  return null;
}

/**
 * Hintergrundbild 1080 × 2400: Baum, Nebelglut, ruhige Typografie.
 * Gibt einen Blob (PNG) zurück.
 */
export async function hintergrundbild(kaeufe, { zeilen = [] } = {}) {
  const B = 1080; const H = 2400;
  const c = document.createElement("canvas");
  c.width = B; c.height = H;
  const ctx = c.getContext("2d");
  // Grund mit Glut und Nebel
  ctx.fillStyle = "#0A0A0C"; ctx.fillRect(0, 0, B, H);
  const glut = ctx.createRadialGradient(B * 0.5, H * 0.42, 0, B * 0.5, H * 0.42, B * 0.9);
  glut.addColorStop(0, "rgba(240, 140, 60, 0.22)"); glut.addColorStop(0.5, "rgba(120, 60, 30, 0.08)"); glut.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glut; ctx.fillRect(0, 0, B, H);
  const dunst = ctx.createLinearGradient(0, H * 0.6, 0, H);
  dunst.addColorStop(0, "rgba(40, 46, 70, 0)"); dunst.addColorStop(1, "rgba(40, 46, 70, 0.25)");
  ctx.fillStyle = dunst; ctx.fillRect(0, 0, B, H);
  // Baum
  const geo = baumGeometrie(kaeufe);
  zeichneBaum(ctx, geo, { cx: B / 2, cy: H * 0.42, R: B * 0.36, atem: 0.8 });
  // Korn
  const korn = ctx.getImageData(0, 0, B, H);
  const z = zufallsquelle(7);
  for (let i = 0; i < korn.data.length; i += 4) {
    const n = (z() - 0.5) * 14;
    korn.data[i] += n; korn.data[i + 1] += n; korn.data[i + 2] += n;
  }
  ctx.putImageData(korn, 0, 0);
  // Schrift
  await document.fonts.ready;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(244, 241, 236, 0.92)";
  ctx.font = '520 64px "Mona", system-ui, sans-serif';
  if ("fontStretch" in ctx) ctx.fontStretch = "expanded";
  ctx.letterSpacing = "-1px";
  ctx.shadowColor = "rgba(255, 170, 90, 0.35)"; ctx.shadowBlur = 30;
  ctx.fillText(zeilen[0] ?? "Jeder Ring ein Montag.", B / 2, H * 0.72);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(167, 163, 174, 0.9)";
  if ("fontStretch" in ctx) ctx.fontStretch = "normal";
  ctx.letterSpacing = "0px";
  ctx.font = '500 34px "Mona", system-ui, sans-serif';
  zeilen.slice(1).forEach((z2, i) => ctx.fillText(z2, B / 2, H * 0.72 + 80 + i * 52));
  return new Promise((ok) => c.toBlob(ok, "image/png"));
}
