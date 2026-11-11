const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.dataset = {}; this.events = {};
    this.textContent = ''; this.disabled = false; this.hidden = false; this.checked = false; this.value = '';
  }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  addEventListener(event, fn) { this.events[event] = fn; }
  querySelectorAll(selector) { return selector === 'tr' ? this.children : []; }
  focus() { this.focused = true; }
}
async function main() {
  const tbody = new Element('tbody');
  const table = { querySelector: () => tbody };
  const elements = {};
  for (const id of ['totalPrice', 'sendToSheet', 'saveStatus', 'openSheet', 'ticketInput',
    'ticketPreview', 'ocrDebug', 'ocrResult', 'ocrWarnings', 'ocrText', 'ocrReviewPanel', 'ocrReviewed']) {
    elements[id] = new Element();
  }
  elements.ocrReviewPanel.hidden = true;
  let fetchCalls = 0, workerClosed = 0;
  const context = vm.createContext({
    document: {
      getElementById: id => id === 'ticketTable' ? table : elements[id],
      querySelector: () => new Element(), createElement: tag => new Element(tag)
    },
    console, alert() {}, fetch() { fetchCalls++; throw Error('Envoi réseau interdit'); }
  });
  for (const file of ['parser', 'form', 'ocr']) {
    vm.runInContext(fs.readFileSync('assets/js/' + file + '.js', 'utf8'), context);
  }
  const manual = context.addRow(['Saisie existante', 'REF', '140', '150', '5.99', '8.99']);
  manual.dataset.manualPrice = 'true';
  const count = context.importReceipt(fs.readFileSync('tests/fixtures/ticket-demo.txt', 'utf8'), 95);
  assert.equal(count, 2);
  assert.equal(tbody.children.length, 3);
  assert.equal(tbody.children[0].children[0].textContent, 'Saisie existante');
  assert.equal(tbody.children[1].children[5].textContent, '8.99');
  assert.equal(tbody.children[2].children[5].textContent, '10');
  assert.equal(elements.ocrReviewed.checked, false);
  assert.equal(elements.ocrReviewPanel.hidden, false);
  assert.equal(elements.totalPrice.textContent, '27.98 €');
  await context.sendToSheets();
  assert.equal(fetchCalls, 0);
  assert.ok(elements.saveStatus.textContent.includes('confirmation'));
  assert.equal(elements.ocrReviewed.focused, true);
  context.importReceipt('Article: Tissu sans prix\nLongueur: 150 cm\nPrix au m2: 5,99', 90);
  const last = tbody.children.at(-1);
  assert.equal(last.children[5].textContent, ''); // Ne pas inventer le prix payé.
  assert.equal(last.dataset.manualPrice, 'true');
  context.calculate();
  assert.equal(last.children[5].textContent, '');
  last.children[4].textContent = '6,00';
  // Simuler la correction d'un tarif par l'utilisateur : son calcul habituel reprend.
  const corrected = last.children[4];
  corrected.closest = selector => selector === 'tr' ? last : corrected;
  tbody.events.input({ target: corrected });
  assert.equal(last.children[5].textContent, '9.00');

  // Une photo déclenche uniquement l'OCR, jamais l'envoi Sheets.
  context.prepareTicketImage = async () => ({ canvas: true });
  context.Tesseract = { createWorker: async () => ({
    recognize: async () => ({ data: { text: 'BOUTONS 2,00\n1 x 2,00 2,00', confidence: 90 } }),
    terminate: async () => { workerClosed++; }
  }) };
  elements.ocrReviewed.checked = true;
  await elements.ticketInput.events.change({ target: { files: [{ type: 'image/png', size: 1000 }] } });
  assert.equal(elements.ocrReviewed.checked, false);
  assert.equal(workerClosed, 1);
  assert.equal(fetchCalls, 0);
  assert.equal(elements.ticketInput.disabled, false);
  assert.equal(elements.sendToSheet.disabled, false);
  const rowCount = tbody.children.length;
  context.Tesseract.createWorker = async () => ({
    recognize: async () => { throw Error('Photo floue'); },
    terminate: async () => { workerClosed++; }
  });
  await elements.ticketInput.events.change({ target: { files: [{ type: 'image/png', size: 1000 }] } });
  assert.equal(tbody.children.length, rowCount);
  assert.equal(workerClosed, 2);
  assert.ok(elements.ocrDebug.textContent.includes('Photo floue'));
  assert.equal(elements.sendToSheet.disabled, false);
  await elements.ticketInput.events.change({ target: { files: [{ type: 'application/pdf', size: 1000 }] } });
  assert.equal(tbody.children.length, rowCount);
  assert.equal(fetchCalls, 0);
  console.log('OK : import sans écrasement, prix payé conservé, correction possible, vérification obligatoire et aucun envoi automatique.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
