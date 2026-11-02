# BTC-Sparplan

Eine App für genau einen Zweck: deinen wöchentlichen Bitcoin-Sparplan über 15 €
sichtbar, verständlich und schön zu machen. Ruhig, ehrlich, ohne Druck.

Sie läuft im Browser und lässt sich wie eine normale App auf den Startbildschirm legen.
Es gibt keinen Server, kein Konto und keine Anmeldung. Deine Daten bleiben auf deinem Handy.

---

## Was sie kann

* **Depot:** Dein Depotwert als große Zahl, die wie ein mechanisches Zählwerk an ihren Platz
  rollt. Dazu Gewinn/Verlust für Woche, Monat, Jahr und gesamt und ein Verlauf, über den du
  mit dem Finger fahren kannst. Die Einzahlungen sind darin eine Treppe aus gleich hohen
  Stufen, getrennt vom Kurs. Darunter: Kennzahlen mit Mini-Verläufen, ein Countdown bis zum
  nächsten Kauf und eine Vorschau auf deinen Baum.
* **Käufe:** alle Sparwochen. ✓ eingetragen · ◌ geschätzt · ◷ ausstehend. Oben „Deine Ernte“:
  wie viele sats jede Woche für dieselben 15 € gebracht hat.
  Antippen öffnet das Eintragen: Menge **oder** Kurs genügt, den Rest rechnet die App aus.
* **Analyse („Dein Weg in Zahlen“):** Kursverlauf mit deinen Käufen, Durchhalte-Ringe,
  Schwankung als Punktwolke, Rückgang und Erholung, Wochenmosaik, Reifegrad (Haltefrist
  je Kauf nach § 23 EStG, reine Datumsrechnung) und die Kostenbasis jedes Kaufs.
* **Weg:** **Dein Baum** (siehe unten), dein Anteil an allen Bitcoin, die Netzwerkuhr
  (wie viele Blöcke seit deinem ersten Kauf gefunden wurden), Meilensteine, Beständigkeit,
  Marktstimmung und das nächste Halving.
* **Jede Zahl lässt sich antippen** und zeigt ihre Rechnung („So entsteht diese Zahl“).
* **Offline:** Ohne Netz startet die App mit dem letzten Stand. Oben steht dann „Stand …“.
* **Erinnerung:** Hinweis in der App, und auf Wunsch eine Push-Nachricht am Montagabend.

## Dein Baum

Statt Zitaten gibt es jetzt etwas, das nur dir gehört: deinen Sparplan als Querschnitt
eines Baumstamms. **Jeder Kauf ist ein Jahresring.** Die Fläche eines Rings entspricht den
sats dieses Kaufs. In günstigen Wochen gab es für dieselben 15 € mehr, dann wird der Ring
breiter. Der jüngste Ring glüht wie Glut und atmet leise. Fährst du mit dem Finger über den
Stamm, siehst du jeden einzelnen Kauf. Der Wechsel zu Bitvavo ist als feine Doppellinie
eingeschrieben.

Kein Baum sieht aus wie ein anderer, denn er entsteht allein aus deinen echten Käufen.
Mit „Als Hintergrundbild sichern“ wird er zu einem Sperrbildschirm in Handy-Größe.

## Gestaltung

Die App ist bewusst eher Film als Formular: dunkel, warm und leicht analog.

* **Atmosphäre:** Hinter allem zieht ein langsamer, leuchtender Nebel, wie Morgendunst. Er
  wird auf der Grafikkarte berechnet und folgt der Tageszeit in Deutschland (Morgen, Tag,
  Abend, Nacht). Neigst du das Handy, bewegt er sich mit, und die Lichtkanten der Karten
  wandern mit. Dazu kommen ein feines, lebendiges Filmkorn, eine Vignette und ein
  Lichtleck am Rand.
* **Leuchten nach Wichtigkeit:** Es gibt drei Stufen (Schimmer, Glimmen, Glut). Der
  Depotwert glüht am stärksten, Nebensachen schimmern nur. Ein Eingabefeld „zündet“, wenn
  du hineintippst: Ein orangefarbenes Licht läuft einmal um den Rand.
* **Bewegung nach Federphysik:** Bewegungen folgen keiner festen Kurve. Die App rechnet eine
  echte gedämpfte Feder durch, deshalb schwingt alles minimal nach. Jede Berührung sendet
  einen kurzen Lichtimpuls aus. Inhalte erscheinen, als würde ein Objektiv sie scharf
  stellen.
* **Eigene Bauteile statt Kästchen:** Zählwerk-Ziffern, die „Insel“ für Hinweise (wächst
  oben aus einem Punkt), glühende Diagrammlinien mit Kometenkopf und Herzschlag am
  jüngsten Punkt, Funkenflug bei Meilensteinen, ein Intro beim ersten Start und das
  Markenzeichen aus 52 Strichen, einem für jede Woche des Jahres.
* **Rücksicht:** Ist am Handy „Bewegung reduzieren“ eingeschaltet, steht alles still.
  In den Einstellungen lässt sich die Atmosphäre abschalten, das spart Akku.

## Einstellungen

Erinnerungen, Push, Sicherung speichern/einlesen, Schnappschüsse und die Übernahme aus der
alten App. Unter **Darstellung**: dein Name für den Gruß, Atmosphäre an/aus, feines
Vibrieren an/aus und „Begrüßung erneut ansehen“.

## Wo liegt was?

| Ordner/Datei | Inhalt |
|---|---|
| `index.html` | Das Grundgerüst der Seite |
| `css/` | Das Aussehen: `basis.css` (Farben, Leuchtstufen, Schriften, Atmosphäre), `komponenten.css` (Bausteine), `ansichten.css` (die vier Seiten) |
| `js/konfig.js` | **Die Eckdaten des Sparplans** (Sparrate, Kaufzeiten, Gebühren) |
| `js/rechnen.js`, `js/kennzahlen.js` | Alle Berechnungen. Hier entsteht jede Zahl |
| `js/kurse.js` | Abfrage der Kurse mit Ausweichquellen und Zwischenspeicher |
| `js/speicher.js` | Speichern im Browser (mit Schreibschutz) |
| `js/altdaten.js`, `js/abgleich.js` | Übernahme aus der alten App (nur lesend) und aus Sicherungsdateien |
| `js/ansichten/` | Die vier Seiten: Depot, Käufe, Analyse, Weg |
| `js/jahresringe.js` | Dein Baum: Geometrie, Zeichnen, Berühren, Hintergrundbild |
| `js/diagramme.js` | Die Diagramme (Glühlinie, Komet, Lichtlauf, Scrubben) |
| `js/ui/federwerk.js` | Federphysik für alle Bewegungen, Scharfstellen, Lichtimpuls |
| `js/ui/nebel.js` | Der Nebel im Hintergrund (WebGL) |
| `js/ui/zaehlwerk.js`, `insel.js`, `intro.js`, `funken.js`, `marke.js` | Zählwerk, Insel-Hinweise, Intro, Funkenflug, Markenzeichen |
| `js/ui/` (Rest) | Umschalter, Sheets, Ziehen zum Aktualisieren, Vibration … |
| `js/eintragen.js`, `js/einstellungen.js`, `js/rechenweg.js`, `js/benachrichtigung.js` | Dialoge |
| `sw.js`, `manifest.webmanifest`, `icons/` | Damit sie als App installierbar ist und offline startet |
| `vendor/` | Chart.js 4.4.3 (Diagramme), direkt im Repository – kein fremder Server nötig |
| `fonts/` | Schriften Inter und Instrument Serif, direkt im Repository |
| `push/`, `.github/workflows/erinnerung.yml` | Die Push-Erinnerung am Montagabend |
| `tests/` | Prüfungen – nur für Entwickler, die App braucht sie nicht |
| `PRUEFUNG.md` | Prüfbericht: Woher jede Zahl kommt und dass sie stimmt |

Was im Repository liegt, ist genau das, was der Browser lädt. Es gibt keinen Bau-Schritt.

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

* **Kein fremder Code:** Diagramm-Bibliothek und Schriften liegen im Repository. Sie wurden
  beim Herunterladen gegen die offiziellen Prüfsummen geprüft (siehe unten).
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
| `vendor/chart-4.4.3.umd.min.js` | npm `chart.js@4.4.3` (`dist/chart.umd.js`, Integrität laut npm geprüft) | `6e708cb2c2b41604db1f5dec01724856ec53ac867899a1e4e2cfb8f0ace6bed9` |
| `fonts/inter-latin-opsz.woff2` | npm `@fontsource-variable/inter@5.3.0` (`files/inter-latin-opsz-normal.woff2`, mit optischer Größe) | `2c295d99e26dcf357d4d01bcf270fd6924b600c9a13dd8c363ef114f4c6976fa` |
| `fonts/inter-bitcoinzeichen.woff2` | daraus, nur das Zeichen ₿ | `29874997b83346930b05899b8727d43ea3b31a7ee11c9932a6696ffd69df7108` |
| `fonts/instrument-serif-kursiv.woff2` | npm `@fontsource/instrument-serif@5.3.0` | `5a51946dfffa82972bc98745359c46761515641fda557c25116459a9f83da4a7` |

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
