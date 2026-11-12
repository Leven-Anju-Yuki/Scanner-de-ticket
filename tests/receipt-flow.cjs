const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{createWorker}=require('tesseract.js');
class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.events={};this.hidden=false;this.disabled=false;this.checked=false;this.value='';this._text='';this.classes=new Set();this.classList={toggle:(key,on)=>on?this.classes.add(key):this.classes.delete(key)};}
 set textContent(value){this._text=String(value??'');}get textContent(){return this._text;}
 appendChild(el){this.children.push(el);return el;}prepend(el){this.children.unshift(el);}replaceChildren(...els){this.children=els;}setAttribute(key,value){this[key]=value;}addEventListener(key,fn){(this.events[key]??=[]).push(fn);}async click(){for(const fn of this.events.click||[])await fn();}focus(){}
 querySelectorAll(selector){if(selector==='tr')return this.children.filter(el=>el.tagName==='tr');return [];}
 querySelector(selector){return this.children.find(el=>selector==='.'+el.className)||this.children.map(el=>el.querySelector(selector)).find(Boolean)||null;}
}
function app(outfits){
 const ids=Object.fromEntries([...fs.readFileSync('index.html','utf8').matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const tbody=new Element('tbody'),title=new Element(),add=new Element('button');title.textContent='✂️ Nom de la tenue';ids.ticketTable.querySelector=()=>tbody;ids.ocrReviewPanel.hidden=true;let callback;const requests=[];
 const ctx=vm.createContext({console,Date,Map,Set,localStorage:{removeItem(){}},alert(){},google:{accounts:{oauth2:{initTokenClient:config=>{callback=config.callback;return {};}}}},fetch:async(_,options)=>{if(options.method==='POST'){const payload=JSON.parse(options.body);assert.equal(payload.action,'history','Toute écriture Sheets est interdite dans ce test');requests.push('history');return{ok:true,text:async()=>JSON.stringify({outfits})};}requests.push('health');return{ok:true,json:async()=>({history:'google-oauth',googleClientId:'example.apps.googleusercontent.com'})};},document:{getElementById:id=>ids[id],querySelector:selector=>selector==='.tenue-title'?title:selector==='.add-row'?add:tbody,querySelectorAll:()=>tbody.children,createElement:tag=>new Element(tag)}});
 for(const file of ['parser','history-core','form','history','ocr'])vm.runInContext(fs.readFileSync('assets/js/'+file+'.js','utf8'),ctx);
 return {ctx,ids,tbody,requests,async login(){await ctx.CoutureHistory.initGoogle();callback({access_token:'test-only',expires_in:3600});await new Promise(resolve=>setImmediate(resolve));}};
}
async function main(){
 const photo=process.argv[2];if(!photo||!fs.existsSync(photo))throw Error('Indiquer le chemin privé du ticket.');
 const worker=await createWorker('fra',1,{cachePath:'.ocr-cache'});let chosen;
 try{const standard=await worker.recognize(photo);await worker.setParameters({tessedit_pageseg_mode:'11'});const sparse=await worker.recognize(photo);const parsing=vm.createContext({});vm.runInContext(fs.readFileSync('assets/js/parser.js','utf8'),parsing);const score=data=>parsing.parseReceipt(data.text,data.confidence).articles.reduce((n,a)=>n+(a.prix?3:0)+(a.taille?2:0)+(a.reference?1:0),0);chosen=score(sparse.data)>=score(standard.data)?sparse.data:standard.data;}finally{await worker.terminate();}
 const probe=app([]),expected=probe.ctx.parseReceipt(fs.readFileSync('tests/fixtures/ticket-six-articles.txt','utf8'));
 const baseline={id:'test-only',version:'test-version',name:'Ancienne tenue fictive de contrôle',rows:expected.articles.map((a,index)=>({row:index+2,values:[a.nom,a.reference,a.largeur,a.taille,a.prix,a.prixUnitaire],note:'Note témoin à préserver'}))};
 const h=app([baseline]);assert.equal(h.ctx.importReceipt(chosen.text,chosen.confidence),6);assert.equal(h.tbody.children.length,6);assert.equal(h.ids.totalPrice.textContent,'90.38 €');assert.equal(h.ids.incomingTitle.textContent,'Mon ticket');assert.equal(h.ids.historyExisting.hidden,true);assert.equal(h.ids.ocrReviewed.checked,false);assert.equal(h.ids.ocrReviewPanel.hidden,false);
 const before=JSON.stringify(h.tbody.children.map(row=>row.children.slice(0,6).map(c=>c.textContent)));
 await h.login();assert.equal(h.ids.historyConnect.hidden,true);assert.equal(h.ids.historyExisting.hidden,true,'Pas de comparaison automatique après connexion');assert.equal(h.ids.incomingTitle.textContent,'Mon ticket');assert.equal(h.ids.duplicateSuggestions.hidden,false);
 const matches=h.ids.historyMatches.children[0];const detected=Number(matches.children[0].textContent.match(/^\d+/)[0]);assert.ok(detected>=5);
 const correctedReferences=[];
 h.tbody.children.forEach((row,index)=>{const expectedRef=baseline.rows[index].values[1];if(row.children[1].textContent!==expectedRef){correctedReferences.push({article:index+1,avant:row.children[1].textContent,apres:expectedRef});row.children[1].textContent=expectedRef;}});
 h.ctx.CoutureHistory.refresh();h.ctx.calculate();assert.equal(h.ids.totalPrice.textContent,'90.38 €');
 const correctedMatch=h.ids.historyMatches.children[0];const correctedCount=Number(correctedMatch.children[0].textContent.match(/^\d+/)[0]);assert.equal(correctedCount,6);
 const correctedBefore=JSON.stringify(h.tbody.children.map(row=>row.children.slice(0,6).map(c=>c.textContent)));
 await correctedMatch.children[1].click();assert.equal(h.ids.historyExisting.hidden,false);assert.equal(h.ids.incomingTitle.textContent,'Nouvelle saisie');assert.equal(h.ids.totalPrice.textContent,'90.38 €');assert.equal(JSON.stringify(h.tbody.children.map(row=>row.children.slice(0,6).map(c=>c.textContent))),correctedBefore);
 assert.equal(h.ids.historyDecisions.children.filter(el=>el.tagName==='label').length,correctedCount);
 const canonical=h.tbody.children.map(row=>[0,1,2,3,5,4].map(i=>row.children[i].textContent));assert.equal(h.ctx.CoutureHistory.prepare(canonical),null,'Choix explicite requis pour les doublons');
 await h.ids.historyExisting.children.find(el=>el.tagName==='button').click();assert.equal(h.ids.historyExisting.hidden,true);assert.equal(h.ids.incomingTitle.textContent,'Mon ticket');assert.equal(h.ids.totalPrice.textContent,'90.38 €');assert.deepEqual(h.requests,['health','history']);
 const noMatch=app([]);noMatch.ctx.importReceipt(chosen.text,chosen.confidence);await noMatch.login();assert.equal(noMatch.ids.duplicateSuggestions.hidden,true);assert.equal(noMatch.ids.historyExisting.hidden,true);assert.equal(noMatch.ids.incomingTitle.textContent,'Mon ticket');
 const result={articles:6,total:90.38,confiance:chosen.confidence,doublonsDansLeCasTemoin:detected,tailleCasTemoin:6,doublonsApresCorrectionReferences:correctedCount,referencesCorrigees:correctedReferences,nouveauTableauParDefaut:true,tableauConservePendantComparaison:true,confirmationOcrObligatoire:true,choixDoublonsObligatoire:true,casSansDoublonValide:true,ecrituresSheets:0,limite:'DOM simulé et ancien tableau fictif de contrôle, pas un import photo dans Chrome ni un constat sur le classeur réel.',articlesReconnus:JSON.parse(before)};
 fs.writeFileSync('backups/test-parcours-ticket-resultat.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
