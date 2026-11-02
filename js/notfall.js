// notfall.js – Falls die App nicht startet (z. B. eine Datei fehlt), erscheint
// nach einigen Sekunden ein Hinweis statt einer leeren Seite. Deine Daten
// sind davon nicht betroffen – sie liegen unverändert im Browser.
"use strict";
setTimeout(function () {
  if (document.documentElement.dataset.bereit) return;
  var box = document.createElement("div");
  box.className = "notfall";
  var titel = document.createElement("p");
  titel.className = "notfall-titel";
  titel.textContent = "Die App konnte nicht vollständig starten.";
  var text = document.createElement("p");
  text.textContent = "Deine Daten sind sicher – sie liegen unverändert in diesem Browser. Bitte neu laden; hilft das nicht, kurz warten und später erneut versuchen.";
  var knopf = document.createElement("button");
  knopf.type = "button";
  knopf.className = "knopf knopf--primaer";
  knopf.textContent = "Neu laden";
  knopf.addEventListener("click", function () { location.reload(); });
  box.append(titel, text, knopf);
  document.body.append(box);
}, 9000);
