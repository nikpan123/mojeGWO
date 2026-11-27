// Ten plik wykonuje ruch dopiero po jawnym uruchomieniu zestawu load w panelu.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {root,readSettings} from '../lib/settings.mjs';
import {writeEvent} from '../dashboard/live-reporter.mjs';
const settings=readSettings(),directory=path.dirname(process.env.MOJE_GWO_RUN_CONFIG||''),config=settings.loadTest;
if(settings.environment!=='test'||settings.baseURL!=='https://moje.gwotest.pl'||settings.suite!=='load'||!config||!directory.startsWith(path.join(root,'.health','runs')+path.sep))throw new Error('Wymagana zapisana konfiguracja obciążenia TEST.');
const secretFile=path.join(root,'.health','private-load',path.basename(directory)+'.json'),rawSummary=path.join(root,'.health','private-load',path.basename(directory)+'-summary.json');let child,stopped=false;
const reportFile=path.join(directory,'report','index.html');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function prepareAccounts(){
 const {chromium}=await import('@playwright/test');const {ensureSession}=await import('../lib/auth.mjs');const {protectContext}=await import('../lib/settings.mjs');const browser=await chromium.launch({headless:true});const accounts=[];
 try{for(const accountSettings of settings.loadAccounts||[]){
  if(await fs.access(path.join(directory,'stop.request')).then(()=>true,()=>false))throw new Error('STOP');
  await ensureSession({settings:accountSettings,browser,forceFresh:false});const context=await browser.newContext({storageState:path.resolve(root,accountSettings.sessionFile),serviceWorkers:'block'});await protectContext(context,accountSettings);
  try{const page=await context.newPage();const waiting=page.waitForResponse(r=>new URL(r.url()).origin==='https://moje.gwotest.pl'&&new URL(r.url()).pathname==='/api/v3/user_info',{timeout:30000});await page.goto('https://moje.gwotest.pl/accesses',{waitUntil:'domcontentloaded'});const response=await waiting;const identity=await response.json();if(!response.ok()||identity.userId!==accountSettings.accountUserId)throw new Error('Sesja konta nie została potwierdzona.');const source=await response.request().allHeaders();const headers=Object.fromEntries(Object.entries(source).filter(([name])=>!/^(host|connection|content-length|accept-encoding|sec-|:)/i.test(name)));accounts.push({userId:identity.userId,headers});}finally{await context.close();}
 }}finally{await browser.close();}
 if(accounts.length!==config.users||new Set(accounts.map(a=>a.userId)).size!==config.users)throw new Error('Brak odrębnych sesji nauczycieli.');
 await fs.mkdir(path.dirname(secretFile),{recursive:true});await fs.writeFile(secretFile,JSON.stringify(accounts),{mode:0o600});
}
let summary={},message='',exitCode=1;
try{
 writeEvent('start','Przygotowanie obciążenia TEST',{total:3});writeEvent('test','Obciążenie moje.gwo TEST — '+config.users+' użytkowników, '+config.durationMinutes+' min');
 if(config.scenario==='teacher-panel'){writeEvent('step','Przygotowanie osobnej, potwierdzonej sesji dla każdego nauczyciela');await prepareAccounts();}
 await fs.mkdir(path.dirname(rawSummary),{recursive:true});writeEvent('step','Generowanie ruchu GET na TEST; przerwa 5 sekund między iteracjami');
 const env=Object.fromEntries(['PATH','Path','SystemRoot','SYSTEMROOT','TEMP','TMP','USERPROFILE'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));Object.assign(env,{GWO_LOAD_CONFIG:process.env.MOJE_GWO_RUN_CONFIG,GWO_LOAD_SECRETS_FILE:secretFile,GWO_LOAD_SUMMARY:rawSummary,K6_NEW_MACHINE_READABLE_SUMMARY:'false'});
 child=spawn(path.join(root,'tools','k6.exe'),['run','--no-usage-report','--no-color','--quiet',path.join(root,'load','moje-gwo.k6.js')],{cwd:root,windowsHide:true,stdio:'ignore',env});
 const watcher=setInterval(async()=>{const stop=await fs.access(path.join(directory,'stop.request')).then(()=>true,()=>false);let parentGone=false;try{process.kill(Number(process.env.GWO_LOAD_PARENT_PID),0);}catch{parentGone=true;}if(stop||parentGone){stopped=true;child.kill();}},1000);
 const timeout=setTimeout(()=>{stopped=true;child.kill();},(config.durationMinutes*60+45)*1000);
 try{exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));});}finally{clearInterval(watcher);clearTimeout(timeout);}
 try{summary=JSON.parse(await fs.readFile(rawSummary,'utf8'));}catch{}
 if(stopped)message='Przebieg przerwany. Nie oznacza zaliczenia testu.';
}catch{message='Nie udało się przygotować lub wykonać obciążenia TEST. Sprawdź silnik k6, konta i sesje.';}
finally{await fs.unlink(secretFile).catch(()=>{});await fs.unlink(rawSummary).catch(()=>{});}
if(!message&&exitCode!==0&&exitCode!==99)message='Przebieg nie zakończył się poprawnie. Wyniki nie stanowią zaliczenia.';
const metrics=summary.metrics||{},requests=metrics.http_reqs?.values?.count||0;
const criteria=[['p95 czasu odpowiedzi < 2 s',metrics.http_req_duration?.thresholds],['Błędy HTTP < 1%',metrics.http_req_failed?.thresholds],['Poprawność odpowiedzi ≥ 99%',metrics.checks?.thresholds]].map(([name,thresholds])=>({name,passed:!message&&requests>0&&!!thresholds&&Object.values(thresholds).length>0&&Object.values(thresholds).every(t=>t.ok===true)}));
const passed=criteria.filter(c=>c.passed).length;const measurements={requests,iterations:metrics.iterations?.values?.count||0,p95Ms:metrics.http_req_duration?.values?.['p(95)']??null,p99Ms:metrics.http_req_duration?.values?.['p(99)']??null,errorRate:metrics.http_req_failed?.values?.rate??null,checkRate:metrics.checks?.values?.rate??null,criteria,message,stopped};
await fs.mkdir(path.dirname(reportFile),{recursive:true});await fs.writeFile(path.join(directory,'load-result.json'),JSON.stringify(measurements,null,2));await fs.writeFile(path.join(directory,'results.json'),JSON.stringify({stats:{expected:passed,unexpected:3-passed,skipped:0,flaky:0}}));
await fs.writeFile(reportFile,'<!doctype html><html lang="pl"><meta charset="utf-8"><title>Obciążenie moje.gwo TEST</title><style>body{font:16px/1.6 system-ui;max-width:1000px;margin:40px auto;padding:20px}table{border-collapse:collapse;width:100%}td,th{padding:12px;border:1px solid #ddd;text-align:left}.pass{color:#176b36}.fail{color:#a12828}</style><h1>Obciążenie moje.gwo TEST</h1><p>Scenariusz: '+escape(config.scenario)+' · Użytkownicy: '+config.users+' · Czas: '+config.durationMinutes+' min</p><p>Ruch GET HTTP/API; bez symulacji renderowania przeglądarki. Progi robocze do uzgodnienia z zespołem.</p><p>'+escape(message)+'</p><h2>'+passed+' / 3 kryteriów zaliczonych</h2><table><tr><th>Kryterium</th><th>Wynik</th></tr>'+criteria.map(c=>'<tr><td>'+escape(c.name)+'</td><td class="'+(c.passed?'pass':'fail')+'">'+(c.passed?'Zaliczone':'Niezaliczone')+'</td></tr>').join('')+'</table><h2>Pomiary</h2><pre>'+escape(JSON.stringify(measurements,null,2))+'</pre><p>Pomiar generatora ruchu należy zestawić z metrykami serwerów i bazy.</p></html>');
for(const c of criteria)writeEvent('result',c.name,{status:c.passed?'passed':'failed'});writeEvent('end',message||'Zakończono obciążenie TEST',{status:passed===3&&exitCode===0?'passed':'failed'});process.exitCode=passed===3&&exitCode===0?0:1;
