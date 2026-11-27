import fs from 'node:fs/promises';
import path from 'node:path';
const types=new Set(['image/png','image/jpeg','image/webp']);
async function localImage(runDir,file){
 try{
  const base=await fs.realpath(runDir),target=await fs.realpath(path.resolve(runDir,file));
  const relative=path.relative(base,target);
  if(!relative||relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative))return null;
  return (await fs.stat(target)).isFile()?target:null;
 }catch{return null;}
}
export async function runScreenshots(runDir){
 let report={},resources=[];
 try{report=JSON.parse(await fs.readFile(path.join(runDir,'results.json'),'utf8'));}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
 try{resources=JSON.parse(await fs.readFile(path.join(runDir,'config.json'),'utf8')).resources||[];}catch{}
 const images=[];
 async function walk(suite){
  for(const spec of suite.specs||[]){
   const match=spec.title.match(/^HC-\d+\/([^ ]+) — /),resource=resources.find(r=>r.id===match?.[1]);
   const testTitle=resource?resource.title+' · '+spec.title.split(' — ').slice(1).join(' — '):spec.title;
   for(const test of spec.tests||[])for(const [attempt,result] of (test.results||[]).entries())for(const attachment of result.attachments||[]){
    if(!types.has(attachment.contentType))continue;
    const file=attachment.path?await localImage(runDir,attachment.path):null;
    const body=typeof attachment.body==='string'?attachment.body:null;
    if(!file&&!body)continue;
    const labels={'kompozytor-01-otwarcie':'1. Po otwarciu aplikacji','kompozytor-02-wynik':'2. Po sprawdzeniu funkcji','ekran-aplikacji':'Ekran aplikacji','ekran-strony':'Ekran strony','katalog-zadan':'Katalog zadań',screenshot:'Zrzut przy błędzie'};
    images.push({testTitle,label:(labels[attachment.name]||attachment.name||'Zrzut ekranu')+(attempt?' · próba '+(attempt+1):''),status:result.status,contentType:attachment.contentType,file,body});
   }
  }
  for(const child of suite.suites||[])await walk(child);
 }
 await walk(report);
 const preview=await localImage(runDir,path.join('live','preview.jpg'));
 if(preview)images.push({testTitle:'Ostatni podgląd przebiegu',label:'Ostatni zapisany obraz',status:null,contentType:'image/jpeg',file:preview,body:null});
 return images;
}
export async function screenshotBytes(runDir,image){
 if(image.file){const file=await localImage(runDir,image.file);if(!file)throw Object.assign(new Error('Nie znaleziono zrzutu.'),{status:404});return fs.readFile(file);}
 return Buffer.from(image.body,'base64');
}
