const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { harness } = require('./apps-script.cjs');
async function main() {
  const server = harness();
  let rows = [{ children: ['Tissu', '00123', '140', '150', '5,99', ''].map(textContent => ({ textContent })), dataset: {} }];
  const elements = { totalPrice: {}, sendToSheet: { disabled: false }, saveStatus: {}, openSheet: { hidden: true } };
  const tbody = { querySelectorAll: () => rows, addEventListener() {} };
  let success = 0, payload;
  const stored = new Map();
  const context = vm.createContext({
    crypto, localStorage: { getItem: k => stored.get(k), setItem: (k, v) => stored.set(k, v) },
    console: { error() {} }, alert: message => { if (message.includes('succès')) success++; },
    document: {
      getElementById: id => id === 'ticketTable' ? { querySelector: () => tbody } : elements[id],
      querySelector: selector => selector === '.tenue-title' ? { textContent: 'Kimono' } : { addEventListener() {} }
    },
    fetch: async (_, options) => {
      assert.equal(options.credentials, 'omit');
      if (options.method === 'GET') return { ok: true, text: async () => server.context.doGet().text };
      assert.equal(options.headers['Content-Type'], 'text/plain;charset=UTF-8');
      payload = JSON.parse(options.body);
      return { ok: true, text: async () => server.post(payload) };
    }
  });
  vm.runInContext(fs.readFileSync('assets/js/form.js', 'utf8'), context);
  await context.sendToSheets();
  assert.equal(success, 1);
  assert.equal(elements.openSheet.hidden, false);
  assert.deepEqual(payload.rows[0], ['Tissu', '00123', '140', '150', '8.99', '5,99']);
  assert.equal(server.cells[6][4], 8.99);
  assert.equal(server.cells[6][5], 5.99);
  const firstId = payload.requestId;
  await context.sendToSheets();
  assert.equal(payload.requestId, firstId);
  assert.equal(server.writes(), 1);
  rows[0].children[3].textContent = '200';
  await context.sendToSheets();
  assert.notEqual(payload.requestId, firstId);
  assert.equal(server.writes(), 2);
  context.fetch = async () => { throw Error('CORS simulé'); };
  const previous = success;
  await context.sendToSheets();
  assert.equal(success, previous);
  assert.equal(elements.sendToSheet.disabled, false);
  assert.equal(elements.openSheet.hidden, true);
  assert.ok(elements.saveStatus.textContent.includes('non confirmé'));
  context.fetch = async () => ({ ok: true, text: async () => 'error:Total invalide' });
  await context.sendToSheets();
  assert.equal(success, previous);
  assert.ok(elements.saveStatus.textContent.includes('pas encore publiée'));
  context.fetch = async (_, options) => ({ ok: true, text: async () => options.method === 'GET'
    ? server.context.doGet().text : 'error:Total invalide' });
  await context.sendToSheets();
  assert.equal(success, previous);
  assert.ok(elements.saveStatus.textContent.includes('Total invalide'));
  console.log('OK : site → POST réel en mémoire → serveur, confirmation, nouvel envoi et échec réseau.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
