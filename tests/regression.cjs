const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const row = (q, p, paid = "", manual = false) => ({
  children: ["", "", "999", q, p, paid].map(textContent => ({textContent})),
  dataset: manual ? {manualPrice: "true"} : {}
});
let rows = [];
const tbody = {querySelectorAll: () => rows, addEventListener() {}};
const total = {};
const context = {document: {
  getElementById: id => id === "ticketTable" ? {querySelector: () => tbody} : total,
  querySelector: () => ({addEventListener() {}})
}};
vm.createContext(context);
vm.runInContext(fs.readFileSync("assets/js/form.js", "utf8"), context);
rows = [row("150", "5,99"), row("5", "2")];
context.calculate();
assert.equal(rows[0].children[5].textContent, "8.99");
assert.equal(total.textContent, "18.99 €");
rows = [row("50", "2"), row("49", "2"), row("", "2"), row("150", "5.99", "7,50", true)];
context.calculate();
assert.equal(rows[0].children[5].textContent, "1.00");
assert.equal(rows[1].children[5].textContent, "98.00");
assert.equal(rows[2].children[5].textContent, "");
assert.equal(rows[3].children[5].textContent, "7,50");
assert.equal(total.textContent, "106.50 €");
vm.runInContext(fs.readFileSync("assets/js/parser.js", "utf8"), context);
assert.equal(context.parseTicket("Largeur 140 cm\nLongueur 1,5 m").taille, "150");
assert.equal(context.parseTicket("TOTAL 15,00 €").prix, "");
assert.equal(context.parseTicket("140 cm").largeur, "");
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
manifest.icons.forEach(icon => assert.ok(fs.existsSync(icon.src)));
const swContext = {self: {addEventListener() {}}};
vm.createContext(swContext);
vm.runInContext(fs.readFileSync("sw.js", "utf8") + "\nFILES_TO_CACHE.forEach(path => { if (!exists(path)) throw new Error(path); });",
  vm.createContext({...swContext, exists: fs.existsSync}));
for (const file of ["form", "parser", "ocr", "install"]) new vm.Script(fs.readFileSync("assets/js/" + file + ".js", "utf8"));
console.log("OK : calcul, seuil 50, prix manuel, total, extraction prudente, icônes et précache.");
