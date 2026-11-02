// =====================================================================
// gemeinsam.js – Kleine Bausteine, die mehrere Ansichten nutzen.
// =====================================================================

import { h, icon } from "../dom.js";
import { euroTeile, btcTeile, prozent, euroMitVorzeichen } from "../format.js";

/** Darstellung für die große Euro-Zahl (Vorkomma groß, Nachkomma und € kleiner). */
export const euroDarstellung = (mitVorzeichen = false, stellen = 2) => (n) => {
  const t = euroTeile(n, stellen, mitVorzeichen);
  return [["vz", t.vz], ["ganz", t.ganz], ["komma", t.komma], ["einheit", t.einheit]];
};

export const btcDarstellung = () => (n) => {
  const t = btcTeile(n);
  return [["ganz", t.ganz], ["komma", t.komma], ["einheit", t.einheit]];
};

export const ganzDarstellung = (einheit = "") => (n) => [["ganz", n == null ? "–" : Math.round(n).toLocaleString("de-DE")], ["einheit", einheit]];

/** Veränderung mit Pfeil und Vorzeichen – Farbe ist nie die einzige Information. */
export function veraenderung(euro, proz, { klein = false } = {}) {
  if (euro == null && proz == null) return h("span", { class: "veraenderung text-3" }, "–");
  const basis = euro ?? proz;
  const richtung = basis > 0 ? "plus" : basis < 0 ? "minus" : "null";
  return h("span", { class: ["veraenderung", `veraenderung--${richtung}`, klein && "veraenderung--klein"] },
    richtung !== "null" ? icon(richtung === "plus" ? "pfeilHoch" : "pfeilRunter", { groesse: klein ? 12 : 14, strich: 2.25, klasse: "veraenderung-pfeil" }) : null,
    euro != null ? h("span", { class: "veraenderung-euro" }, euroMitVorzeichen(euro)) : null,
    proz != null ? h("span", { class: "veraenderung-prozent" }, euro != null ? `(${prozent(proz)})` : prozent(proz)) : null);
}

/** Gestalteter Leerzustand */
export function leer({ titel, text, symbol = "info", aktion = null }) {
  return h("div", { class: "leer" },
    h("div", { class: "leer-symbol" }, icon(symbol, { groesse: 28, strich: 1.5 })),
    h("p", { class: "leer-titel" }, titel),
    h("p", { class: "leer-text" }, text),
    aktion);
}

/** Schimmernder Platzhalter */
export const skelett = (breite = "60%", hoehe = "1em") => h("span", { class: "skelett", style: { width: breite, height: hoehe } });

/** Hinweis-Banner */
export function hinweis({ symbol = "info", titel, text, aktion = null, art = "" }) {
  return h("div", { class: ["hinweis", art && `hinweis--${art}`] },
    h("div", { class: "hinweis-symbol" }, icon(symbol, { groesse: 20 })),
    h("div", { class: "hinweis-text" }, h("p", { class: "hinweis-titel" }, titel), text ? h("p", { class: "hinweis-unter" }, text) : null),
    aktion);
}

/** Abschnitts-Überschrift */
export const ueberschrift = (text, rechts = null) => h("div", { class: "abschnitt-kopf" }, h("h2", { class: "label" }, text), rechts);
