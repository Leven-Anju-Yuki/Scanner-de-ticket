const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

function harness(initial = [], options = {}) {
  const model = [
    ['Nom\nModèle existant', 'Référence', 'Largeur', 'Hauteur', 'Prix', 'Prix au m2', 'Note'],
    ['Existant', '00001', 140, 100, 2, 2, 'Note modèle à conserver'],
    ['TOTAL', '', '', '', 2, '', '']
  ];
  if (options.priceColumn === 6) for (const row of model) [row[4], row[5]] = [row[5], row[4]];
  const cells = [...model, ...initial.map(row => [...row])];
  const operations = [];
  const properties = new Map();
  let locked = false;
  let writes = 0;
  const sheet = {
    getLastRow: () => cells.length,
    getMaxRows: () => 2000, getMaxColumns: () => 26,
    getRowHeight: () => 45,
    insertRowsAfter() {}, insertColumnsAfter() {},
    autoResizeRows: (...args) => operations.push({ method: 'autoResizeRows', args }),
    setRowHeight: (...args) => operations.push({ method: 'setRowHeight', args }),
    getRange(row, col, height = 1, width = 1) {
      const range = { row, col, height, width };
      const result = {
        getDisplayValues() {
          return Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => String(cells[row + r - 1]?.[col + c - 1] ?? '')));
        },
        copyFormatToRange(target, column, columnEnd, firstRow, lastRow) {
          if (options.failFormatting) throw Error('Format indisponible');
          operations.push({ method: 'copyFormatToRange', range, args: [column, columnEnd, firstRow, lastRow] });
        },
        setValues(values) {
          writes++;
          if (options.failWriting) throw Error('Écriture interrompue');
          values.forEach((values, index) => { cells[row + index - 1] = [...values]; });
          operations.push({ method: 'setValues', range, values });
          return result;
        }
      };
      for (const method of ['setFontFamily', 'setFontSize', 'setFontColor', 'setFontWeight',
        'setBackground', 'setWrap', 'setHorizontalAlignment', 'setVerticalAlignment',
        'setBorder', 'setNumberFormat', 'merge']) {
        result[method] = (...args) => {
          if (options.failFormatting) throw Error('Format indisponible');
          operations.push({ method, range, args });
          return result;
        };
      }
      return result;
    }
  };
  const textOutput = text => ({ text, setMimeType() { return this; } });
  const context = vm.createContext({
    console: { error() {} },
    ContentService: { createTextOutput: textOutput, MimeType: { TEXT: 'text', JSON: 'json' } },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }), flush() {},
      BorderStyle: { SOLID: 'SOLID', SOLID_MEDIUM: 'SOLID_MEDIUM' } },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties.get(key),
      setProperty: (key, value) => properties.set(key, value)
    }) },
    LockService: { getScriptLock: () => ({
      waitLock() { locked = true; }, hasLock: () => locked,
      releaseLock() { locked = false; }
    }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_, text) => crypto.createHash('sha256').update(text).digest(),
      base64Encode: bytes => Buffer.from(bytes).toString('base64')
    }
  });
  for (const file of ['Code.gs', 'Formatting.gs']) {
    vm.runInContext(fs.readFileSync('google-apps-script/' + file, 'utf8'), context);
  }
  return { context, sheet, cells, operations, properties, writes: () => writes,
    post: data => context.doPost({ postData: { contents: JSON.stringify(data) } }).text };
}

const sample = {
  tenue: 'TEST — Kimono poisson',
  rows: [['Tissu', '00123', '140', '150', '8.99', '5.99'],
         ['Boutons', 'BTN-5', '', '5', '10.00', '2.00']],
  total: '18.99 €', requestId: 'test-receipt-00000001'
};

function runTests() {
  const original = [['Ancien tableau', '', '', '', '', '', 'Note à conserver']];
  const h = harness(original);
  assert.equal(h.post(sample), 'ok');
  assert.equal(h.cells[3][6], 'Note à conserver');
  assert.equal(h.cells[1][6], 'Note modèle à conserver');
  assert.equal(h.cells[4], undefined);
  assert.equal(h.cells[5], undefined);
  assert.deepEqual(h.cells[7], ['Tissu', '00123', 140, 150, 8.99, 5.99, '']);
  assert.deepEqual(h.cells[9], ['TOTAL DE LA TENUE', '', '', '', 18.99, '', '']);
  const copies = h.operations.filter(op => op.method === 'copyFormatToRange');
  assert.equal(copies.length, 3);
  assert.deepEqual(copies.map(op => op.range.row), [1, 2, 3]);
  assert.ok(copies.every(op => op.args[2] > 4));
  const count = h.operations.length;
  h.cells[7][6] = 'Note après couture';
  assert.equal(h.post(sample), 'ok');
  assert.equal(h.operations.length, count);
  assert.equal(h.cells[7][6], 'Note après couture');
  assert.ok(h.post({ ...sample, total: '1.00' }).startsWith('error:'));
  assert.equal(h.writes(), 1);
  assert.ok(h.post({ ...sample, tenue: 'Autre', total: '18.99' }).startsWith('error:'));
  assert.equal(h.writes(), 1);
  assert.equal(JSON.parse(h.context.doGet().text).version, 'scanner-sheets-2');
  assert.equal(JSON.parse(h.context.doGet().text).formatting, 'existing-template');
  assert.ok(h.context.doPost().text.startsWith('error:'));
  assert.ok(h.post({ ...sample, requestId: 'a'.repeat(16), rows: [['erreur']] }).startsWith('error:'));
  const second = { ...sample, requestId: 'test-receipt-00000002', tenue: 'Deuxième tenue' };
  assert.equal(h.post(second), 'ok');
  assert.equal(h.cells[10], undefined);
  assert.equal(h.cells[11], undefined);
  assert.equal(h.cells[12][0], 'Nom\nDeuxième tenue');
  const failing = harness([], { failWriting: true });
  assert.ok(failing.post(sample).startsWith('error:'));
  assert.ok(failing.post(sample).includes('précédent commencé'));
  assert.equal(failing.writes(), 1);
  const badTotal = harness();
  assert.ok(badTotal.post({ ...sample, total: '0' }).startsWith('error:'));
  assert.equal(badTotal.writes(), 0);
  const formula = harness();
  const rows = sample.rows.map(row => [...row]);
  rows[0][0] = '=IMPORTXML("x")';
  assert.equal(formula.post({ ...sample, rows }), 'ok');
  assert.equal(formula.cells[6][0][0], "'");
  assert.equal(formula.cells[6][1], '00123');
  const swapped = harness([], { priceColumn: 6 });
  assert.equal(swapped.post(sample), 'ok');
  assert.equal(swapped.cells[6][4], 5.99);
  assert.equal(swapped.cells[6][5], 8.99);
  assert.equal(swapped.cells[8][5], 18.99);
  const noTemplate = harness();
  noTemplate.cells[0][0] = 'Pas de modèle';
  assert.ok(noTemplate.post(sample).includes('modèle introuvable'));
  assert.equal(noTemplate.writes(), 0);
  const formatFailure = harness([], { failFormatting: true });
  assert.ok(formatFailure.post(sample).startsWith('error:'));
  assert.ok(formatFailure.post(sample).includes('précédent commencé'));
  assert.equal(formatFailure.writes(), 1);
  console.log('OK : styles copiés du modèle, ordre E/F détecté, notes conservées, totaux, doublons et pannes.');
}
if (require.main === module) runTests();
module.exports = { harness, sample };
