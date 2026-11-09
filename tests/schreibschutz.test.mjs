// Prüft die wichtigste Regel: Die Daten der alten App ("btcdca_…") werden
// nur gelesen – nie geschrieben, nie gelöscht.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { speicherAttrappe } from "./hilfen.mjs";

const WURZEL = new URL("..", import.meta.url).pathname;

function alleQuelldateien(ordner) {
  const aus = [];
  for (const n of readdirSync(ordner)) {
    const p = join(ordner, n);
    if (n === "vendor" || n === "tests" || n.startsWith(".")) continue;
    if (statSync(p).isDirectory()) aus.push(...alleQuelldateien(p));
    else if (/\.(m?js|html)$/.test(n)) aus.push(p);
  }
  return aus;
}

test("Statisch: Schreibzugriffe auf den Speicher gibt es nur in speicher.js", () => {
  const funde = [];
  for (const datei of alleQuelldateien(WURZEL)) {
    const text = readFileSync(datei, "utf8");
    const rel = datei.slice(WURZEL.length);
    for (const muster of [/\.setItem\s*\(/g, /\.removeItem\s*\(/g, /localStorage\.clear\s*\(/g, /localStorage\s*\[/g]) {
      for (const m of text.matchAll(muster)) funde.push(`${rel}: ${m[0]}`);
    }
  }
  const ausserhalb = funde.filter((f) => !f.startsWith("js/speicher.js:"));
  assert.deepEqual(ausserhalb, [], "Schreibzugriff außerhalb von speicher.js gefunden");
});

test("Statisch: Die alten Schlüssel kommen nur in altdaten.js vor (und dort nur lesend)", () => {
  const funde = [];
  for (const datei of alleQuelldateien(WURZEL)) {
    const rel = datei.slice(WURZEL.length);
    const text = readFileSync(datei, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/<!--[\s\S]*?-->/g, ""); // Kommentare ignorieren
    if (text.includes("btcdca_") && rel !== "js/altdaten.js") funde.push(rel);
  }
  assert.deepEqual(funde, []);
  const alt = readFileSync(join(WURZEL, "js/altdaten.js"), "utf8").replace(/\/\/.*$/gm, "");
  assert.ok(!/setItem|removeItem|\.clear\s*\(/.test(alt), "altdaten.js darf nicht schreiben");
});

test("Laufzeit: Migration, Abgleich, Eintragen, Löschen und Import fassen btcdca_ nie schreibend an", async () => {
  const altEintraege = { "2026-06-08": { btc: 0.000241 }, "2026-07-13": { btc: 0.00023, price: 64_000 }, "2026-07-20": { btc: "kaputt" } };
  const { ls, daten, verboten } = speicherAttrappe({
    btcdca_overrides_v1: JSON.stringify(altEintraege),
    btcdca_monday_prices_v4: JSON.stringify({ "2026-06-08": 61_000 }),
    btcdca_daily_closes_v2: JSON.stringify({ "2026-06-08": 61_100 }),
    btcdca_celebrated: JSON.stringify(["s50000", "w4"]),
    btcdca_lastquote: "3",
    btcdca_pc_1m: JSON.stringify({ ts: 1, data: [{ t: 1, c: 60_000 }] }),
  });
  globalThis.localStorage = ls;
  const vorher = new Map([...daten].filter(([k]) => k.startsWith("btcdca_")));

  const { abgleichMitAlterApp, leseSicherungsdatei, uebernimmSicherung } = await import("../js/abgleich.js");
  const { ladeEintraege, setzeEintrag, loescheEintrag } = await import("../js/speicher.js");

  const b1 = abgleichMitAlterApp();
  assert.deepEqual(b1.uebernommen.sort(), ["2026-06-08", "2026-07-13"]);
  assert.equal(b1.fehler.length, 1, "der kaputte Eintrag wird gemeldet, nicht verschwiegen");
  let e = ladeEintraege();
  assert.equal(e["2026-07-13"].kurs, 64_000);
  assert.equal(e["2026-06-08"].herkunft, "alt");

  // Du bearbeitest einen Eintrag hier, die alte App ändert danach denselben → neue App gewinnt
  setzeEintrag("2026-07-13", { btc: 0.000235, kurs: 63_900 });
  // Simulation: die ALTE App schreibt (das darf nur sie selbst – hier direkt in die Attrappe)
  daten.set("btcdca_overrides_v1", JSON.stringify({ ...altEintraege, "2026-07-13": { btc: 0.0003 }, "2026-07-27": { btc: 0.00022 } }));
  const b2 = abgleichMitAlterApp();
  assert.deepEqual(b2.uebernommen, ["2026-07-27"]);
  assert.deepEqual(b2.abweichungen, ["2026-07-13"]);
  e = ladeEintraege();
  assert.equal(e["2026-07-13"].btc, 0.000235);

  // Löschen hier → wird beim nächsten Start nicht wieder hergestellt
  loescheEintrag("2026-06-08");
  abgleichMitAlterApp();
  assert.equal(ladeEintraege()["2026-06-08"], undefined);

  // Import einer Sicherung der alten App
  // Absichtlich als Text: ein Objekt-Literal mit "__proto__" würde den Prototyp setzen statt einen Schlüssel.
  const datei = '{"btcdca_overrides_v1":{"2026-08-03":{"btc":0.00021},"__proto__":{"btc":1}},"btcdca_daily_closes_v2":{"2026-08-03":62000}}';
  const vorschau = leseSicherungsdatei(datei);
  assert.deepEqual(vorschau.neu, ["2026-08-03"]);
  assert.equal(vorschau.fehler.length, 1);
  uebernimmSicherung(vorschau);
  assert.equal(ladeEintraege()["2026-08-03"].btc, 0.00021);
  assert.equal({}.btc, undefined, "keine Prototyp-Verschmutzung");

  // Früh eingetragener Kauf: Zeitpunkt wird gespeichert, aber nur innerhalb der Sparwoche
  const { pruefeEintrag } = await import("../js/speicher.js");
  const montag = Date.parse("2026-11-08T23:00:00Z");     // Mo 9.11., 0:00 deutscher Zeit
  assert.equal(pruefeEintrag("2026-11-09", { btc: 0.0002, zeit: montag + 10 * 3_600_000 }).eintrag.zeit, montag + 10 * 3_600_000);
  assert.ok(pruefeEintrag("2026-11-09", { btc: 0.0002, zeit: montag - 60_000 }).fehler);
  assert.ok(pruefeEintrag("2026-11-09", { btc: 0.0002, zeit: "gestern" }).fehler);

  // Montagskurse der alten App: beim Start übernommen …
  const { lies, SCHLUESSEL } = await import("../js/speicher.js");
  assert.equal(lies(SCHLUESSEL.altkurse)["2026-06-08"], 61_000);
  // … und auch aus einer Sicherungsdatei (damit hat die alte App die Käufe ohne Eintrag erfasst)
  const mitKursen = leseSicherungsdatei('{"btcdca_overrides_v1":{},"btcdca_monday_prices_v4":{"2026-06-15":60500,"2026-06-22":"kaputt","2026-06-08":1}}');
  assert.deepEqual(mitKursen.montagskurse, { "2026-06-15": 60_500 });
  uebernimmSicherung(mitKursen);
  assert.equal(lies(SCHLUESSEL.altkurse)["2026-06-15"], 60_500);
  assert.equal(lies(SCHLUESSEL.altkurse)["2026-06-08"], 61_000, "vorhandene Kurse bleiben");

  assert.deepEqual(verboten, [], "es gab Schreibversuche auf btcdca_");
  for (const [k, v] of vorher) {
    if (k === "btcdca_overrides_v1") continue; // oben absichtlich von der "alten App" geändert
    assert.equal(daten.get(k), v, `${k} wurde verändert`);
  }
  assert.ok([...daten.keys()].filter((k) => !k.startsWith("btcdca_")).every((k) => k.startsWith("dca3_")));
});

test("Schreibschutz greift auch bei einem Programmierfehler", async () => {
  const { ls } = speicherAttrappe();
  globalThis.localStorage = ls;
  const { schreibe, entferne } = await import("../js/speicher.js");
  assert.throws(() => schreibe("btcdca_overrides_v1", {}), /Schreibschutz/);
  assert.throws(() => entferne("btcdca_overrides_v1"), /Schreibschutz/);
  assert.throws(() => schreibe("irgendwas", {}), /Schreibschutz/);
});
