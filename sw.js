// =====================================================================
// sw.js – Service Worker. Läuft im Hintergrund des Browsers und
//   * hält alle Dateien der App bereit, damit sie auch ohne Netz startet,
//   * zeigt Push-Nachrichten an und öffnet beim Antippen das Eintragen.
//
// Er kümmert sich NUR um Dateien dieser App (Ordner /btc-dca3/).
// Kursabfragen an fremde Server laufen an ihm vorbei.
// Bei jeder Änderung an den App-Dateien: VERSION um eins erhöhen.
// =====================================================================

const VERSION = 8;
const PRAEFIX = "dca3-app-";
const CACHE = `${PRAEFIX}${VERSION}`;

const DATEIEN = [
  "./", "index.html", "manifest.webmanifest",
  "css/grund.css", "css/teile.css", "css/ansichten.css",
  "js/app.js", "js/konfig.js", "js/zeit.js", "js/format.js", "js/speicher.js", "js/altdaten.js",
  "js/abgleich.js", "js/rechnen.js", "js/kennzahlen.js", "js/kurse.js", "js/dom.js", "js/jahresringe.js",
  "js/zeitraeume.js", "js/eintragen.js", "js/rechenweg.js", "js/einstellungen.js", "js/benachrichtigung.js", "js/notfall.js",
  "js/bewegung/feder.js", "js/bewegung/geste.js", "js/bewegung/ziffern.js", "js/bewegung/nebel.js",
  "js/teile/fenster.js", "js/teile/tablett.js", "js/teile/meldung.js", "js/teile/linie.js", "js/teile/kurslinie.js", "js/teile/funken.js", "js/teile/ebenen.js", "js/teile/haptik.js",
  "js/ansichten/gemeinsam.js", "js/ansichten/heute.js", "js/ansichten/kaeufe.js", "js/ansichten/baum.js", "js/ansichten/zahlen.js", "js/ansichten/markt.js",
  "fonts/mona-sans.woff2",
  "icons/icon.svg", "icons/icon-192.png", "icons/abzeichen-96.png", "icons/koernung.png",
];

// Unveränderliche Dateien (Name enthält die Version): zuerst aus dem Speicher
const UNVERAENDERLICH = /\/(vendor|fonts|icons)\//;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  // Nur EIGENE alte Zwischenspeicher löschen – andere Apps unter derselben
  // Adresse (z. B. die alte App) bleiben unberührt.
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n.startsWith(PRAEFIX) && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

async function ausSpeicher(anfrage) {
  const c = await caches.open(CACHE);
  return (await c.match(anfrage, { ignoreSearch: anfrage.mode === "navigate" })) ?? (anfrage.mode === "navigate" ? c.match("./") : undefined);
}

/** Erst das Netz (mit Zeitlimit), sonst der Speicher. Frische Antworten werden gemerkt. */
async function netzZuerst(anfrage) {
  const c = await caches.open(CACHE);
  const netz = fetch(anfrage).then((r) => {
    if (r.ok && r.type === "basic") c.put(anfrage.mode === "navigate" ? "./" : anfrage, r.clone());
    return r;
  });
  try {
    return await Promise.race([netz, new Promise((_, nein) => setTimeout(() => nein(new Error("Zeitlimit")), 3500))]);
  } catch {
    return (await ausSpeicher(anfrage)) ?? netz;
  }
}

async function speicherZuerst(anfrage) {
  const treffer = await ausSpeicher(anfrage);
  if (treffer) return treffer;
  const r = await fetch(anfrage);
  if (r.ok && r.type === "basic") (await caches.open(CACHE)).put(anfrage, r.clone());
  return r;
}

self.addEventListener("fetch", (e) => {
  const anfrage = e.request;
  if (anfrage.method !== "GET") return;
  const url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return;                 // Kursabfragen: nicht anfassen
  if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  e.respondWith(UNVERAENDERLICH.test(url.pathname) ? speicherZuerst(anfrage) : netzZuerst(anfrage));
});

// ---------------------------------------------------------------------
// Push-Nachrichten
// ---------------------------------------------------------------------

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {}; }
  const text = (x, max) => (typeof x === "string" ? x.slice(0, max) : "");
  const montag = /^\d{4}-\d{2}-\d{2}$/.test(d.montag ?? "") ? d.montag : null;
  e.waitUntil(self.registration.showNotification(text(d.titel, 80) || "BTC-Sparplan", {
    body: text(d.text, 240) || "Zeit, deinen Kauf einzutragen.",
    icon: "icons/icon-192.png",
    badge: "icons/abzeichen-96.png",
    tag: montag ? `kauf-${montag}` : "sparplan",
    data: { url: montag ? `./?eintragen=${montag}` : "./" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const ziel = new URL(e.notification.data?.url ?? "./", self.registration.scope);
  if (ziel.origin !== self.location.origin) return;
  const montag = ziel.searchParams.get("eintragen");
  e.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const offen = fenster.find((f) => f.url.startsWith(self.registration.scope));
    if (offen) {
      await offen.focus();
      if (montag) offen.postMessage({ art: "eintragen", montag });
      return;
    }
    await self.clients.openWindow(ziel.href);
  })());
});
