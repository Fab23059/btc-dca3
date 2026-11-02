// Tests für "Dein Baum" (nur Geometrie, ohne Zeichnen).
// Ausführen (nur für Entwickler): node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { baumGeometrie, ringBei } from "../js/jahresringe.js";

const TAU = Math.PI * 2;

/** 40 Käufe mit schwankender Menge (wie ein echter Sparplan) */
function beispielKaeufe(n = 40) {
  return Array.from({ length: n }, (_, i) => ({ montag: `w${i}`, btc: 0.0002 * (1 + 0.45 * Math.sin(i * 0.7) + 0.2 * Math.cos(i * 1.9)) }));
}

/** Punkt auf der Außenkante eines Rings (Stamm-Radius 1, Mitte 0/0) */
function kante(ring, p) {
  const n = ring.r.length;
  const th = (p / n) * TAU;
  return { x: ring.mitte.x + Math.cos(th) * ring.r[p], y: ring.mitte.y + Math.sin(th) * ring.r[p] };
}

/** Liegt der Punkt innerhalb des Rings? (gleiche Rechnung wie ringBei) */
function innen(ring, x, y) {
  const dx = x - ring.mitte.x; const dy = y - ring.mitte.y;
  let th = Math.atan2(dy, dx); if (th < 0) th += TAU;
  const p = Math.round((th / TAU) * ring.r.length) % ring.r.length;
  return Math.hypot(dx, dy) <= ring.r[p];
}

test("Baum: derselbe Sparplan ergibt immer denselben Baum", () => {
  const a = baumGeometrie(beispielKaeufe());
  const b = baumGeometrie(beispielKaeufe());
  assert.deepEqual([...a.ringe.at(-1).r], [...b.ringe.at(-1).r]);
});

test("Baum: Ringe kreuzen sich nie – jeder liegt ganz außerhalb des vorigen", () => {
  const geo = baumGeometrie(beispielKaeufe());
  for (let i = 1; i < geo.ringe.length; i++) {
    const vor = geo.ringe[i - 1]; const ring = geo.ringe[i];
    for (let p = 0; p < ring.r.length; p++) {
      const { x, y } = kante(ring, p);
      assert.ok(!innen(vor, x, y), `Ring ${i} liegt bei Punkt ${p} innerhalb von Ring ${i - 1}`);
    }
  }
});

test("Baum: Fläche bis zu jedem Ring ∝ den bis dahin gesammelten sats", () => {
  const kaeufe = beispielKaeufe();
  const geo = baumGeometrie(kaeufe);
  const gesamt = kaeufe.reduce((s, k) => s + k.btc, 0);
  let kum = 0;
  geo.ringe.forEach((ring, i) => {
    kum += kaeufe[i].btc;
    // mittlere Fläche des Rings (Polarformel) im Verhältnis zur Fläche des ganzen Stamms
    const n = ring.r.length;
    const flaeche = ring.r.reduce((s, r) => s + (r * r) / 2, 0) * (TAU / n);
    const ganz = geo.ringe.at(-1).r.reduce((s, r) => s + (r * r) / 2, 0) * (TAU / n);
    // Toleranz: Wuchsform und Mindestabstand verbiegen die Fläche nur leicht
    assert.ok(Math.abs(flaeche / ganz - kum / gesamt) < 0.06, `Ring ${i}: ${flaeche / ganz} statt ${kum / gesamt}`);
  });
});

test("Baum: Berühren trifft den richtigen Kauf", () => {
  const geo = baumGeometrie(beispielKaeufe());
  const R = 200; const cx = 300; const cy = 300;
  for (const i of [0, 5, 17, 39]) {
    const ring = geo.ringe[i];
    const innenRing = i ? geo.ringe[i - 1] : null;
    // Punkt genau zwischen Innen- und Außenkante dieses Rings, bei 1/8 Umdrehung
    const p = Math.round(ring.r.length / 8);
    const th = (p / ring.r.length) * TAU;
    const rMitte = ((innenRing ? innenRing.r[p] : 0) + ring.r[p]) / 2;
    const x = cx + (ring.mitte.x + Math.cos(th) * rMitte) * R;
    const y = cy + (ring.mitte.y + Math.sin(th) * rMitte) * R;
    assert.equal(ringBei(geo, x, y, cx, cy, R), i);
  }
  assert.equal(ringBei(geo, cx + 2 * R, cy, cx, cy, R), null, "außerhalb des Stamms trifft nichts");
});
