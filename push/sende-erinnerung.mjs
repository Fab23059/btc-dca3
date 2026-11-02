// =====================================================================
// sende-erinnerung.mjs – Läuft montagabends über GitHub Actions und
// schickt eine Push-Erinnerung aufs Handy: "Dein Sparplan hat gekauft."
//
// Ablauf (bewährt aus dem früheren Bot):
//   * GitHub startet das Skript mehrmals am Montagabend, weil der
//     Zeitplan von GitHub sich verspäten oder ausfallen kann.
//   * Gesendet wird beim ERSTEN Lauf nach 20:55 Uhr deutscher Zeit.
//   * state/letzte-erinnerung.txt merkt sich den Tag → nie doppelt.
//
// Braucht das GitHub-Secret PUSH_CONFIG (in der App erzeugt).
// Ohne Secret beendet es sich still – dann ist Push einfach nicht eingerichtet.
// =====================================================================

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { sende } from "./webpush.mjs";

const MERKDATEI = "state/letzte-erinnerung.txt";
const SPARRATE = 15;
const ERSTER_MONTAG = "2026-06-08";
const KAUF = { stunde: 20, minute: 50 };        // Bitvavo, laufende Phase
const FRUEHESTENS = { stunde: 20, minute: 55 }; // ein paar Minuten nach dem Kauf

const test = /^(1|true|yes)$/i.test(process.env.TEST ?? "");

function berlin(ts = Date.now()) {
  const t = {};
  for (const p of new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" }).formatToParts(new Date(ts))) t[p.type] = p.value;
  return { tag: `${t.year}-${t.month}-${t.day}`, stunde: Number(t.hour), minute: Number(t.minute), montag: t.weekday === "Mon" };
}

function ladeKonfiguration() {
  const roh = process.env.PUSH_CONFIG;
  if (!roh || !roh.trim()) return null;
  let k;
  try { k = JSON.parse(roh); } catch { throw new Error("PUSH_CONFIG ist kein gültiger Schlüsselblock. Bitte in der App neu kopieren."); }
  if (k?.v !== 1 || !k.vapid?.oeffentlich || !k.vapid?.privat || !k.abo?.endpoint) throw new Error("PUSH_CONFIG ist unvollständig. Bitte in der App neu einrichten.");
  return k;
}

/** Kurs zur Kaufzeit (Minute), mit Ausweichquelle – nur zur Info in der Nachricht. */
async function kursUm(ts) {
  const minute = Math.floor(ts / 60000) * 60;
  const quellen = [
    async () => {
      const r = await fetch(`https://min-api.cryptocompare.com/data/v2/histominute?fsym=BTC&tsym=EUR&limit=3&toTs=${minute + 120}`, { signal: AbortSignal.timeout(10_000) });
      const j = await r.json();
      return j?.Data?.Data?.find((d) => d.time === minute)?.open;
    },
    async () => {
      const von = new Date((minute - 120) * 1000).toISOString(); const bis = new Date((minute + 180) * 1000).toISOString();
      const r = await fetch(`https://api.exchange.coinbase.com/products/BTC-EUR/candles?granularity=60&start=${von}&end=${bis}`, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "btc-sparplan" } });
      const j = await r.json();
      return Array.isArray(j) ? j.find((k) => k[0] === minute)?.[3] : null;
    },
  ];
  for (const q of quellen) {
    try { const k = await q(); if (typeof k === "number" && k > 100 && k < 50_000_000) return k; } catch { /* nächste Quelle */ }
  }
  return null;
}

function kaufzeitpunkt(tag) {
  // 20:50 deutscher Zeit als UTC-Zeitpunkt (Sommer-/Winterzeit beachten)
  const [j, m, t] = tag.split("-").map(Number);
  const naiv = Date.UTC(j, m - 1, t, KAUF.stunde, KAUF.minute);
  const b = berlin(naiv);
  const versatz = (b.stunde - KAUF.stunde) * 60 + (b.minute - KAUF.minute);
  return naiv - versatz * 60_000;
}

async function main() {
  const jetzt = berlin();
  const konfig = ladeKonfiguration();
  if (!konfig) {
    if (test) throw new Error("Das Secret PUSH_CONFIG fehlt. In der App: Einstellungen → Push aufs Handy → Einrichten, dann den Schlüssel als Secret hinterlegen.");
    console.log("PUSH_CONFIG ist nicht eingerichtet – nichts zu tun.");
    return;
  }

  if (!test) {
    if (!jetzt.montag) { console.log(`Kein Montag (${jetzt.tag}) – übersprungen.`); return; }
    if (jetzt.stunde * 60 + jetzt.minute < FRUEHESTENS.stunde * 60 + FRUEHESTENS.minute) { console.log(`Noch vor 20:55 Uhr (${jetzt.stunde}:${String(jetzt.minute).padStart(2, "0")}) – warte auf den Kauf.`); return; }
    let gesendet = "";
    try { gesendet = readFileSync(MERKDATEI, "utf8").trim(); } catch { /* noch nie gesendet */ }
    if (gesendet === jetzt.tag) { console.log(`Für ${jetzt.tag} bereits gesendet – übersprungen.`); return; }
  }

  const woche = Math.floor((Date.parse(`${jetzt.tag}T12:00:00Z`) - Date.parse(`${ERSTER_MONTAG}T12:00:00Z`)) / (7 * 86_400_000)) + 1;
  const kurs = await kursUm(kaufzeitpunkt(jetzt.tag));
  const kursText = kurs ? ` Kurs um 20:50 Uhr: ${kurs.toLocaleString("de-DE", { maximumFractionDigits: 0 })} €.` : "";
  const nutzlast = test
    ? { titel: "Test: Push funktioniert", text: `So sieht deine Montags-Erinnerung aus.${kursText}`, montag: null }
    : { titel: `Woche ${woche}: Dein Sparplan hat gekauft`, text: `${SPARRATE} € sind angelegt.${kursText} Trag die Menge aus Bitvavo ein, sobald sie dort steht.`, montag: jetzt.tag };

  const status = await sende({ abo: konfig.abo, vapid: konfig.vapid, betreff: konfig.app || "https://github.com", nutzlast });
  console.log(`Push gesendet (Status ${status}).`);
  if (!test) {
    mkdirSync("state", { recursive: true });
    writeFileSync(MERKDATEI, `${jetzt.tag}\n`);
  }
}

main().catch((e) => {
  console.error(`FEHLER: ${e.message}`);
  process.exit(1);
});
