const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
async function app(options={}){
 const elements=Object.fromEntries(['installButton','updateApp','installHelp','appUpdateStatus','networkStatus','sendToSheet'].map(id=>[id,{textContent:'',hidden:true,style:{},disabled:false,addEventListener(){}}]));elements.sendToSheet.disabled=!!options.busy;
 const swEvents={},docEvents={},windowEvents={},order=[],messages=[];let observer,updates=0,clock=100000000;
 const reg={update:async()=>{updates++;},addEventListener(){},waiting:options.waiting?{postMessage:msg=>messages.push(msg)}:null};
 const navigator={userAgent:'Android',onLine:true,serviceWorker:{controller:options.firstInstall?null:{old:true},addEventListener:(key,fn)=>swEvents[key]=fn,register:async(url,settings)=>{assert.equal(url,'./sw.js');assert.equal(settings.updateViaCache,'none');return reg;}}};
 const document={hidden:!!options.hidden,activeElement:options.editing?{isContentEditable:true}:null,getElementById:id=>elements[id],addEventListener:(key,fn)=>docEvents[key]=fn};
 const ctx=vm.createContext({navigator,document,window:{addEventListener:(key,fn)=>windowEvents[key]=fn},matchMedia:()=>({matches:false}),Date:{now:()=>clock},setTimeout:fn=>fn(),MutationObserver:class{constructor(fn){observer=fn;}observe(){}},CoutureDraft:{save:()=>{order.push('save');return !options.failSave;}},location:{reload:()=>order.push('reload')}});
 vm.runInContext(fs.readFileSync('assets/js/install.js','utf8'),ctx);await new Promise(resolve=>setImmediate(resolve));
 return {elements,navigator,document,docEvents,windowEvents,order,messages,updates:()=>updates,advance:()=>clock+=61000,idle:()=>observer(),activate(){navigator.serviceWorker.controller={fresh:true};swEvents.controllerchange();}};
}
(async()=>{
 let a=await app();assert.equal(a.elements.updateApp.hidden,false);a.activate();assert.deepEqual(a.order,['save','reload']);
 a=await app({busy:true});a.activate();assert.deepEqual(a.order,[]);a.elements.sendToSheet.disabled=false;a.idle();assert.deepEqual(a.order,['save','reload']);
 a=await app({editing:true});a.activate();assert.deepEqual(a.order,[]);a.document.activeElement=null;a.docEvents.focusout();assert.deepEqual(a.order,['save','reload']);
 a=await app({hidden:true});a.activate();assert.deepEqual(a.order,[]);a.document.hidden=false;a.docEvents.visibilitychange();assert.deepEqual(a.order,['save','reload']);
 a=await app({failSave:true});a.activate();assert.deepEqual(a.order,['save']);assert.match(a.elements.appUpdateStatus.textContent,/sauvegarde locale/);
 a=await app({firstInstall:true});a.activate();assert.deepEqual(a.order,[],'Pas de rechargement à la première installation');
 a=await app({waiting:true});assert.ok(a.messages.some(msg=>msg.type==='ACTIVATE_UPDATE'));a.advance();a.windowEvents.focus();await new Promise(resolve=>setImmediate(resolve));assert.equal(a.updates(),2,'Rechercher à nouveau au retour dans l’application');
 console.log('OK : brouillon enregistré avant actualisation, attente pendant scan/envoi/saisie, reprise au retour et migration du worker en attente.');
})().catch(e=>{console.error(e);process.exitCode=1;});
