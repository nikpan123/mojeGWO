import {loadSettings,saveLoadSettings,loadReadiness,validateLoad} from '../lib/load-testing.mjs';
import {stopTestProcess} from '../lib/stop-test-process.mjs';
import {existsSync} from 'node:fs';
import {environment,dataRoot} from '../lib/environment.mjs';
import {websiteReadiness} from '../lib/website-availability.mjs';
import {createMattermost} from '../lib/mattermost.mjs';
import {createLocalSchedule} from '../lib/local-schedule.mjs';
import {loadHealthConfig,saveHealthConfig,healthReadiness} from '../lib/service-health.mjs';
import {ProfileStore,scenarioCount} from '../lib/profile-store.mjs';
import {secretStore} from '../lib/profile-secrets.mjs';
import {teacherController} from '../lib/teacher-controller.mjs';
import {inspectTeacher} from '../lib/inspect-teacher.mjs';
import http from 'node:http';
import {renderPanel} from './panel-view.mjs';
import {renderMaterialGuide} from './material-guide.mjs';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { root, readSettings, readBaseSettings, validateSettings,assertRunnable } from '../lib/settings.mjs';
import { scenarios,functionalScenarios } from '../lib/catalog.mjs';
import { authAvailability } from '../lib/auth.mjs';

const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function readiness(settings=readSettings()) {
  try {
    validateSettings(settings);
    if(settings.environment==='prod'&&!settings.runEnabled)return {ready:false,status:'draft',message:settings.configurationInspection?'Odczytano konto i wskazane materiały PROD. Trwa dopasowanie interfejsów materiałów; zestaw testowy nadal jest wyłączony.':'PROD przygotowane, nieuruchomione. Do uzupełnienia: adres, konto produkcyjne, sposób logowania i dwa materiały. Uruchamianie jest wyłączone.'};
    if(!settings.accountUserId||!settings.accountDisplayName)return {ready:false,message:'Uzupełnij profil nauczyciela i wybierz „Pobierz dostępy z konta”, aby potwierdzić jego tożsamość.'};
    if(!settings.resources.length)return {ready:false,message:'Przypisz przynajmniej jeden materiał do sprawdzania dla wybranego nauczyciela.'};
    validateSettings(settings,{complete:true});
    const sessionExists = await fs.access(path.resolve(root, settings.sessionFile)).then(()=>true,()=>false);
    const auth = await authAvailability(settings);
    if(!sessionExists && !auth.credentialsConfigured) return {ready:false,message:'Uzupełnij dane logowania wybranego nauczyciela w jego profilu lub, dla dotychczasowego konta, w .env.'};
    await fs.access(path.join(root, 'node_modules/playwright/cli.js'));
    const pending = settings.resources.filter(r=>r.pendingFunctionalSetup).map(r=>r.title+': '+r.pendingFunctionalSetup);
    return { ready: true, message: 'Przed każdym przebiegiem testy sprawdzają sesję i odnawiają logowanie. '+(auth.credentialsConfigured?'Dane logowania wybranego konta są ustawione. W trakcie przebiegu nie loguj się równolegle na to konto.':'Uzupełnij dane logowania w profilu, aby testy mogły odnowić wygasłą sesję.')+(pending.length?' Ograniczenia sprawdzenia materiałów: '+pending.join(' '):'') };
  } catch (e) {
    return { ready: false, message: e.code === 'ENOENT' ? 'Brakuje zapisanej sesji nauczyciela lub bibliotek. Wykonaj kroki z instrukcji.' : e.message };
  }
}
export async function createDashboard({ dataDir = dataRoot, checkReadiness = readiness, settingsProvider=readSettings, launchProcess=spawn, terminateProcess=stopTestProcess, profileStore, credentialVault, inspector=inspectTeacher, serviceConfigRoot=root, notificationService, loadEngineExists=()=>existsSync(path.join(root,'tools','k6.exe')) } = {}) {
  const token = randomBytes(24).toString('hex');
  let active = null,activeRun=null;
  let launching = false,configuring=false;
  const profiles=profileStore||new ProfileStore({file:path.join(dataDir,'profiles.json'),baseProvider:settingsProvider===readSettings?readBaseSettings:settingsProvider});
  const teachers=teacherController({store:profiles,vault:credentialVault||secretStore(root),inspect:inspector});
  const notifications=notificationService||await createMattermost({root,dataDir});
  const historyFile = path.join(dataDir, 'history.json');
  const history = async () => {
    try { return JSON.parse(await fs.readFile(historyFile, 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  };
  async function record(run) {
    await fs.mkdir(dataDir, { recursive: true });
    const rows = await history();
    const next = rows.filter(r => r.id !== run.id);
    next.unshift(run);
    const temp = historyFile + '.tmp';
    await fs.writeFile(temp, JSON.stringify(next, null, 2));
    await fs.rename(temp, historyFile);
  }
  let scheduler;
  const scopeCache=new Map();
  const runScope=config=>({profileLabel:config.profileLabel||config.accountDisplayName||'',materials:(config.resources||[]).filter(resource=>resource.enabled!==false).map(resource=>({id:resource.id,title:resource.title,kind:resource.kind,checkMode:resource.checkMode==='access'?'access':'functional'}))});
  async function scheduleState(){
    const snapshot=scheduler.state();
    snapshot.events=await Promise.all(snapshot.events.map(async event=>{
      if(event.suite!=='functional'||Array.isArray(event.materials)||!/^[a-f0-9-]{36}$/.test(event.runId||''))return event;
      if(!scopeCache.has(event.runId))scopeCache.set(event.runId,fs.readFile(path.join(dataDir,'runs',event.runId,'config.json'),'utf8').then(text=>{const config=JSON.parse(text);return config.environment===environment?runScope(config):null;}).catch(()=>null));
      const scope=await scopeCache.get(event.runId);return scope?{...event,...scope}:event;
    }));
    const retained=new Set(snapshot.events.map(event=>event.runId));for(const id of scopeCache.keys())if(!retained.has(id))scopeCache.delete(id);
    return snapshot;
  }
  const server = http.createServer(async (req, res) => {
    const origin = 'http://127.0.0.1:' + server.address().port;
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    try {
      if (req.headers.host !== new URL(origin).host) return json(403, { error: 'Panel jest dostępny tylko lokalnie.' });
      const url = new URL(req.url, origin);
      if (req.method === 'POST') {
        if (req.headers.origin !== origin || req.headers['x-health-token'] !== token) return json(403, { error: 'Odśwież panel przed uruchomieniem.' });
        if(environment!=='prod'&&['/api/notifications','/api/notifications/test','/api/schedule','/api/schedule/run','/api/schedule/events/clear'].includes(url.pathname))return json(400,{error:'Ta funkcja jest dostępna na PROD.'});
        if(url.pathname==='/api/notifications'||url.pathname==='/api/notifications/test'){
          let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>2000)return json(413,{error:'Za dużo danych.'});}
          try{if(url.pathname.endsWith('/test'))return json(200,{delivery:await notifications.test()});return json(200,{notifications:await notifications.save(body?JSON.parse(body):{})});}catch(e){return json(400,{error:e.message});}
        }
        if(url.pathname==='/api/schedule'||url.pathname==='/api/schedule/run'||url.pathname==='/api/schedule/events/clear'){
          let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4096)return json(413,{error:'Za dużo danych.'});}
          try{const input=body?JSON.parse(body):{};const schedule=url.pathname.endsWith('/clear')?await scheduler.clearEvents():url.pathname.endsWith('/run')?await scheduler.runNow():await scheduler.save(input);return json(200,{schedule});}catch(e){return json(400,{error:e.message});}
        }
        if(url.pathname==='/api/stop'){
          let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1024)return json(413,{error:'Za dużo danych.'});}
          let input;try{input=JSON.parse(body);}catch{return json(400,{error:'Niepoprawne dane zatrzymania.'});}
          const child=active,run=activeRun;
          const schedule=scheduler.state(),stopSchedule=environment==='prod'&&(schedule.enabled||schedule.running);
          if(launching||configuring)return json(409,{error:'Trwa rozpoczynanie testu lub zapis konfiguracji. Spróbuj ponownie za chwilę.'});
          if(child?(!run||run.status!=='RUNNING'||input?.runId!==run.id):input?.runId!=null||!stopSchedule)return json(409,{error:'Stan przebiegu zmienił się. Odśwież panel.'});
          if(run?.stopRequested)return json(202,{stopping:true});
          if(stopSchedule&&input?.scheduleRevision!==schedule.revision)return json(409,{error:'Harmonogram zmienił się. Odśwież panel.'});
          if(run)run.stopRequested=true;
          try{
            if(stopSchedule)await scheduler.stop(input.scheduleRevision);
            if(child){if(run.suite==='load')await fs.writeFile(path.join(dataDir,'runs',run.id,'stop.request'),'stop');else await terminateProcess(child);}
            return json(202,{stopping:!!child,schedule:stopSchedule?scheduler.state():undefined});
          }catch{if(run&&activeRun===run)delete run.stopRequested;return json(500,{error:'Nie udało się zatrzymać testu. Spróbuj ponownie.'});}
        }
        if(url.pathname==='/api/load-stop'){
          if(!activeRun||activeRun.suite!=='load')return json(409,{error:'Brak aktywnego obciążenia.'});
          await fs.writeFile(path.join(dataDir,'runs',activeRun.id,'stop.request'),'stop');return json(200,{stopping:true});
        }
        if(url.pathname==='/api/load-settings'){
          if(environment!=='test')return json(400,{error:'Obciążenie jest dostępne tylko na TEST.'});
          if(active||launching||configuring)return json(409,{error:'Poczekaj na koniec bieżącej operacji.'});configuring=true;
          try{let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>10000)return json(413,{error:'Za dużo danych.'});}
          try{const config=saveLoadSettings(dataDir,JSON.parse(body),profiles.baseProvider(),profiles.read());return json(200,{config});}catch(e){return json(400,{error:e.message});}}finally{configuring=false;}
        }
        if(url.pathname==='/api/service-health'){

          if(active||launching||configuring)return json(409,{error:'Poczekaj na zakończenie bieżącej operacji.'});
          configuring=true;
          try{let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>15000)return json(413,{error:'Za dużo danych.'});}
            let input;try{input=JSON.parse(body);}catch{return json(400,{error:'Niepoprawna konfiguracja.'});}
            try{saveHealthConfig(serviceConfigRoot,input,profiles.baseProvider().environment);}catch(error){return json(400,{error:error.message});}
            return json(200,{saved:true});
          }finally{configuring=false;}
        }
        if(url.pathname.startsWith('/api/teachers/')){
          if(active||launching||configuring)return json(409,{error:'Poczekaj na zakończenie bieżącej operacji.'});
          configuring=true;
          try{
            let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>200000)return json(413,{error:'Za dużo danych formularza.'});}
            let input;try{input=JSON.parse(body);}catch{return json(400,{error:'Niepoprawne dane formularza.'});}
            const result=await teachers.change(url.pathname.slice('/api/teachers/'.length),input);
            return json(200,{...result,profiles:await teachers.state()});
          }finally{configuring=false;}
        }
        if (url.pathname !== '/api/run') return json(404, { error: 'Nie znaleziono.' });
        let payload='';
        for await(const chunk of req){payload+=chunk;if(payload.length>1024)return json(413,{error:'Za duże żądanie.'});}
        let options;
        try{options=payload?JSON.parse(payload):{};}catch{return json(400,{error:'Niepoprawne opcje uruchomienia.'});}
        if(options.forceLogin!==undefined&&typeof options.forceLogin!=='boolean')return json(400,{error:'forceLogin musi być wartością logiczną.'});
        if(['headed','preview'].some(key=>options[key]!==undefined&&typeof options[key]!=='boolean'))return json(400,{error:'Opcje podglądu muszą mieć wartość logiczną.'});
        if(options.speed!==undefined&&![0,250,700].includes(options.speed))return json(400,{error:'Wybierz jedno z dostępnych temp.'});
        if(options.suite!==undefined&&!['functional','services','websites','load'].includes(options.suite))return json(400,{error:'Wybierz właściwy zestaw testów.'});
        if(options.profileId!==undefined&&(typeof options.profileId!=='string'||!profiles.read().teachers.some(t=>t.id===options.profileId&&t.enabled)))return json(400,{error:'Wybierz aktywnego nauczyciela.'});
        const services=options.suite==='services',websites=options.suite==='websites',load=options.suite==='load',anonymous=services||websites||load;
        if(load&&environment!=='test')return json(400,{error:'Obciążenie jest dostępne tylko na TEST.'});
        if(websites&&environment!=='prod')return json(400,{error:'Ten zestaw stron jest dostępny tylko na PROD.'});
        const baseSettings=profiles.baseProvider();
        const serviceHealth=loadHealthConfig(serviceConfigRoot,baseSettings.environment);
        let runSettings=anonymous?{...baseSettings,suite:options.suite,...(services?{serviceHealth}:{})}:profiles.settings(options.profileId);
        if(load){try{const config=validateLoad(loadSettings(dataDir),baseSettings,profiles.read());const ready=loadReadiness(config,baseSettings,profiles.read(),loadEngineExists());if(!ready.ready)return json(409,{error:ready.message});runSettings={...baseSettings,suite:'load',loadTest:config,loadAccounts:config.scenario==='teacher-panel'?config.profileIds.slice(0,config.users).map(id=>profiles.settings(id)):[]};}catch(error){return json(409,{error:error.message});}}
        try{if(!anonymous)assertRunnable(runSettings);}catch(error){return json(error.code==='PROD_DISABLED'?423:409,{error:error.message});}
        if (active || launching || configuring) return json(409, { error: 'Testy już trwają.' });
        launching = true;
        try {
        const state = load?loadReadiness(runSettings.loadTest,baseSettings,profiles.read(),loadEngineExists()):websites?websiteReadiness(baseSettings):services?healthReadiness(serviceHealth,baseSettings):await checkReadiness(runSettings);
        if (!state.ready) return json(409, { error: state.message });
        const id = randomUUID();
        const run = { id, title: load?'Obciążenie TEST — '+runSettings.loadTest.users+' użytkowników':websites?'Dostępność stron PROD — 3 kontrole':services?'Endpointy healthcheck '+environment.toUpperCase()+' — 9 kontroli':'Smoke moje.gwo '+environment.toUpperCase()+' — '+runSettings.profileLabel+' — '+scenarioCount(runSettings)+' kontroli', suite:options.suite||'functional', profileId:anonymous?null:runSettings.profileId, profileLabel:websites?'Strony — bez logowania':services?'Usługi — bez logowania':runSettings.profileLabel, accountEmail:anonymous?null:runSettings.accountEmail, expectedCount:scenarioCount(runSettings), environment: baseSettings.environment, loadTest:load?runSettings.loadTest:undefined, status: 'RUNNING', startedAt: new Date().toISOString(), report: null, trigger:options.trigger==='schedule'?'schedule':'manual', forceLogin:options.forceLogin===true, preview:!anonymous&&options.preview!==false, headed:!anonymous&&options.headed===true, speed:options.speed||0 };
        const runDir = path.join(dataDir, 'runs', id);
        if(!anonymous)Object.assign(run,runScope(runSettings));
        await fs.mkdir(runDir, { recursive: true });
        await fs.writeFile(path.join(runDir,'config.json'),JSON.stringify(runSettings,null,2));
        await record(run);
        const child = launchProcess(process.execPath, load?[path.join(root,'scripts','run-load.mjs')]:[path.join(root, 'node_modules/playwright/cli.js'), 'test', ...(options.headed?['--headed']:[]), '--output', path.join(runDir, 'artifacts')], {
          cwd: root, windowsHide: true, stdio: 'ignore',detached:process.platform!=='win32',
          env: { ...process.env, MOJE_GWO_ENV:environment, GWO_LOAD_PARENT_PID:String(process.pid), MOJE_GWO_SUITE:options.suite||'functional', MOJE_GWO_RUN_CONFIG:path.join(runDir,'config.json'), MOJE_GWO_PROFILE_ID:anonymous?'':runSettings.profileId, MOJE_GWO_LIVE_DIR:path.join(runDir,'live'), MOJE_GWO_PREVIEW:anonymous||options.preview===false?'0':'1', MOJE_GWO_SLOW_MO:String(options.speed||0), MOJE_GWO_FORCE_LOGIN:options.forceLogin===true?'1':'', PLAYWRIGHT_HTML_OPEN: 'never', PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(runDir, 'report'), PLAYWRIGHT_JSON_OUTPUT_FILE: path.join(runDir, 'results.json'), PLAYWRIGHT_JUNIT_OUTPUT_FILE: path.join(runDir, 'junit.xml') }
        });
        active = child;activeRun=run;
        let finished = false;
        const finish = async code => {
          if (finished) return; finished = true;
          try {
            let result;
            try { result = JSON.parse(await fs.readFile(path.join(runDir, 'results.json'), 'utf8')); } catch {}
            const stats = result?.stats || {};
            run.counts = { passed: stats.expected || 0, failed: stats.unexpected || 0, skipped: stats.skipped || 0, flaky: stats.flaky || 0 };
            run.status = code === 0 && run.counts.passed === run.expectedCount && !run.counts.failed && !run.counts.skipped && !run.counts.flaky ? 'PASS' : 'FAIL';
            if(run.stopRequested){run.status='STOPPED';run.message='Test zatrzymany przez użytkownika.';}
            run.finishedAt = new Date().toISOString();
            try {
              if(anonymous)throw new Error('NO_TEACHER_LOGIN');
              const authSummary=JSON.parse(await fs.readFile(path.join(path.dirname(path.resolve(root,runSettings.sessionFile)),'last-auth.json'),'utf8'));
              if(authSummary.startedAt>=run.startedAt){run.authentication=authSummary;if(authSummary.status==='FAIL'&&!run.stopRequested)run.message=authSummary.message;}
            } catch {}
            try { await fs.access(path.join(runDir, 'report/index.html')); run.report = '/report/' + id + '/'; } catch {}
            await record(run);
            try{run.notification=await notifications.notify(run);}catch{run.notification={status:'FAILED'};}
            await record(run);
          } catch (e) { console.error('Nie udało się zapisać wyniku:', e.message); }
          finally { active = null;activeRun=null; }
        };
        child.once('error', () => void finish(1));
        child.once('exit', code => void finish(code));
        return json(202, run);
        } finally { launching = false; }
      }
      if (req.method !== 'GET') return json(405, { error: 'Niedozwolona metoda.' });
      if (url.pathname === '/api/state') return json(200, { ...(await checkReadiness(profiles.settings())), scenarios: scenarios(profiles.settings(),{healthConfig:loadHealthConfig(serviceConfigRoot,profiles.baseProvider().environment)}), serviceHealth:{config:loadHealthConfig(serviceConfigRoot,profiles.baseProvider().environment),...healthReadiness(loadHealthConfig(serviceConfigRoot,profiles.baseProvider().environment),profiles.baseProvider()),expectedCount:9}, environment, websiteAvailability:websiteReadiness(profiles.baseProvider()), loadTesting:{config:loadSettings(dataDir),engineInstalled:loadEngineExists(),...loadReadiness(loadSettings(dataDir),profiles.baseProvider(),profiles.read(),loadEngineExists()),running:activeRun?.suite==='load'}, expectedCount:scenarioCount(profiles.settings()), profiles:await teachers.state(), schedule:await scheduleState(), notifications:await notifications.state(), history: await history(), running: !!active || launching, activeRunId:activeRun?.id||null, stopping:activeRun?.stopRequested===true, busy:configuring });
      const asset=url.pathname.match(/^\/api\/runs\/([a-f0-9-]{36})\/(events|preview)$/);
      if(asset){
        if(!(await history()).some(run=>run.id===asset[1]))return json(404,{error:'Nie znaleziono przebiegu.'});
        const directory=path.join(dataDir,'runs',asset[1],'live');
        if(asset[2]==='preview'){
          const bytes=await fs.readFile(path.join(directory,'preview.jpg'));
          res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(bytes);
        }
        let events=[];
        try { const content=await fs.readFile(path.join(directory,'events.jsonl'),'utf8');events=content.split('\n').filter(Boolean).flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}}).slice(-500); } catch(e){if(e.code!=='ENOENT')throw e;}
        const previewUpdatedAt=await fs.stat(path.join(directory,'preview.jpg')).then(s=>s.mtimeMs,()=>null);
        return json(200,{events,previewUpdatedAt});
      }
      if(url.pathname==='/panel.css'){
        res.writeHead(200,{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-store'});return res.end(await fs.readFile(new URL('./panel.css',import.meta.url)));
      }
      if(['/select-chevron-light.svg','/select-chevron-dark.svg'].includes(url.pathname)){res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(await fs.readFile(new URL('.'+url.pathname,import.meta.url)));}
      if(url.pathname==='/scenarios.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(await fs.readFile(new URL('./scenarios.js',import.meta.url)));}
      if(url.pathname==='/theme.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(await fs.readFile(new URL('./theme.js',import.meta.url)));}
      if(url.pathname==='/environment-client.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(await fs.readFile(new URL('./environment-client.js',import.meta.url)));}
      if(url.pathname==='/load-testing.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(await fs.readFile(new URL('./load-testing.js',import.meta.url)));}
      if(url.pathname==='/notifications.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(await fs.readFile(new URL('./notifications.js',import.meta.url)));}
      if(url.pathname==='/schedule.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(await fs.readFile(new URL('./schedule.js',import.meta.url)));}
      if(url.pathname==='/service-health.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(await fs.readFile(new URL('./service-health.js',import.meta.url)));}
      if(url.pathname==='/teachers.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(await fs.readFile(new URL('./teachers.js',import.meta.url)));}
      if (url.pathname === '/panel.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(await fs.readFile(new URL('./panel.js', import.meta.url)));
      }
      if(url.pathname==='/instruction/materials'){
        const guide=await fs.readFile(path.join(root,'docs/INSTRUKCJA_KONFIGURACJI.md'),'utf8');
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'"});
        return res.end(renderMaterialGuide(guide,environment));
      }
      const guideImage=url.pathname.match(/^\/instruction\/images\/([a-z0-9-]+\.png)$/);
      if(guideImage){const bytes=await fs.readFile(path.join(root,'docs/images',guideImage[1]));res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});return res.end(bytes);}
      if (url.pathname === '/instruction') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(await fs.readFile(path.join(root, 'README.md')));
      }
      if (url.pathname.startsWith('/report/')) {
        const match = url.pathname.match(/^\/report\/([a-f0-9-]{36})\/(.*)$/);
        if (!match) return json(404, { error: 'Nie znaleziono raportu.' });
        const reportRoot = path.join(dataDir, 'runs', match[1], 'report');
        const file = path.resolve(reportRoot, decodeURIComponent(match[2] || 'index.html'));
        if (!file.startsWith(reportRoot + path.sep)) return json(403, { error: 'Niedozwolona ścieżka.' });
        const bytes = await fs.readFile(file);
        const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.zip': 'application/zip', '.webm': 'video/webm' }[path.extname(file)] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff' });
        return res.end(bytes);
      }
      if (url.pathname !== '/') return json(404, { error: 'Nie znaleziono.' });
      const state = await checkReadiness(profiles.settings());
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control':'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; frame-ancestors http://127.0.0.1:4180; object-src 'none'; base-uri 'none'" });
      res.end(renderPanel({environment,token,state,scenarios:scenarios(profiles.settings(),{healthConfig:loadHealthConfig(serviceConfigRoot,profiles.baseProvider().environment)})}));
    } catch (e) { json(e.status || (e.code === 'ENOENT' ? 404 : 500), { error: e.message }); }
  });
  scheduler=await createLocalSchedule({file:path.join(dataDir,'schedule.json'),profiles:()=>profiles.read(),isBusy:()=>!!active||launching||configuring,
    startRun:async options=>{
      const origin='http://127.0.0.1:'+server.address().port;
      const response=await fetch(origin+'/api/run',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Health-Token':token},body:JSON.stringify(options),signal:AbortSignal.timeout(30000)});
      const run=await response.json();if(!response.ok)throw new Error('Nie uruchomiono zestawu.');return run;
    },getRun:async id=>{const run=(await history()).find(r=>r.id===id);return run&&active?{...run,status:'RUNNING'}:run;}});
  server.on('listening',()=>{if(environment==='prod')scheduler.start();});
  server.on('close', () => { scheduler.close();if(activeRun?.suite==='load')void fs.writeFile(path.join(dataDir,'runs',activeRun.id,'stop.request'),'stop');else active?.kill(); });
  return server;
}
