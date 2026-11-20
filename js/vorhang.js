// =====================================================================
// vorhang.js – Baut das Ladebild, bevor irgendetwas anderes lädt.
//
// Ein normales (kein Modul-)Skript, direkt hinter dem Ladebild im HTML:
// Es läuft sofort, noch bevor die App selbst geladen ist. Es legt nur
// 52 Striche (ein Jahr Sparplan) und zwei Kometen an und füllt den Ring
// mit dem Stand vom letzten Besuch (nur lesend). Alles Weitere –
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

  var vorhang = document.getElementById("vorhang");
  // Ab hier läuft das Ladebild – von hier aus misst app.js, wie lange es mindestens bleibt
  vorhang.dataset.start = String(performance.now());

  // Deine Wochen vom letzten Besuch (app.js merkt sie sich): So steht der Ring schon im ersten
  // Bild richtig da. Nur lesen, und nur, solange dieselbe Woche läuft. app.js prüft es danach.
  try {
    var stand = JSON.parse(localStorage.getItem("dca3_vorhang") || "null");
    if (stand && Date.now() < stand.bis && Array.isArray(stand.voll)) {
      var striche = ring.querySelectorAll(".strich");
      for (var k = 0; k < stand.voll.length; k++) {
        var s = striche[stand.voll[k]];
        if (!s) continue;
        s.style.setProperty("--k", String(k));
        s.classList.add("voll");
      }
      striche[0].classList.add("jetzt");
      if (stand.zahl > 0) {
        document.getElementById("vorhang-zahl").textContent = String(stand.zahl);
        document.getElementById("vorhang-wort").textContent = stand.zahl === 1 ? "Woche" : "Wochen";
        vorhang.classList.add("hat-zahl");
      }
    }
  } catch (e) { /* kein Speicher – dann füllt app.js den Ring gleich */ }
})();
