// =====================================================================
// benachrichtigung.js – Erinnerungen ans Eintragen.
//
// 1) Einfach (immer aktiv): Fehlt ein Kauf, zeigt die App es beim Öffnen.
//    Läuft die App zur Kaufzeit, kommt zusätzlich eine Benachrichtigung.
// 2) Push: Montagabend eine Nachricht, auch wenn die App geschlossen ist.
//    Dafür erzeugt die App EINEN Schlüsselblock, den du einmalig als
//    GitHub-Secret "PUSH_CONFIG" hinterlegst. Der private Schlüssel wird
//    nicht gespeichert – er existiert nur in diesem Block.
// =====================================================================

import { h, icon, fuelle } from "./dom.js";
import { oeffneSheet } from "./teile/tablett.js";
import { toast } from "./teile/meldung.js";
import { SCHLUESSEL, lies, schreibe, entferne, ladeEinstellungen, ladeEintraege } from "./speicher.js";
import { ZEITPLAN } from "./konfig.js";
import { naechsterKauf } from "./rechnen.js";
import { datumMonatKurz, uhrzeit, zeitpunkt } from "./format.js";

const kannBenachrichtigen = () => "Notification" in window && "serviceWorker" in navigator;
const kannPush = () => kannBenachrichtigen() && "PushManager" in window;
const APP_ADRESSE = new URL("./", location.href).href;

// ---------------------------------------------------------------------
// 1) Lokale Erinnerung, solange die App läuft
// ---------------------------------------------------------------------

let uhr = null;

async function zeige(titel, text, montag) {
  if (!kannBenachrichtigen() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(titel, {
    body: text, tag: `kauf-${montag}`, renotify: false,
    icon: "icons/icon-192.png", badge: "icons/abzeichen-96.png",
    data: { url: `./?eintragen=${montag}` },
  });
}

/** Plant die Erinnerung für den nächsten Kauf (15 Minuten nach der Kaufzeit). */
export function planeErinnerung(beiKaufzeit) {
  clearTimeout(uhr);
  const n = naechsterKauf(ZEITPLAN, Date.now());
  if (!n) return;
  const warte = n.ts - Date.now();
  if (warte > 2_000_000_000) return; // setTimeout kann nur ~24 Tage
  // Zur Kaufzeit: App neu rechnen lassen (aus "ausstehend" wird "noch eintragen" –
  // außer du hast ihn schon vorher eingetragen, dann bleibt die Erinnerung aus)
  uhr = setTimeout(async () => {
    beiKaufzeit?.();
    setTimeout(() => {
      if (ladeEinstellungen().erinnerung && !ladeEintraege()[n.montag]) {
        zeige("Dein Sparplan hat gekauft", `Montag ${datumMonatKurz(n.montag)}, ${uhrzeit(n.ts)} Uhr. Trag die Menge aus ${n.boerse} ein, sobald sie dort steht.`, n.montag).catch(() => {});
      }
      planeErinnerung(beiKaufzeit);
    }, 15 * 60_000);
  }, warte + 30_000);
}

/** Schalter in den Einstellungen: beim Einschalten um Erlaubnis bitten. */
export async function erinnerungUmschalten(an) {
  if (!an || !kannBenachrichtigen()) return;
  if (Notification.permission === "default") {
    const r = await Notification.requestPermission();
    if (r !== "granted") toast("Ohne Erlaubnis gibt es nur den Hinweis in der App.");
  } else if (Notification.permission === "denied") {
    toast("Benachrichtigungen sind für diese Seite blockiert. Das lässt sich in den Browser-Einstellungen ändern.", { dauer: 7000 });
  }
}

// ---------------------------------------------------------------------
// 2) Web Push einrichten
// ---------------------------------------------------------------------

const b64url = (puffer) => btoa(String.fromCharCode(...new Uint8Array(puffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Erzeugt ein neues Schlüsselpaar (VAPID, P-256) direkt im Browser. */
async function neueSchluessel() {
  const paar = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const oeffentlich = await crypto.subtle.exportKey("raw", paar.publicKey);   // 65 Bytes
  const privat = await crypto.subtle.exportKey("jwk", paar.privateKey);
  return { oeffentlich: b64url(oeffentlich), oeffentlichRoh: new Uint8Array(oeffentlich), privat: privat.d };
}

async function einrichten() {
  const erlaubnis = await Notification.requestPermission();
  if (erlaubnis !== "granted") throw new Error("Ohne Erlaubnis für Benachrichtigungen geht es nicht.");
  const reg = await navigator.serviceWorker.ready;
  const alt = await reg.pushManager.getSubscription();
  if (alt) await alt.unsubscribe();
  const s = await neueSchluessel();
  const abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: s.oeffentlichRoh });
  const j = abo.toJSON();
  const block = {
    v: 1,
    app: APP_ADRESSE,
    vapid: { oeffentlich: s.oeffentlich, privat: s.privat },
    abo: { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } },
  };
  // Gespeichert wird nur der öffentliche Teil – zur Anzeige des Status.
  schreibe(SCHLUESSEL.push, { seit: Date.now(), oeffentlich: s.oeffentlich, endpunkt: new URL(j.endpoint).host });
  return JSON.stringify(block);
}

async function abschalten() {
  try {
    const reg = await navigator.serviceWorker.ready;
    await (await reg.pushManager.getSubscription())?.unsubscribe();
  } catch { /* egal */ }
  entferne(SCHLUESSEL.push);
}

export function oeffnePushEinrichtung() {
  const status = lies(SCHLUESSEL.push);
  const ziel = h("div", { class: "detail-stapel" });
  const sheet = oeffneSheet({ titel: "Push aufs Handy", untertitel: "Montagabend eine Erinnerung – auch bei geschlossener App.", inhalt: ziel });

  const schritt = (nr, titel, ...inhalt) => h("li", { class: "schritt" }, h("span", { class: "schritt-nr" }, String(nr)), h("div", { class: "schritt-inhalt" }, h("p", { class: "schritt-titel" }, titel), ...inhalt));

  function anleitung(block) {
    const feld = h("textarea", { class: "schluessel-feld", readonly: true, rows: 4, spellcheck: "false", "aria-label": "Push-Schlüssel" });
    feld.value = block;
    const kopieren = h("button", { type: "button", class: "knopf knopf--glut knopf--breit", onclick: async () => {
      try { await navigator.clipboard.writeText(block); toast("Kopiert – jetzt bei GitHub einfügen", { art: "erfolg" }); }
      catch { feld.select(); toast("Bitte den markierten Text kopieren"); }
    } }, icon("kopieren", { groesse: 18 }), "Schlüssel kopieren");
    fuelle(ziel,
      h("ol", { class: "schritte" },
        schritt(1, "Schlüssel kopieren", feld, kopieren,
          h("p", { class: "fussnote" }, "Dieser Text enthält einen geheimen Schlüssel. Er gehört nur in das GitHub-Secret – nicht in eine Nachricht, nicht ins Repository.")),
        schritt(2, "Bei GitHub als Secret hinterlegen",
          h("p", { class: "absatz" }, "Im Repository btc-dca3: Settings → Secrets and variables → Actions → New repository secret."),
          h("p", { class: "absatz" }, "Name: PUSH_CONFIG · Secret: einfügen · Add secret.")),
        schritt(3, "Ausprobieren (optional)",
          h("p", { class: "absatz" }, "Im Repository: Actions → Erinnerung → Run workflow. Nach etwa einer Minute kommt eine Testnachricht."))),
      h("p", { class: "fussnote" }, "Gut zu wissen: Am zuverlässigsten klappt Push, wenn die App auf dem Startbildschirm installiert ist. GitHubs Zeitplan kann sich um einige Minuten verspäten – die Nachricht kommt also gegen 21 Uhr, nicht auf die Minute."));
  }

  function start() {
    if (!kannPush()) {
      fuelle(ziel, h("p", { class: "absatz" }, "Dieser Browser unterstützt keine Push-Nachrichten. Der Hinweis in der App funktioniert trotzdem."));
      return;
    }
    const los = h("button", { type: "button", class: "knopf knopf--glut knopf--breit", onclick: async () => {
      los.disabled = true; los.textContent = "Wird eingerichtet …";
      try { anleitung(await einrichten()); } catch (e) { toast(e.message, { art: "fehler", dauer: 6000 }); los.disabled = false; los.textContent = "Einrichten"; }
    } }, status ? "Neu einrichten" : "Einrichten");
    fuelle(ziel,
      status ? h("div", { class: "hinweis" }, h("div", { class: "hinweis-symbol" }, icon("haken", { groesse: 20 })), h("div", { class: "hinweis-text" }, h("p", { class: "hinweis-titel" }, "Eingerichtet"), h("p", { class: "hinweis-unter" }, `Seit ${zeitpunkt(status.seit)} Uhr über ${status.endpunkt}. Damit es ankommt, muss PUSH_CONFIG bei GitHub hinterlegt sein.`))) : null,
      h("p", { class: "absatz" }, "Die App erzeugt dafür ein eigenes Schlüsselpaar und meldet dieses Gerät für Nachrichten an. Danach kopierst du einmal einen Text zu GitHub – das ist alles."),
      h("p", { class: "absatz" }, "Die Nachricht enthält nur die Erinnerung und den Kurs zur Kaufzeit – keine Käufe. Unterwegs ist sie verschlüsselt, sodass der Push-Dienst sie nicht lesen kann."),
      los,
      status ? h("button", { type: "button", class: "knopf knopf--leise knopf--breit", onclick: async () => { await abschalten(); sheet.schliessen(); toast("Push abgeschaltet. Das Secret bei GitHub kannst du löschen."); } }, "Abschalten") : null);
  }
  start();
}
