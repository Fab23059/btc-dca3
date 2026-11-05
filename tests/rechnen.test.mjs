// Tests für den Rechenkern. Ausführen (nur für Entwickler): node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { berlinZeitpunkt, heuteBerlin, jahrestag, plusTage, montagVon } from "../js/zeit.js";
import { sparwochen, kaeufeBerechnen, zusammenfassung, zeitraumErgebnis, wochenZerlegung, wertverlauf, kursBei, naechsterKauf, kaufkurseZusammenfuehren } from "../js/rechnen.js";
import { haltefrist, rueckgang, volatilitaet, meilensteine, durchhalten, dcaBilanz } from "../js/kennzahlen.js";
import { ZEITPLAN, SPARRATE_EUR } from "../js/konfig.js";
import { nah } from "./hilfen.mjs";

const UTC = (s) => Date.parse(s);

test("Kaufzeit: Sommer- und Winterzeit", () => {
  assert.equal(berlinZeitpunkt("2026-07-06", 20, 50), UTC("2026-07-06T18:50:00Z"));
  assert.equal(berlinZeitpunkt("2026-11-02", 20, 50), UTC("2026-11-02T19:50:00Z"));
  assert.equal(berlinZeitpunkt("2026-06-08", 8, 40), UTC("2026-06-08T06:40:00Z"));
  // Tag der Zeitumstellung (25.10.2026, 3 Uhr → 2 Uhr)
  assert.equal(berlinZeitpunkt("2026-10-25", 20, 50), UTC("2026-10-25T19:50:00Z"));
  assert.equal(berlinZeitpunkt("2026-03-29", 20, 50), UTC("2026-03-29T18:50:00Z"));
  assert.equal(heuteBerlin(UTC("2026-11-02T23:30:00Z")), "2026-11-03");
  assert.equal(montagVon("2026-11-05"), "2026-11-02");
});

// Testdaten: Kurse je Montag (frei erfunden, nur zum Nachrechnen)
function testKurse(wochen) {
  const k = {};
  wochen.forEach((w, i) => { k[w.montag] = { kurs: 60_000 + 1000 * Math.sin(i) + 50 * i }; });
  return k;
}

test("Der laufende Montag zählt erst NACH der Kaufzeit (Hauptfehler der Altapp)", () => {
  const vorher = UTC("2026-11-02T19:47:00Z");  // 20:47 deutscher Zeit
  const nachher = UTC("2026-11-02T19:51:00Z"); // 20:51 deutscher Zeit
  const w1 = sparwochen(ZEITPLAN, vorher);
  const kurse = testKurse(w1);
  const k1 = kaeufeBerechnen({ wochen: w1, eintraege: {}, kaufkurse: kurse, jetzt: vorher, sparrate: SPARRATE_EUR });
  const s1 = zusammenfassung(k1, 61_000);
  assert.equal(k1.at(-1).montag, "2026-11-02");
  assert.equal(k1.at(-1).status, "ausstehend");
  assert.equal(s1.anzahl, w1.length - 1);
  assert.equal(s1.investiert, (w1.length - 1) * 15);
  assert.equal(s1.ausstehend.length, 1);

  const w2 = sparwochen(ZEITPLAN, nachher);
  const k2 = kaeufeBerechnen({ wochen: w2, eintraege: {}, kaufkurse: kurse, jetzt: nachher, sparrate: SPARRATE_EUR });
  const s2 = zusammenfassung(k2, 61_000);
  assert.equal(k2.at(-1).status, "geschaetzt");
  assert.equal(s2.anzahl, w2.length);
  assert.equal(s2.investiert, w2.length * 15);
});

test("Anzahl Sparwochen bis 02.11.2026: 22 (4 Binance + 18 Bitvavo)", () => {
  const w = sparwochen(ZEITPLAN, UTC("2026-11-02T21:00:00Z"));
  assert.equal(w.length, 22);
  assert.equal(w.filter((x) => x.boerse === "Binance").length, 4);
  assert.equal(w[0].montag, "2026-06-08");
  assert.equal(w[4].montag, "2026-07-06");
});

test("Einträge gehen immer vor; fehlende Angabe wird aus Sparrate und Gebühr berechnet", () => {
  const jetzt = UTC("2026-07-20T20:00:00Z");
  const w = sparwochen(ZEITPLAN, jetzt);
  const kurse = testKurse(w);
  const e = {
    "2026-06-08": { btc: 0.0002 },              // nur Menge
    "2026-06-15": { kurs: 55_000 },             // nur Kurs
    "2026-06-22": { btc: 0.00025, kurs: 59_000 },
  };
  const k = kaeufeBerechnen({ wochen: w, eintraege: e, kaufkurse: kurse, jetzt, sparrate: 15 });
  assert.equal(k[0].status, "eingetragen");
  assert.ok(nah(k[0].kurs, (15 * 0.996) / 0.0002));
  assert.ok(nah(k[1].btc, (15 * 0.996) / 55_000));
  assert.equal(k[2].btc, 0.00025);
  assert.equal(k[2].kurs, 59_000);
  assert.equal(k[3].status, "automatisch");   // ohne Eintrag, aber älter als eine Woche: vollwertiger Kauf
  assert.ok(nah(k[3].btc, (15 * 0.996) / kurse["2026-06-29"].kurs));
  // Bitvavo-Phase: 0,25 % Gebühr
  assert.ok(nah(k[4].btc, (15 * 0.9975) / kurse["2026-07-06"].kurs));
  const s = zusammenfassung(k, 62_000);
  const btc = k.reduce((a, x) => a + x.btc, 0);
  assert.ok(nah(s.btc, btc));
  assert.equal(s.investiert, k.length * 15);
  assert.ok(nah(s.durchschnitt, (k.length * 15) / btc));
  assert.ok(nah(s.gv, btc * 62_000 - k.length * 15));
  assert.ok(nah(s.gvProzent, (s.gv / s.investiert) * 100));
});

test("Automatisch erfasste Käufe der alten App zählen voll – nur der frischeste erinnert ans Eintragen", () => {
  const jetzt = UTC("2026-11-05T18:00:00Z");
  const w = sparwochen(ZEITPLAN, jetzt);
  const kurse = testKurse(w);
  // Wie beim Nutzer: Binance (Juni) nie eingetragen, Bitvavo eingetragen, der letzte Montag noch offen
  const e = {};
  for (const x of w) if (x.boerse === "Bitvavo" && x.montag !== "2026-11-02") e[x.montag] = { btc: 0.00022 };
  const k = kaeufeBerechnen({ wochen: w, eintraege: e, kaufkurse: kurse, jetzt, sparrate: 15 });
  const s = zusammenfassung(k, 62_000);
  assert.deepEqual(k.slice(0, 4).map((x) => x.status), ["automatisch", "automatisch", "automatisch", "automatisch"]);
  assert.ok(k.slice(0, 4).every((x) => x.gezaehlt && x.nr != null));
  assert.equal(k.at(-1).status, "geschaetzt");          // 2.11.: jünger als eine Woche
  assert.ok(k.at(-1).gezaehlt);
  assert.equal(s.anzahl, w.length);
  assert.equal(s.automatisch, 4);
  assert.equal(s.geschaetzt.length, 1);
  assert.equal(s.investiert, w.length * 15);
  // Eine Woche später ist auch der 2.11. ein normaler automatischer Kauf
  const k2 = kaeufeBerechnen({ wochen: w, eintraege: e, kaufkurse: kurse, jetzt: UTC("2026-11-09T20:00:00Z"), sparrate: 15 });
  assert.equal(k2.at(-1).status, "automatisch");
});

test("Kaufkurse: Minutenkurs vor dem Kurs der alten App vor dem Stundenkurs", () => {
  const alt = {
    "2026-06-08": { kurs: 60_000, genauigkeit: "altapp" },
    "2026-06-15": { kurs: 61_000, genauigkeit: "altapp" },   // kein neuer Kurs da
    "2026-10-26": { kurs: 66_000, genauigkeit: "altapp" },   // zur falschen Zeit gemerkt
    "2026-06-22": { kurs: 59_000, genauigkeit: "altapp" },   // neu nur als Stundenkurs
  };
  const neu = {
    "2026-06-08": { kurs: 60_012, genauigkeit: "minute" },
    "2026-10-26": { kurs: 64_000, genauigkeit: "minute" },
    "2026-06-22": { kurs: 60_500, genauigkeit: "stunde" },
    "2026-06-29": { kurs: 62_000, genauigkeit: "stunde" },
  };
  const z = kaufkurseZusammenfuehren(alt, neu);
  assert.equal(z["2026-06-08"].kurs, 60_012);
  assert.equal(z["2026-06-15"].kurs, 61_000);
  assert.equal(z["2026-10-26"].kurs, 64_000);
  assert.equal(z["2026-06-22"].kurs, 59_000);
  assert.equal(z["2026-06-29"].kurs, 62_000);
  assert.deepEqual(kaufkurseZusammenfuehren({}, neu), neu);
});

test("Ohne Kurs zählt ein Kauf (noch) nicht – statt mit einem Platzhalter zu rechnen", () => {
  const jetzt = UTC("2026-06-16T12:00:00Z");
  const w = sparwochen(ZEITPLAN, jetzt);
  const k = kaeufeBerechnen({ wochen: w, eintraege: {}, kaufkurse: { "2026-06-08": { kurs: 60_000 } }, jetzt, sparrate: 15 });
  assert.equal(k[1].status, "ohneKurs");
  assert.equal(zusammenfassung(k, 60_000).anzahl, 1);
});

test("Zeitraum: neue Einzahlung ist kein Gewinn (Verlustwoche bleibt Verlustwoche)", () => {
  // Zwei Käufe à 15 € zu 60.000 €, eine Woche später fällt der Kurs um 2 %.
  const k = [
    { gezaehlt: true, ts: 1000, btc: 15 / 60_000, brutto: 15 },
    { gezaehlt: true, ts: 2000, btc: 15 / 58_800, brutto: 15 },
  ];
  const r = zeitraumErgebnis({ kaeufe: k, aktuellerKurs: 58_800, jetzt: 3000, startTs: 1500, kursZuBeginn: 60_000 });
  // Wert stieg von 15 € auf 29,70 € – das ist aber KEIN Gewinn von 14,70 €
  assert.ok(nah(r.veraenderung, -0.3, 1e-6));
  assert.ok(r.veraenderung < 0);
  assert.ok(nah(r.prozent, (-0.3 / 30) * 100, 1e-6));
});

test("Zeitraum 'Gesamt' ergibt genau Gewinn ÷ Investiert", () => {
  const jetzt = UTC("2026-11-02T21:00:00Z");
  const w = sparwochen(ZEITPLAN, jetzt);
  const k = kaeufeBerechnen({ wochen: w, eintraege: {}, kaufkurse: testKurse(w), jetzt, sparrate: 15 });
  const s = zusammenfassung(k, 61_234);
  const r = zeitraumErgebnis({ kaeufe: k, aktuellerKurs: 61_234, jetzt, startTs: -Infinity, kursZuBeginn: null });
  assert.ok(nah(r.veraenderung, s.gv));
  assert.ok(nah(r.prozent, s.gvProzent));
});

test("Wochenzerlegung: Einzahlungen − Kosten + Kurseffekte = heutiger Wert (exakt)", () => {
  const jetzt = UTC("2026-11-02T21:00:00Z");
  const w = sparwochen(ZEITPLAN, jetzt);
  const k = kaeufeBerechnen({ wochen: w, eintraege: { "2026-07-13": { btc: 0.00024, kurs: 61_500 } }, kaufkurse: testKurse(w), jetzt, sparrate: 15 });
  const z = wochenZerlegung(k, 63_000, jetzt);
  const summe = z.reduce((s, x) => s + x.einzahlung - x.kosten + x.kurseffekt, 0);
  assert.ok(nah(summe, zusammenfassung(k, 63_000).wert, 1e-9));
  assert.ok(z.every((x) => x.einzahlung === 15));
});

test("Wertverlauf: jede Einzahlung erscheint als eigener Sprung um den Marktwert der Kaufmenge", () => {
  const jetzt = UTC("2026-07-20T20:00:00Z");
  const w = sparwochen(ZEITPLAN, jetzt);
  const kk = testKurse(w);
  const k = kaeufeBerechnen({ wochen: w, eintraege: {}, kaufkurse: kk, jetzt, sparrate: 15 });
  const kurse = [];
  for (let t = w[0].ts - 86_400_000; t < jetzt; t += 3_600_000) kurse.push({ t, c: 60_000 });
  const v = wertverlauf({ kaeufe: k, kurse, aktuellerKurs: 60_500, jetzt });
  const spruenge = v.filter((p) => p.kauf);
  assert.equal(spruenge.length, k.length);
  for (const p of spruenge) {
    const vorher = v[v.indexOf(p) - 1];
    assert.ok(vorher.vorKauf);
    assert.ok(nah(p.investiert - vorher.investiert, 15));
  }
  assert.ok(nah(v.at(-1).wert, zusammenfassung(k, 60_500).wert));
});

test("kursBei interpoliert und gibt außerhalb null", () => {
  const p = [{ t: 0, c: 100 }, { t: 10, c: 200 }];
  assert.equal(kursBei(p, 5), 150);
  assert.equal(kursBei(p, 11), null);
});

test("Haltefrist: Kauf 08.06.2026 → steuerfrei ab 09.06.2027; 29.02. → 01.03.", () => {
  assert.equal(plusTage(jahrestag("2026-06-08"), 1), "2027-06-09");
  assert.equal(plusTage(jahrestag("2028-02-29"), 1), "2029-03-01");
  const k = [{ gezaehlt: true, montag: "2026-06-08", kaufdatum: "2026-06-08", btc: 0.001 }, { gezaehlt: true, montag: "2026-07-06", kaufdatum: "2026-07-07", btc: 0.003 }];
  const h1 = haltefrist(k, UTC("2027-06-08T12:00:00Z"));
  assert.equal(h1.btcFrei, 0);
  const h2 = haltefrist(k, UTC("2027-06-09T12:00:00Z"));
  assert.equal(h2.btcFrei, 0.001);
  assert.ok(nah(h2.anteilFrei, 25));
  assert.equal(h2.naechste.freiAb, "2027-07-08");
});

test("Rückgang und Erholung", () => {
  const d = 86_400_000;
  const p = [100, 110, 99, 88, 95, 105, 111, 108].map((c, i) => ({ t: UTC("2026-07-01T00:00:00Z") + i * 7 * d, c }));
  const r = rueckgang(p, []);
  assert.ok(nah(r.tiefe, (88 / 110 - 1) * 100));
  assert.equal(r.wochenBisErholt, 3);
  assert.equal(r.aufgeholtProzent, 100);
  const r2 = rueckgang(p.slice(0, 5), []);
  assert.equal(r2.erholtTag, null);
  assert.ok(nah(r2.aufgeholtProzent, ((95 - 88) / (110 - 88)) * 100));
});

test("Schwankung aus Tageskursen", () => {
  const p = []; let c = 60_000;
  for (let i = 0; i < 40; i++) { c *= i % 2 ? 1.02 : 0.98; p.push({ t: i, c }); }
  const v = volatilitaet(p);
  assert.ok(v.tagProzent > 1.9 && v.tagProzent < 2.1);
  assert.ok(nah(v.jahrProzent, v.tagProzent * Math.sqrt(365)));
});

test("Meilensteine und Durchhalten", () => {
  const jetzt = UTC("2026-11-02T21:00:00Z");
  const w = sparwochen(ZEITPLAN, jetzt);
  const k = kaeufeBerechnen({ wochen: w, eintraege: {}, kaufkurse: testKurse(w), jetzt, sparrate: 15 });
  const m = meilensteine(k, 60_000, 15);
  assert.ok(m.erreicht.length >= 3);
  assert.ok(m.naechstes.ziel > m.sats);
  const d = durchhalten(k, jetzt);
  assert.equal(d.wochenInFolge, 22);
  assert.equal(d.tage, 147);
});

test("Nächster Kauf", () => {
  const n = naechsterKauf(ZEITPLAN, UTC("2026-11-02T19:00:00Z"));
  assert.equal(n.montag, "2026-11-02");
  const n2 = naechsterKauf(ZEITPLAN, UTC("2026-11-02T20:00:00Z"));
  assert.equal(n2.montag, "2026-11-09");
});

test("DCA-Bilanz: Vergleich mit einer Einmalanlage am ersten Kauftag", () => {
  const k = [
    { gezaehlt: true, ts: 0, btc: (15 * 0.996) / 60_000, kurs: 60_000, brutto: 15, gebuehr: 0.004 },
    { gezaehlt: true, ts: 7 * 86_400_000, btc: (15 * 0.996) / 50_000, kurs: 50_000, brutto: 15, gebuehr: 0.004 },
    { gezaehlt: false, ts: 14 * 86_400_000, btc: null, kurs: null, brutto: 0, gebuehr: 0.004 },
  ];
  const b = dcaBilanz(k, 55_000, 10 * 86_400_000);
  assert.equal(b.anzahl, 2);
  assert.equal(b.tage, 10);
  assert.ok(nah(b.einmalBtc, (30 * 0.996) / 60_000));
  assert.ok(nah(b.vorteil, (b.btc - b.einmalBtc) * 55_000));
  assert.ok(b.vorteil > 0);                       // im Tief nachgekauft → besser als Einmalanlage
  assert.equal(b.guenstigster.kurs, 50_000);
  assert.equal(b.teuerster.kurs, 60_000);
  assert.equal(dcaBilanz([], 55_000, 0), null);
});
