// Tests fürs Einlesen von Zahlen – so, wie sie getippt oder aus Bitvavo kopiert werden.
import { test } from "node:test";
import assert from "node:assert/strict";
import { leseZahl } from "../js/format.js";

test("Menge: so, wie Bitvavo sie anzeigt (+, Leerzeichen, BTC)", () => {
  assert.equal(leseZahl("+ 0.00022552 BTC", "btc"), 0.00022552);
  assert.equal(leseZahl("+0.00022552 BTC", "btc"), 0.00022552);
  assert.equal(leseZahl("+ 0,00022552 BTC", "btc"), 0.00022552);
  assert.equal(leseZahl("  + 0.00022552 BTC  ", "btc"), 0.00022552);   // geschützte Leerzeichen
  assert.equal(leseZahl("0.00022552btc", "btc"), 0.00022552);
  assert.equal(leseZahl("₿ 0,00022552", "btc"), 0.00022552);
});

test("Menge: wie getippt", () => {
  assert.equal(leseZahl("0,00024512", "btc"), 0.00024512);
  assert.equal(leseZahl("0.00024512", "btc"), 0.00024512);
  assert.equal(leseZahl("", "btc"), null);
  assert.equal(leseZahl("   ", "btc"), null);
  assert.ok(Number.isNaN(leseZahl("abc", "btc")));
  assert.ok(Number.isNaN(leseZahl("0,0002,4", "btc")));
  assert.ok(Number.isNaN(leseZahl("- 0.0002 BTC", "btc")));        // Verkauf, kein Kauf
});

test("Menge in sats wird in BTC umgerechnet", () => {
  assert.equal(leseZahl("22.552 sats", "btc"), 0.00022552);
  assert.equal(leseZahl("22552 sat", "btc"), 0.00022552);
  assert.equal(leseZahl("22,552 Satoshis", "btc"), 0.00022552);
});

test("Kurs: deutsch, englisch, mit Währung", () => {
  assert.equal(leseZahl("61.234,56", "kurs"), 61234.56);
  assert.equal(leseZahl("61.234", "kurs"), 61234);
  assert.equal(leseZahl("61234.56", "kurs"), 61234.56);
  assert.equal(leseZahl("€ 66,878.18", "kurs"), 66878.18);
  assert.equal(leseZahl("66.878,18 €", "kurs"), 66878.18);
  assert.equal(leseZahl("66878.18 EUR", "kurs"), 66878.18);
  assert.equal(leseZahl("66,878", "kurs"), 66878);
});
