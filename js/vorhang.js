// =====================================================================
// vorhang.js – Baut das Ladebild, bevor irgendetwas anderes lädt.
//
// Ein normales (kein Modul-)Skript, direkt hinter dem Ladebild im HTML:
// Es läuft sofort, noch bevor die App selbst geladen ist. Es legt nur
// 52 Striche (ein Jahr Sparplan) und zwei Kometen an. Alles Weitere –
// das Kreisen, das Aufleuchten, das Atmen – ist reines CSS, das die
// Grafikkarte allein abspielt. Deshalb läuft es auch dann flüssig, wenn
// die App im Hintergrund gerade viel zu tun hat.
// =====================================================================
(function () {
  "use strict";
  var ring = document.getElementById("vorhang-ring");
  if (!ring) return;
  var teile = document.createDocumentFragment();
  for (var i = 0; i < 52; i++) {
    var strich = document.createElement("span");
    strich.className = "strich";
    strich.style.setProperty("--i", String(i));
    var voll = document.createElement("i");
    voll.className = "strich-voll";
    strich.appendChild(voll);
    teile.appendChild(strich);
  }
  // Die Köpfe der beiden Kometen – im selben Zug angelegt, damit alles im selben Takt startet
  var a = document.createElement("span"); a.className = "vorhang-kopf vorhang-kopf--a";
  var b = document.createElement("span"); b.className = "vorhang-kopf vorhang-kopf--b";
  teile.appendChild(a); teile.appendChild(b);
  ring.insertBefore(teile, ring.firstChild);
})();
