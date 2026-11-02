// =====================================================================
// zitate.js – Gedanken aus dem Fernen Osten über Geduld und Beständigkeit.
// Die Sammlung der alten App, vollständig übernommen und um einige
// passende Sprichwörter ergänzt.
// =====================================================================

export const ZITATE = Object.freeze([
  // aus der alten App
  { t: "Eine Reise von tausend Meilen beginnt mit einem einzigen Schritt.", a: "Laozi, Daodejing" },
  { t: "Die Natur hat es nicht eilig, und doch wird alles vollendet.", a: "Laozi" },
  { t: "Das Große dieser Welt beginnt stets im Kleinen.", a: "Laozi, Daodejing" },
  { t: "Wer andere kennt, ist klug. Wer sich selbst kennt, ist weise.", a: "Laozi" },
  { t: "Sei wie Wasser: Es sucht keinen Streit und überwindet doch das Härteste.", a: "Laozi" },
  { t: "Ruhe ist die Meisterin über die Unruhe.", a: "Laozi, Daodejing" },
  { t: "Der Weise handelt, ohne zu streiten.", a: "Laozi" },
  { t: "Sorge dich nicht, langsam zu gehen. Sorge dich nur, stehenzubleiben.", a: "Chinesisches Sprichwort" },
  { t: "Der beste Zeitpunkt zu pflanzen war vor zwanzig Jahren. Der zweitbeste ist jetzt.", a: "Chinesisches Sprichwort" },
  { t: "Der Tropfen höhlt den Stein nicht durch Kraft, sondern durch beständiges Fallen.", a: "Chinesisches Sprichwort" },
  { t: "Geduld ist ein Baum mit bitterer Wurzel, aber süßen Früchten.", a: "Chinesisches Sprichwort" },
  { t: "Mit Geduld und Zeit wird aus dem Maulbeerblatt ein Seidenkleid.", a: "Chinesisches Sprichwort" },
  { t: "Fällst du siebenmal, steh achtmal auf.", a: "Japanisches Sprichwort" },
  { t: "Der Bambus, der sich im Sturm biegt, ist stärker als die Eiche, die bricht.", a: "Japanisches Sprichwort" },
  { t: "Hast du es eilig, mach einen Umweg.", a: "Japanisches Sprichwort" },
  { t: "Vor der Erleuchtung: Holz hacken, Wasser tragen. Nach der Erleuchtung: Holz hacken, Wasser tragen.", a: "Zen-Sprichwort" },
  { t: "Leere deine Tasse, damit sie neu gefüllt werden kann.", a: "Zen-Sprichwort" },
  { t: "Wenn der Schüler bereit ist, erscheint der Lehrer.", a: "Zen-Sprichwort" },
  { t: "Sitze ruhig, tue nichts. Der Frühling kommt, und das Gras wächst von selbst.", a: "Zen-Sprichwort" },
  { t: "Der Geist ist alles. Was du denkst, das wirst du.", a: "Buddha, Dhammapada" },
  { t: "Auch ein Krug füllt sich Tropfen für Tropfen.", a: "Buddha, Dhammapada" },
  { t: "Alles Entstandene ist vergänglich – wer das sieht, wird ruhig.", a: "Buddhistisches Sprichwort" },
  { t: "Der Mensch stolpert nicht über Berge, sondern über Maulwürfe.", a: "Konfuzius" },
  { t: "Wohin du auch gehst, geh mit deinem ganzen Herzen.", a: "Konfuzius" },
  { t: "Besser ein kleines Licht anzünden, als die Dunkelheit verfluchen.", a: "Konfuzius" },
  { t: "Es kommt nicht darauf an, wie langsam du gehst, solange du nicht stehen bleibst.", a: "Konfuzius" },
  { t: "Übung von tausend Tagen ist Schulung, von zehntausend Tagen ist Meisterschaft.", a: "Miyamoto Musashi" },
  { t: "Kenne dich und den Markt, und du musst hundert Schlachten nicht fürchten.", a: "frei nach Sunzi" },
  // neu dazugekommen
  { t: "Auch Staub, der sich anhäuft, wird zum Berg.", a: "Japanisches Sprichwort" },
  { t: "Beharrlichkeit ist Kraft.", a: "Japanisches Sprichwort" },
  { t: "Sitz drei Jahre auf einem Stein, und er wird warm.", a: "Japanisches Sprichwort" },
  { t: "Ein Baum, den man mit beiden Armen umfasst, wuchs aus einem haarfeinen Keim.", a: "Laozi, Daodejing" },
  { t: "Ein Turm von neun Stockwerken beginnt mit einem Häufchen Erde.", a: "Laozi, Daodejing" },
  { t: "Wer weiß, wann es genug ist, gerät nicht in Gefahr.", a: "Laozi, Daodejing" },
  { t: "Wer einen Berg versetzen will, beginnt damit, kleine Steine wegzutragen.", a: "Chinesisches Sprichwort" },
]);

/** Das Zitat des Tages – an einem Tag immer dasselbe. */
export function zitatDesTages(heute) {
  const [j, m, t] = heute.split("-").map(Number);
  const tagNr = Math.floor(Date.UTC(j, m - 1, t) / 86_400_000);
  return (tagNr * 7) % ZITATE.length;
}
