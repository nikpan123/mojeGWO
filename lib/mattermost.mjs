import {environment} from './environment.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseEnv} from 'node:util';
export function validateMention(value){const login=String(value||'').trim().replace(/^@/,'');if(!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(login)||['channel','here','all'].includes(login.toLowerCase()))throw new Error('Podaj osobisty login Mattermost, np. @imie.nazwisko.');return '@'+login;}
export function validWebhook(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/hooks\/[a-z0-9_-]+\/?$/i.test(u.pathname)?u.href:null;}catch{return null;}}
export function failureMessage(run,mention){
 const c=run.counts||{},label=run.suite==='websites'?'Dostępność stron':run.suite==='services'?'Endpointy healthcheck usług':'Konto nauczyciela i materiały';
 const lines=[(mention?mention+' ':'')+'❌ **moje.gwo — niezaliczony przebieg**','Zestaw: '+label,'Zaliczone: '+(c.passed||0)+' / '+run.expectedCount+' · Błędy: '+(c.failed||0)+' · Pominięte: '+(c.skipped||0),'Zakończenie: '+new Date(run.finishedAt).toLocaleString('pl-PL',{timeZone:'Europe/Warsaw'})];
 if(/^\/report\/[a-f0-9-]{36}\/$/.test(run.report||''))lines.push('[Raport na komputerze uruchamiającym testy](http://127.0.0.1:4182/prod'+run.report+')');
 lines.push('Link lokalny — działa wyłącznie na komputerze uruchamiającym testy.');return {text:lines.join('\n\n')};
}
export async function createMattermost({root,dataDir,send=fetch,readWebhook}={}){
 const file=path.join(dataDir,'mattermost.json');let config={enabled:false,mention:'',mode:'failures',revision:0,lastDelivery:null},queue=Promise.resolve();
 try{config={...config,...JSON.parse(await fs.readFile(file,'utf8')),mode:'failures'};}catch(e){if(e.code!=='ENOENT')throw new Error('Nie można odczytać ustawień powiadomień.');}
 const secret=readWebhook||(async()=>{try{const env=parseEnv(await fs.readFile(path.join(root,'.env.'+environment),'utf8'));return validWebhook(env.MOJE_GWO_MATTERMOST_WEBHOOK_URL||'');}catch{return null;}});
 const persist=()=>{const snapshot=JSON.stringify(config,null,2);queue=queue.then(async()=>{await fs.mkdir(dataDir,{recursive:true});await fs.writeFile(file+'.pending',snapshot);await fs.rename(file+'.pending',file);});return queue;};
 const state=async()=>({...structuredClone(config),webhookConfigured:!!await secret()});
 async function deliver(payload,runId){let result;try{const url=await secret();if(!url)return {status:'NOT_CONFIGURED',at:new Date().toISOString()};const response=await send(url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});const body=(await response.text()).trim();result={status:response.status===200&&body==='ok'?'SENT':'FAILED',at:new Date().toISOString(),httpStatus:response.status};}catch{result={status:'FAILED',at:new Date().toISOString()};}config.lastDelivery={...result,runId:runId||null};await persist();return result;}
 return {state,
  async save(input){if(input.revision!==config.revision)throw new Error('Ustawienia zmieniły się. Odśwież panel.');if(typeof input.enabled!=='boolean')throw new Error('Niepoprawny stan powiadomień.');const mention=input.mention?validateMention(input.mention):'';if(input.enabled&&!await secret())throw new Error('Najpierw ustaw webhook w lokalnym pliku .env.');Object.assign(config,{enabled:input.enabled,mention,mode:'failures',revision:config.revision+1});await persist();return state();},
  async notify(run){if(!config.enabled||run.status!=='FAIL')return {status:'SKIPPED'};const mention=config.mention?validateMention(config.mention):'';return deliver(failureMessage(run,mention),run.id);},
  async test(){if(!await secret())throw new Error('Ustaw MOJE_GWO_MATTERMOST_WEBHOOK_URL w lokalnym pliku .env.');const mention=config.mention?validateMention(config.mention):'';return deliver({text:(mention?mention+' — ':'')+'Test powiadomień moje.gwo. To wiadomość kontrolna, nie alarm awarii.'});}
 };
}
