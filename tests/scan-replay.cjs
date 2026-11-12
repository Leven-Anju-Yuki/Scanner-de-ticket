const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{app}=require('./receipt-flow.cjs');
const fixture=fs.readFileSync('tests/fixtures/ticket-six-articles.txt','utf8');
const text='TICKET\n05/11/2025 18:50\nCaisse 1 - Numéro 139\n'+fixture;
async function main(){
const h=app([]);assert.equal(h.ctx.importReceipt(text,90,'file:one'),6);assert.equal(h.ids.totalPrice.textContent,'90.38 €');
h.tbody.children[0].children[0].textContent='Burlington corrigé par moi';
const before=JSON.stringify(h.tbody.children.map(row=>row.children.slice(0,6).map(c=>c.textContent)));
assert.equal(h.ctx.importReceipt(text,90,'file:one'),0);assert.equal(h.tbody.children.length,6);assert.equal(h.ids.totalPrice.textContent,'90.38 €');
assert.equal(h.ctx.importReceipt(text.replace('BURLINGTON','BURLINGTOM'),65,'file:another-photo'),0,'Même numéro/date malgré une autre lecture OCR');
assert.equal(h.ctx.importReceipt('Autre lecture de la même photo',65,'file:one'),0,'Même photo malgré un texte différent');
assert.equal(JSON.stringify(h.tbody.children.map(row=>row.children.slice(0,6).map(c=>c.textContent))),before,'Corrections conservées');
let stored='';function draft(context){context.localStorage={getItem:()=>stored||null,setItem:(_,v)=>stored=v,removeItem(){}};context.document.addEventListener=()=>{};context.window={addEventListener(){}};context.MutationObserver=class{observe(){}};vm.runInContext(fs.readFileSync('assets/js/draft.js','utf8'),context);}
draft(h.ctx);assert.equal(h.ctx.CoutureDraft.save(),true);const restored=app([]);draft(restored.ctx);assert.equal(restored.ctx.importReceipt(text,90,'file:one'),0);assert.equal(restored.tbody.children.length,6);assert.equal(restored.tbody.children[0].children[0].textContent,'Burlington corrigé par moi');assert.equal(restored.ids.totalPrice.textContent,'90.38 €');
assert.equal(h.ctx.importReceipt(text.replace('Numéro 139','Numéro 140'),90,'file:new-ticket'),6,'Un autre ticket peut contenir les mêmes tissus');assert.equal(h.tbody.children.length,12);
const legacy=app([]);const receipt=legacy.ctx.parseReceipt(fixture);receipt.articles.forEach(a=>{const row=legacy.ctx.addRow([a.nom,a.reference,a.largeur,a.taille,a.prixUnitaire,a.prix]);row.dataset.manualPrice='true';});legacy.tbody.children[0].children[0].textContent='Nom déjà corrigé';assert.equal(legacy.ctx.importReceipt(text,90),0);assert.equal(legacy.tbody.children.length,6);assert.equal(legacy.tbody.children[0].children[0].textContent,'Nom déjà corrigé');
assert.equal(h.requests.length,0);assert.equal(restored.requests.length,0);assert.equal(legacy.requests.length,0);
console.log('OK : rescan sans doublon, corrections et brouillon préservés, migration des anciennes lignes et autre ticket autorisé.');

const crypto=require('node:crypto'),bytes=new Uint8Array([1,2,3]);const hash='file:'+crypto.createHash('sha256').update(bytes).digest('hex');const preflight=app([]);preflight.ctx.crypto=crypto.webcrypto;preflight.ctx.importReceipt(text,90,hash);preflight.ctx.Tesseract={createWorker:()=>{throw Error('Le rescan ne doit pas relancer le moteur');}};await preflight.ctx.readTicket({target:{files:[{type:'image/jpeg',size:3,arrayBuffer:async()=>bytes.buffer}],value:'selected'}});assert.equal(preflight.tbody.children.length,6);assert.equal(preflight.ids.totalPrice.textContent,'90.38 €');assert.match(preflight.ids.ocrDebug.textContent,/déjà dans ton tableau/);assert.equal(preflight.ids.sendToSheet.disabled,false);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
