var CoutureHistory = (function () {
  const byId = id => document.getElementById(id);
  let outfits = [], selected = null, choices = new Map(), lastSaved = "";
  const canonicalRows = () => Array.from(document.querySelectorAll("#ticketTable tbody tr"), tr =>
    [0, 1, 2, 3, 5, 4].map(i => tr.children[i].textContent.trim())).filter(row => row.some(Boolean));
  const node = (tag, text) => { const el = document.createElement(tag); if (text != null) el.textContent = text; return el; };
  let googleToken = "", expiresAt = 0, tokenClient = null, sessionVersion = 0;
  const token = () => Date.now() < expiresAt ? googleToken : "";
  async function api(payload) {
    const res = await fetch(SHEETS_ENDPOINT, { method: "POST", credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify({ ...payload, googleAccessToken: token() }) });
    const text = await res.text();
    if (!res.ok || text.startsWith("error:")) throw Error(text.replace(/^error:/, ""));
    return JSON.parse(text);
  }
  async function connect() {
    const version = sessionVersion;
    byId("historyStatus").textContent = "Chargement de tes tableaux…";
    try {
      const result = await api({ action: "history" });
      if (version !== sessionVersion || !token()) return;
      outfits = result.outfits;
      byId("historyDisconnect").hidden = false;
      if (selected) selected = outfits.find(o => o.id === selected.id) || null;
      byId("historyStatus").textContent = outfits.length + " tableaux disponibles. Saisis le nom de la tenue pour chercher.";
      renderMatches(); refresh();
    } catch (error) { if (version === sessionVersion) byId("historyStatus").textContent = "Historique indisponible : " + error.message; }
  }
  function renderMatches() {
    const name = document.querySelector(".tenue-title").textContent.replace(/^✂️\s*/, "").trim();
    const target = byId("historyMatches"); target.replaceChildren();
    if (!name || name === "Nom de la tenue") return;
    outfits.map(o => ({ outfit: o, score: Couture.nameScore(name, o.name) })).filter(o => o.score >= 0.55)
      .sort((a, b) => b.score - a.score).slice(0, 5).forEach(({ outfit }) => {
        const button = node("button", "Voir « " + outfit.name + " »"); button.type = "button";
        button.addEventListener("click", () => { selected = outfit; choices.clear(); refresh(); });
        target.appendChild(button);
      });
  }
  function refresh() {
    const container = byId("historyExisting");
    const previousScroll = container.querySelector(".table-scroll");
    const scrollLeft = previousScroll?.scrollLeft || 0, scrollTop = previousScroll?.scrollTop || 0;
    container.replaceChildren();
    const decisions = byId("historyDecisions"); decisions.replaceChildren();
    container.hidden = !selected;
    byId("comparisonLayout").classList.toggle("has-existing", Boolean(selected));
    if (!selected) return;
    container.appendChild(node("h3", "Déjà dans Sheets : " + selected.name));
    const caption = node("p", "Lecture seule · Compare avec la nouvelle saisie à droite. Les lignes repérées ont un doublon possible.");
    caption.className = "pane-caption"; container.appendChild(caption);
    const cancel = node("button", "Créer plutôt un nouveau tableau"); cancel.type = "button";
    cancel.addEventListener("click", () => { selected = null; choices.clear(); refresh(); });
    const scroll = node("div"); scroll.className = "table-scroll";
    const table = node("table"); table.className = "tenue-table";
    const head = node("tr");
    ["Nom", "Référence", "Largeur (cm)", "Longueur / quantité", "Tarif", "Prix payé", "Note"].forEach(t => head.appendChild(node("th", t)));
    table.appendChild(head);
    const rows = canonicalRows();
    const matchedRows = new Set(rows.flatMap(row => Couture.duplicates(row, selected.rows).map(item => item.row)));
    selected.rows.forEach(item => {
      const tr = node("tr");
      if (matchedRows.has(item.row)) tr.className = "existing-match";
      const values = item.values;
      [values[0], values[1], values[2], values[3], values[5], values[4], item.note].forEach(text => tr.appendChild(node("td", text)));
      table.appendChild(tr);
    });
    scroll.appendChild(table); container.appendChild(scroll); container.appendChild(cancel);
    scroll.scrollLeft = scrollLeft; scroll.scrollTop = scrollTop;
    let fresh = 0;
    rows.forEach((row, index) => {
      const candidates = Couture.duplicates(row, selected.rows);
      if (!candidates.length) { fresh++; return; }
      const key = JSON.stringify([index, row]);
      const label = node("label", "Doublon possible : " + row[0] + " (" + row[1] + ") — ");
      const select = node("select"); select.setAttribute("aria-label", "Choix pour le doublon " + (index + 1));
      const options = [["", "Choisir…"], ["skip", "Garder l’existant, ignorer cet article"], ["add", "Ajouter une ligne séparée"]];
      candidates.forEach(item => options.push(["sum:" + item.row, "Cumuler avec la ligne " + item.row + " (même tarif)"]));
      for (const [value, text] of options) { const option = node("option", text); option.value = value; select.appendChild(option); }
      select.value = choices.get(key) || "";
      select.addEventListener("change", () => choices.set(key, select.value));
      label.appendChild(select); decisions.appendChild(label);
    });
    decisions.prepend(node("h4", "Choisir les articles à ajouter"));
    decisions.appendChild(node("p", fresh + " article(s) nouveau(x) seront ajoutés. Les doublons attendent ton choix. Les notes existantes sont conservées."));
  }
  function prepare(rows) {
    if (!selected) return {};
    if (!token()) { byId("saveStatus").textContent = "Reconnecte-toi avec Google avant d’ajouter à cette tenue."; return null; }
    const signature = JSON.stringify([selected.id, rows]);
    if (signature === lastSaved) { byId("saveStatus").textContent = "Ces articles ont déjà été envoyés. Modifie la saisie pour un nouvel ajout."; return null; }
    const decisions = [];
    for (let i = 0; i < rows.length; i++) {
      const candidates = Couture.duplicates(rows[i], selected.rows);
      if (!candidates.length) { decisions.push({ action: "add" }); continue; }
      const value = choices.get(JSON.stringify([i, rows[i]]));
      if (!value) { refresh(); byId("saveStatus").textContent = "Choisis le traitement de chaque doublon avant l’envoi."; return null; }
      const [action, row] = value.split(":");
      if (action === "sum") {
        const existing = candidates.find(c => c.row === Number(row));
        try { Couture.sum(existing.values, rows[i]); } catch (error) { byId("saveStatus").textContent = error.message; return null; }
      }
      decisions.push({ action, row: row ? Number(row) : undefined });
    }
    return { action: "merge", targetId: selected.id, targetVersion: selected.version, decisions, googleAccessToken: token() };
  }
  function afterSave(rows) {
    if (selected) { lastSaved = JSON.stringify([selected.id, rows]); choices.clear(); connect(); }
    else if (outfits.length) connect();
  }
  async function initGoogle() {
    try {
      const response = await fetch(SHEETS_ENDPOINT, { credentials: "omit", cache: "no-store" });
      if (!response.ok) throw Error("Service de connexion indisponible.");
      const config = await response.json();
      if (config.history !== "google-oauth" || !/^[\w-]+\.apps\.googleusercontent\.com$/.test(config.googleClientId || ""))
        throw Error("La connexion Google attend sa configuration côté serveur.");
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: config.googleClientId, scope: "openid email", include_granted_scopes: false,
        callback: result => {
          if (result.error || !result.access_token) { byId("historyStatus").textContent = "Connexion Google refusée. Réessaie pour consulter tes tableaux."; return; }
          sessionVersion++;
          outfits = []; selected = null; choices.clear(); renderMatches(); refresh();
          googleToken = result.access_token;
          expiresAt = Date.now() + Math.max(0, Number(result.expires_in || 0) - 30) * 1000;
          connect();
        },
        error_callback: () => { byId("historyStatus").textContent = "Connexion annulée ou fenêtre bloquée. Réessaie avec le bouton Google."; }
      });
      byId("historyConnect").disabled = false;
      byId("historyStatus").textContent = "Connecte-toi pour rechercher tes anciennes tenues.";
    } catch (error) { byId("historyStatus").textContent = error.message; }
  }
  function disconnect() {
    sessionVersion++;
    googleToken = ""; expiresAt = 0; outfits = []; selected = null; choices.clear(); lastSaved = "";
    renderMatches(); refresh();
    byId("historyDisconnect").hidden = true;
    byId("historyStatus").textContent = "Déconnecté. Tes tableaux ont été masqués.";
  }
  byId("historyConnect").addEventListener("click", () => { if (tokenClient) tokenClient.requestAccessToken({ prompt: "select_account" }); });
  byId("historyDisconnect").addEventListener("click", disconnect);
  document.querySelector(".tenue-title").addEventListener("input", renderMatches);
  document.querySelector("#ticketTable tbody").addEventListener("input", refresh);
  document.querySelector("#ticketTable tbody").addEventListener("click", refresh);
  document.querySelector(".add-row").addEventListener("click", refresh);
  try { localStorage.removeItem("couture:history-code"); } catch (_) {}
  return { prepare, refresh, afterSave, initGoogle };
})();
