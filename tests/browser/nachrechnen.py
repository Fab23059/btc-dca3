"""
nachrechnen.py – Unabhängige Gegenrechnung (nur für Entwickler).

Rechnet alle Kennzahlen der Browser-Prüfung mit eigenem Python-Code nach –
ohne eine einzige Zeile der App zu verwenden – und vergleicht sie mit dem,
was die App angezeigt hat. Grundlage sind dieselben Testkurse.

Aufruf: python3 tests/browser/nachrechnen.py <ausgabeordner der Browser-Prüfung>
"""
import json, math, re, sys
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

ordner = sys.argv[1]
daten = json.load(open(f"{ordner}/testdaten.json"))
ergebnis = json.load(open(f"{ordner}/ergebnis.json"))
START, P = daten["start"], daten["punkte"]
BERLIN = ZoneInfo("Europe/Berlin")

def runde(x):  # wie Math.round(x*100)/100 in den nachgebauten Quellen
    return math.floor(x * 100 + 0.5) / 100

def kurs(t):  # Testkurs zu Sekunde t: linear zwischen Stundenpunkten
    k = int((t - START) // 3600)
    a, b = P[k], P[k + 1]
    return a + (b - a) * (t - START - k * 3600) / 3600

def kaufzeit(tag):
    d = datetime.fromisoformat(tag)
    h, m = (8, 40) if tag <= "2026-06-29" else (20, 50)
    return int(datetime(d.year, d.month, d.day, h, m, tzinfo=BERLIN).timestamp())

def gebuehr(tag):
    return 0.004 if tag <= "2026-06-29" else 0.0025

def stundenreihe(jetzt):  # wie CryptoCompare histohour limit=744: Schlusskurse je Stunde
    letzte = jetzt // 3600 * 3600
    return [(min(t + 3600, jetzt), runde(kurs(min(t + 3600, jetzt)))) for t in (letzte - i * 3600 for i in range(744, -1, -1))]

def interpoliert(reihe, t):
    for (t0, c0), (t1, c1) in zip(reihe, reihe[1:]):
        if t0 <= t <= t1:
            return c0 + (c1 - c0) * (t - t0) / (t1 - t0) if t1 > t0 else c1
    return None

def erwartung(jetzt):
    montage = []
    d = datetime(2026, 6, 8)
    while d.date() <= datetime.fromtimestamp(jetzt, BERLIN).date():
        montage.append(d.strftime("%Y-%m-%d")); d += timedelta(days=7)
    kaeufe = []  # (zeitpunkt, btc)
    for m in montage:
        ts = kaufzeit(m)
        o = daten["overrides"].get(m)
        if o:  # eingetragen
            kaeufe.append((ts, o["btc"]))
        elif ts <= jetzt:  # geschätzt: 15 € abzüglich Gebühr zum Marktkurs (Minutenkerze, Eröffnung)
            kaeufe.append((ts, 15 * (1 - gebuehr(m)) / runde(kurs(ts // 60 * 60))))
        # sonst: ausstehend → zählt nicht
    aktuell = runde(kurs(jetzt))
    inv = 15 * len(kaeufe); btc = sum(b for _, b in kaeufe)
    wert = btc * aktuell; gv = wert - inv
    e = {"Aktueller Kurs": aktuell, "Investiert": inv, "BTC gesamt": btc, "Depotwert": wert,
         "Ø Kaufpreis": inv / btc, "G/V gesamt (€)": gv, "G/V gesamt (%)": gv / inv * 100}
    reihe = stundenreihe(jetzt)
    for name, tage in (("Woche", 7), ("Monat", 30)):
        s = jetzt - tage * 86400
        vorher = [b for t, b in kaeufe if t <= s]
        w0 = sum(vorher) * interpoliert(reihe, s)
        einz = 15 * (len(kaeufe) - len(vorher))
        veraenderung = gv - (w0 - 15 * len(vorher))
        e[f"G/V {name} (€)"] = veraenderung
        e[f"G/V {name} (%)"] = veraenderung / (w0 + einz) * 100
    e["G/V Jahr (€)"] = gv; e["G/V Jahr (%)"] = gv / inv * 100   # Plan jünger als ein Jahr
    e["Kursverlauf 1M (%)"] = (aktuell / interpoliert(reihe, jetzt - 30 * 86400) - 1) * 100
    return e

def zahl(text):
    t = text.replace("−", "-").replace(".", "").replace(",", ".")
    return float(re.findall(r"[-+]?\d+(?:\.\d+)?", t)[0])

def angezeigt(s):
    z = s["zeitraeume"]
    zn = s["zahlen"]
    teile = lambda t: re.findall(r"[-+−]?[\d.]+,\d+", t)
    a = {"Aktueller Kurs": zahl(s["fuss"].split("Bitcoin")[1]),
         "Investiert": zahl(zn["investiert"]),
         # Die App zeigt den Bestand in sats (ganze Zahl) – zurück in BTC
         "BTC gesamt": zahl(zn["sats"]) / 1e8,
         "Depotwert": zahl(s["wert"]),
         "Ø Kaufpreis": zahl(zn["durchschnitt"]),
         "G/V gesamt (€)": zahl(teile(z["Gesamt"])[0]), "G/V gesamt (%)": zahl(teile(z["Gesamt"])[1])}
    for n in ("Woche", "Monat", "Jahr"):
        a[f"G/V {n} (€)"] = zahl(teile(z[n])[0]); a[f"G/V {n} (%)"] = zahl(teile(z[n])[1])
    return a

GENAU = {"Aktueller Kurs": 1, "Ø Kaufpreis": 1, "BTC gesamt": 1e-8}
zeilen = []; alles_ok = True
for name, jetzt in (("neu-2047", int(datetime(2026, 11, 2, 19, 47, tzinfo=timezone.utc).timestamp())), ("neu-2100", int(datetime(2026, 11, 2, 20, 0, tzinfo=timezone.utc).timestamp()))):
    e = erwartung(jetzt); a = angezeigt(ergebnis["szenarien"][name])
    for k, soll in e.items():
        if k not in a: continue
        ist = a[k]; toleranz = GENAU.get(k, 0.01)
        ok = abs(round(soll, 8 if k == "BTC gesamt" else 2) - ist) <= toleranz + 1e-9
        alles_ok &= ok
        zeilen.append(f"| {name} | {k} | {soll:.8f} | {ist} | {'✓' if ok else '✗'} |" if k == "BTC gesamt" else f"| {name} | {k} | {soll:,.2f} | {ist:,.2f} | {'✓' if ok else '✗'} |")
print("| Szenario | Kennzahl | erwartet (Python) | angezeigt (App) | |\n|---|---|---|---|---|")
print("\n".join(zeilen))
print("\nALLES STIMMT" if alles_ok else "\nABWEICHUNG GEFUNDEN")
sys.exit(0 if alles_ok else 1)
