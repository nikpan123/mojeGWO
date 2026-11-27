import fs from 'node:fs';
import path from 'node:path';
export const serviceDefinitions=[{id:'moje-gwo',name:'moje.gwo',host:'moje',covers:'Backend panelu, konta i posiadanych dostępów.'},{id:'multipodreczniki',name:'Multipodręczniki',host:'multipodreczniki.apps',covers:'Backend czytnika, metadane i zasób techniczny magazynu treści.'},{id:'kompozytor',name:'Kompozytor',host:'kompozytorklasowek.apps',covers:'Backend bibliotek, klas i list zestawów.'}];
export function healthDefaults(environment){return {version:1,environment,services:serviceDefinitions.map(s=>({...s,url:'',confirmed:false})),responseLimitMs:2000,timeoutMs:5000,maxBodyBytes:4096};}
export function validateHealthConfig(input,environment){
 if(!input||input.environment!==environment||!Array.isArray(input.services)||input.services.length!==3)throw new Error('Wymagana osobna konfiguracja trzech usług tego środowiska.');
 const output=healthDefaults(environment),suffix=environment==='prod'?'gwo.pl':'gwotest.pl';
 for(const definition of serviceDefinitions){
  const matches=input.services.filter(s=>s.id===definition.id);if(matches.length!==1)throw new Error('Każda usługa musi wystąpić dokładnie raz.');const value=matches[0];
  if(typeof value.url!=='string'||value.url.length>2000||typeof value.confirmed!=='boolean')throw new Error('Nieprawidłowy adres lub potwierdzenie usługi.');
  const url=value.url.trim();if(url){let u;try{u=new URL(url);}catch{throw new Error('Podaj poprawny adres healthchecka HTTPS.');}if(u.protocol!=='https:'||u.hostname!==definition.host+'.'+suffix||u.username||u.password||u.search||u.hash||(u.port&&u.port!=='443'))throw new Error('Healthcheck musi należeć do właściwej usługi i środowiska, bez danych logowania i parametrów.');}
  if(value.confirmed&&!url)throw new Error('Nie można potwierdzić pustego adresu healthchecka.');
  Object.assign(output.services.find(s=>s.id===definition.id),{url,confirmed:value.confirmed});
 }
 return output;
}
export function loadHealthConfig(root,environment){const file=path.join(root,'config','service-health.local.json');try{return validateHealthConfig(JSON.parse(fs.readFileSync(file,'utf8')),environment);}catch(e){if(e.code==='ENOENT')return healthDefaults(environment);throw e;}}
export function healthReadiness(config,base){
 if(base.environment==='prod'&&!base.runEnabled)return {ready:false,message:'Uruchamianie PROD jest wyłączone w konfiguracji.'};
 const missing=config.services.filter(s=>!s.url||!s.confirmed);
 return missing.length?{ready:false,message:'Do potwierdzenia przez właścicieli usług: '+missing.map(s=>s.name).join(', ')+'. Nie uruchomiono sprawdzeń endpointów.'}:{ready:true,message:'Potwierdzono adresy trzech usług. Kontrole są anonimowe, tylko GET, bez logowania nauczyciela.'};
}
export function saveHealthConfig(root,input,environment){const config=validateHealthConfig(input,environment),file=path.join(root,'config','service-health.local.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.pending',JSON.stringify(config,null,2));fs.renameSync(file+'.pending',file);return config;}
export function inspectHealthResponse(sample,service,{maxBodyBytes=4096,now=Date.now()}={}){
 const problems=[];const headers=Object.fromEntries(Object.entries(sample.headers||{}).map(([k,v])=>[k.toLowerCase(),String(v)]));
 if(sample.status!==200)problems.push(sample.status>=300&&sample.status<400?'REDIRECT':'HTTP_STATUS');
 if(!/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/i.test(headers['content-type']||''))problems.push('CONTENT_TYPE');
 if(Buffer.byteLength(sample.body||'')>maxBodyBytes)problems.push('BODY_TOO_LARGE');
 let body;try{body=JSON.parse(sample.body);}catch{problems.push('INVALID_JSON');}
 if(body){
  if(typeof body!=='object'||Array.isArray(body)||!body)problems.push('INVALID_SCHEMA');
  else{
   if(Object.keys(body).some(key=>!['service','status','checkedAt'].includes(key)))problems.push('PUBLIC_EXTRA_FIELDS');
   if(body.service!==service.id)problems.push('WRONG_SERVICE');if(body.status!=='ok')problems.push('NOT_READY');
   if(body.checkedAt!==undefined){const at=typeof body.checkedAt==='string'?Date.parse(body.checkedAt):NaN;if(!Number.isFinite(at)||now-at>15000||at-now>5000)problems.push('STALE_CHECK');}
  }
 }else if(!problems.includes('INVALID_JSON'))problems.push('INVALID_SCHEMA');
 return {ok:problems.length===0,problems};
}
export function inspectCache(headers){
 const h=Object.fromEntries(Object.entries(headers).map(([k,v])=>[k.toLowerCase(),String(v)])),problems=[];
 if(!(h['cache-control']||'').toLowerCase().split(',').some(v=>v.trim()==='no-store'))problems.push('CACHE_NO_STORE_MISSING');
 if(h.age!==undefined&&(!/^\d+$/.test(h.age)||Number(h.age)>0))problems.push('CACHED_AGE');
 if([h['x-cache'],h['cf-cache-status']].some(value=>/(^|[^a-z])hit([^a-z]|$)/i.test(value||'')))problems.push('CACHE_HIT');
 return {ok:problems.length===0,problems};
}
export async function probeService(request,service,config){
 const start=performance.now();let response;
 try{
  response=await request.get(service.url,{timeout:config.timeoutMs,maxRedirects:0,failOnStatusCode:false});
  const body=(await response.body()).toString('utf8');return {status:response.status(),headers:response.headers(),body,elapsedMs:performance.now()-start};
 }finally{await response?.dispose();}
}
export function endpointScenarios(environment,config){
 const project=environment==='prod'?'moje-gwo-prod':'moje-gwo',tag=environment.toUpperCase();
 return config.services.flatMap(service=>[
  {code:'EP-01/'+service.id,title:service.name+' — HTTPS, status, JSON i minimalna odpowiedź',expected:'Poprawny TLS, HTTP 200, właściwa usługa, status ok, brak nadmiarowych pól i przekierowań.',steps:'Anonimowy GET bez sesji i bez podążania za przekierowaniami; sprawdź kontrakt odpowiedzi.'},
  {code:'EP-02/'+service.id,title:service.name+' — czas odpowiedzi',expected:'Poprawna odpowiedź do 2 sekund; timeout najpóźniej po 5 sekundach.',steps:'Zmierz pełny czas pobrania odpowiedzi i potwierdź jej poprawność.'},
  {code:'EP-03/'+service.id,title:service.name+' — ochrona przed starą odpowiedzią z cache',expected:'Dwa poprawne odczyty, no-store, brak Age > 0 i sygnału cache HIT. To nie zastępuje próby awarii zależności.',steps:'Wykonaj dwa GET, sprawdź nagłówki i ewentualny znacznik checkedAt.'}
 ].map(row=>({...row,id:project+':'+row.code,project,type:'automatic',module:'Endpointy healthcheck '+tag,file:'tests/service-health.spec.mjs',tags:[tag,'endpoint','healthcheck'],blocker:service.url&&service.confirmed?'':'Brak potwierdzonego adresu healthchecka. Wykonanie zablokowane.',preconditions:['Adres potwierdzony przez właściciela usługi.','Brak konta nauczyciela i danych logowania w żądaniu.'],source:'Kontrakt healthchecka; osobny zestaw od smoke funkcjonalnego.'})));
}
export function acceptanceScenarios(environment){
 const project=environment==='prod'?'moje-gwo-prod':'moje-gwo';
 return [
  ['QA-02','Awaria krytycznej zależności','Na uzgodnionym środowisku TEST zablokuj zależność z właścicielem usługi, odczytaj healthcheck i przywróć zależność.','HTTP 503 podczas awarii; brak pozornego OK.'],
  ['QA-03','Powolna krytyczna zależność','Na TEST wprowadź kontrolowane opóźnienie zależności i zmierz odpowiedź healthchecka.','Brak gotowości w uzgodnionym limicie; sprawdzenie nie zawiesza się.'],
  ['QA-04','Awaria zależności opcjonalnej','Na TEST wyłącz uzgodniony komponent opcjonalny i porównaj wynik z kontraktem.','Brak nieuzasadnionego alarmu krytycznego.'],
  ['QA-06','Cache podczas rzeczywistej zmiany stanu','Na TEST po poprawnym odczycie wyłącz krytyczną zależność; sprawdź odpowiedź z punktu zewnętrznego.','Nie jest zwracane stare OK z cache.'],
  ['QA-07','Przywrócenie działania','Na TEST przywróć krytyczną zależność po próbie awarii.','Powrót do HTTP 200 i statusu ok bez ręcznego resetu.'],
  ['QA-08','Koszt i brak skutków ubocznych','Z właścicielem ustal liczbę i tempo próbek na TEST; porównaj dane, metryki i liczbę połączeń przed i po próbie.','Brak zmian danych, narastania połączeń i istotnego wpływu na użytkowników.'],
  ['QA-09','DNS, TLS i brak połączenia','W kontrolowanej konfiguracji monitora zasymuluj brak DNS, niepoprawny certyfikat oraz niedostępny port.','Każdy błąd oznacza nieudany pomiar, nigdy zaliczenie.'],
  ['MON-01','Alarm, przywrócenie i brak pomiarów','Z Nickiem wykonaj kontrolowane próby monitora: 3 błędy, 2 poprawne pomiary i brak nowych pomiarów.','Alarm i przywrócenie docierają do właściwych odbiorców; brak danych daje osobny alarm.']
 ].flatMap(([code,title,steps,expected])=>serviceDefinitions.map(service=>({id:project+':'+code+'/'+service.id,code:code+'/'+service.id,title:service.name+' — '+title,steps:'Usługa: '+service.name+'. '+steps,expected,project,type:'manual',module:'Odbiór healthchecków — kontrolowane próby',tags:[environment.toUpperCase(),'QA','odbiór','TEST-only','manual'],blocker:'Wymaga uzgodnionego środowiska TEST, właściciela usługi i dowodów. Nie wykonuje awarii na PROD.',preconditions:['Właściciel odbieranej usługi uczestniczy w próbie.','Zatwierdzona procedura awarii i odtworzenia na TEST.'],source:'Scenariusz odbiorowy — nie jest automatycznym wynikiem monitoringu.'})));
}
