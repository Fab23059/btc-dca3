// =====================================================================
// geste.js – Ziehen mit dem Finger (oder der Maus), mit Achsen-Sperre
// und Tempo-Messung. Grundlage für alles, was man greifen kann.
//
//   * Erst nach ein paar Pixeln entscheidet sich, ob waagerecht oder
//     senkrecht gezogen wird. Die andere Richtung bleibt dem Browser
//     (z. B. normales Scrollen).
//   * Das Tempo beim Loslassen wird aus den letzten 80 ms gemessen –
//     damit lässt sich etwas "werfen".
// =====================================================================

/**
 * @param {Element} el
 * @param {object} o
 *   achse: "x" | "y" | "frei"
 *   sofort: true → schon beim Aufsetzen greifen (z. B. Linie scrubben)
 *   darf(e): false → diese Berührung ignorieren
 *   start(info), bewege(info), ende(info)
 * info = { x, y, dx, dy, vx, vy, e }  (Tempo in px/s)
 */
export function ziehe(el, { achse = "y", sofort = false, schwelle = 7, darf = () => true, start, bewege, ende }) {
  let s = null;

  const verlauf = [];
  const merke = (e) => {
    verlauf.push({ x: e.clientX, y: e.clientY, t: e.timeStamp || performance.now() });
    while (verlauf.length > 2 && verlauf[verlauf.length - 1].t - verlauf[0].t > 100) verlauf.shift();
  };
  const tempo = () => {
    if (verlauf.length < 2) return { vx: 0, vy: 0 };
    const a = verlauf[0]; const b = verlauf[verlauf.length - 1];
    const dt = Math.max(8, b.t - a.t) / 1000;
    return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
  };
  const info = (e) => ({ x: e.clientX, y: e.clientY, dx: e.clientX - s.x0, dy: e.clientY - s.y0, e, ...tempo() });

  const runter = (e) => {
    if (e.button > 0 || s) return;
    if (!darf(e)) return;
    s = { x0: e.clientX, y0: e.clientY, id: e.pointerId, gegriffen: false };
    verlauf.length = 0; merke(e);
    if (sofort) greife(e);
  };
  const greife = (e) => {
    s.gegriffen = true;
    try { el.setPointerCapture(s.id); } catch { /* schon losgelassen */ }
    start?.(info(e));
  };
  const bewegt = (e) => {
    if (!s || e.pointerId !== s.id) return;
    merke(e);
    if (!s.gegriffen) {
      const dx = Math.abs(e.clientX - s.x0); const dy = Math.abs(e.clientY - s.y0);
      if (Math.max(dx, dy) < schwelle) return;
      const passt = achse === "frei" || (achse === "x" ? dx > dy : dy > dx);
      if (!passt) { s = null; return; }      // falsche Richtung → dem Browser überlassen
      greife(e);
    }
    bewege?.(info(e));
  };
  const hoch = (e, abgebrochen = false) => {
    if (!s || e.pointerId !== s.id) return;
    const war = s.gegriffen;
    const i = info(e);
    s = null;
    if (war) ende?.({ ...i, abgebrochen });
  };

  el.addEventListener("pointerdown", runter);
  el.addEventListener("pointermove", bewegt);
  el.addEventListener("pointerup", (e) => hoch(e));
  el.addEventListener("pointercancel", (e) => hoch(e, true));
  el.addEventListener("lostpointercapture", (e) => { if (s?.gegriffen) hoch(e, true); });
  return () => el.removeEventListener("pointerdown", runter);
}

/**
 * Druck-Rückmeldung für alles Tippbare: Beim Aufsetzen gibt das Element
 * federnd nach (nur transform) und an der Fingerstelle glimmt kurz Licht auf.
 * Einmal für das ganze Dokument aktiviert.
 */
export function druckAktivieren() {
  let aktiv = null;
  const los = () => {
    if (!aktiv) return;
    aktiv.classList.remove("wird-gedrueckt");
    aktiv = null;
  };
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest?.(".tippbar");
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--druck-x", `${e.clientX - r.left}px`);
    el.style.setProperty("--druck-y", `${e.clientY - r.top}px`);
    el.classList.add("wird-gedrueckt");
    aktiv = el;
  }, { passive: true });
  for (const t of ["pointerup", "pointercancel", "dragstart"]) document.addEventListener(t, los, { passive: true });
  document.addEventListener("scroll", los, { passive: true, capture: true });
}
