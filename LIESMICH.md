# BTC-Sparplan

Eine App für genau einen Zweck: deinen wöchentlichen Bitcoin-Sparplan über 15 €
sichtbar, verständlich und schön zu machen. Ruhig, ehrlich, ohne Druck.

Sie läuft im Browser und lässt sich wie eine normale App auf den Startbildschirm legen.
Es gibt keinen Server, kein Konto und keine Anmeldung. Deine Daten bleiben auf deinem Handy.

---

## Was sie kann

Es gibt **eine Startseite**. Alles andere sind Fenster, die sich aus ihr heraus entfalten
und dorthin zurückfalten.

* **Startseite:**
  * Oben steht dein Depotwert als Zählwerk, darunter Gewinn/Verlust für Woche, Monat, Jahr oder alles.
  * Darunter liegt die Linie: Wert über der Treppe deiner Einzahlungen.
  * **Zeitreise:** Fährst du mit dem Finger über die Linie, springt die ganze Seite in diesen
    Moment. Die Zahlen rollen zum damaligen Stand, die Käufe- und Baum-Kachel gehen mit.
    Beim Loslassen gleitet alles zurück ins Jetzt.
  * Darunter stehen der Countdown bis zum nächsten Kauf und drei Kacheln.
* **Käufe:**
  * „Ernte“ zeigt jeden Kauf als Balken, so hoch wie die sats, die es dafür gab.
  * Darunter stehen alle Sparwochen: ✓ eingetragen · ◌ geschätzt · ◷ ausstehend.
  * Eine Zeile antippen → sie entfaltet sich zum Eintragen. Menge **oder** Kurs genügt.
* **Dein Baum:** Jeder Kauf ist ein Jahresring (siehe unten). Er hat eine Zeitleiste und lässt
  sich als Hintergrundbild speichern.
* **Zahlen:**
  * Bitcoin heute, Durchhalten, dein Anteil an allen Bitcoin, nächster Meilenstein
  * Haltefrist nach § 23 EStG (reine Datumsrechnung)
  * Tiefpunkt und Erholung, Blöcke seit deinem ersten Kauf mit nächstem Halving, Marktstimmung
* **Jede Zahl lässt sich antippen** und zeigt ihre Rechnung („So entsteht diese Zahl“).
* **Offline:** Ohne Netz startet die App mit dem letzten Stand. Oben steht dann „Stand …“.
* **Erinnerung:** ein Hinweis in der App und auf Wunsch eine Push-Nachricht am Montagabend.

## Dein Baum

Statt Zitaten gibt es etwas, das nur dir gehört: deinen Sparplan als Querschnitt eines
Baumstamms.

* **Jeder Kauf ist ein Jahresring.** Die Fläche eines Rings entspricht den sats dieses Kaufs.
  In günstigen Wochen gab es für dieselben 15 € mehr, dann wird der Ring breiter.
* Der jüngste Ring glüht und atmet leise.
* Auf der Zeitleiste fährst du zurück in die Zeit, und der Baum schrumpft Ring für Ring.
  Fährst du über den Stamm, siehst du jeden einzelnen Kauf.
* Kein Baum gleicht einem anderen, denn er entsteht allein aus deinen echten Käufen.
* Mit „Als Hintergrundbild sichern“ wird er zum Sperrbildschirm in Handy-Größe.

## Gestaltung

Die App wurde von der Bewegung aus gedacht, nicht vom Bild. Zuerst wurde festgelegt, wie
sich alles bewegt; daraus folgen Formen, Farben und Schrift. Das ganze Konzept steht in
**[GESTALTUNG.md](GESTALTUNG.md)**. Die Grundzüge:

* **Federphysik:** Jede Bewegung ist eine echte Feder, keine feste Kurve. Man kann jedes
  Fenster mitten in der Bewegung greifen.
* **Nur Lage und Deckkraft bewegen sich.** Deshalb gibt es kein Milchglas und keine Schatten.
  Tiefe entsteht durch Tonwerte.
* **Licht aus Bewegung:** In Ruhe ist die App matt. Was sich bewegt oder berührt wird, glüht.
  Ein Eingabefeld „zündet“ an der Stelle, an der du tippst.
* **Atmosphäre:** Hinter allem liegt ein Morgennebel nach Tageszeit. Er wird einmal gerechnet
  und danach nur verschoben, deshalb kostet er kaum Akku.
* **Schrift:** Mona Sans. Die Zahlen stehen in der breiten Form, alle Ziffern sind gleich
  breit, damit sie wie ein Zählwerk rollen können.
* Ist am Handy „Bewegung reduzieren“ eingeschaltet, steht alles still.

## Einstellungen

Erinnerungen, Push, Sicherung speichern/einlesen, Schnappschüsse und die Übernahme aus der
alten App. Unter **Darstellung**: dein Name für den Gruß, Atmosphäre an/aus und feines
Vibrieren an/aus.

## Wo liegt was?

| Ordner/Datei | Inhalt |
|---|---|
| `index.html` | Das Grundgerüst der Seite |
| `GESTALTUNG.md` | Das Gestaltungskonzept: erst die Bewegungen, dann alles andere |
| `css/` | `grund.css` (Farben, Schrift, Atmosphäre), `teile.css` (Bausteine), `ansichten.css` (Startseite und Fenster) |
| `js/konfig.js` | **Die Eckdaten des Sparplans** (Sparrate, Kaufzeiten, Gebühren) |
| `js/rechnen.js`, `js/kennzahlen.js`, `js/zeitraeume.js` | Alle Berechnungen. Hier entsteht jede Zahl |
| `js/kurse.js` | Abfrage der Kurse mit Ausweichquellen und Zwischenspeicher |
| `js/speicher.js` | Speichern im Browser (mit Schreibschutz) |
| `js/altdaten.js`, `js/abgleich.js` | Übernahme aus der alten App (nur lesend) und aus Sicherungsdateien |
| `js/bewegung/` | Der Bewegungskern: `feder.js` (Federphysik), `geste.js` (Finger mit Tempo), `ziffern.js` (Zählwerk), `nebel.js` (Atmosphäre) |
| `js/teile/` | Bausteine: `fenster.js` (Entfalten/Falten), `tablett.js`, `linie.js` (die Linie mit Zeitreise), `meldung.js` (Statuszeile), Zurück-Taste, Vibration |
| `js/ansichten/` | Startseite (`heute.js`) und die Fenster Käufe, Baum, Zahlen |
| `js/jahresringe.js` | Dein Baum: Geometrie, Zeichnen, Berühren, Hintergrundbild |
| `js/eintragen.js`, `js/einstellungen.js`, `js/rechenweg.js`, `js/benachrichtigung.js` | Eintragen, Einstellungen, Rechenweg, Erinnerungen |
| `sw.js`, `manifest.webmanifest`, `icons/` | Damit sie als App installierbar ist und offline startet |
| `fonts/` | Die Schrift Mona Sans, direkt im Repository |
| `push/`, `.github/workflows/erinnerung.yml` | Die Push-Erinnerung am Montagabend |
| `tests/` | Prüfungen – nur für Entwickler, die App braucht sie nicht |
| `PRUEFUNG.md` | Prüfbericht: Woher jede Zahl kommt und dass sie stimmt |

Was im Repository liegt, ist genau das, was der Browser lädt. Es gibt keinen Bau-Schritt
und keine fremden Bibliotheken.

## Deine Daten

* Die App speichert alles in deinem Browser, unter Namen, die mit `dca3_` beginnen.
* **Die alte App bleibt unangetastet.** Beide laufen unter derselben Adresse
  (`fab23059.github.io`) und teilen sich deshalb den Speicher. Die neue App **liest** die Daten
  der alten (`btcdca_…`), schreibt dort aber nie etwas hinein. Das ist im Code durch
  eine Sperre abgesichert und durch Tests geprüft.
* Beim ersten Start übernimmt sie deine eingetragenen Käufe aus der alten App. Danach
  übernimmt sie bei jedem Start Käufe, die du dort **neu** einträgst. Hast du denselben
  Montag in beiden Apps unterschiedlich eingetragen, gilt der Wert der neuen App.
  In den Einstellungen siehst du die Abweichung und kannst wählen.
* **Vor jeder Änderung** legt die App automatisch einen Schnappschuss an (die letzten 20).
  Einstellungen → Schnappschüsse → „Zurückholen“.
* **Sicherung:** Einstellungen → „Sicherung speichern“ erzeugt eine Datei. „Sicherung einlesen“
  nimmt Dateien dieser App **und** der alten App an. Du siehst vorher, was sich ändert.
  Einmal im Monat sichern ist eine gute Gewohnheit.

## Sicherheit – was getan wurde

* **Kein fremder Code:** Die App nutzt keine fremden Bibliotheken; auch die Linie ist selbst
  gezeichnet. Einzige Fremddatei ist die Schrift. Sie liegt im Repository und wurde beim
  Herunterladen gegen die offizielle Prüfsumme geprüft (siehe unten).
* **Strenge Sicherheitsrichtlinie (CSP):** Die Seite darf nur eigene Dateien laden und nur mit
  den freigegebenen Datenquellen sprechen (Kurse, Marktstimmung, Blockzeit). Mit „Trusted Types“ ist technisch ausgeschlossen, dass
  Text von außen (etwa aus einer Kursquelle) als Programmcode ins Dokument gelangt.
* **Alle Daten von außen werden geprüft:** Kurse außerhalb plausibler Grenzen werden verworfen.
  Sicherungsdateien werden vollständig kontrolliert, bevor etwas übernommen wird.
* **Keine Cookies, keine Herkunftsangabe** bei Kursabfragen, keine Konten, keine Schlüssel.
* **Push:** Der geheime Schlüssel liegt nur als GitHub-Secret vor. Die Nachricht enthält keine
  Käufe, nur Erinnerung und Kurs. Unterwegs ist sie verschlüsselt, sodass der Push-Dienst
  (Google) sie nicht lesen kann. Der Workflow nutzt keine fremden Bausteine.

**Gut zu wissen:** Alles unter `fab23059.github.io` (auch `btc-dca`, `btc-dca2` und jedes andere
GitHub-Pages-Projekt dieses Kontos) teilt sich **einen** Browser-Speicher. Jede dieser Seiten
könnte die Daten der anderen lesen. Das ist eine Eigenschaft von GitHub Pages, keine Lücke
dieser App. Deshalb gilt: dort nur eigenen, vertrauenswürdigen Code veröffentlichen und
regelmäßig sichern.

### Prüfsummen der mitgelieferten Fremddateien

| Datei | Herkunft | SHA-256 |
|---|---|---|
| `fonts/mona-sans.woff2` | npm `@fontsource-variable/mona-sans@5.3.0` (`files/mona-sans-latin-wdth-normal.woff2`, Integrität laut npm geprüft) | `5ea3740633e5ac7af56c13d7e8ec32bcae12e7723e53d34284469a8947ccb2f3` |

## Push-Erinnerung einrichten (optional)

1. In der App: Einstellungen → „Push aufs Handy“ → „Einrichten“ → Benachrichtigungen erlauben.
2. „Schlüssel kopieren“ antippen.
3. Auf GitHub im Repository **btc-dca3**: Settings → Secrets and variables → Actions →
   „New repository secret“ → Name `PUSH_CONFIG`, als Wert den kopierten Text einfügen → „Add secret“.
4. Zum Ausprobieren: Actions → „Erinnerung“ → „Run workflow“.

Danach kommt jeden Montag gegen 21 Uhr eine Nachricht. GitHub startet geplante Abläufe
manchmal ein paar Minuten zu spät. Am zuverlässigsten klappt es, wenn die App auf
dem Startbildschirm installiert ist.

## Etwas ändern

* **Sparrate, Kaufzeit, Gebühr oder Brokerwechsel:** nur in `js/konfig.js`.
* Nach Änderungen an App-Dateien in `sw.js` die Zahl bei `VERSION` um eins erhöhen.
  Dann holen sich installierte Apps die neuen Dateien zuverlässig.
* Jede Datei ist auf GitHub direkt les- und bearbeitbar. Änderungen sind nach einer Minute live.

## Für Entwickler

```
node --test tests/*.test.mjs                 # Rechenkern, Schreibschutz, Push-Verschlüsselung
node tests/browser/pruefung.mjs <ordner>     # Browser-Prüfung (braucht Playwright)
python3 tests/browser/nachrechnen.py <ordner> # unabhängige Gegenrechnung
node tests/browser/film.mjs <ordner>         # Vorführvideo aufnehmen (braucht ffmpeg)
```

Keine Anlage- und keine Steuerberatung.
