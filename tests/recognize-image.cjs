const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createWorker } = require('tesseract.js');
async function main() {
  const cache = path.resolve('.ocr-cache');
  fs.mkdirSync(cache, { recursive: true });
  const worker = await createWorker('fra', 1, { cachePath: cache });
  try {
    const { data } = await worker.recognize('tests/fixtures/ticket-demo.png');
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync('assets/js/parser.js', 'utf8'), context);
    const receipt = context.parseReceipt(data.text, data.confidence);
    console.log(JSON.stringify({ confidence: data.confidence, text: data.text,
      articles: receipt.articles.map(a => ({ nom: a.nom, reference: a.reference, largeur: a.largeur,
        taille: a.taille, prixUnitaire: a.prixUnitaire, prix: a.prix })) }, null, 2));
    assert.equal(receipt.articles.length, 2);
    assert.equal(receipt.articles[0].taille, '150');
    assert.equal(receipt.articles[0].prix, '8.99');
    assert.equal(receipt.articles[1].taille, '5');
    assert.equal(receipt.articles[1].prix, '10');
    console.log('OK : image PNG → moteur Tesseract réel → deux articles prêts à corriger.');
  } finally { await worker.terminate(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
