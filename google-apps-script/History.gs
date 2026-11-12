// Empreinte du compte propriétaire autorisé ; aucun jeton ni secret client.
const HISTORY_ALLOWED_ACCOUNT_HASH = "42b49059cd65dcdccbef3ea41b32907116547c3d2396aa690a8688e3a743e1e7";
function historyHash(value) {
  return Array.from(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value)),
    byte => ((byte + 256) % 256).toString(16).padStart(2, "0")).join("");
}
function authorizeHistory(data) {
  if (typeof data.googleAccessToken !== "string" || !data.googleAccessToken ||
      data.googleAccessToken.length > 4096 || /[\r\n]/.test(data.googleAccessToken))
    throw new Error("Connecte-toi avec Google pour accéder aux tableaux.");
  // Google vérifie le jeton OAuth ; aucune identité fournie par le navigateur n'est crue.
  let response;
  try {
    response = UrlFetchApp.fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: "Bearer " + data.googleAccessToken }, muteHttpExceptions: true
    });
  } catch (_) { throw new Error("Le propriétaire doit autoriser les appels Google du script mis à jour."); }
  if (response.getResponseCode() !== 200) throw new Error("Connexion Google expirée ou refusée. Reconnecte-toi.");
  const identity = JSON.parse(response.getContentText());
  if (!identity.sub || identity.email_verified !== true ||
      historyHash(String(identity.email || "").toLowerCase()) !== HISTORY_ALLOWED_ACCOUNT_HASH)
    throw new Error("Ce compte Google n’a pas accès à ce classeur.");
}
function readOutfits(sheet) {
  const last = sheet.getLastRow();
  if (!last) return [];
  const matrix = sheet.getRange(1, 1, last, 7).getDisplayValues();
  return Couture.blocks(matrix).filter(block => block.end).map(block => {
    const range = sheet.getRange(block.start, 1, block.end - block.start + 1, 7);
    block.version = historyHash(JSON.stringify([range.getValues(), range.getFormulas(), range.getNotes()]));
    return block;
  });
}
function historyResponse(data) {
  authorizeHistory(data);
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  return ContentService.createTextOutput(JSON.stringify({ ok: true, outfits: readOutfits(sheet) }))
    .setMimeType(ContentService.MimeType.JSON);
}
function mergeOutfit(sheet, data) {
  authorizeHistory(data);
  const block = readOutfits(sheet).find(item => item.id === String(data.targetId));
  if (!block || block.version !== data.targetVersion) throw new Error("Le tableau a changé : recharge l’historique avant de fusionner.");
  if (!Array.isArray(data.decisions) || data.decisions.length !== data.rows.length) throw new Error("Choisis le traitement de chaque doublon.");
  const footer = sheet.getRange(block.end, block.priceColumn);
  const formula = footer.getFormula();
  if (formula && !/^=SUM\([A-Z]+\d+(?::[A-Z]+\d+)?\)$/i.test(formula)) throw new Error("Total personnalisé : ajoute un tableau séparé pour préserver son calcul.");
  const additions = [], changes = [];
  let delta = 0;
  const amounts = new Map();
  data.rows.forEach((row, index) => {
    const decision = data.decisions[index];
    if (!decision || !["add", "skip", "sum"].includes(decision.action)) throw new Error("Choix de doublon invalide");
    const candidates = Couture.duplicates(row, block.rows);
    if (decision.action === "skip") return;
    if (decision.action === "sum") {
      const existing = candidates.find(item => item.row === Number(decision.row));
      if (!existing) throw new Error("Doublon non retrouvé : recharge l’historique.");
      const current = amounts.get(existing.row) || existing.values.slice();
      const sum = Couture.sum(current, row);
      current[3] = sum.amount; current[4] = sum.paid;
      amounts.set(existing.row, current);
    } else {
      additions.push(row);
    }
    delta += Math.round(decimalValue(row[4], "Prix") * 100);
  });
  const oldTotal = decimalValue(footer.getDisplayValue(), "Total existant");
  for (const [row, values] of amounts) changes.push({ row, amount: values[3], paid: values[4] });
  // Toutes les validations précèdent la première mutation.
  if (additions.length) sheet.insertRowsBefore(block.end, additions.length);
  for (const change of changes) {
    sheet.getRange(change.row, 4).setValue(change.amount);
    sheet.getRange(change.row, block.priceColumn).setValue(change.paid);
  }
  if (additions.length) {
    const values = buildBlock({ rows: additions, total: additions.reduce((n, row) => n + Math.round(decimalValue(row[4], "Prix") * 100), 0) / 100, tenue: "" }, block.priceColumn).slice(1, -1);
    sheet.getRange(block.end, 1, additions.length, 7).setValues(values);
    sheet.getRange(block.start + 1, 1, 1, 7).copyFormatToRange(sheet, 1, 7, block.end, block.end + additions.length - 1);
    sheet.getRange(block.end, 2, additions.length, 1).setNumberFormat("@");
    sheet.autoResizeRows(block.end, additions.length);
  }
  const totalRow = block.end + additions.length;
  // Garder les formules SUM simples en les étendant ; préserver un total saisi avec son delta.
  const column = String.fromCharCode(64 + block.priceColumn);
  const newFooter = sheet.getRange(totalRow, block.priceColumn);
  if (formula) newFooter.setFormula("=SUM(" + column + (block.start + 1) + ":" + column + (totalRow - 1) + ")");
  else newFooter.setValue((Math.round(Number(oldTotal || 0) * 100) + delta) / 100);
  return { start: block.start, count: totalRow - block.start + 1 };
}
