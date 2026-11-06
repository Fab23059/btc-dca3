# Gestaltung – von der Bewegung aus gedacht

Diese App wurde nicht erst gezeichnet und dann animiert. Zuerst wurde festgelegt,
**wie sich alles bewegt**. Erst daraus folgen Formen, Raster, Farben und Schrift.
Ein Bild der App zeigt deshalb immer nur einen Zwischenstand einer Bewegung.

**Zweite Fassung (1.1): lauter.** Die erste Fassung war bewusst leise. Gewünscht war mehr
Wirkung: mehr Licht, mehr Bewegung, mehr Atmosphäre. Die Bewegungen sind dieselben
geblieben, aber jede ist aufgedreht: Der Komet fährt bei jedem Zeitraumwechsel, der Nebel
lebt, das Filmkorn springt, Meilensteine werden mit Funken gefeiert. Die Regel, dass nur
Lage und Deckkraft animiert werden, gilt weiter. Deshalb bleibt es flüssig.

---

## 1. Die Bewegungen (zuerst)

| | Bewegung | Was passiert | Gerechnet als |
|---|---|---|---|
| B1 | **Entfalten** | Ein Fenster wächst aus seiner Kachel (oder einer Zeile, einem Knopf) auf den ganzen Bildschirm. Der Inhalt bleibt stehen, nur der Rahmen öffnet sich. Zurück faltet es sich in genau die Stelle, aus der es kam. | Feder „Raum“ (Antwort 0,5 s, Dämpfung 0,86) |
| B2 | **Falten mit dem Finger** | Ein offenes Fenster lässt sich nach unten ziehen. Es schrumpft dabei auf seinem Rückweg, genau unter dem Finger. Loslassen: Der Schwung entscheidet, ob es zufällt oder zurückspringt. | dieselbe Feder, Startgeschwindigkeit = Fingertempo |
| B3 | **Zeitreise** | Finger auf die Linie: Alles auf dem Bildschirm springt in diesen Moment. Die Zahlen rollen, der Baum hat so viele Ringe wie damals, der Nebel zieht mit. Loslassen: Die Zeit gleitet zurück ins Jetzt. | Finger 1 : 1, Rückweg Feder „Zeiger“ |
| B4 | **Komet** | Bei jedem Wechsel Woche → Monat → Jahr → Alles (und € ↔ ₿) fährt ein glühender Punkt die Linie von links nach rechts ab. Er zieht einen Schweif und verliert Funken, die Käufe auf der Linie zünden im Vorbeiflug, im Jetzt läuft eine Lichtwelle aus. Dasselbe gilt im Kursverlauf des Bitcoin-Fensters. Kommen neue Kurse herein, fließt die Linie in ihre neue Form. | Feder „Aufzug“ (1,25 s, ohne Nachschwingen), Funken mit Schwerkraft |
| B5 | **Zählwerk** | Ziffern rollen wie ein mechanisches Zählwerk, die rechte zuerst. | Feder „Zeiger“ je Ziffer |
| B6 | **Tablett** | Kleine Dinge (Rechenweg, Rückfragen) kommen als Tablett von unten. Ändert sich der Inhalt, wächst oder schrumpft das Tablett, statt neu aufzugehen. | Feder „Raum“ |
| B7 | **Die Statuszeile spricht** | Meldungen erscheinen nicht als neue Kästchen. Die vorhandene Statuszeile oben verwandelt sich in die Nachricht und danach zurück. | Feder „Zeiger“ |
| B8 | **Aufgang** | Beim Start rollt der Wert von null hoch, der Komet zieht die Linie, die Kacheln steigen federnd nacheinander auf. Über jede läuft dabei einmal eine Lichtkante. Balken wachsen aus dem Boden, Zeilen gleiten herein, Abzeichen-Ringe füllen sich. | federnd (Dämpfung 0,74), 95 ms versetzt |
| B9 | **Feier** | Ein neuer Meilenstein oder ein frisch eingetragener Kauf: Funken und Konfetti sprühen aus der Stelle, an der es passiert ist. | eigene Leinwand, Schwerkraft und Luftwiderstand |

**Regeln, die für alle Bewegungen gelten**

1. **Nichts erscheint aus dem Nichts.** Alles kommt von irgendwo und geht dorthin zurück.
2. **Jede Bewegung ist unterbrechbar.** Man kann jedes Fenster, jedes Tablett und jede Linie
   mitten in der Bewegung greifen. Die Geschwindigkeit geht dabei nie verloren.
3. **Federn statt Kurven.** Es gibt keine festen Dauern, nur drei Federn: „Raum“ für große
   Flächen, „Zeiger“ für kleine Teile und „Gummi“ für das Nachgeben am Rand.
4. **Eine Achse, eine Bedeutung.** Waagerecht ist Zeit. Senkrecht ist Tiefe: hinein und
   wieder heraus. Tippen öffnet.
5. **Nur Lage und Deckkraft bewegen sich.** Die Grafikkarte kann das ohne Ruckeln.
   Unschärfe, Milchglas oder Größenänderungen von Flächen werden nie animiert. Glühen
   entsteht auf Leinwänden (Linie, Nebel, Funken) oder als ruhender Schein.
6. **Licht entsteht durch Bewegung.** Was sich bewegt oder berührt wird, leuchtet – stärker,
   je schneller und je wichtiger. Danach glimmt es aus. Die große Zahl, der Nebel und der
   Schein hinter ihr hängen an derselben „Energie“: Rollen die Ziffern, glüht alles auf.

## 2. Was daraus folgt (danach)

| Folge aus | Gestaltungsentscheidung |
|---|---|
| B1, Regel 1 | **Jede Kachel ist die verkleinerte Ansicht ihres eigenen Fensters.** Die Startseite zeigt die oberen Teile der Fenster, in 0,92-facher Größe. Beim Entfalten muss deshalb nichts ausgetauscht werden. |
| B1 | Alle Fenster haben dieselbe Breite und dieselbe Kopfhöhe. So öffnet sich alles in dieselbe Richtung, und die Startseite bekommt einen ruhigen Takt. |
| B1 | Inhalte in Fenstern sind oben verankert, nie mittig. Beim Aufziehen verrutscht nichts. |
| Regel 5 | **Kein Milchglas.** Tiefe entsteht durch Tonwerte (Grund, Fläche, gehobene Fläche) und durch warmes Licht, das von oben rechts in die Kacheln und Fenster fällt. |
| Regel 5 | Keine Rahmenlinien um Flächen. Haarlinien gibt es nur innerhalb von Listen. |
| B5 | **Alle Zahlen haben feste Ziffernbreiten.** Nur so können sie rollen, ohne zu springen. Deshalb ist die Schrift Mona Sans: Ihre Ziffern sind gleich breit, und die breite Form wirkt ruhig und hochwertig. |
| Regel 6 | **Es gibt nur eine Akzentfarbe, Glut-Orange.** Sie steht nur dort, wo Bewegung oder Handlung ist: an der Linie, am Zeiger der Zeitreise, am jüngsten Ring, am Hauptknopf. |
| Regel 4 | Zeitliche Dinge stehen immer waagerecht: Linie, Zeitraum, Ernte, Zeitleiste des Baums. |
| Regel 3 | Es gibt nur drei Radien: 28 für Fenster, 16 für Felder innerhalb, rund für Pillen. Sie sind ineinander verschachtelt: innen = außen − Abstand. |
| B3 | Die Linie ist das Bedienelement. Es gibt keine Achsen und keine Gitter. Wenn der Finger die Linie berührt, zeigen die Zahlen oben die Werte. |
| B7 | Keine Toasts, keine Banner. Die Statuszeile ist der einzige Ort für Meldungen. |

## 3. Bausteine

* **Raster:** 4-Punkt-Raster, Seitenrand 16, Abstand zwischen Fenstern 12, Kachelhöhe 184.
* **Farben:** Grund `#090807`, Fläche `#131110`, gehobene Fläche `#1C1916`; Text `#F2EDE6`,
  `#A0988E`, `#6A635B`; Glut `#FF8A2A`; Plus `#93C6A0`, Minus `#E39A87` (nur in Zahlen).
* **Schrift:** Mona Sans (SIL Open Font License). Zahlen und Titel in der breiten Form (125 %),
  Text in der normalen Breite. Keine Großbuchstaben-Etiketten, keine Kursivschrift.
* **Atmosphäre:** Der Nebel ist eine Rechnung auf der Grafikkarte (WebGL): zwei Schichten
  verwirbeltes Rauschen, die verschieden schnell treiben, dazu drei warme Lichtquellen, die
  unregelmäßig flackern. Weil das Feld unendlich ist, gibt es keine Kanten und keine
  sichtbaren Ebenen. Scrollen und Zeitreise verschieben nur den Blick.
  Gerechnet wird in zwei Durchgängen: erst klein (ein Viertel der Auflösung), dann
  **bikubisch** auf Bildschirmgröße hochgerechnet, von der Grafikkarte selbst. Der Browser
  vergrößert also nie ein kleines Bild, denn das ergab auf dem Handy sichtbare Kästchen.
  Im zweiten Durchgang kommt das laufende Filmkorn dazu.
  In Ruhe 15 Bilder pro Sekunde (der Nebel treibt so langsam, dass man den Unterschied nicht
  sieht), beim Scrollen und bei der Zeitreise 30, bei offenem Fenster oder im Hintergrund keins.
  Die Farben folgen der Tageszeit (abends glühend orange, nachts kühl violett).
  Ohne WebGL gibt es zwei vorgerechnete Bilder, die weich auslaufen.
* **Filmkorn** liegt zusätzlich hauchfein und ruhend über allem, auch über Fenstern.
* „Atmosphäre“ in den Einstellungen schaltet den Nebel ab (spart Akku).
  „Bewegung reduzieren“ am Handy hält alles an.

### Leistung: was flüssig hält und Akku spart (1.1.1)

* **Kein Weichzeichner auf Leinwänden.** Der Schein um die Linien entsteht aus zwei breiten,
  durchscheinenden Strichen. Ein echter Weichzeichner kostete beim Kometen die Hälfte der Bilder.
* **Nichts läuft dauernd, das neu zeichnen muss.** Was immer läuft (Herzschlag am Jetzt-Punkt,
  Atmen des jüngsten Rings), ist reine Deckkraft oder Lage. Das macht die Grafikkarte allein.
  Leinwände zeichnen nur, solange sich etwas bewegt.
* **Keine Werte an der Wurzel der Seite pro Bild.** Ein Wert an `:root` lässt den Browser die
  ganze Seite neu berechnen, deshalb hängt das Aufleuchten an einer eigenen Fläche (`#glut`).
* **Ruhige Uhr.** Der Countdown zeigt Tage, Stunden und Minuten, ohne Lichtpuls und ohne Sekunden.
* Gemessen mit viermal gedrosseltem Prozessor (ohne Nebel, der auf dem Handy die Grafikkarte
  rechnet): in Ruhe 64 statt 498 ms Arbeit pro Sekunde, Scrollen und Komet mit 60 Bildern pro Sekunde.

## 4. Was wir aus der vorigen Fassung behalten haben – und was nicht

Behalten haben wir diese Ideen:
* der Baum (jeder Kauf ein Ring),
* das Zählwerk,
* der Nebel,
* das Leuchten nach Wichtigkeit,
* die Federphysik,
* der Rechenweg hinter jeder Zahl.

Nicht übernommen haben wir:

| Weggelassen | Warum |
|---|---|
| Karten mit Großbuchstaben-Etiketten | Das typische Kartenraster vieler Vorlagen sieht beliebig aus. |
| Erklärsätze unter jeder Grafik | Zu viel Text, die Grafiken sollen für sich sprechen. |
| Kursiv-Überschriften | Die Kursivschrift wirkte wie eine beliebige Vorlage. |
| Milchglas | Ruckelt in der Bewegung. |
| Leuchten überall | Ohne Hierarchie verliert das Leuchten seine Bedeutung. |
| Laufendes Filmkorn | *In 1.1 zurückgeholt,* in 1.1.1 in den Nebel verlegt: Die Grafikkarte rechnet es im selben Durchgang mit. |
| Schwebende Tableiste | Die vier Seiten werden durch Fenster ersetzt, die sich aus der Startseite entfalten. |
| Ringdiagramme und Tachos | Kein Kartenraster. *In 1.1* gibt es zwei Ausnahmen mit Bedeutung: die Abzeichen-Ringe (sie füllen sich bis zum nächsten Ziel) und die Stimmungsuhr mit federndem Zeiger. |
| Fremde Diagramm-Bibliothek | Die Linie ist jetzt selbst gebaut, nur so kann sie fließen. |
