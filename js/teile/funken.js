// =====================================================================
// funken.js – Feiern: ein Regen aus Funken und Konfetti.
//
// Für Meilensteine und frisch eingetragene Käufe. Eine eigene Leinwand
// legt sich für zwei, drei Sekunden über alles (ohne Klicks abzufangen)
// und verschwindet danach wieder vollständig. Funken leuchten additiv,
// Konfetti flattert, dreht sich und fällt.
// "Bewegung reduzieren" → keine Feier, nur die Meldung.
// =====================================================================

import { h, wenigBewegung } from "../dom.js";

const FARBEN = ["#FF8A2A", "#FFB067", "#FFD7A8", "#FFF1E0", "#F26B1D", "#93C6A0"];

let laufend = null;

/**
 * Startet eine Feier.
 * x, y: Ursprung in Bildschirmpunkten (Standard: oben in der Mitte)
 * staerke: 0.3 (kleiner Funke) … 1 (großer Meilenstein)
 */
export function feiern({ x = innerWidth / 2, y = innerHeight * 0.22, staerke = 1 } = {}) {
  if (wenigBewegung() || document.documentElement.classList.contains("ruhig")) return;
  if (!laufend) laufend = buehne();
  laufend.zuenden(x, y, staerke);
}

function buehne() {
  const leinwand = h("canvas", { class: "funken-buehne", "aria-hidden": "true" });
  document.body.append(leinwand);
  const ctx = leinwand.getContext("2d");
  const dpr = Math.min(2, devicePixelRatio || 1);
  const mass = () => { leinwand.width = Math.round(innerWidth * dpr); leinwand.height = Math.round(innerHeight * dpr); };
  mass();
  const teile = [];
  let zuletzt = performance.now();
  let bild = 0;

  function zuenden(x, y, staerke) {
    const funkenZahl = Math.round(70 * staerke + 20);
    for (let i = 0; i < funkenZahl; i++) {
      const w = Math.random() * Math.PI * 2;
      const v = (180 + Math.random() * 520) * (0.6 + staerke * 0.5);
      teile.push({ art: "funke", x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v - 160, leben: 0.6 + Math.random() * 0.9, alt: 0, r: 0.8 + Math.random() * 1.8 });
    }
    const konfettiZahl = Math.round(80 * staerke);
    for (let i = 0; i < konfettiZahl; i++) {
      const w = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const v = 320 + Math.random() * 520 * staerke;
      teile.push({
        art: "konfetti", x: x + (Math.random() - 0.5) * 40, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v,
        leben: 2.2 + Math.random() * 1.4, alt: 0, b: 5 + Math.random() * 5, h: 8 + Math.random() * 7,
        dreh: Math.random() * Math.PI, drehV: (Math.random() - 0.5) * 14, flatter: Math.random() * Math.PI * 2,
        farbe: FARBEN[Math.floor(Math.random() * FARBEN.length)],
      });
    }
    // Ein Lichtblitz am Ursprung
    teile.push({ art: "blitz", x, y, alt: 0, leben: 0.5, r: 90 + 120 * staerke });
    if (!bild) { zuletzt = performance.now(); bild = requestAnimationFrame(schritt); }
  }

  function schritt(jetzt) {
    const dt = Math.min(0.04, (jetzt - zuletzt) / 1000);
    zuletzt = jetzt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = teile.length - 1; i >= 0; i--) {
      const t = teile[i];
      t.alt += dt;
      const rest = 1 - t.alt / t.leben;
      if (rest <= 0 || t.y > innerHeight + 40) { teile.splice(i, 1); continue; }
      if (t.art === "blitz") {
        const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.r);
        g.addColorStop(0, `rgba(255, 214, 170, ${(0.55 * rest * rest).toFixed(3)})`); g.addColorStop(1, "rgba(255, 138, 42, 0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      } else if (t.art === "funke") {
        t.vx *= 1 - 2.2 * dt; t.vy = t.vy * (1 - 2.2 * dt) + 520 * dt;
        t.x += t.vx * dt; t.y += t.vy * dt;
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(255, ${Math.round(140 + 100 * rest)}, ${Math.round(60 + 120 * rest)}, ${(0.95 * rest).toFixed(3)})`;
        ctx.lineWidth = t.r; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x - t.vx * 0.022, t.y - t.vy * 0.022); ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      } else {
        t.vx *= 1 - 1.6 * dt; t.vy = t.vy * (1 - 1.6 * dt) + 380 * dt;
        t.flatter += dt * 7; t.dreh += t.drehV * dt;
        t.x += (t.vx + Math.sin(t.flatter) * 40) * dt; t.y += t.vy * dt;
        ctx.save();
        ctx.translate(t.x, t.y); ctx.rotate(t.dreh); ctx.scale(1, Math.cos(t.flatter));
        ctx.globalAlpha = Math.min(1, rest * 2.2);
        ctx.fillStyle = t.farbe;
        ctx.fillRect(-t.b / 2, -t.h / 2, t.b, t.h);
        ctx.restore();
      }
    }
    if (teile.length) { bild = requestAnimationFrame(schritt); return; }
    bild = 0;
    leinwand.remove();
    laufend = null;
  }

  addEventListener("resize", mass, { once: true });
  return { zuenden };
}
