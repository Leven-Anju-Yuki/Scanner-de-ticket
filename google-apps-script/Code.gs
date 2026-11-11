const SHEET_ID = "1jdgbpLBnvWIhoYqL_-Ut31sG_1NhxqSIePDb9H6hwi0";
const SHEET_NAME = "Feuille 1";
const APP_VERSION = "scanner-sheets-2";
// Identifiant public du client Web, projet indépendant scanner-de-tickets-couture.
const GOOGLE_WEB_CLIENT_ID = "882018689960-t5uercolas7p2m71od4d37ie018i9pbo.apps.googleusercontent.com";

// À exécuter une fois par le propriétaire dans l'éditeur après l'ajout d'OAuth.
// Diagnostic public Google uniquement : aucune écriture dans Sheets.
function authorizeGoogleConnection() {
  const response = UrlFetchApp.fetch("https://accounts.google.com/.well-known/openid-configuration");
  if (response.getResponseCode() !== 200 || !Session.getEffectiveUser().getEmail()) {
    throw new Error("Autorisation Google à vérifier.");
  }
  console.log("Appels Google autorisés. Retourne sur le scanner et reconnecte-toi.");
}

function doGet() {
  // Diagnostic public sans accès au tableur ni donnée personnelle.
  const googleClientId = PropertiesService.getScriptProperties().getProperty("GOOGLE_OAUTH_CLIENT_ID") || GOOGLE_WEB_CLIENT_ID;
  return ContentService.createTextOutput(JSON.stringify({ ok: true, version: APP_VERSION, formatting: "existing-template", history: "google-oauth", googleClientId }))
    .setMimeType(ContentService.MimeType.JSON);
}

function decimalValue(value, label) {
  const text = String(value ?? "").trim().replace(/\s/g, "").replace(/€$/, "").replace(",", ".");
  if (!text) return "";
  if (!/^\d+(?:\.\d+)?$/.test(text) || !Number.isFinite(Number(text))) {
    throw new Error(label + " : nombre invalide");
  }
  return Number(text);
}

function literalText(value) {
  const text = String(value ?? "");
  return /^\s*[=+@-]/.test(text) ? "'" + text : text;
}

function buildBlock(data, priceColumn = 5) {
  if (!Array.isArray(data.rows) || !data.rows.length || data.rows.length > 500 ||
      data.rows.some(row => !Array.isArray(row) || row.length !== 6 ||
        row.some(value => !["string", "number"].includes(typeof value)))) {
    throw new Error("Articles invalides");
  }
  // Le POST garde son ordre historique : nom, réf, largeur, quantité, prix, tarif.
  // Le modèle Sheets détermine si le prix se trouve en E ou en F.
  const rows = data.rows.map(row => [
    literalText(row[0]), literalText(row[1]),
    decimalValue(row[2], "Largeur"), decimalValue(row[3], "Hauteur / quantité"),
    decimalValue(row[4], "Prix"), decimalValue(row[5], "Tarif"), ""
  ]);
  const cents = rows.reduce((sum, row) => sum + Math.round((Number(row[4]) + Number.EPSILON * Math.max(1, Number(row[4]))) * 100), 0);
  const total = decimalValue(data.total, "Total");
  if (total === "" || Math.abs(total - cents / 100) > 0.001) throw new Error("Total incohérent avec les prix");
  const title = String(data.tenue || "").trim();
  if (title.length > 500) throw new Error("Nom de tenue trop long");
  const headers = [literalText("Nom" + (title ? "\n" + title : "")), "Référence", "Largeur (cm)",
    "Hauteur (cm) / Quantité", "Prix", "Prix au m² / unité", "Note"];
  const footer = ["TOTAL DE LA TENUE", "", "", "", cents / 100, "", ""];
  if (priceColumn === 6) {
    for (const row of [headers, ...rows, footer]) [row[4], row[5]] = [row[5], row[4]];
  }
  return [
    headers, ...rows, footer
  ];
}

function appendOutfit(sheet, data) {
  const template = readFormatTemplate(sheet);
  const block = buildBlock(data, template.priceColumn);
  const start = sheet.getLastRow() ? sheet.getLastRow() + 3 : 1;
  const end = start + block.length - 1;
  if (end > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), end - sheet.getMaxRows());
  if (sheet.getMaxColumns() < 7) sheet.insertColumnsAfter(sheet.getMaxColumns(), 7 - sheet.getMaxColumns());
  sheet.getRange(start, 1, block.length, 7).setValues(block);
  formatBlock(sheet, start, block.length, template);
  return { start: start, count: block.length };
}

function doPost(e) {
  let lock;
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error("Utilise le bouton Enregistrer du site");
    const data = JSON.parse(e.postData.contents);
    if (data.action === "history") return historyResponse(data);
    if (data.action === "merge") authorizeHistory(data);
    buildBlock(data); // Valider avant toute écriture.
    if (data.requestId && !/^[a-zA-Z0-9-]{16,80}$/.test(data.requestId)) throw new Error("Identifiant d'envoi invalide");
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    const properties = PropertiesService.getScriptProperties();
    const key = data.requestId ? "receipt:" + data.requestId : null;
    const fingerprint = JSON.stringify({ rows: data.rows, total: data.total, tenue: data.tenue || "", action: data.action || "append", targetId: data.targetId, targetVersion: data.targetVersion, decisions: data.decisions });
    const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, fingerprint));
    const saved = key && properties.getProperty(key);
    if (saved) {
      const receipt = JSON.parse(saved);
      if (receipt.hash !== hash) throw new Error("Identifiant d'envoi déjà utilisé pour un autre tableau");
      if (receipt.status === "ok") return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
      throw new Error("Envoi précédent commencé mais non confirmé : vérifier la feuille avant toute nouvelle tentative");
    }
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Feuille introuvable");
    // Une panne après cette réservation bloque la répétition au lieu de dupliquer des lignes.
    if (key) properties.setProperty(key, JSON.stringify({ hash: hash, status: "pending" }));
    if (data.action === "merge") mergeOutfit(sheet, data);
    else appendOutfit(sheet, data);
    SpreadsheetApp.flush();
    if (key) properties.setProperty(key, JSON.stringify({ hash: hash, status: "ok" }));
    return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    console.error(error);
    return ContentService.createTextOutput("error:" + error.message).setMimeType(ContentService.MimeType.TEXT);
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}
