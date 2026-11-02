// =====================================================================
// gemeinsam.js – Kleine Helfer, die alle Ansichten teilen.
// =====================================================================

import { h, icon } from "../dom.js";
import { zahl, euroMitVorzeichen, prozent, MINUS } from "../format.js";

/** Euro für das Zählwerk: ganze Euro groß, Cent und € klein. */
export const euroTeile = ({ stellen = 2, vorzeichen = false } = {}) => (n) => {
  if (n == null || !Number.isFinite(n)) return [["ganz", "–"]];
  const v = vorzeichen ? (n > 0.004 ? "+" : n < -0.004 ? MINUS : "") : (n < -0.004 ? MINUS : "");
  const text = zahl(Math.abs(n), stellen);
  const [ganz, rest] = stellen ? [text.slice(0, -stellen - 1), text.slice(-stellen - 1)] : [text, ""];
  return [["ganz", `${v}${ganz}`], ["rest", `${rest} €`]];
};

/** Ganze Zahl mit Tausenderpunkten und Einheit. */
export const ganzTeile = (einheit = "") => (n) => [["ganz", n == null || !Number.isFinite(n) ? "–" : Math.round(n).toLocaleString("de-DE")], ["einheit", einheit]];

/** Gewinn/Verlust als ruhige Zeile: Pfeil, Euro, Prozent – Farbe nur im Zeichen. */
export function veraenderung(euro, proz) {
  if (euro == null) return h("span", { class: "text-3" }, "–");
  const art = euro > 0.004 ? "plus" : euro < -0.004 ? "minus" : "null";
  return h("span", { class: `veraenderung veraenderung--${art}` },
    art !== "null" ? icon(art === "plus" ? "pfeilHoch" : "pfeilRunter", { groesse: 14, strich: 2.2, klasse: "veraenderung-pfeil" }) : null,
    h("span", { class: "zahl" }, euroMitVorzeichen(euro)),
    proz != null ? h("span", { class: "zahl veraenderung-prozent" }, prozent(proz)) : null);
}

export const skelett = (breite = "60%", hoehe = "1em") => h("span", { class: "skelett", style: { width: breite, height: hoehe } });

/** Das Plus oben rechts in jedem Fenster-Kopf (wird beim Öffnen zum ×). */
export const kopfPlus = () => h("span", { class: "fkopf-plus", "aria-hidden": "true" }, icon("plus", { groesse: 20, strich: 1.8 }));
