const fs = require('node:fs');
const C = require('../assets/js/history-core.js');
const input = JSON.parse(fs.readFileSync('backups/normalization-input.json', 'utf8'));
const matrix = input.rows.map(row => Array.from({ length: 7 }, (_, i) => {
  const v = row[i]?.value; return v?.stringValue ?? v?.numberValue ?? v?.formulaValue ?? '';
}));
const blocks = C.blocks(matrix);
const requests = [], conversions = [], ambiguous = [];
const range = (a, b, c = 0, d = 7) => ({ sheetId: 0, startRowIndex: a - 1, endRowIndex: b, startColumnIndex: c, endColumnIndex: d });
for (const block of blocks) {
  if (!block.end) { ambiguous.push({ cell: 'A' + block.start, original: 'Total non repéré' }); continue; }
  for (const [sourceRow, first, last] of [[2, block.start, block.start], [3, block.start + 1, block.end - 1], [28, block.end, block.end]]) {
    if (last < first || (sourceRow === first && first === last)) continue;
    requests.push({ copyPaste: { source: range(sourceRow, sourceRow), destination: range(first, last), pasteType: 'PASTE_FORMAT' } });
  }
  requests.push({ repeatCell: { range: range(block.start + 1, block.end - 1, 2, 4),
    cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0.####' } } }, fields: 'userEnteredFormat.numberFormat' } });
  for (const [column, text] of [[2, 'Largeur (cm)'], [3, 'Longueur (cm) / Quantité (unités)']]) {
    requests.push({ updateCells: { start: { sheetId: 0, rowIndex: block.start - 1, columnIndex: column },
      rows: [{ values: [{ userEnteredValue: { stringValue: text } }] }], fields: 'userEnteredValue' } });
  }
  for (const item of block.rows) for (const col of [2, 3]) {
    const cell = input.rows[item.row - 1]?.[col];
    if (!cell?.value || !('stringValue' in cell.value)) continue;
    const original = cell.value.stringValue;
    const result = C.measure(original);
    const coordinate = String.fromCharCode(65 + col) + item.row;
    let note = cell.note;
    if (result.kind === 'ambiguous') {
      ambiguous.push({ cell: coordinate, original });
      note += (note ? '\n' : '') + 'À vérifier : mesure ambiguë conservée sans modification. Valeur originale : ' + original;
      requests.push({ updateCells: { start: { sheetId: 0, rowIndex: item.row - 1, columnIndex: col },
        rows: [{ values: [{ note }] }], fields: 'note' } });
    } else if (typeof result.value === 'number') {
      note += (note ? '\n' : '') + 'Valeur originale : ' + original + '. Type : ' + (result.kind === 'quantity' ? 'quantité' : result.kind === 'length' ? 'longueur en cm' : 'valeur de la colonne');
      conversions.push({ cell: coordinate, original, value: result.value, kind: result.kind });
      requests.push({ updateCells: { start: { sheetId: 0, rowIndex: item.row - 1, columnIndex: col },
        rows: [{ values: [{ userEnteredValue: { numberValue: result.value }, note }] }], fields: 'userEnteredValue,note' } });
    }
  }
}
fs.writeFileSync('backups/normalization-plan.json', JSON.stringify({ requests, conversions, ambiguous, blocks: blocks.map(b => ({name:b.name,start:b.start,end:b.end})) }, null, 2));
console.log(JSON.stringify({ blocks: blocks.length, conversions: conversions.length, ambiguous }));
