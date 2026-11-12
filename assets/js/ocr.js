const input = document.getElementById("ticketInput");
const debug = document.getElementById("ocrDebug");
const preview = document.getElementById("ticketPreview");
let previewUrl = null;

async function prepareTicketImage(file) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  preview.hidden = false;
  const load = source => new Promise((resolve, reject) => {
    preview.onload = () => { preview.onload = preview.onerror = null; resolve(); };
    preview.onerror = () => { preview.onload = preview.onerror = null; reject(new Error("Format photo illisible. Essaie une image JPG ou PNG.")); };
    preview.src = source;
  });
  try { await load(previewUrl); }
  catch (_) {
    // Certains navigateurs intégrés ne décodent pas les URL blob. Relire le
    // fichier sur l'appareil ; aucune photo n'est envoyée à un serveur.
    const source = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Impossible de lire cette photo sur cet appareil."));
      reader.readAsDataURL(file);
    });
    await load(source);
  }
  const ratio = Math.min(2, Math.max(1, 1400 / preview.naturalWidth),
    3200 / Math.max(preview.naturalWidth, preview.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(preview.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(preview.naturalHeight * ratio));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Préparation de l’image impossible.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(preview, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function receiptIdentity(text) {
  const normalized = String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
  const date = normalized.match(/\b(\d{2}[/.]\d{2}[/.]\d{4})\s+(\d{1,2}:\d{2})\b/);
  const number = normalized.match(/CAISSE\s*(\d+)\s*[-–:]?\s*NUMERO\s*(\d+)/);
  if (date && number) return "ticket:" + [date[1], date[2], number[1], number[2]].join(":");
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) hash = Math.imul(hash ^ normalized.charCodeAt(i), 16777619);
  return "text:" + normalized.length + ":" + (hash >>> 0).toString(16);
}
function existingReceipt(key, fileKey) {
  return Array.from(tbody.querySelectorAll("tr")).some(row =>
    (key && row.dataset.receiptKey === key) || (fileKey && row.dataset.receiptFileKey === fileKey));
}
function alreadyImported() {
  debug.textContent = "Ce ticket est déjà dans ton tableau. Aucune ligne ajoutée ; tes corrections sont conservées.";
  if (typeof CoutureDraft !== "undefined") CoutureDraft.save();
  return 0;
}
function legacyReceiptRows(articles) {
  // Migration des brouillons créés avant le suivi des scans. Comparaison de
  // l'ensemble des lignes, avec leur multiplicité ; jamais des autres tenues.
  const fingerprint = values => {
    const ref = String(values[1] || "").replace(/\D/g, "") || String(values[0] || "").toLowerCase().replace(/\s+/g, " ").trim();
    const amount = readNumber(values[3]), paid = readNumber(values[5]);
    return ref && amount !== null && paid !== null ? JSON.stringify([ref, amount, paid]) : "";
  };
  const available = new Map();
  for (const row of tbody.querySelectorAll("tr")) {
    if (row.dataset.receiptKey || row.dataset.receiptFileKey) continue;
    const key = fingerprint(Array.from(row.children).slice(0, 6).map(cell => cell.textContent));
    if (key) { if (!available.has(key)) available.set(key, []); available.get(key).push(row); }
  }
  const found = [];
  for (const article of articles) {
    const key = fingerprint([article.nom, article.reference, article.largeur, article.taille, article.prixUnitaire, article.prix]);
    const candidates = available.get(key);
    if (!candidates?.length) return null;
    found.push(candidates.pop());
  }
  return found.length ? found : null;
}
function importReceipt(text, confidence, fileKey = "") {
  const receipt = parseReceipt(text, confidence);
  const key = receiptIdentity(text);
  if (existingReceipt(key, fileKey)) return alreadyImported();
  const legacy = legacyReceiptRows(receipt.articles);
  if (legacy) {
    legacy.forEach(row => { row.dataset.receiptKey = key; if (fileKey) row.dataset.receiptFileKey = fileKey; });
    return alreadyImported();
  }
  let added = 0;
  receipt.articles.forEach(article => { if (fillForm({ ...article, receiptKey: key, receiptFileKey: fileKey })) added++; });
  const warnings = document.getElementById("ocrWarnings");
  warnings.replaceChildren();
  const messages = [...receipt.warnings];
  receipt.articles.forEach((article, index) => {
    if (article.warnings.length) messages.push("Article " + (index + 1) + " (" + (article.nom || "sans nom") + ") : " + article.warnings.join(" "));
  });
  for (const message of messages) {
    const item = document.createElement("li");
    item.textContent = message;
    warnings.appendChild(item);
  }
  document.getElementById("ocrText").textContent = text || "(Aucun texte lu)";
  document.getElementById("ocrResult").hidden = false;
  if (added) {
    document.getElementById("ocrReviewPanel").hidden = false;
    document.getElementById("ocrReviewed").checked = false;
    document.getElementById("saveStatus").textContent = "Scan ajouté : corrige les cellules si nécessaire avant d’enregistrer.";
    if (typeof CoutureHistory !== "undefined") CoutureHistory.refresh();
  }
  debug.textContent = added
    ? added + " article(s) proposé(s). Vérifie les noms, mesures et prix avant l’envoi."
    : "Aucun article identifiable. Consulte le texte lu et saisis les informations manuellement.";
  if (typeof CoutureDraft !== "undefined") CoutureDraft.save();
  return added;
}

async function readTicket(event) {
  const activeInput = event.target;
  const file = event.target.files[0];
  if (!file) return;
  if (document.getElementById("sendToSheet").disabled) {
    debug.textContent = "Attends la fin de l’enregistrement avant de scanner un autre ticket.";
    activeInput.value = "";
    return;
  }
  if (file.type && !file.type.startsWith("image/")) {
    debug.textContent = "Choisis une photo du ticket (JPG ou PNG).";
    activeInput.value = "";
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    debug.textContent = "Photo trop volumineuse (maximum 20 Mo). Recadre ou réduis la photo.";
    activeInput.value = "";
    return;
  }
  let worker;
  const sendButton = document.getElementById("sendToSheet");
  input.disabled = true;
  const gallery = document.getElementById("ticketGallery");
  if (gallery) gallery.disabled = true;
  sendButton.disabled = true;
  debug.textContent = "Préparation de la photo…";
  try {
    let fileKey = "";
    if (typeof crypto !== "undefined" && crypto.subtle && typeof file.arrayBuffer === "function") {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      fileKey = "file:" + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      if (existingReceipt("", fileKey)) { alreadyImported(); return; }
    }
    if (typeof Tesseract === "undefined") throw new Error("Le lecteur OCR n’est pas chargé. Vérifie la connexion Internet.");
    const image = await prepareTicketImage(file);
    worker = await Tesseract.createWorker("fra", 1, {
      logger(message) {
        debug.textContent = message.status === "recognizing text"
          ? "Lecture du ticket : " + Math.round(message.progress * 100) + " %"
          : "Chargement du lecteur de tickets…";
      }
    });
    let result = await worker.recognize(image);
    if (/(?:[*+•]\s*)?\d{5,8}\s*\//.test(result.data.text) && result.data.confidence < 85) {
      debug.textContent = "Seconde lecture des colonnes du ticket…";
      await worker.setParameters({ tessedit_pageseg_mode: "11" });
      const retry = await worker.recognize(image);
      const score = data => parseReceipt(data.text, data.confidence).articles.reduce((n, a) => n + (a.prix ? 3 : 0) + (a.taille ? 2 : 0) + (a.reference ? 1 : 0), 0);
      if (score(retry.data) >= score(result.data)) result = retry;
    }
    importReceipt(result.data.text, result.data.confidence, fileKey);
  } catch (error) {
    debug.textContent = "Lecture impossible : " + error.message + " Tu peux toujours saisir les articles à la main.";
  } finally {
    if (worker) {
      try { await worker.terminate(); } catch (_) {}
    }
    input.disabled = false;
    if (gallery) gallery.disabled = false;
    sendButton.disabled = false;
    activeInput.value = "";
  }
}
input.addEventListener("change", readTicket);
document.getElementById("ticketGallery")?.addEventListener("change", readTicket);
