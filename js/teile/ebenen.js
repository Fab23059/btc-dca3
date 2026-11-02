// =====================================================================
// ebenen.js – Verwaltet alles, was über der App liegt (Sheets, Details).
// Die Zurück-Taste von Android schließt die oberste Ebene, statt die App
// zu verlassen. Der Fokus bleibt in der Ebene und kehrt danach zurück.
// =====================================================================

const stapel = [];
let zaehler = 0;
let eigeneRuecksprunge = 0;   // history.back()-Aufrufe, die wir selbst ausgelöst haben

addEventListener("popstate", () => {
  if (eigeneRuecksprunge > 0) { eigeneRuecksprunge--; return; }
  const oben = stapel[stapel.length - 1];
  if (oben) oben.schliessenIntern();
});

addEventListener("keydown", (e) => {
  const oben = stapel[stapel.length - 1];
  if (!oben) return;
  if (e.key === "Escape") { e.preventDefault(); oben.anfrageSchliessen(); }
  if (e.key === "Tab") {
    const fokussierbar = [...oben.el.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter((x) => !x.disabled && x.offsetParent !== null);
    if (!fokussierbar.length) return;
    const erstes = fokussierbar[0]; const letztes = fokussierbar[fokussierbar.length - 1];
    if (e.shiftKey && document.activeElement === erstes) { e.preventDefault(); letztes.focus(); }
    else if (!e.shiftKey && document.activeElement === letztes) { e.preventDefault(); erstes.focus(); }
  }
});

/**
 * Meldet eine Ebene an. schliessen() wird aufgerufen, wenn sie zugehen soll
 * (Zurück-Taste, Escape oder Knopf). Gibt eine Funktion zum Schließen zurück.
 */
export function ebeneAnmelden(el, schliessen) {
  const id = ++zaehler;
  const vorherFokus = document.activeElement;
  const eintrag = {
    id, el,
    schliessenIntern() {
      const i = stapel.indexOf(eintrag);
      if (i === -1) return false;
      stapel.splice(i, 1);
      schliessen();
      document.documentElement.classList.toggle("hat-ebene", stapel.length > 0);
      if (vorherFokus && vorherFokus.isConnected) vorherFokus.focus({ preventScroll: true });
      return true;
    },
    anfrageSchliessen() {
      // Sofort schließen und den eigenen Verlaufseintrag wieder entfernen.
      if (eintrag.schliessenIntern() && history.state?.ebene === id) {
        eigeneRuecksprunge++;
        history.back();
      }
    },
  };
  stapel.push(eintrag);
  history.pushState({ ebene: id }, "");
  document.documentElement.classList.add("hat-ebene");
  return eintrag.anfrageSchliessen;
}
