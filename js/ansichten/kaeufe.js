// =====================================================================
// kaeufe.js – Alle Sparwochen als Liste, nach Monaten gruppiert.
// Eingetragen = ruhiges Häkchen, geschätzt = gestrichelter Kreis,
// ausstehend = Uhr. Antippen öffnet das Eintragen.
// =====================================================================

import { h, icon, fuelle } from "../dom.js";
import { btc as btcFmt, euro, monatsname, wochentagKurz, datumLang, anzahl, ganz } from "../format.js";
import { zerlege } from "../zeit.js";
import { leer } from "./gemeinsam.js";

const STATUS = {
  eingetragen: { text: "eingetragen", symbol: "haken" },
  geschaetzt: { text: "geschätzt", symbol: "schaetzung" },
  ausstehend: { text: "ausstehend", symbol: "uhr" },
  ohneKurs: { text: "Kurs fehlt", symbol: "offline" },
};

export function erstelleKaeufe(app) {
  const z = app.zustand;
  const zahl = h("p", { class: "kaeufe-zahl zahl-gross" });
  const unter = h("p", { class: "kaeufe-unter" });
  const knopf = h("button", { type: "button", class: "knopf knopf--primaer knopf--breit", onclick: (e) => app.eintragen(null, e.currentTarget) }, icon("plus", { groesse: 18, strich: 2 }), "Kauf eintragen");
  const liste = h("div", { class: "kaeufe-liste" });
  const el = h("div", { class: "seite-inhalt" },
    h("header", { class: "seiten-kopf" }, h("p", { class: "label" }, "Deine Käufe"), zahl, unter, knopf),
    liste);

  function zeile(k) {
    const st = STATUS[k.status];
    const { tag } = zerlege(k.montag);
    const uhr = `${String(k.stunde).padStart(2, "0")}:${String(k.minute).padStart(2, "0")}`;
    const mitte = k.status === "ausstehend"
      ? [h("span", { class: "kauf-menge" }, `Kauf um ${uhr} Uhr`), h("span", { class: "kauf-kurs" }, "zählt ab dann mit")]
      : k.status === "ohneKurs"
        ? [h("span", { class: "kauf-menge" }, "Kurs wird gesucht"), h("span", { class: "kauf-kurs" }, "oder selbst eintragen")]
        : [h("span", { class: "kauf-menge" }, btcFmt(k.btc), h("span", { class: "kauf-einheit" }, " BTC")),
          h("span", { class: "kauf-kurs" }, `zu ${euro(k.kurs, 0)}${k.kaufdatum !== k.montag ? ` · gekauft ${wochentagKurz(k.kaufdatum)}` : ""}`)];
    return h("button", {
      type: "button", class: ["kauf-zeile", "tippbar", `ist-${k.status.toLowerCase()}`],
      "aria-label": `${datumLang(k.montag, true)}: ${st.text}. Antippen zum ${k.status === "eingetragen" ? "Bearbeiten" : "Eintragen"}.`,
      onclick: (e) => app.eintragen(k.montag, e.currentTarget),
    },
    h("span", { class: "kauf-datum" }, h("span", { class: "kauf-tag" }, String(tag)), h("span", { class: "kauf-wt" }, wochentagKurz(k.montag))),
    h("span", { class: "kauf-mitte" }, mitte),
    h("span", { class: "kauf-status" }, icon(st.symbol, { groesse: 16, strich: 2 }), h("span", { class: "kauf-status-text" }, st.text)));
  }

  return {
    el,
    aktualisiere() {
      const s = z.summe;
      zahl.textContent = ganz(s.anzahl);
      const teile = [z.kaeufe.length ? `${s.anzahl === 1 ? "Kauf" : "Käufe"} seit ${datumLang(z.kaeufe[0].montag, true).replace(/^\w+, /, "")}` : "Käufe"];
      const sub = [];
      if (s.eingetragen) sub.push(`${s.eingetragen} eingetragen`);
      if (s.geschaetzt.length) sub.push(`${s.geschaetzt.length} geschätzt`);
      if (s.ausstehend.length) sub.push(`${s.ausstehend.length} ausstehend`);
      fuelle(unter, teile[0], sub.length ? h("span", { class: "text-3 kaeufe-unter-zeile" }, sub.join(" · ")) : null);

      if (!z.kaeufe.length) {
        fuelle(liste, leer({ titel: "Noch keine Sparwoche", text: "Der Sparplan startet am 8. Juni 2026. Ab dann erscheint hier jede Woche ein Kauf.", symbol: "kaeufe" }));
        return;
      }
      // Nach Monaten gruppieren, neueste zuerst; Börsenwechsel als Trenner
      const gruppen = [];
      for (const k of [...z.kaeufe].reverse()) {
        const { jahr, monat } = zerlege(k.montag);
        const schl = `${jahr}-${monat}`;
        if (!gruppen.length || gruppen[gruppen.length - 1].schl !== schl) gruppen.push({ schl, jahr, monat, boerse: k.boerse, kaeufe: [] });
        gruppen[gruppen.length - 1].kaeufe.push(k);
      }
      const kinder = [];
      let letzteBoerse = null;
      for (const g of gruppen) {
        const boerse = g.kaeufe[g.kaeufe.length - 1].boerse;
        if (boerse !== letzteBoerse) {
          const inPhase = z.kaeufe.filter((k) => k.boerse === boerse);
          const geb = (inPhase[0].gebuehr * 100).toLocaleString("de-DE", { maximumFractionDigits: 2 });
          kinder.push(h("p", { class: "phasen-trenner" }, h("span", null, `${boerse} · ${geb} % Gebühr · ${anzahl(inPhase.length, "Sparwoche", "Sparwochen")}`)));
          letzteBoerse = boerse;
        }
        kinder.push(h("section", { class: "monat-gruppe" },
          h("h3", { class: "monat-titel" }, `${monatsname(g.monat)} ${g.jahr}`),
          h("div", { class: "karte karte--liste" }, g.kaeufe.map(zeile))));
      }
      fuelle(liste, kinder);
    },
  };
}
