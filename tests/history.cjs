const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), crypto = require('node:crypto');
const Couture = require('../assets/js/history-core.js');
assert.throws(() => Couture.sum(['a','r',140,100,'',2],['a','r',140,100,2,2]), /Prix/);
assert.throws(() => Couture.sum(['a','r',140,100,2,''],['a','r',140,100,2,2]), /Tarifs/);
function harness() {
 const cells = [
 ['Nom\nRobe', 'Référence', 'Largeur (cm)', 'Longueur / Quantité', 'Tarif', 'Prix', 'Note'],
 ['Tissu', 'R1', 140, 100, 2, 2, 'Note à conserver'],
 ['TOTAL', '', '', '', '', '=SUM(F2:F2)', ''],
 ['Nom\nAutre','Référence','Largeur','Quantité','Tarif','Prix','Note'],
 ['Autre','R2',140,100,3,3,'Historique conservé'], ['TOTAL','','','','',3,'']
 ].map(row=>row.map(v=>({v,n:''})));
 let writes=0;
 const value=(r,c)=>cells[r-1]?.[c-1] || {v:'',n:''};
 const display=(r,c)=> {const v=value(r,c).v; if(typeof v==='string'&&v.startsWith('=SUM(')) {const m=v.match(/F(\d+):F(\d+)/); return String(cells.slice(+m[1]-1,+m[2]).reduce((n,row)=>n+Number(row[5]?.v||0),0));} return String(v);};
 const sheet={getLastRow:()=>cells.length,insertRowsBefore(r,n){writes++;cells.splice(r-1,0,...Array.from({length:n},()=>Array.from({length:7},()=>({v:'',n:''}))));}, autoResizeRows(){},
 getRange(r,c,h=1,w=1){const range={
 getValues:()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>value(r+i,c+j).v)),
 getFormulas:()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>String(value(r+i,c+j).v).startsWith('=')?value(r+i,c+j).v:'')),
 getNotes:()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>value(r+i,c+j).n)),
 getDisplayValues:()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>display(r+i,c+j))),
 getDisplayValue:()=>display(r,c),getFormula:()=>String(value(r,c).v).startsWith('=')?value(r,c).v:'',
 setValue(v){writes++;value(r,c).v=v;return range;},setFormula(v){return range.setValue(v);},
 setValues(rows){writes++;rows.forEach((row,i)=>row.forEach((v,j)=>{value(r+i,c+j).v=v;}));return range;},
 setNumberFormat(){return range;},copyFormatToRange(){}
 };return range;}};
 const ctx=vm.createContext({Couture,console,Session:{getEffectiveUser:()=>({getEmail:()=> 'owner@gmail.com'})},UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({sub:'owner',email:'owner@gmail.com',email_verified:true})})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,v)=>crypto.createHash('sha256').update(v).digest()},PropertiesService:{},ContentService:{}});
 vm.runInContext(fs.readFileSync('google-apps-script/Code.gs','utf8')+'\n'+fs.readFileSync('google-apps-script/History.gs','utf8').replace(/const HISTORY_ALLOWED_ACCOUNT_HASH = [^;]+;/, 'const HISTORY_ALLOWED_ACCOUNT_HASH = '+JSON.stringify(crypto.createHash('sha256').update('owner@gmail.com').digest('hex'))+';'),ctx);
 const block=ctx.readOutfits(sheet)[0];
 const payload={googleAccessToken:'valid',targetId:block.id,targetVersion:block.version,rows:[['Tissu','R1',140,150,3,2],['Bouton','B1','',2,1,0.5]],decisions:[{action:'sum',row:2},{action:'add'}]};
 return {ctx,sheet,cells,payload,writes:()=>writes};
}
let h=harness(); const later=JSON.stringify(h.cells.slice(3));
h.ctx.mergeOutfit(h.sheet,h.payload);
assert.equal(h.cells[1][3].v,250);assert.equal(h.cells[1][5].v,5);assert.equal(h.cells[1][6].v,'Note à conserver');
assert.equal(h.cells[2][0].v,'Bouton');assert.equal(h.cells[3][5].v,'=SUM(F2:F3)');
assert.equal(JSON.stringify(h.cells.slice(4)),later);
h=harness();h.payload.targetVersion='stale';assert.throws(()=>h.ctx.mergeOutfit(h.sheet,h.payload),/changé/);assert.equal(h.writes(),0);
h=harness();h.payload.decisions[0].row=99;assert.throws(()=>h.ctx.mergeOutfit(h.sheet,h.payload),/non retrouvé/);assert.equal(h.writes(),0);
h=harness();h.payload.decisions=[{action:'skip'},{action:'skip'}];const before=JSON.stringify(h.cells);h.ctx.mergeOutfit(h.sheet,h.payload);assert.equal(JSON.stringify(h.cells),before);
console.log('OK : fusion, ajout avant total, sommes, notes et tableaux suivants préservés, données périmées refusées avant écriture.');
