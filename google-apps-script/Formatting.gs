// Reprendre le style du premier tableau existant, sans copier ses valeurs ni ses notes.
function findFormatTemplate(values) {
  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  for (let i = 0; i < values.length; i++) {
    const header = values[i].map(normalize);
    if (!header[0].startsWith("nom") || !header[1].includes("ref") || !header[6].includes("note")) continue;
    const priceIndex = header.findIndex((name, index) => index >= 4 && index <= 5 && name === "prix");
    const rateIndex = header.findIndex((name, index) => index >= 4 && index <= 5 && /(?:m[²2]|unit|tarif)/.test(name));
    if (priceIndex < 0 || rateIndex < 0 || priceIndex === rateIndex) continue;
    let firstData = null;
    for (let j = i + 1; j < values.length; j++) {
      const label = normalize(values[j][0]);
      if (/^total\b/.test(label) && firstData !== null) {
        return { headerRow: i + 1, dataRow: firstData + 1, totalRow: j + 1, priceColumn: priceIndex + 1 };
      }
      if (label.startsWith("nom")) break;
      if (firstData === null && values[j].some(value => String(value || "").trim())) firstData = j;
    }
  }
  throw new Error("Tableau modèle introuvable : aucun import effectué");
}

function readFormatTemplate(sheet) {
  return findFormatTemplate(sheet.getRange(1, 1, Math.min(sheet.getLastRow(), 100), 7).getDisplayValues());
}

function formatBlock(sheet, start, count, template) {
  if (!template || count < 3 || start <= template.totalRow) throw new Error("Plage de mise en forme invalide");
  const last = start + count - 1;
  sheet.getRange(template.headerRow, 1, 1, 7).copyFormatToRange(sheet, 1, 7, start, start);
  sheet.getRange(template.dataRow, 1, 1, 7).copyFormatToRange(sheet, 1, 7, start + 1, last - 1);
  sheet.getRange(template.totalRow, 1, 1, 7).copyFormatToRange(sheet, 1, 7, last, last);
  // Les références doivent garder leurs zéros, même si le modèle utilisait des nombres.
  sheet.getRange(start + 1, 2, count - 2, 1).setNumberFormat("@");
  sheet.autoResizeRows(start, count);
  sheet.setRowHeight(start, Math.max(sheet.getRowHeight(template.headerRow), sheet.getRowHeight(start), 64));
}
