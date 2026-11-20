// =====================================================================
// nebel-werk.js – Hintergrund-Thread für den Nebel.
// Bekommt den Auftrag für eine Kachel, rechnet sie (nebel-rechnung.js)
// und schickt die fertigen Bildpunkte zurück – die Oberfläche bleibt
// dabei völlig frei.
// =====================================================================

import { rechneKachel } from "./nebel-rechnung.js";

self.onmessage = (e) => {
  const { nr, auftrag } = e.data;
  try {
    const k = rechneKachel(auftrag);
    self.postMessage({ nr, breite: k.breite, hoehe: k.hoehe, daten: k.daten }, [k.daten.buffer]);
  } catch (fehler) {
    self.postMessage({ nr, fehler: String(fehler) });
  }
};
