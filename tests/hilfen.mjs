// Hilfen für die Tests: ein nachgebauter Browser-Speicher, der jeden
// Schreibversuch auf Schlüssel der alten App ("btcdca_…") sofort meldet.

export function speicherAttrappe(start = {}) {
  const daten = new Map(Object.entries(start));
  const verboten = [];
  const ls = {
    get length() { return daten.size; },
    key(i) { return [...daten.keys()][i] ?? null; },
    getItem(k) { return daten.has(k) ? daten.get(k) : null; },
    setItem(k, v) {
      if (String(k).startsWith("btcdca_")) { verboten.push(["setItem", k]); throw new Error("VERBOTEN: " + k); }
      daten.set(String(k), String(v));
    },
    removeItem(k) {
      if (String(k).startsWith("btcdca_")) { verboten.push(["removeItem", k]); throw new Error("VERBOTEN: " + k); }
      daten.delete(String(k));
    },
    clear() { verboten.push(["clear"]); throw new Error("VERBOTEN: clear"); },
  };
  return { ls, daten, verboten };
}

export const nah = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
