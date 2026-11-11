// Diagnostic sans article : le POST est volontairement invalide et ne peut rien écrire.
const endpoint = 'https://script.google.com/macros/s/AKfycbxqwIB0_qFuaRil5e-uKEgXm64aZultHO9uqHKL1o5bISsfo9sKDe8DV39dno68hMnEkg/exec';
const origin = 'http://127.0.0.1:5501';
async function main() {
  const health = await fetch(endpoint, { headers: { Origin: origin }, signal: AbortSignal.timeout(45000) });
  const text = await health.text();
  let info;
  try { info = JSON.parse(text); } catch (_) { throw Error('Le diagnostic du nouveau serveur est indisponible'); }
  if (!health.ok || info.version !== 'scanner-sheets-2' || !info.ok) throw Error('Version serveur inattendue');
  if (info.formatting !== 'existing-template') throw Error('Mise en forme automatique non publiée');
  const response = await fetch(endpoint, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ rows: [], total: '0', tenue: '' }),
    signal: AbortSignal.timeout(45000)
  });
  const result = await response.text();
  if (!response.ok || result !== 'error:Articles invalides') throw Error('Réponse de validation inattendue');
  const headers = [health, response].map(r => r.headers.get('access-control-allow-origin'));
  if (headers.some(value => value !== '*' && value !== origin)) throw Error('En-tête CORS absent ou incompatible');
  console.log(JSON.stringify({ version: info.version, formatting: info.formatting, getStatus: health.status, postStatus: response.status,
    validation: result, cors: headers, articlesEnvoyes: 0 }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
