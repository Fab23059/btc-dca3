// =====================================================================
// zeitraffer.js – Die Reise ansehen (Bewegung B14).
//
// Die Zeitreise (B3) gibt es schon: Finger auf die Linie, und die ganze
// Seite springt in diesen Moment. Der Zeitraffer fährt diese Reise von
// selbst – vom ersten Kauf bis heute, in etwa zehn Sekunden. Die Zahlen
// rollen hoch, der Baum legt Ring um Ring zu, die Ernte füllt sich.
//
// Das Besondere ist der Takt: Die Zeit läuft nicht gleichmäßig. Sie
// verweilt bei jedem Kauf einen Wimpernschlag und eilt durch die Tage
// dazwischen. So wird aus dem Verlauf ein Puls – Montag, Montag, Montag.
// Genau das ist ein Sparplan.
//
// Diese Datei kennt keinen Bildschirm. Sie liefert nur die Zeit; was
// sich bewegt, entscheidet, wer zuhört (in der App: lin.fahre(anteil),
// alles Weitere folgt aus der vorhandenen Zeitreise).
//
//   * Jederzeit unterbrechbar: halt() bremst federnd ab, weiter() läuft
//     an derselben Stelle wieder an, ab() beendet.
//   * "Bewegung reduzieren": kein Zeitraffer; beiEnde kommt sofort.
// =====================================================================

import { wenigBewegung } from "../dom.js";
import { Feder, imTakt, klemme } from "../bewegung/feder.js";
import { tick } from "./haptik.js";

const zeitfaktor = () => {
  const z = Number(globalThis.__ZEITLUPE);
  return Number.isFinite(z) && z >= 1 && z <= 40 ? 1 / z : 1;
};

/**
 * @param {object} o
 *   kaeufe     gezählte Käufe in zeitlicher Reihenfolge (jeder mit ts)
 *   jetzt      Ende der Reise (Zeitpunkt in Millisekunden)
 *   beiZeit    ({ t, anteil, kaufNr }) – in jedem Bild; anteil 0 … 1 zwischen erstem Kauf und jetzt
 *   beiKauf    (kauf, index) – genau in dem Moment, in dem die Reise einen Kauf erreicht
 *   beiEnde    ({ abgebrochen }) – angekommen im Jetzt (oder abgebrochen)
 *   sekunden   Dauer der ganzen Reise (Standard: je nach Anzahl der Käufe 6 bis 16)
 * @returns {{ start, halt, weiter, ab, laeuft }}
 */
export function zeitraffer({ kaeufe, jetzt, beiZeit, beiKauf = null, beiEnde = null, sekunden = null }) {
  const n = kaeufe.length;
  const t0 = n ? kaeufe[0].ts : jetzt;
  const spanne = Math.max(1, jetzt - t0);
  // Die Reise in "Schritten": Schritt i liegt genau auf Kauf i, der letzte Schritt n ist das Jetzt
  const marken = [...kaeufe.map((k) => k.ts), jetzt];
  const dauer = sekunden ?? klemme(n * 0.42, 6, 16);
  // Verweilen: stark bei wenigen Käufen, kaum noch bei sehr vielen (sonst wird es ein Flimmern)
  const verweilen = klemme(0.9 - Math.max(0, n - 60) / 240, 0.3, 0.9);

  let tau = 0;                 // gleichmäßig laufende Uhr, 0 … n
  let laeuft = false;
  let erreicht = -1;           // Index des letzten gemeldeten Kaufs
  let stopp = null;
  let zuletzt = 0;

  // Das Tempo ist eine Feder: weich anfahren, weich anhalten, mittendrin greifbar
  const tempo = new Feder(0, { art: "raum", genau: 0.002 });

  /** Aus der gleichmäßigen Uhr wird der Takt: an jedem ganzen Schritt fast Stillstand. */
  const takt = (x) => x - (verweilen / (2 * Math.PI)) * Math.sin(2 * Math.PI * x);

  function zeitBei(u) {
    const i = Math.min(n - 1, Math.floor(u));
    const rest = u - i;
    return marken[i] + (marken[i + 1] - marken[i]) * klemme(rest);
  }

  function melde() {
    const u = klemme(takt(tau), 0, n);
    const t = u >= n ? jetzt : zeitBei(u);
    // Käufe melden, sobald der Takt auf ihnen landet (bei tau = ganze Zahl)
    while (erreicht < n - 1 && tau >= erreicht + 1) {
      erreicht++;
      tick(erreicht % 4 === 0 ? 7 : 4);        // jeder vierte Kauf etwas kräftiger – ungefähr ein Monat
      beiKauf?.(kaeufe[erreicht], erreicht);
    }
    beiZeit({ t, anteil: klemme((t - t0) / spanne), kaufNr: Math.max(0, erreicht + 1) });
  }

  function bild(zeit) {
    const dt = Math.min(0.05, (zeit - zuletzt) / 1000) * zeitfaktor();
    zuletzt = zeit;
    tau = Math.min(n, tau + (n / dauer) * tempo.wert * dt);
    melde();
    if (tau >= n) beende(false);
    else if (!laeuft && tempo.ruht) { stopp?.(); stopp = null; }    // angehalten: nichts mehr zu tun
  }

  function beende(abgebrochen) {
    stopp?.(); stopp = null;
    laeuft = false;
    tempo.springe(0);
    beiEnde?.({ abgebrochen });
  }

  function anlaufen() {
    laeuft = true;
    tempo.zu(1);
    if (!stopp) { zuletzt = performance.now(); stopp = imTakt(bild); }
  }

  return {
    get laeuft() { return laeuft; },
    get anteil() { return n ? tau / n : 1; },
    /** Von vorn beginnen. */
    start() {
      if (!n || wenigBewegung()) { beiEnde?.({ abgebrochen: false }); return; }
      tau = 0; erreicht = -1;
      tempo.springe(0);
      melde();
      anlaufen();
    },
    /** Federnd anhalten (z. B. wenn der Finger die Linie greift). */
    halt() { if (laeuft) { laeuft = false; tempo.zu(0); } },
    /** An derselben Stelle weiterlaufen. */
    weiter() { if (!laeuft && tau < n) anlaufen(); },
    /** Beenden, ohne anzukommen. */
    ab() { if (stopp || laeuft) beende(true); },
  };
}
