import fs from 'node:fs/promises';
import path from 'node:path';
export function validateSchedule(input,profiles){
 if(typeof input.enabled!=='boolean'||!Number.isInteger(input.intervalMinutes)||input.intervalMinutes<1||input.intervalMinutes>10080)throw new Error('Podaj odstęp od 1 do 10080 minut.');
 if(!Array.isArray(input.suites)||!input.suites.length||new Set(input.suites).size!==input.suites.length||input.suites.some(s=>!['functional','websites','services'].includes(s)))throw new Error('Wybierz co najmniej jeden zestaw.');
 if(input.enabled&&input.suites.includes('functional')&&!profiles.teachers.some(t=>t.id===input.profileId&&t.enabled))throw new Error('Wybierz aktywnego nauczyciela harmonogramu.');
 return {enabled:input.enabled,intervalMinutes:input.intervalMinutes,suites:['functional','websites','services'].filter(s=>input.suites.includes(s)),profileId:input.profileId||''};
}
export async function createLocalSchedule({file,profiles,isBusy,startRun,getRun,now=Date.now,pollMs=1000}){
 let data={enabled:false,intervalMinutes:30,suites:['functional','websites','services'],profileId:profiles().selectedId,nextRunAt:null,revision:0,events:[]},running=false,closed=false,timer=null,writing=Promise.resolve();
 try{const stored=JSON.parse(await fs.readFile(file,'utf8'));const valid=validateSchedule({...stored,enabled:false},profiles());const missing=stored.suites.includes('functional')&&!profiles().teachers.some(t=>t.id===stored.profileId&&t.enabled);data={...stored,...valid,enabled:stored.enabled&&!missing,events:(stored.events||[]).slice(-100)};if(missing)data.events.unshift({at:new Date(now()).toISOString(),type:'ERROR',message:'Harmonogram wyłączony: wskazany nauczyciel jest nieaktywny.'});}catch(e){if(e.code!=='ENOENT')throw new Error('Nie można odczytać harmonogramu: '+e.message);}
 const persist=()=>{const snapshot=JSON.stringify(data,null,2);writing=writing.then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.pending',snapshot);await fs.rename(file+'.pending',file);});return writing;};
 const event=async(type,message,extra={})=>{data.events=[{at:new Date(now()).toISOString(),type,message,...extra},...data.events].slice(0,100);await persist();};
 const state=()=>({...structuredClone(data),running});
 async function cycle(manual=false){
  if(running||closed)return false;
  if(isBusy()){await event('SKIPPED','Pominięto cykl — trwa inny przebieg lub edycja konfiguracji.');return false;}
  running=true;const config=structuredClone(data),revision=data.revision;
  try{
   validateSchedule({...config,enabled:true},profiles());
   await event('START','Rozpoczęto cykl harmonogramu.');
   for(const suite of config.suites){
    if(closed||data.revision!==revision||(!manual&&!data.enabled)){await event('STOP','Zatrzymano kolejkę; rozpoczęty przebieg może się dokończyć.');break;}
    let run;
    try{run=await startRun({suite,profileId:suite==='functional'?config.profileId:undefined,forceLogin:false,preview:true,headed:false,trigger:'schedule'});}
    catch{await event('ERROR','Nie udało się uruchomić zestawu. Sprawdź gotowość konfiguracji w panelu.',{suite});continue;}
    await event('RUN','Uruchomiono zestaw.',{suite,runId:run.id});
    const deadline=now()+20*60*1000;let result;
    while(!closed&&now()<deadline){result=await getRun(run.id);if(result&&result.status!=='RUNNING')break;await new Promise(resolve=>setTimeout(resolve,pollMs));}
    if(!result||result.status==='RUNNING'){await event('ERROR','Brak końcowego wyniku; kolejny zestaw nie został uruchomiony.',{suite,runId:run.id});break;}
    await event(result.status,'Zakończono zestaw.',{suite,runId:run.id,report:result.report||null,counts:result.counts||null});
   }
  }catch{await event('ERROR','Cykl przerwany przez błąd lokalnego panelu.');}
  finally{try{await event('END','Zakończono cykl harmonogramu.');}finally{running=false;}}
  return true;
 }
 async function tick(){
  if(closed||running||!data.enabled)return;
  if(!data.nextRunAt){data.nextRunAt=new Date(now()+data.intervalMinutes*60000).toISOString();await persist();return;}
  if(now()<Date.parse(data.nextRunAt))return;
  const revision=data.revision;data.nextRunAt=new Date(now()+data.intervalMinutes*60000).toISOString();await persist();if(data.enabled&&data.revision===revision)await cycle();
 }
 return {state,tick,
  async clearEvents(){data.events=[];await persist();return state();},
  async save(input){if(input.revision!==data.revision)throw new Error('Harmonogram zmienił się. Odśwież panel.');const next=validateSchedule(input,profiles());Object.assign(data,next,{revision:data.revision+1,nextRunAt:next.enabled?new Date(now()+next.intervalMinutes*60000).toISOString():null});await event(next.enabled?'ENABLED':'DISABLED',next.enabled?'Włączono harmonogram.':'Wyłączono harmonogram. Trwający test może się dokończyć.');return state();},
  async runNow(){if(running||isBusy())throw new Error('Poczekaj na zakończenie bieżącego przebiegu.');validateSchedule({...data,enabled:true},profiles());void cycle(true).catch(()=>{});return state();},
  start(){if(!timer){timer=setInterval(()=>void tick().catch(()=>{}),1000);timer.unref();}},
  close(){closed=true;clearInterval(timer);}
 };
}
