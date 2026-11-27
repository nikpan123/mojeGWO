import fs from 'node:fs/promises';
import path from 'node:path';
const center='http://127.0.0.1:4180';
const centerHTML=await (await fetch(center)).text();
const centerToken=centerHTML.match(/name="center-token" content="([^"]+)"/)[1];
const runnerResponse=await fetch(center+'/api/runner',{method:'POST',headers:{Origin:center,'Content-Type':'application/json','X-Center-Token':centerToken},body:JSON.stringify({project:'moje-gwo-prod'})});
if(!runnerResponse.ok) throw new Error('Nie udało się otworzyć panelu moje.gwo: '+runnerResponse.status);
const {url:runner}=await runnerResponse.json();
const html=await (await fetch(runner)).text();
const token=html.match(/name="health-token" content="([^"]+)"/)[1];
const response=await fetch(runner+'/api/run',{method:'POST',headers:{Origin:runner,'X-Health-Token':token,'Content-Type':'application/json'},body:JSON.stringify({forceLogin:process.env.MOJE_GWO_PROD_FORCE_LOGIN==='1'})});
const run=await response.json();
if(!response.ok) throw new Error(run.error);
console.log('Uruchomiono przebieg:',run.id);
for(let i=0;i<180;i++){
  const state=await (await fetch(runner+'/api/state')).json();
  const current=state.history.find(r=>r.id===run.id);
  if(current && current.status!=='RUNNING'){
    console.log('WYNIK',JSON.stringify(current));
    const centerState=await (await fetch(center+'/api/state')).json();
    console.log('W_CENTRUM',JSON.stringify(centerState.history.find(r=>r.id==='moje-gwo-prod:'+run.id)));
    const results=JSON.parse(await fs.readFile(path.join('C:/Users/npanek/Documents/ChatGPT/MojeGwoProd/.health/runs',run.id,'results.json'),'utf8'));
    function walk(suite){for(const spec of suite.specs||[])for(const t of spec.tests||[])console.log('TEST',spec.title,t.status,(t.results?.at(-1)?.errors||[]).map(e=>(e.message||'').replace(/\u001b\[[0-9;]*m/g,'')).join('\n').slice(0,1800));for(const child of suite.suites||[])walk(child);}
    results.suites.forEach(walk);
    break;
  }
  await new Promise(r=>setTimeout(r,2000));
}
