// Lecture distante uniquement. Sauvegarde la copie locale avant chaque récupération.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, '.clasp.json'), 'utf8'));
const remote = path.join(root, 'google-apps-script', 'remote');
if (config.scriptId !== '1XlGKnwd2i4mDsv0-DJRRjvuAPxQX65tzEqyubUwBjMgNEHQOFE5akFEo' ||
    path.resolve(root, config.rootDir) !== remote) {
  throw new Error('Configuration différente du projet prévu : récupération arrêtée.');
}
if (fs.existsSync(remote) && fs.readdirSync(remote).length) {
  const backup = path.join(root, 'backups', 'apps-script-' + new Date().toISOString().replace(/[:.]/g, '-'));
  fs.cpSync(remote, backup, { recursive: true, errorOnExist: true, force: false });
  console.log('Copie locale sauvegardée : ' + path.relative(root, backup));
}
fs.mkdirSync(remote, { recursive: true });
const cli = path.join(root, 'node_modules', '@google', 'clasp', 'build', 'src', 'index.js');
const result = spawnSync(process.execPath, [cli, 'pull'], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
