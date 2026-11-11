// Convertit les opérations du serveur exécuté en mémoire en aperçu natif sur la copie de test.
const { harness, sample } = require('../tests/apps-script.cjs');
const h = harness();
h.post(sample);
h.post({ ...sample, tenue: 'TEST — Deuxième tenue', requestId: 'test-receipt-00000002' });
const sheetId = 773031;
const requests = [{ addSheet: { properties: { sheetId, title: 'Aperçu envoi du site',
  gridProperties: { rowCount: 50, columnCount: 7 } } } }];
const rgb = hex => ({
  red: parseInt(hex.slice(1, 3), 16) / 255,
  green: parseInt(hex.slice(3, 5), 16) / 255,
  blue: parseInt(hex.slice(5, 7), 16) / 255
});
const grid = r => ({ sheetId, startRowIndex: r.row - 1, endRowIndex: r.row + r.height - 1,
  startColumnIndex: r.col - 1, endColumnIndex: r.col + r.width - 1 });
for (const op of h.operations) {
  if (op.method === 'setValues') {
    requests.push({ updateCells: { range: grid(op.range), fields: 'userEnteredValue',
      rows: op.values.map(row => ({ values: row.map(value => ({ userEnteredValue:
        typeof value === 'number' ? { numberValue: value } : { stringValue: value } })) })) } });
    continue;
  }
  if (op.method === 'merge') {
    requests.push({ mergeCells: { range: grid(op.range), mergeType: 'MERGE_ALL' } }); continue;
  }
  if (op.method === 'autoResizeRows' || op.method === 'setRowHeight') {
    requests.push({ updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: op.args[0] - 1,
        endIndex: op.args[0] - 1 + (op.method === 'setRowHeight' ? 1 : op.args[1]) },
      properties: { pixelSize: op.method === 'setRowHeight' ? op.args[1] : 42 }, fields: 'pixelSize'
    } }); continue;
  }
  if (op.method === 'setBorder') {
    const borders = { range: grid(op.range) };
    ['top', 'left', 'bottom', 'right', 'innerVertical', 'innerHorizontal'].forEach((side, i) => {
      if (op.args[i] !== null) borders[side] = { style: op.args[i] ? op.args[7] : 'NONE', color: rgb(op.args[6]) };
    });
    requests.push({ updateBorders: borders }); continue;
  }
  const value = op.args[0];
  let format, fields;
  switch (op.method) {
    case 'setFontFamily': format = { textFormat: { fontFamily: value } }; fields = 'textFormat.fontFamily'; break;
    case 'setFontSize': format = { textFormat: { fontSize: value } }; fields = 'textFormat.fontSize'; break;
    case 'setFontColor': format = { textFormat: { foregroundColor: rgb(value) } }; fields = 'textFormat.foregroundColor'; break;
    case 'setFontWeight': format = { textFormat: { bold: value === 'bold' } }; fields = 'textFormat.bold'; break;
    case 'setBackground': format = { backgroundColor: rgb(value) }; fields = 'backgroundColor'; break;
    case 'setWrap': format = { wrapStrategy: 'WRAP' }; fields = 'wrapStrategy'; break;
    case 'setHorizontalAlignment': format = { horizontalAlignment: value.toUpperCase() }; fields = 'horizontalAlignment'; break;
    case 'setVerticalAlignment': format = { verticalAlignment: value.toUpperCase() }; fields = 'verticalAlignment'; break;
    case 'setNumberFormat': format = { numberFormat: { type: 'NUMBER', pattern: value } }; fields = 'numberFormat'; break;
    default: throw Error(op.method);
  }
  requests.push({ repeatCell: { range: grid(op.range), cell: { userEnteredFormat: format }, fields: 'userEnteredFormat.' + fields } });
}
[180, 120, 115, 145, 150, 110, 200].forEach((pixelSize, i) => requests.push({
  updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
    properties: { pixelSize }, fields: 'pixelSize' }
}));
process.stdout.write(JSON.stringify({ requests }));
