/**************************************************
 * RÉFÉRENCES DOM
 **************************************************/
const table = document.getElementById("ticketTable");
const tbody = table.querySelector("tbody");
const addRowBtn = document.querySelector(".add-row");
const totalPriceEl = document.getElementById("totalPrice");

/**************************************************
 * AJOUT D’UNE LIGNE
 **************************************************/
addRowBtn.addEventListener("click", () => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
    <td contenteditable="true"></td>
    <td contenteditable="true"></td>
    <td contenteditable="true"></td>
    <td contenteditable="true"></td>
    <td contenteditable="true" class="prixCalcule">0.00 €</td>
    <td contenteditable="true"></td>
    <td>
      <button class="duplicate-row">📄</button>
      <button class="delete-row">🗑️</button>
    </td>
  `;

    tbody.appendChild(tr);
});

/**************************************************
 * SUPPRESSION & DUPLICATION (EVENT DELEGATION)
 **************************************************/
tbody.addEventListener("click", (e) => {
    const row = e.target.closest("tr");
    if (!row) return;

    // 🗑️ supprimer
    if (e.target.classList.contains("delete-row")) {
        row.remove();
        calculate();
    }

    // 📄 dupliquer
    if (e.target.classList.contains("duplicate-row")) {
        const clone = row.cloneNode(true);
        clone.querySelector(".prixCalcule").textContent = "0.00 €";
        row.after(clone);
        calculate();
    }
});

/**************************************************
 * ENVOI DES DONNÉES À GOOGLE SHEETS
 **************************************************/
function sendToGoogleSheets(rowData) {
    fetch(
        "https://script.google.com/macros/s/AKfycbxqwIB0_qFuaRil5e-uKEgXm64aZultHO9uqHKL1o5bISsfo9sKDe8DV39dno68hMnEkg/exec",
        {
            method: "POST",
            body: JSON.stringify(rowData),
        },
    )
        .then((res) => res.json())
        .then((data) => console.log("Envoyé :", data))
        .catch((err) => console.error("Erreur :", err));
}

/**************************************************
 * CALCUL DES PRIX
 * règle :
 * - largeur ignorée
 * - si prix au m² → (cm / 100) × prixM2
 * - sinon → quantité × prix
 **************************************************/
function calculate() {
    let total = 0;

    tbody.querySelectorAll("tr").forEach((tr) => {
        const height = parseFloat(tr.children[3].textContent.replace(",", ".")) || 0;
        const price = parseFloat(tr.children[4].textContent.replace(",", ".")) || 0;
        const priceM2 = parseFloat(tr.children[5].textContent.replace(",", ".")) || 0;

        let lineTotal = 0;

        if (priceM2 > 0) {
            lineTotal = (height / 100) * priceM2;
        } else {
            lineTotal = height * price;
        }

        tr.children[4].textContent = lineTotal.toFixed(2) + " €";
        total += lineTotal;
    });

    totalPriceEl.textContent = total.toFixed(2) + " €";
}
/**************************************************
 * SAUVEGARDE DES DONNÉES
**************************************************/
document.getElementById("sendToSheet").addEventListener("click", () => {

    const allRows = [];

    tbody.querySelectorAll("tr").forEach((tr) => {

        const rowData = [
            tr.children[0].textContent.trim(), // Nom
            tr.children[1].textContent.trim(), // Référence
            tr.children[2].textContent.trim(), // Largeur
            tr.children[3].textContent.trim(), // Hauteur
            tr.children[4].textContent.trim(), // Prix
            tr.children[5].textContent.trim(), // Prix m2
            totalPriceEl.textContent          // Total général
        ];

        allRows.push(rowData);
    });

    fetch("TON_URL_APPS_SCRIPT", {
        method: "POST",
        body: JSON.stringify(allRows),
    })
    .then(res => res.json())
    .then(data => {
        console.log("Envoyé proprement :", data);
        alert("Données envoyées avec succès ✅");
    })
    .catch(err => console.error(err));

});
/**************************************************
 * RECALCUL AUTOMATIQUE À LA SAISIE
 **************************************************/
tbody.addEventListener("input", calculate);
