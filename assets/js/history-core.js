// Fonctions partagées navigateur / Apps Script : aucune donnée ni requête réseau.
var Couture = (function () {
  function normalize(value) {
    return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function measure(value) {
    const raw = String(value ?? "").trim();
    const text = raw.toLowerCase().replace(/,/g, ".").replace(/\s+/g, " ");
    if (!text) return { value: "", kind: "unknown" };
    if (/^\d+(?:\.\d+)?$/.test(text)) return { value: Number(text), kind: "unknown" };
    let match = text.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|m|m[eè]tres?|millim[eè]tres?|centim[eè]tres?)$/);
    if (match) {
      const unit = match[2];
      const factor = unit === "mm" || unit.startsWith("milli") ? 0.1 : unit === "m" || unit.startsWith("mètre") || unit.startsWith("metre") ? 100 : 1;
      return { value: Number((Number(match[1]) * factor).toFixed(4)), kind: "length" };
    }
    match = text.match(/^(\d+)m(\d{2})$/);
    if (match) return { value: Number(match[1]) * 100 + Number(match[2]), kind: "length" };
    match = text.match(/^(\d+(?:\.\d+)?)\s*(?:unit[eé]s?|pi[eè]ces?|boutons?|pcs?)$/);
    if (match) return { value: Number(match[1]), kind: "quantity" };
    return { value: raw, kind: "ambiguous" };
  }
  function nameScore(a, b) {
    a = normalize(a); b = normalize(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const aa = new Set(a.split(" ")), bb = new Set(b.split(" "));
    const common = [...aa].filter(t => bb.has(t)).length;
    const tokens = common / Math.max(aa.size, bb.size);
    const distance = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let before = distance[0]; distance[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const old = distance[j];
        distance[j] = Math.min(distance[j] + 1, distance[j - 1] + 1, before + (a[i - 1] === b[j - 1] ? 0 : 1));
        before = old;
      }
    }
    return Math.max(tokens, 1 - distance[b.length] / Math.max(a.length, b.length));
  }
  function duplicates(incoming, existing) {
    const ref = normalize(incoming[1]);
    return existing.filter(item => {
      const oldRef = normalize(item.values[1]);
      if (ref && oldRef) return ref === oldRef;
      return nameScore(incoming[0], item.values[0]) >= 0.82;
    });
  }
  function blocks(matrix) {
    const starts = [];
    for (let i = 0; i < matrix.length; i++) {
      const row = matrix[i] || [];
      if (/^nom(?:\s|$)/.test(normalize(row[0])) && normalize(row[1]).includes("ref") && normalize(row[6]).startsWith("note")) starts.push(i);
    }
    return starts.map((start, n) => {
      const header = matrix[start];
      const price = [4, 5].find(c => normalize(header[c]) === "prix");
      if (price === undefined) return null;
      const rate = price === 4 ? 5 : 4;
      const limit = starts[n + 1] ?? matrix.length;
      let end = null;
      const rows = [];
      for (let i = start + 1; i < limit; i++) {
        const row = matrix[i] || [];
        const priceOnly = String(row[price] ?? "").trim() && [0, 1, 2, 3, rate, 6].every(c => !String(row[c] ?? "").trim());
        if (/^total\b/.test(normalize(row[0])) || priceOnly) { end = i; break; }
        if (row.slice(0, 7).some(v => String(v ?? "").trim())) {
          rows.push({ row: i + 1, values: [row[0] ?? "", row[1] ?? "", row[2] ?? "", row[3] ?? "", row[price] ?? "", row[rate] ?? ""], note: row[6] ?? "" });
        }
      }
      return { id: String(start + 1), start: start + 1, end: end === null ? null : end + 1,
        name: String(header[0]).replace(/^\s*nom\s*[:\n]?\s*/i, "").trim(),
        priceColumn: price + 1, rateColumn: rate + 1, rows };
    }).filter(Boolean);
  }
  function sum(existing, incoming) {
    const a = measure(existing[3]), b = measure(incoming[3]);
    if ([a, b].some(v => v.kind === "ambiguous" || v.value === "")) throw Error("Mesure ambiguë : ajoute une ligne séparée.");
    const kind = v => v.kind === "unknown" ? (Number(v.value) < 50 ? "quantity" : "length") : v.kind;
    if (kind(a) !== kind(b)) throw Error("Longueur et quantité différentes : ajoute une ligne séparée.");
    const decimal = v => String(v).trim() ? Number(String(v).replace(/\s/g, "").replace(/€$/, "").replace(",", ".")) : NaN;
    if (!Number.isFinite(decimal(existing[4])) || !Number.isFinite(decimal(incoming[4]))) throw Error("Prix payé manquant : ajoute une ligne séparée.");
    if (!Number.isFinite(decimal(existing[5])) || !Number.isFinite(decimal(incoming[5])) ||
        Math.abs(decimal(existing[5]) - decimal(incoming[5])) > 0.001) throw Error("Tarifs différents : ajoute une ligne séparée.");
    return { amount: Number(a.value) + Number(b.value), paid: Math.round((decimal(existing[4]) + decimal(incoming[4])) * 100) / 100 };
  }
  return { normalize, measure, nameScore, duplicates, blocks, sum };
})();
if (typeof module !== "undefined") module.exports = Couture;
