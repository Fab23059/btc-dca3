// Jede Datei, die die App lädt, muss im Service Worker stehen – sonst startet sie ohne Netz nicht.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const WURZEL = new URL("../", import.meta.url).pathname;
const alle = (ordner) => readdirSync(ordner).flatMap((n) => {
  const p = join(ordner, n);
  return statSync(p).isDirectory() ? alle(p) : [relative(WURZEL, p)];
});

test("Alle Skripte und Stile sind für den Offline-Start zwischengespeichert", () => {
  const sw = readFileSync(join(WURZEL, "sw.js"), "utf8");
  const liste = sw.slice(sw.indexOf("const DATEIEN"), sw.indexOf("];", sw.indexOf("const DATEIEN")));
  const dateien = new Set([...liste.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  const fehlen = [...alle(join(WURZEL, "js")), ...alle(join(WURZEL, "css"))].filter((d) => !dateien.has(d));
  assert.deepEqual(fehlen, [], `Fehlt in sw.js: ${fehlen.join(", ")}`);
});
