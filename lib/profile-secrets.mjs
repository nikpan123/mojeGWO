import {environment} from '../lib/environment.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {validId} from './profile-store.mjs';
async function crypt(value,decrypt=false){
 if(process.platform!=='win32')throw new Error('Lokalny zapis haseł wymaga konta Windows.');
 const script=`[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);Add-Type -AssemblyName System.Security;$v=[Console]::In.ReadToEnd();`+(decrypt?`$b=[Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($v),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Write([Text.Encoding]::UTF8.GetString($b))`:`$b=[Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($v),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Write([Convert]::ToBase64String($b))`);
 return new Promise((resolve,reject)=>{const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:['pipe','pipe','ignore']});let output='';const timer=setTimeout(()=>{child.kill();reject(new Error('Nie udało się otworzyć lokalnego magazynu haseł.'));},15000);child.stdout.setEncoding('utf8');child.stdout.on('data',value=>output+=value);child.on('error',()=>{clearTimeout(timer);reject(new Error('Nie udało się otworzyć lokalnego magazynu haseł.'));});child.on('close',code=>{clearTimeout(timer);code===0?resolve(output):reject(new Error('Nie udało się odczytać lub zapisać zaszyfrowanych danych na tym koncie Windows.'));});child.stdin.on('error',()=>{});child.stdin.end(value);});
}
export function secretStore(root){
 const file=id=>{if(!validId(id))throw new Error('Nieprawidłowy profil.');return path.join(root,'.health',environment,'credentials',id+'.json');};
 return {
  async status(id){try{const data=JSON.parse(await fs.readFile(file(id),'utf8'));return data.status;}catch(e){if(e.code==='ENOENT')return {portal:false,gitlab:false};throw e;}},
  async read(id,service){try{const envelope=JSON.parse(await fs.readFile(file(id),'utf8'));const values=JSON.parse(await crypt(envelope.encrypted,true));return values[service]||null;}catch(e){if(e.code==='ENOENT')return null;throw e;}},
  async save(id,input,reset=false){
   let values={};if(!reset){try{const old=JSON.parse(await fs.readFile(file(id),'utf8'));values=JSON.parse(await crypt(old.encrypted,true));}catch(e){if(e.code!=='ENOENT')throw e;}}
   if(input.portalPassword)values.portal={login:input.portalLogin,password:input.portalPassword};
   if(input.gitlabPassword){if(!input.gitlabLogin)throw new Error('Podaj login GitLaba.');values.gitlab={login:input.gitlabLogin,password:input.gitlabPassword};}
   const envelope={status:{portal:!!values.portal,gitlab:!!values.gitlab},encrypted:await crypt(JSON.stringify(values))};const target=file(id);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target+'.pending',JSON.stringify(envelope));await fs.rename(target+'.pending',target);
  }
 };
}
