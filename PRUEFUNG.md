# Prüfbericht – stimmen die Zahlen?

Stand: 2. November 2026 · App-Version 1.0.0 (neue Gestaltung, zweite Prüfrunde)

Dieser Bericht hält fest, **woher jede Zahl kommt, wie sie geprüft wurde und was
dabei herauskam**. Zusätzlich kann jede Kennzahl in der App selbst angetippt werden.
Unter „So entsteht diese Zahl“ steht dann die Rechnung mit den echten Werten.

## 1. Wie geprüft wurde

| Prüfung | Womit | Ergebnis |
|---|---|---|
| Rechenkern (19 Einzeltests: Zeitzone, Kaufzeit, Einträge, Zeiträume, Haltefrist, Rückgang …) | `tests/rechnen.test.mjs` | alle bestanden |
| Schutz der alten Daten (statisch und im Lauf) | `tests/schreibschutz.test.mjs` | alle bestanden |
| Push-Verschlüsselung gegen den offiziellen Testvektor aus RFC 8291 | `tests/webpush.test.mjs` | Byte für Byte identisch |
| Dein Baum: gleiche Käufe → gleicher Baum, Ringe kreuzen sich nie, Fläche ∝ sats, Berühren trifft den richtigen Kauf | `tests/jahresringe.test.mjs` | alle bestanden |
| Komplette App im Browser (Chromium, 390 × 844 und 360 × 780), alte und neue App unter derselben Adresse wie auf GitHub Pages | `tests/browser/pruefung.mjs` | siehe unten |
| **Unabhängige Gegenrechnung** in Python, ohne eine Zeile App-Code | `tests/browser/nachrechnen.py` | 27 von 27 Werten stimmen – auch nach der neuen Gestaltung erneut geprüft |
| Vorführvideo der ganzen App (Intro, alle Seiten, Eintragen, Gesten), Bild für Bild durchgesehen | `tests/browser/film.mjs` | Darstellungsfehler gefunden und behoben (siehe Abschnitt 4) |

**Ehrliche Einschränkung:** Aus meiner Arbeitsumgebung waren die echten Kursquellen
(CryptoCompare, Coinbase, CoinGecko …) gesperrt. Ich habe deshalb mit einem festen,
künstlichen Kursverlauf geprüft. Er wird genau so ausgeliefert wie von den echten
Quellen (gleiches Antwortformat, gleiche Kerzen-Logik). Damit ist **die Rechnung**
geprüft. Ob die **Quellen** stimmen, zeigt die App selbst: Tippe auf den Bitcoin-Kurs.
Unter „Gegenprobe“ fragt sie CryptoCompare und Coinbase gleichzeitig und zeigt die
Abweichung. Deine echten Einträge kenne ich nicht, sie liegen nur in deinem Browser.

## 2. Die Fehler der alten App

### Fehler 1 – bestätigt: Der laufende Montag zählt zu früh

Die alte App zählt den Montag als Kauf, sobald das Datum erreicht ist. Bitvavo kauft
aber erst um ~20:50 Uhr. Bis dahin setzt die alte App den Kurs „jetzt“ als
Platzhalter ein. Nachgestellt mit identischen Daten am Montag, 2.11., um 20:47 Uhr:

| Kennzahl um 20:47 Uhr | alte App | neue App | richtig |
|---|---|---|---|
| Investiert | 330,00 € (22 Käufe) | **315,00 €** (21 Käufe) | 315,00 € – der 22. Kauf findet erst um 20:50 statt |
| BTC gesamt | 0,00518373 | **0,00495444** | ohne den noch nicht getätigten Kauf |
| Depotwert | 338,24 € | **323,28 €** | |
| Ø Kaufpreis | 63.660,73 € | **63.579 €** | |

Die neue App zeigt den Montag bis zur Kaufzeit als **„ausstehend“** an. Er erscheint
sichtbar als Hinweis („Heute 20:50 Uhr kauft dein Sparplan“), fließt aber in keine
Summe ein. Ab 20:50 Uhr gilt er als „geschätzt“, bis du die echte Menge einträgst.

### Fehler 2 – neu gefunden: Der Platzhalterkurs wird dauerhaft gemerkt

Öffnet man die alte App an einem Montag vor der Kaufzeit, schreibt sie den Platzhalterkurs
(z. B. von 15:12 Uhr) **für immer** als Kaufkurs dieses Montags in ihren Speicher
(`btcdca_monday_prices_v4`). Im Test stand für den 26.10. danach dauerhaft 66.272,62 €
statt des Marktkurses um 20:50 Uhr (66.304,15 €). Betroffen ist jeder Montag, an dem du
die App vor dem Kauf geöffnet hast und **keinen** echten Wert eingetragen hast.

Die neue App übernimmt diese gemerkten Kurse deshalb **nicht** als Grundlage. Sie holt
den Kurs zur Kaufzeit neu, minutengenau, und speichert ihn erst 10 Minuten nach dem Kauf.
Die alten Kurse dienen nur als Notvorrat, falls beim allerersten Start kein Netz da ist.
Deine eingetragenen Werte sind davon nicht betroffen, sie hatten schon immer Vorrang.

### Fehler 3 – Zeitraum-Gewinn mit ungenauem Startkurs

Für „Woche“ und „Monat“ nahm die alte App den Tagesschlusskurs des Starttags (bis zu
24 Stunden daneben). Die neue App rechnet mit Stundenkursen und dazwischen linear.
Die **Regel** der alten App bleibt erhalten: Gemessen wird die Veränderung von
*(Wert − Investiert)*. Die neue Einzahlung zählt nie als Gewinn.

### Fehler 4 – Darstellung: „Die Käufe werden nach rechts immer kleiner“

Ursache war ein Diagramm, das zwei verschiedene Dinge mit zwei gleichartigen Linien zeigte.
Die neue App trennt sie:

* **Ansicht „Wert“:** Die Einzahlungen sind eine graue **Treppe** mit 22 exakt gleich hohen
  Stufen. Der Depotwert ist eine durchgehende Linie. Jeder Kauf erscheint darin als eigener
  Sprung genau zur Kaufzeit. Die Fläche dazwischen ist grün oder rot getönt: Gewinn bzw. Verlust.
* **Ansicht „Wochen“:** Je Woche ein grauer Block (deine 15 €, immer gleich groß) und darüber
  bzw. darunter ein farbiger Block (was der Kurs mit dem ganzen Bestand gemacht hat).
  Rechnerisch gilt exakt: Summe aller Einzahlungen − Gebühren + Kursbewegungen = heutiger
  Wert (Test „Wochenzerlegung“).

## 3. Jede Kennzahl: Quelle, erwartet, angezeigt

**Quelle/Rechnung** ist die Definition, so wie sie in der App unter „So entsteht diese Zahl“
steht. **Erwartet** hat die unabhängige Python-Rechnung ermittelt. **Angezeigt** ist das,
was auf dem Bildschirm stand. Die App rundet Kurs und Ø Kaufpreis auf ganze Euro.

| Kennzahl | Quelle / Rechnung |
|---|---|
| Aktueller Kurs | CryptoCompare, sonst Coinbase, sonst CoinGecko. Offline: letzter bekannter Stand mit Uhrzeit |
| Investiert | Anzahl gezählter Käufe × 15 € (brutto). Ausstehende zählen nicht |
| BTC gesamt | Summe der eingetragenen Mengen + geschätzte Mengen (15 € × (1 − Gebühr) ÷ Marktkurs zur Kaufzeit) |
| Depotwert | BTC gesamt × aktueller Kurs |
| Ø Kaufpreis | Investiert ÷ BTC gesamt (Gebühr steckt drin = echter Einstandspreis) |
| G/V gesamt | Depotwert − Investiert; Prozent: ÷ Investiert |
| G/V Woche/Monat | (Wert − Investiert) jetzt minus (Wert − Investiert) vor 7/30 Tagen; Prozent: ÷ (Wert zu Beginn + Einzahlungen im Zeitraum) |
| G/V Jahr | wie oben mit 365 Tagen; solange der Plan jünger ist, identisch mit „gesamt“ |
| Prozent über dem Kursverlauf | aktueller Kurs ÷ Kurs genau am Anfang des Zeitraums − 1 (1M = 30 Tage) |

| Szenario | Kennzahl | erwartet (Python) | angezeigt (App) | |
|---|---|---|---|---|
| Mo 20:47 | Aktueller Kurs | 65.250,96 € | 65.251 € | ✓ |
| Mo 20:47 | Investiert | 315,00 € | 315,00 € | ✓ |
| Mo 20:47 | BTC gesamt | 0,00495444 | 0,00495444 | ✓ |
| Mo 20:47 | Depotwert | 323,28 € | 323,28 € | ✓ |
| Mo 20:47 | Ø Kaufpreis | 63.579,30 € | 63.579 € | ✓ |
| Mo 20:47 | G/V gesamt | +8,28 € / +2,63 % | +8,28 € / +2,63 % | ✓ |
| Mo 20:47 | G/V Woche | −5,31 € / −1,62 % | −5,31 € / −1,62 % | ✓ |
| Mo 20:47 | G/V Monat | −10,53 € / −3,15 % | −10,53 € / −3,15 % | ✓ |
| Mo 20:47 | G/V Jahr | +8,28 € / +2,63 % | +8,28 € / +2,63 % | ✓ |
| Mo 21:00 | Aktueller Kurs | 65.253,71 € | 65.254 € | ✓ |
| Mo 21:00 | Investiert | 330,00 € | 330,00 € | ✓ |
| Mo 21:00 | BTC gesamt | 0,00518375 | 0,00518375 | ✓ |
| Mo 21:00 | Depotwert | 338,26 € | 338,26 € | ✓ |
| Mo 21:00 | Ø Kaufpreis | 63.660,51 € | 63.661 € | ✓ |
| Mo 21:00 | G/V gesamt | +8,26 € / +2,50 % | +8,26 € / +2,50 % | ✓ |
| Mo 21:00 | G/V Woche | −5,05 € / −1,47 % | −5,05 € / −1,47 % | ✓ |
| Mo 21:00 | G/V Monat | −10,44 € / −2,99 % | −10,44 € / −2,99 % | ✓ |
| Mo 21:00 | G/V Jahr | +8,26 € / +2,50 % | +8,26 € / +2,50 % | ✓ |
| Mo 21:00 | Kursverlauf 1M | −3,27 % | −3,27 % | ✓ |

Beispiel, warum die Zeitraum-Regel wichtig ist: In der Testwoche stieg der Depotwert
von etwa 328 € auf 338 €. Das sieht nach Gewinn aus. Davon waren aber 15 € neue
Einzahlung. Richtig ist deshalb **−5,05 €**, wie angezeigt.

## 4. Weitere Prüfungen

| Prüfung | Ergebnis |
|---|---|
| Alte Daten (`btcdca_*`) vor und nach dem Lauf der neuen App verglichen | **Byte für Byte unverändert** |
| Neue Schlüssel, die die neue App angelegt hat | ausschließlich `dca3_…` |
| Codesuche nach Schreibzugriffen (`setItem`, `removeItem`, `clear`) | nur in `js/speicher.js`, dort hinter einer Sperre, die jeden Schlüssel ohne `dca3_` abweist |
| Codesuche nach `btcdca_` | nur in `js/altdaten.js` (nur `getItem`) und in Kommentaren |
| Alte App nach der neuen geöffnet | läuft, zeigt dieselben Einträge |
| Eintrag in der neuen App gespeichert | landet nur in `dca3_eintraege`, alte App unberührt |
| Hauptquelle CryptoCompare ausgefallen | Coinbase springt ein, identische Zahlen |
| Ohne Netz neu geladen | App startet aus dem Zwischenspeicher, Kopfzeile „Stand 2.11., 21:00“ |
| Breite 360 und 390 Pixel | kein waagerechtes Scrollen, nichts abgeschnitten, nichts unter der Tableiste |
| Gesten | Wischen zwischen Seiten, Ziehen zum Aktualisieren, Scrubbing mit dem Finger, Sheet wegwischen, Android-Zurück-Taste schließen Dialoge: alles funktioniert |
| Fehler in der Browser-Konsole, Verstöße gegen die Sicherheitsrichtlinie | keine |
| Lump-Sum-Vergleich, Was-wäre-wenn, Telegram | im Code nicht mehr vorhanden |
| Push: Schlüssel im Browser erzeugt → Versandskript → unabhängig in Python entschlüsselt | Inhalt korrekt, Absender-Signatur gültig |
| Baum als Hintergrundbild | PNG 1080 × 2400 wird erzeugt und geladen |
| Anteil an allen Bitcoin | 21 Mio. BTC ÷ 8,2 Mrd. Menschen ≈ 256.098 sats; Testdepot 518.375 sats = 202 % ✓ |
| Netzwerkuhr | Blockhöhe zum ersten Kauf über mempool.space; Differenz zur aktuellen Höhe |
| Gefundene und behobene Darstellungsfehler | Leerzeichen im Begrüßungsgruß fehlten; Herzschlag-Punkt erschien auch im Balkendiagramm; Wert-Linie bei „Woche“/„Monat“ war flach (Achse begann immer bei 0 €, zoomt jetzt auf den echten Bereich); Fehlermeldung „Menge größer als 0“ kam schon beim Eintippen von „0,0…“ |
| „Bewegung reduzieren“ am Handy (im Browser nachgestellt) | Nebel steht still, keine Konsolenfehler; die Begrüßung erscheint ruhend statt animiert |

## 5. Was du selbst einmal prüfen solltest

1. **Gegenprobe des Kurses:** In der App auf die Kachel „Bitcoin“ tippen → „Gegenprobe“.
   Beide Quellen sollten höchstens wenige Zehntel Prozent auseinanderliegen.
2. **Ein Kauf aus Bitvavo:** Menge eines Kaufs aus Bitvavo mit der Liste unter „Käufe“ vergleichen.
3. **Investiert:** Anzahl Montage seit dem 8. Juni × 15 €. Steht ein Montag als
   „ausstehend“ da, darf er noch nicht mitzählen.
