import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {root} from '../lib/environment.mjs';
import {createApplication} from '../dashboard/server.mjs';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import {listenApplication} from '../dashboard/server.mjs';
import {healthDefaults,saveHealthConfig,loadHealthConfig} from '../lib/service-health.mjs';

async function probe(environment) {
  const script=`
    import {readBaseSettings,validateSettings,assertRunnable} from './lib/settings.mjs';
    import {environment,dataRoot,envFile} from './lib/environment.mjs';
    import {readCredentials} from './lib/auth.mjs';
    const base=readBaseSettings();validateSettings(base);
    let blocked=false;try{assertRunnable(base);}catch{blocked=true;}
    const other=environment==='test'?'PROD':'TEST';
    const creds=await readCredentials({envFile:'nonexistent-env-file',env:{['MOJE_GWO_'+other+'_USERNAME']:'other', ['MOJE_GWO_'+other+'_PASSWORD']:'private'},service:'portal'});
    console.log(JSON.stringify({environment,dataRoot,envFile,session:base.sessionFile,blocked,creds}));`;
  const child=spawn(process.execPath,['--input-type=module','-e',script],{cwd:root,windowsHide:true,env:{...process.env,MOJE_GWO_ENV:environment,MOJE_GWO_RUN_CONFIG:''}});
  let output='',errors='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);
  const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});
  assert.equal(code,0,errors);return JSON.parse(output);
}
test('wybór środowiska izoluje konfigurację, hasła, sesje i historię',async()=>{
  const test=await probe('test'),prod=await probe('prod');
  assert.notEqual(test.dataRoot,prod.dataRoot);assert.notEqual(test.envFile,prod.envFile);
  for(const result of [test,prod]){
    assert.equal(result.creds,null);assert.equal(result.session,'playwright/.auth/'+result.environment+'/teacher.json');
    assert.equal(result.dataRoot,path.join(root,'.health',result.environment));
  }
  assert.equal(prod.blocked,true);
});
test('zapis adresów usług TEST nie nadpisuje ustawień PROD',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gwo-environments-'));
  try{
    for(const environment of ['test','prod'])saveHealthConfig(directory,healthDefaults(environment),environment);
    assert.equal(loadHealthConfig(directory,'test').environment,'test');
    assert.equal(loadHealthConfig(directory,'prod').environment,'prod');
    assert.deepEqual(fs.readdirSync(path.join(directory,'config')).sort(),['service-health.prod.local.json','service-health.test.local.json']);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('zajęte porty nie blokują uruchomienia wspólnego panelu',async()=>{
  const blockers=[http.createServer(),http.createServer()];
  let server;
  try{
    for(const blocker of blockers)await new Promise(resolve=>blocker.listen(0,'127.0.0.1',resolve));
    server=await createApplication();
    const origin=await listenApplication(server,{port:blockers[0].address().port,fallbackPort:blockers[1].address().port});
    assert.ok(blockers.every(blocker=>blocker.address().port!==server.address().port));
    const response=await fetch(origin+'/test/api/state');
    assert.equal(response.status,200);assert.equal((await response.json()).environment,'test');
    assert.equal(server.listenerCount('error'),0);
  }finally{
    if(server?.listening)await new Promise(resolve=>server.close(resolve));
    for(const blocker of blockers)await new Promise(resolve=>blocker.close(resolve));
  }
});
test('jeden panel udostępnia oba środowiska i odrzuca mieszanie tokenów',async()=>{
  const server=await createApplication();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  try {
    const tokens={};
    for(const environment of ['test','prod']){
      const html=await(await fetch(origin+'/'+environment+'/')).text();
      assert.match(html,new RegExp('data-environment="'+environment+'"'));
      assert.match(html,/id="environment-choice"/);
      assert.ok(html.includes('src="/'+environment+'/environment-client.js"'));
      tokens[environment]=html.match(/name="health-token" content="([^"]+)"/)[1];
      const response=await fetch(origin+'/'+environment+'/api/state');assert.equal(response.status,200);
      const state=await response.json();assert.equal(state.environment,environment);assert.equal(state.running,false);
      assert.equal((await fetch(origin+'/'+environment+'/panel.js')).status,200);
    }
    const post=(environment,token,body,requestOrigin=origin)=>fetch(origin+'/'+environment+'/api/run',{method:'POST',headers:{Origin:requestOrigin,'X-Health-Token':token,'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await post('prod',tokens.test,{})).status,403);
    assert.equal((await post('test',tokens.test,{},'https://example.com')).status,403);
    assert.equal((await post('prod',tokens.prod,{})).status,423);
    assert.equal((await post('prod',tokens.prod,{suite:'load'})).status,400);
    assert.equal((await post('test',tokens.test,{suite:'websites'})).status,400);
    assert.equal((await fetch(origin+'/invalid/api/state')).status,404);
    assert.notEqual(tokens.test,tokens.prod);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
