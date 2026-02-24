function parseTicket(text) {
  return {
    reference: text.match(/\b\d{5,6}\b/)?.[0] || "",
    largeur: text.match(/(\d{2,3})\s?cm/i)?.[1] || "",
    prix: text.match(/(\d+[,.]\d{2})\s?€/i)?.[1]?.replace(",", ".") || "",
    taille: text.match(/(\d{2,4})\s?cm/i)?.[1] || ""
  };
}
