// =====================================================================
// kurven.js – Federn als fertige Kurven für die Grafikkarte.
//
// Unsere Federn (feder.js) rechnen Bild für Bild in JavaScript. Das ist
// richtig für alles, was dem Finger folgt. Für feste Abläufe (etwa das
// Aufsteigen der Kacheln) ist es besser, die Feder einmal vorab
// auszurechnen und der Grafikkarte als Kurve zu geben: Dann läuft die
// Bewegung ohne die Oberfläche, auch wenn die gerade beschäftigt ist.
// CSS kann das mit linear(): eine Kurve aus vielen Stützpunkten.
// =====================================================================

const KANN_LINEAR = typeof CSS !== "undefined" && CSS.supports?.("transition-timing-function", "linear(0, 1)");

/**
 * Rechnet eine Feder von 0 nach 1 (dieselbe Physik wie feder.js) und gibt sie als
 * linear()-Kurve zurück, samt der Dauer, bis sie ruht.
 * @returns {{ kurve: string, dauer: number }}  dauer in ms
 */
export function federKurve({ antwort, daempfung = 1, punkte = 48 }) {
  const k = (2 * Math.PI / antwort) ** 2;
  const c = (4 * Math.PI * daempfung) / antwort;
  const dt = 1 / 240;
  const werte = [0];
  let x = 0; let v = 0; let t = 0;
  // Bis zur Ruhe rechnen (höchstens 3 s)
  while (t < 3) {
    v += (-k * (x - 1) - c * v) * dt;
    x += v * dt; t += dt;
    werte.push(x);
    if (Math.abs(1 - x) < 0.0015 && Math.abs(v) < 0.01) break;
  }
  const dauer = Math.round(t * 1000);
  if (!KANN_LINEAR) return { kurve: "cubic-bezier(.2, .9, .25, 1.06)", dauer };
  const stuetzen = [];
  for (let i = 0; i <= punkte; i++) {
    const w = werte[Math.round((i / punkte) * (werte.length - 1))];
    stuetzen.push(i === punkte ? "1" : w.toFixed(4));
  }
  return { kurve: `linear(${stuetzen.join(", ")})`, dauer };
}
