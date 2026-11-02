// haptik.js – feines Vibrieren als Rückmeldung (nur wenn eingeschaltet und vom Gerät unterstützt).
import { ladeEinstellungen } from "../speicher.js";

let an = ladeEinstellungen().haptik;
export const haptikAn = (wert) => { an = wert; };
export function tick(ms = 6) {
  if (an && typeof navigator.vibrate === "function" && navigator.userActivation?.hasBeenActive !== false) {
    try { navigator.vibrate(ms); } catch { /* manche Browser verbieten es ohne Geste */ }
  }
}
