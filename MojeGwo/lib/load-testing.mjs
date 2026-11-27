import fs from 'node:fs';
import path from 'node:path';
export const loadDefaults=()=>({version:1,revision:0,scenario:'public-page',users:5,durationMinutes:5,profileIds:[]});
export function validateLoad(input,base,registry){
 if(base.environment!=='test'||new URL(base.baseURL).origin!=='https://moje.gwotest.pl')throw new Error('Obciążenie jest dostępne wyłącznie dla moje.gwotest.pl (TEST).');
 if(!['public-page','teacher-panel'].includes(input.scenario))throw new Error('Wybierz scenariusz obciążenia.');
 if(!Number.isInteger(input.users)||input.users<1||input.users>50)throw new Error('Liczba użytkowników: od 1 do 50.');
 if(!Number.isInteger(input.durationMinutes)||input.durationMinutes<1||input.durationMinutes>10)throw new Error('Czas trwania: od 1 do 10 minut.');
 if(!Array.isArray(input.profileIds)||input.profileIds.length>50||new Set(input.profileIds).size!==input.profileIds.length||input.profileIds.some(id=>typeof id!=='string'||!registry.teachers.some(t=>t.id===id&&t.enabled)))throw new Error('Wybierz aktywne konta nauczycieli.');
 return {version:1,revision:Number.isInteger(input.revision)?input.revision:0,scenario:input.scenario,users:input.users,durationMinutes:input.durationMinutes,profileIds:input.profileIds};
}
export function loadSettings(dataDir){try{return JSON.parse(fs.readFileSync(path.join(dataDir,'load-settings.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return loadDefaults();throw e;}}
export function saveLoadSettings(dataDir,input,base,registry){const previous=loadSettings(dataDir);if(input.revision!==previous.revision)throw new Error('Konfiguracja zmieniła się. Odśwież panel.');const config=validateLoad(input,base,registry);config.revision++;fs.mkdirSync(dataDir,{recursive:true});const file=path.join(dataDir,'load-settings.json');fs.writeFileSync(file+'.pending',JSON.stringify(config,null,2));fs.renameSync(file+'.pending',file);return config;}
export function loadReadiness(config,base,registry,engineExists){
 try{validateLoad(config,base,registry);}catch(e){return {ready:false,message:e.message};}
 if(!engineExists)return {ready:false,message:'Brak lokalnego silnika k6 w tools/k6.exe.'};
 if(config.scenario==='teacher-panel'){
  const accounts=config.profileIds.map(id=>registry.teachers.find(t=>t.id===id));
  if(accounts.length<config.users)return {ready:false,message:'Dla '+config.users+' użytkowników wybierz co najmniej '+config.users+' różnych kont nauczycieli.'};
  if(accounts.some(t=>!t.accountUserId||!t.accountEmail)||new Set(accounts.map(t=>t.accountEmail.toLowerCase())).size!==accounts.length||new Set(accounts.map(t=>t.accountUserId)).size!==accounts.length)return {ready:false,message:'Konta muszą mieć potwierdzoną tożsamość i różne loginy oraz identyfikatory.'};
 }
 return {ready:true,message:'Gotowe do ręcznego uruchomienia na TEST. Zapis ustawień nie uruchamia obciążenia.'};
}
export function loadScenarios(){return ['public-page','teacher-panel'].map((id,index)=>({id:'moje-gwo:LOAD-'+(index+1),code:'LOAD-0'+(index+1),project:'moje-gwo',type:'automatic',module:'Obciążenie moje.gwo TEST',file:'load/moje-gwo.k6.js',title:index?'Obciążenie API panelu i dostępów nauczycieli':'Obciążenie anonimowego wejścia do moje.gwo',steps:'Ustaw liczbę użytkowników (1–50) i czas (1–10 minut), zapisz, a następnie uruchom ręcznie w panelu TEST.',expected:'Trzy kryteria: p95 żądań poniżej 2 s, błędy HTTP poniżej 1%, co najmniej 99% poprawnych sprawdzeń odpowiedzi. Progi robocze do uzgodnienia z zespołem.',preconditions:index?['Osobne konto TEST na każdego użytkownika.','Dostępne sesje albo skonfigurowane logowanie kont.']:['Wyłącznie TEST; żądania GET bez konta.'],tags:['TEST','obciążenie','k6','ręczne uruchomienie'],source:'Osobny zestaw obciążeniowy; poza harmonogramem smoke.'}));}
