const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function main(){
 const handlers={},deleted=[];let claimed=0,skipped=0,network=0;
 const cached={cached:true};
 const ctx=vm.createContext({URL,Promise,caches:{keys:async()=>['tissu-planner-v1','tissu-planner-v13','other-app'],delete:async key=>deleted.push(key),match:async()=>cached,open:async()=>({addAll:async paths=>paths.forEach(p=>assert.ok(fs.existsSync(p.split("?")[0])))})},fetch:async()=>{network++;return {};},self:{location:{origin:'https://example.com'},registration:{scope:'https://example.com/Scanner-de-ticket/'},clients:{claim:async()=>claimed++},skipWaiting:()=>skipped++,addEventListener:(name,fn)=>handlers[name]=fn}});
 vm.runInContext(fs.readFileSync('sw.js','utf8'),ctx);
 let pending;handlers.install({waitUntil:p=>pending=p});await pending;
 handlers.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['tissu-planner-v1']);assert.equal(claimed,1);
 handlers.message({data:{type:'ACTIVATE_UPDATE'}});assert.equal(skipped,1);
 for(const [method,url] of [['POST','https://example.com/Scanner-de-ticket/'],['GET','https://accounts.google.com/gsi/client'],['GET','https://script.google.com/macros/s/id/exec'],['GET','https://example.com/Scanner-de-ticket/private']]){
 let intercepted=false;handlers.fetch({request:{method,url},respondWith:()=>intercepted=true});assert.equal(intercepted,false,url);
 }
 handlers.fetch({request:{method:'GET',url:'https://example.com/Scanner-de-ticket/index.html'},respondWith:p=>pending=p});assert.equal(await pending,cached);assert.equal(network,0);
 const manifest=JSON.parse(fs.readFileSync('manifest.json'));assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');assert.equal(manifest.orientation,'landscape');
 console.log('OK : installation, cache hors connexion, mise à jour contrôlée, aucune interception OAuth/Sheets/photo et isolation des autres applications.');
}main().catch(e=>{console.error(e);process.exitCode=1;});
