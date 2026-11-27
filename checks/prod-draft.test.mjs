import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {readSettings,validateSettings,assertRunnable,assertSafeURL} from '../lib/settings.mjs';
import {readCredentials,ensureSession} from '../lib/auth.mjs';
import {scenarios} from '../lib/catalog.mjs';
import {createDashboard} from '../dashboard/server.mjs';
const draft=async()=>JSON.parse(await fs.readFile(new URL('../config/prod.example.json',import.meta.url),'utf8'));
test('przycisk przy zegarze wyłącza harmonogram także w oczekiwaniu na termin',async()=>{
 const dir=await fs.mkdtemp(path.join(tmpdir(),'gwo-stop-schedule-'));let server;
 try{
  const config=await draft();server=await createDashboard({dataDir:dir,settingsProvider:()=>config,checkReadiness:async()=>({ready:false,message:'Przykład'})});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port,html=await(await fetch(origin)).text(),token=html.match(/name="health-token" content="([^"]+)"/)[1];
  const post=(route,body)=>fetch(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Health-Token':token},body:JSON.stringify(body)});
  const saved=await post('/api/schedule',{enabled:true,intervalMinutes:30,suites:['websites'],profileId:'default',revision:0});assert.equal(saved.status,200);
  assert.equal((await post('/api/stop',{runId:null,scheduleRevision:0})).status,409);
  const response=await post('/api/stop',{runId:null,scheduleRevision:1});assert.equal(response.status,202);
  const state=await(await fetch(origin+'/api/state')).json();assert.equal(state.schedule.enabled,false);assert.equal(state.schedule.nextRunAt,null);assert.equal(state.running,false);
  const stored=JSON.parse(await fs.readFile(path.join(dir,'schedule.json'),'utf8'));assert.equal(stored.enabled,false);assert.equal(stored.nextRunAt,null);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}
});

test('PROD pozostaje konfiguracją roboczą z pięcioma osobnymi scenariuszami',async()=>{
 const settings=validateSettings(await draft());
 assert.equal(settings.environment,'prod');assert.equal(settings.runEnabled,false);
 assert.equal(settings.baseURL,'');assert.equal(settings.accountEmail,'');
 assert.ok(settings.resources.every(resource=>resource.title===''));
 const rows=scenarios(settings);assert.equal(rows.filter(r=>r.file==='tests/health.spec.mjs').length,5);assert.equal(rows.filter(r=>r.file==='tests/service-health.spec.mjs').length,9);assert.equal(rows.filter(r=>r.type==='manual').length,24);
 assert.ok(rows.every(row=>row.project==='moje-gwo-prod'&&row.id.startsWith('moje-gwo-prod:')));
 assert.throws(()=>assertRunnable(settings),error=>error.code==='PROD_DISABLED');
});

test('dziennik odtwarza materiały z konfiguracji przebiegu zamiast bieżącego profilu',async()=>{
 const directory=await fs.mkdtemp(path.join(tmpdir(),'mojegwo-scope-')),runId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';let server;
 try{
  const config=await draft();config.accountDisplayName='Aktualny nauczyciel';config.resources=[{id:'new',title:'Nowy materiał',kind:'aplikacja'}];
  await fs.mkdir(path.join(directory,'runs',runId),{recursive:true});
  await fs.writeFile(path.join(directory,'runs',runId,'config.json'),JSON.stringify({environment:'prod',profileLabel:'Nauczyciel z przebiegu',resources:[{id:'old',title:'Podręcznik z przebiegu',kind:'multipodrecznik',checkMode:'functional'}],privateValue:'dummy-private-do-not-return'}));
  await fs.writeFile(path.join(directory,'schedule.json'),JSON.stringify({enabled:false,intervalMinutes:30,suites:['functional'],profileId:'default',revision:0,nextRunAt:null,events:[{type:'PASS',suite:'functional',runId,at:'2026-11-27T07:00:00Z',message:'Zakończono zestaw.'}]}));
  server=await createDashboard({dataDir:directory,settingsProvider:()=>config,checkReadiness:async()=>({ready:false,message:'Przykład'})});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const state=await(await fetch('http://127.0.0.1:'+server.address().port+'/api/state')).json(),event=state.schedule.events[0];
  assert.equal(event.profileLabel,'Nauczyciel z przebiegu');assert.equal(event.materials[0].title,'Podręcznik z przebiegu');
  assert.equal(event.materials[0].checkMode,'functional');assert.ok(!JSON.stringify(state).includes('dummy-private-do-not-return'));
 }finally{if(server?.listening)await new Promise(resolve=>server.close(resolve));await fs.rm(directory,{recursive:true,force:true});}
});
test('dane TEST nie są używane jako fallback produkcji',async()=>{
 const missingFile=path.join(tmpdir(),'mojegwo-prod-env-never-created-'+Date.now());
 const env={GITLAB_USERNAME:'dummy-test',GITLAB_PASSWORD:'dummy-test',MOJE_GWO_USERNAME:'dummy-test',MOJE_GWO_PASSWORD:'dummy-test'};
 assert.equal(await readCredentials({env,envFile:missingFile,service:'gitlab'}),null);
 assert.equal(await readCredentials({env,envFile:missingFile,service:'portal'}),null);
 assert.deepEqual(await readCredentials({env:{MOJE_GWO_PROD_USERNAME:'dummy-prod',MOJE_GWO_PROD_PASSWORD:'dummy-prod'},envFile:missingFile,service:'portal'}),{login:'dummy-prod',password:'dummy-prod'});
});
test('blokada PROD zatrzymuje logowanie przed otwarciem przeglądarki i pobraniem hasła',async()=>{
 let browserCalls=0,credentialCalls=0;
 await assert.rejects(ensureSession({settings:await draft(),forceFresh:true,browser:{newContext(){browserCalls++;throw new Error('Nie powinno być wywołane.');}},credentialsProvider:async()=>{credentialCalls++;return null;}}),error=>error.code==='PROD_DISABLED');
 assert.equal(browserCalls,0);assert.equal(credentialCalls,0);
});
test('konfiguracja PROD odrzuca hosty TEST, DEV oraz sesję TEST',async()=>{
 const settings=await draft();settings.allowedHosts=['moje.gwotest.pl','moje.gwodev.pl','moje.gwo.pl'];
 assert.throws(()=>assertSafeURL('https://moje.gwotest.pl',settings));
 assert.throws(()=>assertSafeURL('https://moje.gwodev.pl',settings));
 assert.equal(assertSafeURL('https://moje.gwo.pl',settings).hostname,'moje.gwo.pl');
 assert.throws(()=>validateSettings({...settings,sessionFile:'playwright/.auth/teacher.json'}));
});
test('lokalny panel pokazuje pustą historię i blokuje API uruchomienia bez zapisu przebiegu',async()=>{
 const directory=await fs.mkdtemp(path.join(tmpdir(),'mojegwo-prod-draft-'));
 const settings=await draft();
 const server=await createDashboard({dataDir:directory,settingsProvider:()=>settings,checkReadiness:async()=>({ready:false,message:'Do konfiguracji — nieuruchomione'})});
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const html=await(await fetch(origin)).text();
  assert.match(html,/moje.gwo PROD/);assert.match(html,/Do konfiguracji/);
  assert.match(html,/<button id="run" disabled>/);
  const state=await(await fetch(origin+'/api/state')).json();
  assert.equal(state.ready,false);assert.equal(state.scenarios.length,41);assert.deepEqual(state.history,[]);
  const token=html.match(/name="health-token" content="([^"]+)"/)[1];
  const response=await fetch(origin+'/api/run',{method:'POST',headers:{Origin:origin,'X-Health-Token':token}});
  assert.equal(response.status,423);
  assert.equal(await fs.access(path.join(directory,'history.json')).then(()=>true,()=>false),false);
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(directory,{recursive:true,force:true});}
});
