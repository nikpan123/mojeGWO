// Odczytuje hasła wyłącznie w pamięci; w wyniku pokazuje tylko liczbę sprawdzonych plików.
import fs from 'node:fs/promises';
import path from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {parseEnv} from 'node:util';
const root='C:/Users/npanek/Documents/ChatGPT/MojeGwoProd';
const runId=process.argv[2];
if(!/^[a-f0-9-]{36}$/.test(runId||''))throw new Error('Podaj identyfikator przebiegu.');
const env=parseEnv(await fs.readFile(path.join(root,'.env'),'utf8'));
const values=[env.GITLAB_PROD_PASSWORD,env.MOJE_GWO_PROD_PASSWORD].filter(Boolean);
const needles=[...new Set(values.flatMap(value=>[value,encodeURIComponent(value),JSON.stringify(value).slice(1,-1)]))].map(value=>Buffer.from(value));
let checked=0;
function scan(bytes){
 checked++;
 if(needles.some(needle=>bytes.includes(needle)))throw new Error('Wykryto dane dostępowe w artefaktach. Wartości nie są wyświetlane.');
}
function scanZip(bytes){
 let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw new Error('Nie można sprawdzić archiwum raportu.');
 const count=bytes.readUInt16LE(end+10);let offset=bytes.readUInt32LE(end+16);
 for(let i=0;i<count;i++){
  if(bytes.readUInt32LE(offset)!==0x02014b50)throw new Error('Nieprawidłowy katalog archiwum raportu.');
  const method=bytes.readUInt16LE(offset+10),size=bytes.readUInt32LE(offset+20),local=bytes.readUInt32LE(offset+42);
  const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
  const data=bytes.subarray(start,start+size);
  if(method===0)scan(data);else if(method===8)scan(inflateRawSync(data,{maxOutputLength:256*1024*1024}));else throw new Error('Nieobsługiwany format archiwum raportu.');
  offset+=46+bytes.readUInt16LE(offset+28)+bytes.readUInt16LE(offset+30)+bytes.readUInt16LE(offset+32);
 }
}
async function walk(directory){
 for(const entry of await fs.readdir(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);
  if(entry.isDirectory())await walk(file);
  else{
   const bytes=await fs.readFile(file);scan(bytes);
   if(entry.name.endsWith('.zip'))scanZip(bytes);
   if(entry.name.endsWith('.html'))for(const match of bytes.toString('utf8').matchAll(/data:application\/zip;base64,([A-Za-z0-9+/=]+)/g))scanZip(Buffer.from(match[1],'base64'));
  }
 }
}
await walk(path.join(root,'.health/runs',runId));
console.log(`OK: sprawdzono ${checked} plików/elementów raportu. Nie znaleziono haseł z .env.`);
