const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),Couture=require('../assets/js/history-core.js');
class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.events={};this.textContent='';this.hidden=false;this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
 appendChild(el){this.children.push(el);return el;}prepend(el){this.children.unshift(el);}replaceChildren(){this.children=[];}addEventListener(name,fn){this.events[name]=fn;}setAttribute(name,value){this[name]=value;}
 querySelector(selector){return this.children.find(el=>selector==='.'+el.className)||this.children.map(el=>el.querySelector(selector)).find(Boolean)||null;}
}
(async()=>{
 const ids=Object.fromEntries(['historyStatus','historyDisconnect','historyMatches','historyExisting','historyDecisions','comparisonLayout','historyConnect','saveStatus'].map(id=>[id,new Element()]));
 const title=new Element();title.textContent='Robe';const body=new Element(),add=new Element();
 const incoming=[{children:['Tissu','R1','140','150','2','3'].map(textContent=>({textContent}))}];
 const old={id:'1',version:'version',name:'Robe',rows:[{row:2,values:['Tissu','R1','140','100','2','2'],note:'Note conservée'}]};const original=JSON.stringify(old);let oauthCallback,requests=0;
 const ctx=vm.createContext({Couture,Date,Map,Set,localStorage:{removeItem(){}},SHEETS_ENDPOINT:'https://example.com',google:{accounts:{oauth2:{initTokenClient:config=>{oauthCallback=config.callback;return {};}}}},fetch:async(_,options)=>{requests++;return options.method==='POST'?{ok:true,text:async()=>JSON.stringify({outfits:[old]})}:{ok:true,json:async()=>({history:'google-oauth',googleClientId:'example.apps.googleusercontent.com'})};},document:{getElementById:id=>ids[id],createElement:tag=>new Element(tag),querySelector:selector=>selector==='.tenue-title'?title:selector==='.add-row'?add:body,querySelectorAll:()=>incoming}});
 vm.runInContext(fs.readFileSync('assets/js/history.js','utf8'),ctx);
 await ctx.CoutureHistory.initGoogle();oauthCallback({access_token:'test-only',expires_in:3600});await new Promise(resolve=>setImmediate(resolve));
 ids.historyMatches.children[0].events.click();
 assert.equal(ids.historyExisting.hidden,false);assert.ok(ids.comparisonLayout.classes.has('has-existing'));
 assert.match(ids.historyExisting.children[0].textContent,/Déjà dans Sheets/);
 const scroll=ids.historyExisting.querySelector('.table-scroll'),table=scroll.children[0];
 assert.deepEqual(table.children[0].children.slice(4,6).map(c=>c.textContent),['Tarif','Prix payé']);
 assert.equal(table.children[1].className,'existing-match');assert.equal(table.children[1].children[6].textContent,'Note conservée');
 assert.ok(ids.historyDecisions.children.some(el=>el.tagName==='label'));
 assert.equal(ctx.CoutureHistory.prepare([['Tissu','R1','140','150','3','2']]),null,'Pas de fusion sans choix explicite');
 assert.equal(JSON.stringify(old),original);assert.equal(requests,2,'Lecture uniquement, aucune écriture Sheets');
 ids.historyDisconnect.events.click();assert.equal(ids.historyExisting.hidden,true);assert.equal(ids.historyDecisions.children.length,0);assert.ok(!ids.comparisonLayout.classes.has('has-existing'));
 console.log('OK : comparaison côte à côte après connexion, colonnes alignées, doublons visibles, notes intactes et masquage à la déconnexion.');
})().catch(e=>{console.error(e);process.exitCode=1;});
