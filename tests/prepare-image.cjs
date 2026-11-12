const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
async function main(){
 let fallback=0,draws=0,readError=false;
 const preview={naturalWidth:1434,naturalHeight:2572,set src(value){queueMicrotask(()=>value.startsWith('blob:')?this.onerror():this.onload());}};
 const input={addEventListener(){}};
 const ctx=vm.createContext({queueMicrotask,URL:{createObjectURL:()=> 'blob:unsupported',revokeObjectURL(){}},FileReader:class{readAsDataURL(){fallback++;queueMicrotask(()=>{if(readError)this.onerror();else{this.result='data:image/jpeg;base64,test';this.onload();}});}},document:{getElementById:id=>id==='ticketPreview'?preview:input,createElement:()=>({getContext:()=>({fillRect(){},drawImage(){draws++;}})})}});
 vm.runInContext(fs.readFileSync('assets/js/ocr.js','utf8'),ctx);
 const canvas=await ctx.prepareTicketImage({});assert.equal(fallback,1);assert.equal(draws,1);assert.ok(canvas.width>0&&canvas.height<=3200);
 readError=true;await assert.rejects(()=>ctx.prepareTicketImage({}),/Impossible de lire/);assert.equal(draws,1);
 console.log('OK : secours FileReader après URL blob refusée et erreur de lecture sans faux résultat.');
}main().catch(e=>{console.error(e);process.exitCode=1;});
