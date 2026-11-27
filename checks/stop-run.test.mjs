import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {EventEmitter,once} from 'node:events';
import {spawn} from 'node:child_process';
import {createDashboard} from '../dashboard/environment-server.mjs';
import {stopTestProcess} from '../lib/stop-test-process.mjs';

test('zatrzymanie wymaga tokenu i bieżącego ID, a historia odróżnia zatrzymanie od błędu',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gwo-stop-run-'));let server;
 const child=new EventEmitter();child.pid=123;child.kill=()=>true;let stops=0;
 try{
  const config=JSON.parse(await fs.readFile(new URL('../config/test.example.json',import.meta.url),'utf8'));
  config.accountDisplayName='Nauczyciel przykładowy';config.accountUserId=123;
  server=await createDashboard({dataDir:dir,settingsProvider:()=>config,checkReadiness:async()=>({ready:true,message:'Przykład'}),launchProcess:()=>child,terminateProcess:async target=>{assert.equal(target,child);stops++;}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port,html=await(await fetch(origin)).text(),token=html.match(/name="health-token" content="([^"]+)"/)[1];
  const post=(route,body,secret=token)=>fetch(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Health-Token':secret},body:JSON.stringify(body)});
  const response=await post('/api/run',{suite:'functional'});assert.equal(response.status,202);const run=await response.json();
  assert.equal((await post('/api/stop',{runId:run.id},'wrong')).status,403);
  assert.equal((await post('/api/stop',{runId:'old-run'})).status,409);assert.equal(stops,0);
  assert.equal((await post('/api/stop',{runId:run.id})).status,202);
  assert.equal((await post('/api/stop',{runId:run.id})).status,202);assert.equal(stops,1);
  assert.equal((await(await fetch(origin+'/api/state')).json()).stopping,true);
  child.emit('exit',1);
  let state;for(let i=0;i<100;i++){state=await(await fetch(origin+'/api/state')).json();if(!state.running)break;await new Promise(resolve=>setTimeout(resolve,5));}
  assert.equal(state.running,false);assert.equal(state.history[0].status,'STOPPED');assert.match(state.history[0].message,/zatrzymany przez użytkownika/);
  assert.equal((await post('/api/stop',{runId:run.id})).status,409);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}
});

test('zatrzymanie usuwa uruchomiony proces próbny razem z jego procesem potomnym',async()=>{
 const child=spawn(process.execPath,['-e',`const {spawn}=require('node:child_process');const p=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});console.log(p.pid);setInterval(()=>{},1000);`],{windowsHide:true,detached:process.platform!=='win32',stdio:['ignore','pipe','ignore']});
 const exit=once(child,'exit');
 try{
  const [buffer]=await once(child.stdout,'data'),descendant=Number(buffer.toString().trim());assert.ok(descendant>0);
  await stopTestProcess(child);await exit;
  let alive=true;for(let i=0;i<100;i++){try{process.kill(descendant,0);}catch{alive=false;break;}await new Promise(resolve=>setTimeout(resolve,10));}
  assert.equal(alive,false,'Proces potomny również musi zostać zatrzymany.');
 }finally{if(child.exitCode==null&&child.signalCode==null)await stopTestProcess(child);}
});
