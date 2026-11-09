// =====================================================================
// konfig.js – Die festen Eckdaten des Sparplans.
//
// Wenn sich am Sparplan etwas ändert (andere Rate, neuer Broker),
// ist das hier die einzige Stelle, die angepasst werden muss.
// =====================================================================

/** Sparrate pro Woche in Euro (brutto, also inklusive Gebühr). */
export const SPARRATE_EUR = 15;

/**
 * Der Zeitplan in Phasen. Jede Phase hat eigene Kaufzeit und Gebühr.
 * Gekaufte Menge = SPARRATE_EUR × (1 − gebuehr) ÷ Kurs.
 * Als "investiert" zählen immer die vollen 15 €.
 *
 *  - Phase 1: vier Käufe bei Binance im Juni 2026 (feste Historie).
 *  - Phase 2: seit Juli 2026 bei Bitvavo (Wechsel wegen MiCA), laufend.
 */
export const ZEITPLAN = Object.freeze([
  Object.freeze({ erster: "2026-06-08", letzter: "2026-06-29", stunde: 8, minute: 40, gebuehr: 0.004, boerse: "Binance" }),
  Object.freeze({ erster: "2026-07-06", letzter: null, stunde: 20, minute: 50, gebuehr: 0.0025, boerse: "Bitvavo" }),
]);

/** Alle Daten dieser App liegen im Browser unter Schlüsseln mit diesem Präfix. */
export const SPEICHER_PRAEFIX = "dca3_";

/** Version der App (erscheint in den Einstellungen und im Export). */
export const APP_VERSION = "1.1.3";

/**
 * Die einzigen fremden Server, mit denen die App spricht – alle ohne Schlüssel,
 * alle nur lesend. Dieselbe Liste steht in der Sicherheitsrichtlinie (index.html).
 */
export const ERLAUBTE_SERVER = Object.freeze([
  "min-api.cryptocompare.com",
  "api.exchange.coinbase.com",
  "api.coingecko.com",
  "api.alternative.me",
  "mempool.space",
]);

/** Plausibilitätsgrenzen: Werte außerhalb gelten als Unsinn (Tippfehler oder kaputte Quelle). */
export const GRENZEN = Object.freeze({
  kursMin: 100,          // € pro BTC
  kursMax: 50_000_000,   // € pro BTC
  btcMin: 0.000_000_01,  // 1 Satoshi
  btcMax: 1,             // mehr als 1 BTC für 15 € ist ausgeschlossen
});
