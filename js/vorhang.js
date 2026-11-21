// =====================================================================
// vorhang.js – Baut das Ladebild, bevor irgendetwas anderes lädt.
//
// Ein normales (kein Modul-)Skript, direkt hinter dem Ladebild im HTML:
// Es läuft sofort, noch bevor die App selbst geladen ist. Es legt nur an,
// was das CSS bewegt (vorhang.css): 52 Striche (ein Jahr Sparplan) mit je
// einem Sat-Funken, die beiden Kometenköpfe, den Lichtpunkt für den Schluss
// mit seiner Spur und das Zählwerk in der Mitte. Dann füllt es den Ring mit
// dem Stand vom letzten Besuch (nur lesend). Alles Weitere – das Kreisen,
// Aufleuchten, Ernten – spielt die Grafikkarte allein ab. Deshalb läuft es
// auch dann flüssig, wenn die App im Hintergrund gerade viel zu tun hat.
// =====================================================================
(function () {
  "use strict";
  var vorhang = document.getElementById("vorhang");
  var ring = document.getElementById("vorhang-ring");
  if (!vorhang || !ring) return;

  function el(art, klasse) { var e = document.createElement(art); e.className = klasse; return e; }

  var teile = document.createDocumentFragment();
  for (var i = 0; i < 52; i++) {
    var strich = el("span", "strich");
    strich.style.setProperty("--i", String(i));
    strich.appendChild(el("i", "strich-voll"));
    strich.appendChild(el("i", "strich-sat"));
    teile.appendChild(strich);
  }
  // Die Köpfe der beiden Kometen – im selben Zug angelegt, damit alles im selben Takt startet
  teile.appendChild(el("span", "vorhang-kopf vorhang-kopf--a"));
  teile.appendChild(el("span", "vorhang-kopf vorhang-kopf--b"));
  ring.insertBefore(teile, ring.firstChild);

  // Der Lichtpunkt am Schluss und drei Nachbilder als Spur. Jeder steckt in zwei Hüllen:
  // eine fliegt waagerecht, eine senkrecht – mit verschiedenen Kurven ergibt das einen Bogen.
  var flug = document.getElementById("vorhang-flug");
  for (var s = 0; s < 4; s++) {
    var x = el("div", "vorhang-flug-x");
    var y = el("div", "vorhang-flug-y");
    var f = el("span", s === 0 ? "vorhang-funke" : "vorhang-funke vorhang-funke--spur");
    if (s) f.style.setProperty("--spur", String(0.42 - s * 0.11));
    y.appendChild(f); x.appendChild(y); flug.appendChild(x);
  }

  // Ab hier läuft das Ladebild – von hier aus misst app.js, wie lange es mindestens bleibt
  vorhang.dataset.start = String(performance.now());

  /** Das Zählwerk: Jede Ziffer rollt von 0 herauf, die rechten länger – wie ein Kilometerzähler. */
  vorhang.zeigeZahl = function (n) {
    var zahl = document.getElementById("vorhang-zahl");
    var text = String(n);
    if (zahl.dataset.wert === text) return;
    zahl.dataset.wert = text;
    zahl.textContent = "";
    for (var k = 0; k < text.length; k++) {
      var d = Number(text[k]);
      var runden = 1 + k;                          // rechts mehr Umdrehungen
      var fenster = el("span", "vz");
      var band = el("span", "vz-band");
      band.style.setProperty("--n", String(k));
      band.style.setProperty("--ziel", String(runden * 10 + d));
      for (var z = 0; z <= runden * 10 + d; z++) {
        var ziffer = document.createElement("span");
        ziffer.textContent = String(z % 10);
        band.appendChild(ziffer);
      }
      fenster.appendChild(band);
      zahl.appendChild(fenster);
    }
    zahl.setAttribute("aria-label", text);
    document.getElementById("vorhang-wort").textContent = n === 1 ? "Woche" : "Wochen";
    vorhang.classList.add("hat-zahl");
  };

  // Deine Wochen vom letzten Besuch (app.js merkt sie sich): So steht der Ring schon im ersten
  // Bild richtig da. Nur lesen, und nur, solange dieselbe Woche läuft. app.js prüft es danach.
  try {
    var stand = JSON.parse(localStorage.getItem("dca3_vorhang") || "null");
    if (stand && Date.now() < stand.bis && Array.isArray(stand.voll)) {
      var striche = ring.querySelectorAll(".strich");
      for (var v = 0; v < stand.voll.length; v++) {
        var st = striche[stand.voll[v]];
        if (!st) continue;
        st.style.setProperty("--k", String(v));
        st.classList.add("voll");
      }
      striche[0].classList.add("jetzt");
      if (stand.zahl > 0) vorhang.zeigeZahl(stand.zahl);
    }
  } catch (e) { /* kein Speicher – dann füllt app.js den Ring gleich */ }
})();
