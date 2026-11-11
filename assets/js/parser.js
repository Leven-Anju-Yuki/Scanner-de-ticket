// Analyse locale prudente : aucune requête réseau, aucune valeur manquante inventée.
function parseReceipt(text, confidence = 100) {
  const lines = String(text || "").replace(/\u00a0/g, " ").replace(/[×✕]/g, "x")
    .split(/\r?\n/).map(line => line.trim().replace(/\s+/g, " ")).filter(Boolean);
  if (lines.some(line => /^(?:[*+•]\s*)?\d{5,8}\s*\//.test(line))) return parseStructuredReceipt(lines, confidence);
  const moneyEnd = /(?:^|\s)(\d+[,.]\d{2})\s*(?:€|EUR)?\s*[A-D]?$/i;
  const excluded = /^(?:sous[- ]?total\b|total\b(?!\s+article)|(?:net|reste|montant)\s+[àa]\s+payer|[àa]\s+payer|tva\b|ht\b|ttc\b|rendu\b|esp[eè]ces\b|carte\b|cb\b|visa\b|mastercard\b|paiement\b|merci\b|siret\b|t[eé]l\b|ticket\b|caisse\b|facture\b|adresse\b|\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}\b)/i;
  const detail = /^(?:r[eé]f(?:[eé]rence)?\b|laize\b|largeur\b|larg\.|longueur\b|hauteur\b|coupe\b|(?:quantit[eé]|qt[eé]|qty)(?=\s|[:.=]|$)|p\.?u\.?(?:\s|[:=])|prix\b|montant\s+article\b|total\s+article\b|remise\b|promo\b|rabais\b|\d+(?:[.,]\d+)?\s*(?:cm|m|u|pcs?)?\s*[xX*@à])/i;
  const referenceLine = /^r[eé]f(?:[eé]rence)?[\s:.#=-]*([\w-]+)/i;
  const explicitName = /^(?:article|produit|d[eé]signation|libell[eé])\s*:\s*(.+)/i;
  const blocks = [];
  const ignored = [];
  let current = null;
  let pendingName = "";
  function start(name) {
    if (current) blocks.push(current);
    current = { name: name || "", lines: [] };
    pendingName = "";
  }
  function cleanName(value) {
    return value.replace(moneyEnd, "").replace(/\b(?:r[eé]f(?:[eé]rence)?|laize|largeur|longueur|quantit[eé])\s*[:=].*$/i, "")
      .replace(/\s+\d+(?:[.,]\d+)?\s*(?:cm|m|u|pcs?)?\s*[xX*@à]\s*\d+[.,]\d{2}.*$/, "").trim();
  }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (excluded.test(line)) {
      if (current) { blocks.push(current); current = null; }
      pendingName = "";
      ignored.push(line);
      continue;
    }
    const named = line.match(explicitName);
    const sku = line.match(/^(\d{5,13}|[A-Z]{1,5}-[\w-]+)\s+([A-Za-zÀ-ÿ].*)$/);
    const pricedName = !detail.test(line) && moneyEnd.test(line) &&
      /[A-Za-zÀ-ÿ]/.test(line.replace(moneyEnd, ""));
    if (named || pricedName || (sku && detail.test(lines[index + 1] || ""))) {
      const name = cleanName(named ? named[1] : sku ? sku[2] : line);
      if (current && !current.name && current.lines.every(previous => referenceLine.test(previous))) {
        current.name = name;
      } else start(name);
      if (sku) current.lines.push("Réf: " + sku[1]);
      current.lines.push(line);
    } else if (detail.test(line)) {
      const ref = line.match(referenceLine);
      if (ref && current && current.lines.some(previous => referenceLine.test(previous))) start(pendingName);
      if (!current) start(pendingName);
      current.lines.push(line);
    } else if (current && /^\d+[,.]\d{2}\s*(?:€|EUR)?$/.test(line)) {
      current.lines.push(line);
    } else if (/^\d+(?:[.,]\d+)?\s*(?:cm|m|kg|g)$/i.test(line)) {
      ignored.push(line); // Une mesure sans libellé ne permet pas de distinguer largeur et longueur.
    } else if (/[A-Za-zÀ-ÿ]/.test(line) && line.length > 2) {
      if (current && !current.name && current.lines.every(previous => referenceLine.test(previous))) {
        current.name = line;
        current.lines.push(line);
      } else {
        if (current) { blocks.push(current); current = null; }
        pendingName = line;
      }
    } else {
      ignored.push(line);
    }
  }
  if (current) blocks.push(current);

  const number = value => Number(value.replace(",", "."));
  const centimetres = (value, unit) => String(Number((number(value) * (unit.toLowerCase() === "m" ? 100 : 1)).toFixed(4)));
  const articles = blocks.map(block => {
    const source = block.lines.join("\n");
    const warnings = [];
    function unique(values, label) {
      const distinct = [...new Set(values)];
      if (distinct.length > 1) warnings.push(label + " : plusieurs valeurs, cellule laissée vide.");
      return distinct.length === 1 ? distinct[0] : "";
    }
    const refs = [...source.matchAll(/\br[eé]f(?:[eé]rence)?[\s:.#=-]*([A-Z0-9-]+)/gi)].map(m => m[1]);
    const width = [...source.matchAll(/\b(?:largeur|laize|larg\.)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(cm|m)\b/gi)]
      .map(m => centimetres(m[1], m[2]));
    const length = [...source.matchAll(/\b(?:longueur|hauteur|coupe)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(cm|m)\b/gi)]
      .map(m => centimetres(m[1], m[2]));
    const quantity = [...source.matchAll(/\b(?:quantit[eé]|qt[eé]|qty)\.?\s*[:=]?\s*(\d+(?:[.,]\d+)?)/gi)].map(m => String(number(m[1])));
    const rates = [...source.matchAll(/(?:\bprix\s+unitaire|\bp\.?u\.?|\bprix\s*(?:au|\/)\s*m[²2]?)\s*[:=]?\s*(\d+(?:[.,]\d{2}))/gi)].map(m => String(number(m[1])));
    for (const m of source.matchAll(/(\d+[,.]\d{2})\s*(?:€|EUR)?\s*\/\s*(?:m[²2]?|unit[eé]|u)(?=\s|$|[.,;:])/gi)) rates.push(String(number(m[1])));
    const explicitPaid = [...source.matchAll(/(?:prix\s+pay[eé]|montant\s+article|prix\s+total|total\s+article)\s*[:=]?\s*(\d+[.,]\d{2})/gi)].map(m => String(number(m[1])));
    const paid = [...explicitPaid];
    let metres = length.length > 0;
    for (const line of block.lines) {
      const multiply = line.match(/(\d+(?:[.,]\d+)?)\s*(cm|m|unit[eé]s?|u|pcs?|pi[eè]ces?)?\s*[xX*@à]\s*(\d+[.,]\d{2})\s*(?:€|EUR)?/i);
      if (multiply) {
        rates.push(String(number(multiply[3])));
        const amount = number(multiply[1]);
        const unit = (multiply[2] || "").toLowerCase();
        if (unit === "m" || unit === "cm") {
          length.push(centimetres(multiply[1], unit));
          metres = true;
        } else if (Number.isInteger(amount) || unit) {
          quantity.push(String(amount));
        } else {
          warnings.push("Longueur ou quantité sans unité : à renseigner.");
        }
        const remainder = line.slice(multiply.index + multiply[0].length);
        const final = remainder.match(moneyEnd);
        if (final) paid.push(String(number(final[1])));
      } else if (!detail.test(line) || /^\d+[,.]\d{2}\s*(?:€|EUR)?$/.test(line)) {
        const final = line.match(moneyEnd);
        if (final) paid.push(String(number(final[1])));
      }
    }
    let taille = unique(length.length ? length : quantity, "Longueur / quantité");
    if (length.length && quantity.length) {
      taille = "";
      warnings.push("Longueur et quantité indiquées ensemble : vérifier la valeur à utiliser.");
    }
    let prix = unique(explicitPaid.length ? explicitPaid : paid, "Prix payé");
    if (/\b(?:remise|promo|rabais)\b/i.test(source) && !explicitPaid.length) {
      prix = "";
      warnings.push("Remise détectée : le prix réellement payé doit être vérifié.");
    }
    const article = {
      nom: block.name, reference: unique(refs, "Référence"), largeur: unique(width, "Largeur"),
      taille, prixUnitaire: unique(rates, "Tarif"), prix, warnings, source, ocr: true
    };
    if (!article.nom) warnings.push("Nom non reconnu.");
    if (!article.reference) warnings.push("Référence non reconnue.");
    if (!article.taille) warnings.push("Longueur / quantité non reconnue.");
    if (!article.prixUnitaire) warnings.push("Tarif non reconnu.");
    if (!article.prix) warnings.push("Prix payé non reconnu.");
    if (metres && taille && Number(taille) < 50) warnings.push("Tissu de moins de 50 cm : conserver le prix payé, le calcul habituel traite cette valeur comme une quantité.");
    if (!metres && taille && Number(taille) >= 50) warnings.push("Quantité de 50 ou plus : conserver le prix payé, le calcul habituel traite cette valeur comme des centimètres.");
    if (taille && article.prixUnitaire && prix) {
      const expected = (Number(taille) < 50 ? Number(taille) : Number(taille) / 100) * Number(article.prixUnitaire);
      if (Math.abs(expected - Number(prix)) > 0.02) warnings.push("Le prix payé diffère du calcul : vérifier remise, quantité et tarif.");
    }
    if (Number.isFinite(confidence) && confidence < 70) warnings.push("Lecture photo peu fiable : vérifier toutes les cellules.");
    return article;
  }).filter(article => [article.nom, article.reference, article.largeur, article.taille, article.prixUnitaire, article.prix].some(Boolean));
  const warnings = ["Toutes les propositions restent à vérifier avec le ticket."];
  if (!articles.length) warnings.push("Aucun article suffisamment identifiable : saisie manuelle nécessaire.");
  const totals = lines.filter(line => /^(?:total\b(?!\s+article)|net\s+[àa]\s+payer)/i.test(line))
    .map(line => line.match(moneyEnd)).filter(Boolean).map(m => number(m[1]));
  if (articles.length && articles.every(a => a.prix) && totals.length === 1) {
    const sum = articles.reduce((n, a) => n + Math.round(Number(a.prix) * 100), 0) / 100;
    if (Math.abs(sum - totals[0]) > 0.02) warnings.push("Le total des articles reconnus diffère du total du ticket : article manquant, remise ou erreur de lecture possible.");
  }
  return { articles, warnings, ignoredLines: ignored, text: String(text || "") };
}

function parseStructuredReceipt(lines, confidence) {
  const groups = [];
  let group = null;
  const footer = [];
  let finished = false;
  for (const line of lines) {
    if (/^(?:\d+\s+article|total\b|taux\b|carte\b)/i.test(line)) finished = true;
    const starts = /^(?:[*+•]\s*|(?=\d{5,8}\s*\/))/.test(line);
    if (!finished && starts) {
      if (group) groups.push(group);
      group = [line.replace(/^[*+•]\s*/, "")];
    } else if (!finished && group) group.push(line);
    else if (finished) footer.push(line);
  }
  if (group) groups.push(group);
  const articles = groups.map(parts => {
    const header = parts[0];
    const source = parts.join("\n");
    const ref = header.match(/^(\d{5,8})\s*\/\s*/);
    const name = header.replace(/^\d{5,8}\s*\/\s*/, "").replace(/\s+(?:L\d{2,3}|L[I1]\d{2}|\d+MM|\d+PES|\d+GR\/M2|HORS\b).*$/i, "").trim();
    const width = header.match(/\bL(\d{2,3})\b/i);
    const millimetres = header.match(/\b(\d+(?:[,.]\d+)?)\s*MM\b/i);
    const rest = parts.slice(1).join(" ");
    const multiplication = rest.match(/(\d+(?:[.,]\d+)?)\s*(cm|mm|m|n)?\s*x\s*=?\s*/i);
    const warnings = [];
    let taille = "", tarif = "", paid = "";
    if (multiplication) {
      const amount = Number(multiplication[1].replace(",", "."));
      const unit = (multiplication[2] || "").toLowerCase();
      if (unit === "n") warnings.push("Unité m lue comme n : vérifier la longueur.");
      taille = String(Number((amount * (unit === "m" || unit === "n" ? 100 : unit === "mm" ? 0.1 : 1)).toFixed(4)));
      const prices = rest.slice(multiplication.index + multiplication[0].length).match(/\d+[,.]\d{2}(?!\d)/g) || [];
      if (prices.length === 2) {
        tarif = String(Number(prices[0].replace(",", ".")));
        paid = String(Number(prices[1].replace(",", ".")));
      } else warnings.push("Tarif ou prix payé incomplet : vérifier la ligne du ticket.");
    } else warnings.push("Longueur ou quantité non reconnue.");
    const secondary = rest.slice(0, multiplication?.index ?? rest.length).trim();
    const article = { nom: name, reference: ref ? ref[1] : secondary,
      largeur: width ? width[1] : millimetres ? String(Number(millimetres[1].replace(",", ".")) / 10) : "",
      taille, prixUnitaire: tarif, prix: paid, source, warnings, ocr: true };
    if (ref && secondary) warnings.push("Code secondaire conservé dans le texte lu : " + secondary);
    if (!article.largeur && /tissu|polaire|viscose|guipure|dentelle|burlington/i.test(name)) warnings.push("Largeur à vérifier sur la photo.");
    if (taille && tarif && paid) {
      const expected = (Number(taille) < 50 ? Number(taille) : Number(taille) / 100) * Number(tarif);
      if (Math.abs(expected - Number(paid)) > 0.02) warnings.push("Le tarif ne correspond pas au montant lu : vérifier les chiffres.");
    }
    if (confidence < 80) warnings.push("Lecture photo incertaine : vérifier la référence et les montants.");
    return article;
  });
  const complete = articles.every(article => article.prix !== "");
  const total = complete ? articles.reduce((sum, article) => sum + Math.round(Number(article.prix) * 100), 0) / 100 : null;
  const payment = footer.join("\n").match(/carte\s+bancaire[\s\S]*?(\d+[,.]\d{2})/i);
  const warnings = ["Vérifie les six champs de chaque article avant d’envoyer."];
  if (!complete) warnings.push("Certains prix sont illisibles : le total est incomplet.");
  if (payment && total !== null && Math.abs(total - Number(payment[1].replace(",", "."))) > 0.02) warnings.push("Le total des articles diffère du paiement indiqué sur le ticket.");
  return { articles, warnings, text: lines.join("\n"), ignoredLines: footer, total };
}

// Compatibilité avec l'ancien appel à un seul article.
function parseTicket(text) {
  const receipt = parseReceipt(text);
  return receipt.articles.length === 1 ? receipt.articles[0] :
    { nom: "", reference: "", largeur: "", taille: "", prixUnitaire: "", prix: "" };
}
