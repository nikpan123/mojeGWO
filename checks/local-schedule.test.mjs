import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createLocalSchedule,validateSchedule} from '../lib/local-schedule.mjs';
const profiles=()=>({selectedId:'a',teachers:[{id:'a',enabled:true}]});
const config={enabled:true,intervalMinutes:30,suites:['functional','services'],profileId:'a',revision:0};
test('zatrzymanie harmonogramu wyłącza przyszłe terminy i kolejne zestawy',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'moje-stop-cycle-'));let schedule,release,started;
 const ready=new Promise(resolve=>started=resolve),calls=[];
 try{
  schedule=await createLocalSchedule({file:path.join(dir,'schedule.json'),profiles,isBusy:()=>false,startRun:async options=>{calls.push(options);return {id:'1'};},getRun:()=>{started();return new Promise(resolve=>release=resolve);},pollMs:1});
  await schedule.save(config);const before=schedule.state();await schedule.runNow();await ready;
  await schedule.stop(schedule.state().revision);release({id:'1',status:'STOPPED'});
  for(let i=0;i<100&&schedule.state().running;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(schedule.state().running,false);assert.equal(calls.length,1);
  assert.equal(schedule.state().enabled,false);assert.equal(schedule.state().nextRunAt,null);assert.equal(schedule.state().revision,before.revision+1);
  assert.ok(schedule.state().events.some(e=>e.type==='STOP'&&e.runId==='1'));assert.ok(!schedule.state().events.some(e=>e.type==='FAIL'));
 }finally{schedule?.close();await fs.rm(dir,{recursive:true,force:true});}
});
async function fixture(fn){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'moje-schedule-'));let clock=Date.now(),busy=false;const calls=[],file=path.join(dir,'schedule.json');let schedule;const dependencies={file,profiles,now:()=>clock,isBusy:()=>busy,startRun:async options=>{calls.push(options);return {id:String(calls.length)};},getRun:async id=>({id,status:id==='1'?'FAIL':'PASS'}),pollMs:1};try{schedule=await createLocalSchedule(dependencies);await fn({schedule,calls,file,dependencies,advance:n=>clock+=n,setBusy:b=>busy=b});}finally{schedule?.close();await fs.rm(dir,{recursive:true,force:true});}}
test('odstęp, zestawy i aktywny nauczyciel są walidowane',()=>{for(const input of [{...config,intervalMinutes:0},{...config,intervalMinutes:1.5},{...config,suites:[]},{...config,profileId:'other'}])assert.throws(()=>validateSchedule(input,profiles()));});
test('dostępność stron może zastąpić endpointy bez zmiany odstępu i nauczyciela',()=>{const next=validateSchedule({...config,suites:['functional','websites']},profiles());assert.deepEqual(next.suites,['functional','websites']);assert.equal(next.intervalMinutes,30);assert.equal(next.profileId,'a');});
test('oba zestawy kolejno; porażka pierwszego nie blokuje drugiego; zapis i odtworzenie ustawień',()=>fixture(async({schedule,calls,file,dependencies,advance})=>{await schedule.save(config);advance(29*60000);await schedule.tick();assert.equal(calls.length,0);advance(60000);await schedule.tick();assert.deepEqual(calls.map(c=>c.suite),['functional','services']);assert.equal(calls[0].profileId,'a');assert.equal(calls[0].forceLogin,false);assert.ok(schedule.state().events.some(e=>e.type==='FAIL'));const reloaded=await createLocalSchedule(dependencies);assert.equal(reloaded.state().enabled,true);assert.equal(reloaded.state().intervalMinutes,30);reloaded.close();assert.ok(JSON.parse(await fs.readFile(file)).nextRunAt);}));
test('zajęty termin jest pomijany, bez nadrabiania lawiny po uśpieniu',()=>fixture(async({schedule,calls,advance,setBusy})=>{await schedule.save(config);setBusy(true);advance(10*60*60000);await schedule.tick();assert.equal(calls.length,0);setBusy(false);await schedule.tick();assert.equal(calls.length,0);assert.ok(schedule.state().events.some(e=>e.type==='SKIPPED'));advance(30*60000);await schedule.tick();assert.equal(calls.length,2);}));
test('wyłączenie zatrzymuje następne terminy i chroni przed starym formularzem',()=>fixture(async({schedule,calls,advance})=>{await schedule.save(config);await assert.rejects(schedule.save(config),/zmienił/);await schedule.save({...config,revision:1,enabled:false});advance(60*60000);await schedule.tick();assert.equal(calls.length,0);assert.equal(schedule.state().nextRunAt,null);}));
test('wyłączenie w trakcie przebiegu zatrzymuje kolejny zestaw',()=>fixture(async({schedule,dependencies,calls})=>{dependencies.startRun=async options=>{calls.push(options);await schedule.save({...config,revision:schedule.state().revision,enabled:false});return {id:'1'};};schedule.close();const next=await createLocalSchedule(dependencies);schedule=next;await schedule.save(config);await schedule.runNow();for(let i=0;i<100&&schedule.state().running;i++)await new Promise(r=>setTimeout(r,5));assert.equal(calls.length,1);assert.equal(schedule.state().enabled,false);next.close();}));

test('czyszczenie dziennika zachowuje terminy, ustawienia i raporty',()=>fixture(async({schedule,file,dependencies})=>{
 await schedule.save(config);const before=schedule.state();
 const report=path.join(path.dirname(file),'history.json');await fs.writeFile(report,'[{"status":"PASS"}]');
 const after=await schedule.clearEvents();assert.deepEqual(after.events,[]);
 for(const field of ['enabled','intervalMinutes','profileId','nextRunAt','revision'])assert.equal(after[field],before[field]);
 assert.deepEqual(after.suites,before.suites);assert.equal(await fs.readFile(report,'utf8'),'[{"status":"PASS"}]');
 const reloaded=await createLocalSchedule(dependencies);assert.deepEqual(reloaded.state().events,[]);reloaded.close();
}));

test('czyszczenie w trakcie cyklu nie zatrzymuje następnego zestawu',()=>fixture(async({schedule,calls,advance})=>{
 await schedule.save(config);advance(30*60000);
 const cycle=schedule.tick();await schedule.clearEvents();await cycle;
 assert.deepEqual(calls.map(call=>call.suite),['functional','services']);assert.equal(schedule.state().enabled,true);
}));
