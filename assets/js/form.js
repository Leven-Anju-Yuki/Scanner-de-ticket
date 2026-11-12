const table = document.getElementById("ticketTable");
const tbody = table.querySelector("tbody");
const totalPriceEl = document.getElementById("totalPrice");
const SHEETS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxqwIB0_qFuaRil5e-uKEgXm64aZultHO9uqHKL1o5bISsfo9sKDe8DV39dno68hMnEkg/exec";
function readNumber(value) {
  const s = String(value).trim().replace(/\s/g, "").replace(/€$/, "").replace(",", ".");
  return /^\d+(?:\.\d+)?$/.test(s) ? Number(s) : null;
}
function toCents(value) {
  return Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value))) * 100);
}
function addRow(values = []) {
  const tr = document.createElement("tr");
  for (let i = 0; i < 6; i++) {
    const td = document.createElement("td");
    td.contentEditable = "true";
    if (i >= 2) td.inputMode = "decimal";
    td.textContent = values[i] ?? "";
    if (i === 5) td.className = "prixCalcule";
    tr.appendChild(td);
  }
  const actions = document.createElement("td");
  actions.innerHTML = '<button type="button" class="duplicate-row" aria-label="Dupliquer">📄</button> <button type="button" class="delete-row" aria-label="Supprimer">🗑️</button>';
  tr.appendChild(actions);
  tbody.appendChild(tr);
  return tr;
}
document.querySelector(".add-row").addEventListener("click", () => addRow());
tbody.addEventListener("click", e => {
  const button = e.target.closest("button");
  const row = button?.closest("tr");
  if (!row) return;
  if (button.classList.contains("delete-row")) row.remove();
  if (button.classList.contains("duplicate-row")) row.after(row.cloneNode(true));
  calculate();
});
function calculate() {
  let cents = 0;
  tbody.querySelectorAll("tr").forEach(row => {
    const amount = readNumber(row.children[3].textContent);
    const unit = readNumber(row.children[4].textContent);
    if (row.dataset.manualPrice !== "true") {
      row.children[5].textContent = amount === null || unit === null ? "" :
        (toCents((amount < 50 ? amount : amount / 100) * unit) / 100).toFixed(2);
    }
    const paid = readNumber(row.children[5].textContent);
    if (paid !== null) cents += toCents(paid);
  });
  totalPriceEl.textContent = (cents / 100).toFixed(2) + " €";
}
tbody.addEventListener("input", e => {
  const cell = e.target.closest("td");
  const row = cell?.closest("tr");
  if (!row) return;
  const index = Array.from(row.children).indexOf(cell);
  if (index === 5) row.dataset.manualPrice = cell.textContent.trim() ? "true" : "false";
  if (index === 3 || index === 4) delete row.dataset.manualPrice;
  calculate();
});
function fillForm(data) {
  const values = [data.nom, data.reference, data.largeur, data.taille, data.prixUnitaire, data.prix];
  if (!values.some(value => value != null && value !== "")) return false;
  let row = Array.from(tbody.querySelectorAll("tr")).find(row =>
    Array.from(row.children).slice(0, 6).every(cell => !cell.textContent.trim()));
  if (!row) row = addRow();
  values.forEach((value, i) => { row.children[i].textContent = value ?? ""; });
  if (data.prix || data.ocr) row.dataset.manualPrice = "true";
  if (data.ocr) {
    row.dataset.ocr = "true";
    if (data.receiptKey) row.dataset.receiptKey = data.receiptKey;
    if (data.receiptFileKey) row.dataset.receiptFileKey = data.receiptFileKey;
    row.title = "Texte du ticket :\n" + (data.source || "");
    const badge = document.createElement("span");
    badge.className = "ocr-row-note";
    badge.textContent = "À vérifier";
    badge.title = (data.warnings || []).join("\n");
    row.children[6].appendChild(badge);
  }
  calculate();
  return true;
}
async function sendToSheets() {
  const button = document.getElementById("sendToSheet");
  if (button.disabled) return;
  const reviewPanel = document.getElementById("ocrReviewPanel");
  const reviewed = document.getElementById("ocrReviewed");
  if (reviewPanel && !reviewPanel.hidden && reviewed?.checked === false) {
    document.getElementById("saveStatus").textContent = "Vérifie les articles reconnus, puis coche la confirmation avant l’envoi.";
    reviewed.focus();
    return;
  }
  const status = document.getElementById("saveStatus");
  const sheetLink = document.getElementById("openSheet");
  calculate();
  const rows = Array.from(tbody.querySelectorAll("tr"), row =>
    [0, 1, 2, 3, 5, 4].map(index => row.children[index].textContent.trim())).filter(row => row.some(Boolean));
  if (!rows.length) return alert("Ajoute au moins un article.");
  const total = totalPriceEl.textContent;
  const tenue = document.querySelector(".tenue-title").textContent.trim();
  const merge = typeof CoutureHistory !== "undefined" ? CoutureHistory.prepare(rows) : {};
  if (merge === null) return;
  const payload = { rows, total, tenue, ...merge };
  const identity = { ...payload }; delete identity.accessCode; delete identity.googleAccessToken;
  const serialized = JSON.stringify(identity);
  const requestId = submissionId(serialized);
  button.disabled = true;
  status.textContent = "Enregistrement dans Sheets…";
  sheetLink.hidden = true;
  try {
    // Refuser l'ancien serveur avant tout POST : son format ne correspond pas à rows.
    const health = await fetch(SHEETS_ENDPOINT, { method: "GET", credentials: "omit", redirect: "follow", cache: "no-store" });
    let info;
    try { info = JSON.parse(await health.text()); } catch (_) { info = null; }
    if (!health.ok || info?.version !== "scanner-sheets-2" || info?.ok !== true) {
      throw new Error("La mise à jour du script Google n’est pas encore publiée ou accessible");
    }
    const response = await fetch(SHEETS_ENDPOINT, {
      method: "POST", redirect: "follow", credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ ...payload, requestId })
    });
    const result = (await response.text()).trim();
    if (!response.ok || result !== "ok") {
      throw new Error(result.startsWith("error:") ? result.slice(6) : "Réponse serveur inattendue");
    }
    status.textContent = "Tableau enregistré dans Sheets. Tu peux encore le consulter sur le site.";
    sheetLink.hidden = false;
    if (typeof CoutureHistory !== "undefined") CoutureHistory.afterSave(rows);
    alert("Envoyé avec succès ✅");
  } catch (error) {
    status.textContent = "Enregistrement non confirmé : " + error.message + ". Vérifie la feuille avant de réessayer.";
    alert("Envoi non confirmé. Vérifie la feuille avant de réessayer pour éviter un doublon.");
    console.error(error);
  } finally { button.disabled = false; }
}

let lastSubmission;
function submissionId(serialized) {
  // Conserver le même identifiant en cas de clic répété ou de réponse réseau perdue.
  try {
    lastSubmission = JSON.parse(localStorage.getItem("couture:last-submission")) || lastSubmission;
  } catch (_) { /* Stockage privé/indisponible : conserver la mémoire de cette page. */ }
  if (!lastSubmission || lastSubmission.serialized !== serialized) {
    lastSubmission = { serialized, id: crypto.randomUUID() };
    try { localStorage.setItem("couture:last-submission", JSON.stringify(lastSubmission)); } catch (_) {}
  }
  return lastSubmission.id;
}
calculate();
