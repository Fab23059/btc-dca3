// =====================================================================
// toast.js – Kurze Hinweise. Seit der Neugestaltung erscheinen sie als
// "Insel" oben am Bildschirm (siehe insel.js). Diese Datei übersetzt nur.
// =====================================================================

import { insel } from "./insel.js";

export function toast(text, { aktion = null, dauer = 4200, art = "" } = {}) {
  const a = art === "erfolg" ? "erfolg" : art === "fehler" ? "fehler" : art === "feier" ? "feier" : "info";
  // Langer Text: erster Satz als Titel, Rest darunter
  const satz = text.match(/^(.{12,70}?[.!?])\s+(.+)$/);
  return insel({ titel: satz ? satz[1] : text, text: satz ? satz[2] : null, art: a, aktion, dauer });
}
