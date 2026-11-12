const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function main(){
 const handlers={},deleted=[],stored=new Map();let claimed=0,skipped=0,network=0,offline=false,lastRequest;
 const scope='https://example.com/Scanner-de-ticket/';
 const key=request=>typeof request==='string'?request:request.url;
 const cache={async addAll(requests){for(const request of requests){assert.equal(request.cache,'reload');const file=new URL(request.url).pathname.replace('/Scanner-de-ticket/','')||'index.html';assert.ok(fs.existsSync(file));stored.set(request.url,new Response(fs.readFileSync(file)));}},async match(request){return stored.get(key(request))?.clone();},async put(request,response){stored.set(key(request),response.clone());}};
 const ctx=vm.createContext({URL,Request,Response,Promise,caches:{keys:async()=>['tissu-planner-v1','tissu-planner-v16','other-app'],delete:async key=>deleted.push(key),open:async name=>{assert.equal(name,'tissu-planner-v16');return cache;},match:()=>{throw Error('Ne pas mélanger les anciens caches');}},fetch:async request=>{network++;lastRequest=request;if(offline)throw Error('offline');return new Response('Version courante',{status:200});},self:{location:{origin:'https://example.com'},registration:{scope},clients:{claim:async()=>claimed++},skipWaiting:()=>skipped++,addEventListener:(name,fn)=>handlers[name]=fn}});
 vm.runInContext(fs.readFileSync('sw.js','utf8'),ctx);
 let pending;handlers.install({waitUntil:p=>pending=p});await pending;assert.equal(skipped,1,'La mise à jour ne reste pas en attente de fermeture des onglets');
 handlers.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['tissu-planner-v1']);assert.equal(claimed,1);
 handlers.message({data:{type:'ACTIVATE_UPDATE'}});assert.equal(skipped,2);
 let version;handlers.message({data:{type:'GET_VERSION'},ports:[{postMessage:data=>version=data}]});assert.equal(version.release,'20261112-6');
 for(const [method,url] of [['POST',scope],['GET','https://accounts.google.com/gsi/client'],['GET','https://script.google.com/macros/s/id/exec'],['GET',scope+'private'],['GET',scope+'mise-a-jour.html']]){let intercepted=false;handlers.fetch({request:new Request(url,{method}),respondWith:()=>intercepted=true});assert.equal(intercepted,false,url);}
 handlers.fetch({request:new Request(scope+'index.html'),respondWith:p=>pending=p});assert.equal(await (await pending).text(),'Version courante');assert.equal(lastRequest.cache,'no-store');assert.equal(network,1,'Le HTML ne reste pas bloqué dans le cache');
 offline=true;handlers.fetch({request:new Request(scope+'index.html?updated=20261112-6'),respondWith:p=>pending=p});assert.equal(await (await pending).text(),'Version courante','Brouillon accessible avec le shell hors connexion');
 const before=network;handlers.fetch({request:new Request(scope+'assets/js/form.js?v=20261112-6'),respondWith:p=>pending=p});assert.ok((await (await pending).text()).includes('sendToSheets'));assert.equal(network,before,'Assets versionnés disponibles hors connexion');
 const manifest=JSON.parse(fs.readFileSync('manifest.json'));assert.equal(manifest.id,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.orientation,'landscape');for(const icon of manifest.icons){assert.match(icon.src,/install-pref-/);const bytes=fs.readFileSync(icon.src);assert.equal(bytes.readUInt32BE(16),Number(icon.sizes.split('x')[0]));assert.equal(bytes.readUInt32BE(16),bytes.readUInt32BE(20));}
 const html=fs.readFileSync('index.html','utf8');assert.match(html,/class="brand-mark" src="assets\/image\/favicon_pref_2.png/);assert.match(html,/rel="apple-touch-icon" href="assets\/image\/install-pref-192.png/);
 const recovery=fs.readFileSync('mise-a-jour.html','utf8');assert.doesNotMatch(recovery,/localStorage\.clear|caches\.delete|\.unregister\(/);assert.match(recovery,/GET_VERSION/);
 console.log('OK : activation immédiate, HTML neuf en ligne et secours hors connexion, cache isolé, reprise sans effacement et icônes pref/pref 2 séparées.');
}main().catch(e=>{console.error(e);process.exitCode=1;});
