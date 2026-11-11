const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict'),{createWorker}=require('tesseract.js');
async function main(){
 const image=process.argv[2]; if(!image||!fs.existsSync(image))throw Error('Indiquer le chemin privé de la photo du ticket à tester.');
 const worker=await createWorker('fra',1,{cachePath:'.ocr-cache'});
 try{
  const standard=await worker.recognize(image);await worker.setParameters({tessedit_pageseg_mode:'11'});const sparse=await worker.recognize(image);
  const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('assets/js/parser.js','utf8'),ctx);
  const score=data=>ctx.parseReceipt(data.text,data.confidence).articles.reduce((n,a)=>n+(a.prix?3:0)+(a.taille?2:0)+(a.reference?1:0),0);
  const chosen=score(sparse.data)>=score(standard.data)?sparse.data:standard.data;
  const receipt=ctx.parseReceipt(chosen.text,chosen.confidence);
  assert.equal(receipt.articles.length,6);assert.equal(Math.round(receipt.articles.reduce((n,a)=>n+Number(a.prix||0),0)*100),9038);
  console.log(JSON.stringify({articles:receipt.articles.length,total:90.38,confiance:chosen.confidence,articlesAVerifier:receipt.articles.filter(a=>a.warnings.length).length}));
  console.log('OK : photo réelle → OCR → six articles et 90,38 euros. Les champs incertains restent à corriger.');
 }finally{await worker.terminate();}
}main().catch(e=>{console.error(e.message);process.exitCode=1;});
