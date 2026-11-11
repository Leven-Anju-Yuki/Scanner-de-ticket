// Préparer les seuls fichiers à envoyer. Aucune écriture chez Google.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'google-apps-script');
const release = path.join(source, 'release');
fs.mkdirSync(release, { recursive: true });
for (const name of ['Code', 'Formatting', 'History']) {
  fs.writeFileSync(path.join(release, name + '.js'), fs.readFileSync(path.join(source, name + '.gs'), 'utf8').replace(/^\uFEFF/, ''));
}
fs.writeFileSync(path.join(release, 'HistoryCore.js'), fs.readFileSync(path.join(root, 'assets/js/history-core.js'), 'utf8').replace(/^\uFEFF/, ''));
// Reprendre le manifeste réel sans modifier les droits ni l'identité d'exécution.
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'remote', 'appsscript.json'), 'utf8'));
fs.writeFileSync(path.join(release, 'appsscript.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(source, '.release.clasp.json'), JSON.stringify({
  scriptId: '1XlGKnwd2i4mDsv0-DJRRjvuAPxQX65tzEqyubUwBjMgNEHQOFE5akFEo', rootDir: 'release'
}, null, 2) + '\n');
console.log('Version préparée dans google-apps-script/release/ ; aucune publication.');
