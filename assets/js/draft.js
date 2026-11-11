var CoutureDraft = (function () {
  const key = "couture:draft:v1", title = document.querySelector(".tenue-title");
  function save() {
    try {
      const rows = Array.from(tbody.querySelectorAll("tr"), row => ({
        values: Array.from(row.children).slice(0, 6).map(cell => cell.textContent),
        manual: row.dataset.manualPrice === "true"
      }));
      localStorage.setItem(key, JSON.stringify({ title: title.textContent, rows,
        review: !document.getElementById("ocrReviewPanel").hidden }));
      return true;
    } catch (_) { return false; }
  }
  try {
    const draft = JSON.parse(localStorage.getItem(key));
    if (draft && Array.isArray(draft.rows) && draft.rows.length <= 500 &&
      draft.rows.every(row => Array.isArray(row.values) && row.values.length === 6 && row.values.every(v => typeof v === "string"))) {
      tbody.replaceChildren();
      draft.rows.forEach(item => { const row = addRow(item.values); if (item.manual) row.dataset.manualPrice = "true"; });
      if (!draft.rows.length) addRow();
      if (typeof draft.title === "string") title.textContent = draft.title;
      if (draft.review) { document.getElementById("ocrReviewPanel").hidden = false; document.getElementById("ocrReviewed").checked = false; }
      calculate();
    }
  } catch (_) {}
  document.addEventListener("input", save);
  new MutationObserver(save).observe(tbody, { childList: true, subtree: true, characterData: true });
  window.addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  for (const row of tbody.querySelectorAll("tr")) for (let i = 2; i < 6; i++) row.children[i].inputMode = "decimal";
  return { save };
})();
