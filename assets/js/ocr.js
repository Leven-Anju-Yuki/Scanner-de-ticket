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

function importReceipt(text, confidence) {
  const receipt = parseReceipt(text, confidence);
  let added = 0;
  receipt.articles.forEach(article => { if (fillForm(article)) added++; });
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
    importReceipt(result.data.text, result.data.confidence);
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
