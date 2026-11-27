// Uruchomienie ze wspólnego panelu; środowisko określa MOJE_GWO_ENV (domyślnie TEST).
import fs from 'node:fs/promises';
import path from 'node:path';
import {environment,dataRoot} from '../lib/environment.mjs';
const origin=process.env.MOJE_GWO_PANEL_ORIGIN||'http://127.0.0.1:4182',runner=origin+'/'+environment;
const html=await(await fetch(runner+'/')).text();
const token=html.match(/name="health-token" content="([^"]+)"/)?.[1];
if(!token)throw new Error('Otwórz wspólny panel poleceniem npm run panel.');
const response=await fetch(runner+'/api/run',{method:'POST',headers:{Origin:origin,'X-Health-Token':token,'Content-Type':'application/json'},body:JSON.stringify({forceLogin:process.env.MOJE_GWO_FORCE_LOGIN==='1'})});
const run=await response.json();if(!response.ok)throw new Error(run.error);
console.log('Uruchomiono przebieg '+environment.toUpperCase()+': '+run.id);
for(let index=0;index<180;index++){
 const state=await(await fetch(runner+'/api/state')).json(),current=state.history.find(item=>item.id===run.id);
 if(current&&current.status!=='RUNNING'){
  const result=JSON.parse(await fs.readFile(path.join(dataRoot,'runs',run.id,'results.json'),'utf8'));
  console.log(JSON.stringify({status:current.status,counts:current.counts,stats:result.stats}));
  process.exitCode=current.status==='PASS'?0:1;break;
 }
 if(index===179)throw new Error('Przekroczono czas oczekiwania na wynik.');
 await new Promise(resolve=>setTimeout(resolve,2000));
}
