// =====================================================================
// funken.js – Ein Meilenstein ist erreicht: Funken steigen auf wie aus
// einem Lagerfeuer in der Nacht. Warm, ruhig, ein paar Sekunden lang.
// =====================================================================

import { h, wenigBewegung } from "../dom.js";

export function funkenflug({ x = innerWidth / 2, y = innerHeight * 0.62, anzahl = 70 } = {}) {
  if (wenigBewegung()) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const c = h("canvas", { class: "funken-ebene", "aria-hidden": "true" });
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  document.body.append(c);
  const ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  const funken = Array.from({ length: anzahl }, (_, i) => ({
    x: x + (Math.random() - 0.5) * 60,
    y: y + Math.random() * 30,
    vx: (Math.random() - 0.5) * 1.4,
    vy: -(1.2 + Math.random() * 2.6),
    leben: 0,
    dauer: 1800 + Math.random() * 2200,
    groesse: 0.8 + Math.random() * 2.2,
    phase: Math.random() * Math.PI * 2,
    start: i * 18 + Math.random() * 300,
    farbe: Math.random() < 0.18 ? [255, 236, 210] : Math.random() < 0.5 ? [255, 178, 92] : [240, 132, 52],
  }));
  const t0 = performance.now();
  let letzte = t0;
  const bild = (jetzt) => {
    const dt = Math.min(48, jetzt - letzte) / 16.7;
    letzte = jetzt;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = "lighter";
    let lebend = 0;
    for (const f of funken) {
      const alter = jetzt - t0 - f.start;
      if (alter < 0) { lebend++; continue; }
      const k = alter / f.dauer;
      if (k >= 1) continue;
      lebend++;
      f.phase += 0.06 * dt;
      f.vx += Math.sin(f.phase) * 0.03 * dt;
      f.vy *= 0.995;
      f.x += f.vx * dt; f.y += f.vy * dt;
      const flackern = 0.75 + 0.25 * Math.sin(alter / 40 + f.phase * 3);
      const alpha = Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k) * flackern;
      const r = f.groesse * (1 - k * 0.5);
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 6);
      g.addColorStop(0, `rgba(${f.farbe.join(",")}, ${alpha})`);
      g.addColorStop(0.25, `rgba(${f.farbe.join(",")}, ${alpha * 0.35})`);
      g.addColorStop(1, "rgba(240, 120, 40, 0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, r * 6, 0, Math.PI * 2); ctx.fill();
    }
    if (lebend) requestAnimationFrame(bild); else c.remove();
  };
  requestAnimationFrame(bild);
}
