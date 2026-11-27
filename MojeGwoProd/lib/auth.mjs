import {secretStore} from './profile-secrets.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {chromium} from '@playwright/test';
import {root,readSettings,validateSettings,protectContext,assertSafeURL,assertRunnable} from './settings.mjs';
import {necessaryCookiesOnly} from './cookies.mjs';

const gitlabOrigin='https://gitlab.gwo.pl';
export class AuthenticationError extends Error {
  constructor(code,message){super(message);this.name='AuthenticationError';this.code=code;}
}
export async function readCredentials({env=process.env,envFile=path.join(root,'.env'),service='gitlab',profileId='default'}={}) {
  let registry;try{registry=JSON.parse(await fs.readFile(path.join(root,'.health','profiles.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const profile=registry?.teachers.find(t=>t.id===profileId);
  if((profileId!=='default'||profile?.credentialMode==='vault')){
    const saved=await secretStore(root).read(profileId,service);
    if(saved)return saved;
    if(service==='portal'||!profile?.sharedGitlab)return null;
  }
  let file={};
  try { file=parseEnv(await fs.readFile(envFile,'utf8')); }
  catch(e){if(e.code!=='ENOENT')throw new AuthenticationError('ENV_READ_FAILED','Nie można odczytać lokalnego pliku .env.');}
  const prefix=service==='portal'?'MOJE_GWO_PROD':'GITLAB_PROD';
  const login=env[prefix+'_USERNAME']??file[prefix+'_USERNAME'];
  const password=env[prefix+'_PASSWORD']??file[prefix+'_PASSWORD'];
  return login&&password?{login,password}:null;
}
export async function authAvailability(settings=readSettings()){
 const profileId=settings.profileId||'default';
 let registry;try{registry=JSON.parse(await fs.readFile(path.join(root,'.health','profiles.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const profile=registry?.teachers.find(t=>t.id===profileId);
 let gitlabConfigured=false,portalConfigured=false;
 if(profileId!=='default'||profile?.credentialMode==='vault'){
  const status=await secretStore(root).status(profileId);portalConfigured=status.portal;gitlabConfigured=status.gitlab;
  if(!gitlabConfigured&&profile?.sharedGitlab)gitlabConfigured=!!await readCredentials({service:'gitlab',profileId:'default'});
 }else{gitlabConfigured=!!await readCredentials();portalConfigured=!!await readCredentials({service:'portal'});}
 return {credentialsConfigured:portalConfigured&&(settings.authMode==='portal'||gitlabConfigured),gitlabConfigured,portalConfigured};
}
const exists=async file=>fs.access(file).then(()=>true,()=>false);

async function verifyTeacher(page,settings,identityPromise,inspection=false){
  if(new URL(page.url()).origin!==new URL(settings.baseURL).origin)throw new AuthenticationError('WRONG_DESTINATION','Logowanie nie wróciło do panelu moje.gwo PROD.');
  const target=assertSafeURL(new URL(settings.identityAPI,settings.baseURL).href,settings);
  if(target.origin!==new URL(settings.baseURL).origin)throw new AuthenticationError('WRONG_IDENTITY_API','Sprawdzenie konta musi odbywać się na moje.gwo PROD.');
  const user=page.locator(settings.authenticatedUserSelector);
  await user.waitFor({state:'visible',timeout:20000});
  // Panel może dodawać własny nagłówek autoryzacji. Weryfikujemy jego rzeczywistą odpowiedź.
  const result=await identityPromise;
  if(!result)throw new AuthenticationError('IDENTITY_UNAVAILABLE','Nie udało się potwierdzić zalogowania przez API PROD.');
  if(inspection&&!settings.accountUserId){
    if(!result.roles?.includes(settings.requiredUserFunction))throw new AuthenticationError('WRONG_ROLE','Konto nie ma wymaganej roli nauczyciela.');
    settings.accountUserId=result.userId;settings.accountDisplayName=result.name;
  }
  if(result.userId!==settings.accountUserId || result.name!==settings.accountDisplayName || !result.roles?.includes(settings.requiredUserFunction))throw new AuthenticationError('WRONG_ACCOUNT','Zalogowano inne konto albo brakuje wymaganej roli nauczyciela. Sesja nie została zapisana.');
  if((await user.innerText()).trim()!==settings.accountDisplayName)throw new AuthenticationError('WRONG_ACCOUNT','Panel wyświetla inne konto nauczyciela.');
}

export async function ensureSession({forceFresh=process.env.MOJE_GWO_PROD_FORCE_LOGIN==='1',settings=readSettings(),browser:providedBrowser,stateFile,summaryFile,credentialsProvider=()=>readCredentials({profileId:settings.profileId}),portalCredentialsProvider=()=>readCredentials({service:'portal',profileId:settings.profileId}),protect=protectContext,inspection=false}={}){
  if(inspection)validateSettings(settings);else assertRunnable(settings);
  stateFile??=path.resolve(root,settings.sessionFile);
  summaryFile??=path.join(path.dirname(stateFile),'last-auth.json');
  let browser=providedBrowser,context,currentPage,contextBlocked;
  const summary={startedAt:new Date().toISOString(),environment:'prod',status:'RUNNING',mode:'session',forcedFresh:forceFresh};
  try{
    if(!browser){
      const installed=await exists(chromium.executablePath());
      browser=await chromium.launch({headless:true,...(installed?{}:{channel:'msedge'})});
    }
    const stored=!forceFresh&&await exists(stateFile);
    context=await browser.newContext({viewport:{width:1920,height:1080},screen:{width:1920,height:1080},...(stored?{storageState:stateFile}:{}),serviceWorkers:'block',acceptDownloads:false});
    const blocked=await protect(context,settings);
    contextBlocked=blocked;
    const page=await context.newPage();
    currentPage=page;
    const identityTarget=assertSafeURL(new URL(settings.identityAPI,settings.baseURL).href,settings);
    if(identityTarget.origin!==new URL(settings.baseURL).origin)throw new AuthenticationError('WRONG_IDENTITY_API','Sprawdzenie konta musi odbywać się na moje.gwo PROD.');
    const waitForIdentity=()=>page.waitForResponse(r=>r.ok()&&new URL(r.url()).origin===identityTarget.origin&&new URL(r.url()).pathname===identityTarget.pathname,{timeout:90000}).then(r=>r.json()).then(data=>({userId:data.userId,name:data.name,roles:data.userFunctions})).catch(()=>null);
    let identityPromise=waitForIdentity();
    page.on('response',r=>{const u=new URL(r.url());if(u.origin===identityTarget.origin&&u.pathname===identityTarget.pathname)summary.identityStatus=r.status();});
    const navigationOrigins=new Set();
    page.on('request',request=>{if(request.isNavigationRequest())navigationOrigins.add(new URL(request.url()).origin);});
    summary.phase='open-portal';
    await page.goto(settings.baseURL,{waitUntil:'domcontentloaded',timeout:30000});
    let stage;
    try{
      stage=await Promise.any([
        page.locator(settings.authenticatedUserSelector).waitFor({state:'visible',timeout:25000}).then(()=> 'portal'),
        page.locator('#user_password').waitFor({state:'visible',timeout:25000}).then(()=> 'login'),
        page.locator('input[name="password"]').waitFor({state:'visible',timeout:25000}).then(()=> 'portal-login'),
        page.locator('input[autocomplete="one-time-code"], #user_otp_attempt, iframe[src*="captcha"]').first().waitFor({state:'visible',timeout:25000}).then(()=> 'challenge')
      ]);
    }catch{throw new AuthenticationError('LOGIN_SCREEN_UNAVAILABLE','Nie załadowano panelu ani formularza logowania. Sprawdź dostępność PROD/GitLaba i dozwolone domeny.');}
    if(stage==='challenge')throw new AuthenticationError('INTERACTIVE_LOGIN_REQUIRED','GitLab wymaga MFA lub CAPTCHA. Testy nie omijają tego kroku.');
    if(stage==='login'){
      if(settings.authMode!=='gitlab-and-portal')throw new AuthenticationError('UNEXPECTED_SSO','Nie potwierdzono użycia GitLaba w konfiguracji PROD.');
      summary.phase='gitlab-login';
      const current=new URL(page.url());
      if(current.origin!==gitlabOrigin||current.pathname!=='/users/sign_in')throw new AuthenticationError('UNEXPECTED_LOGIN_PAGE','Formularz logowania ma nieoczekiwany adres. Nie wpisano danych.');
      const form=page.locator('form').filter({has:page.locator('#user_password')});
      const action=new URL(await form.getAttribute('action')||current.href,current);
      if(action.origin!==gitlabOrigin||action.pathname!=='/users/sign_in'||(await form.getAttribute('method'))?.toLowerCase()!=='post')throw new AuthenticationError('UNEXPECTED_LOGIN_FORM','Formularz nie wysyła danych do właściwego logowania GitLaba.');
      const credentials=await credentialsProvider();
      if(!credentials)throw new AuthenticationError('CREDENTIALS_MISSING','Uzupełnij logowanie GitLaba wybranego profilu w zakładce Nauczyciele i materiały lub wspólnym .env.');
      // Ten kontekst nie ma trace, wideo ani zrzutów ekranu; wyjątki z fill nie opuszczają modułu.
      try{
        await page.locator('#user_login').fill(credentials.login);
        await page.locator('#user_password').fill(credentials.password);
        await form.getByRole('button',{name:'Sign in',exact:true}).click();
      }catch{throw new AuthenticationError('LOGIN_SUBMIT_FAILED','Nie udało się wypełnić lub wysłać formularza GitLaba. Dane nie są zapisywane w raporcie.');}
      finally{credentials.password='';}
      try{await page.waitForURL(u=>u.origin===new URL(settings.baseURL).origin,{timeout:30000,waitUntil:'domcontentloaded'});}
      catch{
        if(await page.locator('input[autocomplete="one-time-code"], #user_otp_attempt, iframe[src*="captcha"]').first().isVisible().catch(()=>false))throw new AuthenticationError('INTERACTIVE_LOGIN_REQUIRED','GitLab wymaga MFA lub CAPTCHA. Testy nie omijają tego kroku.');
        throw new AuthenticationError('LOGIN_NOT_COMPLETED','GitLab nie zakończył logowania. Sprawdź dane w .env lub wymaganie ręcznej zgody/MFA. Wykonano jedną próbę.');
      }
      summary.mode='password-login';
      summary.gitlabLogin=true;
    }else summary.mode=navigationOrigins.has(gitlabOrigin)?'sso-renewed':'saved-session';
    const catalogURL=new URL(settings.catalogPath,settings.baseURL);
    const atPortalLogin=new URL(page.url()).origin===catalogURL.origin&&new URL(page.url()).pathname.replace(/\/$/,'')==='/uzytkownik';
    if(!atPortalLogin&&new URL(page.url()).pathname!==catalogURL.pathname){identityPromise=waitForIdentity();await page.goto(catalogURL.href,{waitUntil:'domcontentloaded',timeout:30000});}
    summary.phase='portal-form-or-panel';
    let portalStage;
    try{portalStage=await Promise.any([
      page.locator(settings.authenticatedUserSelector).waitFor({state:'visible',timeout:20000}).then(()=> 'portal'),
      page.locator('input[name="password"]').waitFor({state:'visible',timeout:20000}).then(()=> 'portal-login')
    ]);}catch{throw new AuthenticationError('PORTAL_SCREEN_UNAVAILABLE','Po GitLabie nie załadowano panelu ani formularza konta nauczyciela.');}
    if(portalStage==='portal-login'){
      summary.phase='portal-login';
      const current=new URL(page.url());
      if(current.origin!==new URL(settings.baseURL).origin||current.pathname.replace(/\/$/,'')!=='/uzytkownik')throw new AuthenticationError('UNEXPECTED_PORTAL_LOGIN','Formularz konta nauczyciela ma nieoczekiwany adres.');
      const form=page.locator('form').filter({has:page.locator('input[name="password"]')});
      await form.waitFor({state:'visible',timeout:15000});
      const action=new URL(await form.getAttribute('action')||current.href,current);
      const declaredMethod=(await form.getAttribute('method')||'').toLowerCase();
      if(action.origin!==current.origin||(declaredMethod&&declaredMethod!=='post'))throw new AuthenticationError('UNEXPECTED_PORTAL_FORM','Formularz konta nauczyciela ma nieoczekiwany adres lub metodę.');
      const credentials=await portalCredentialsProvider();
      if(!credentials)throw new AuthenticationError('PORTAL_CREDENTIALS_MISSING','Uzupełnij hasło wybranego nauczyciela w jego profilu. Dotychczasowy profil może korzystać z .env.');
      let rejectSubmission;
      const unsafeSubmission=new Promise((_,reject)=>{rejectSubmission=reject;});
      const submissionGuard=async route=>{
        const request=route.request(),destination=new URL(request.url());
        if((!['GET','HEAD'].includes(request.method())&&(request.method()!=='POST'||destination.origin!==current.origin))||(request.method()==='GET'&&destination.searchParams.has('password'))){
          rejectSubmission(new AuthenticationError('UNSAFE_PORTAL_SUBMISSION','Zablokowano wysłanie danych konta nauczyciela niewłaściwą metodą lub do innej domeny.'));
          await route.abort('blockedbyclient');return;
        }
        await route.fallback();
      };
      await context.route('**/*',submissionGuard);
      try{
        await form.locator('input[name="login"]').fill(credentials.login);
        await form.locator('input[name="password"]').fill(credentials.password);
        await Promise.race([(async()=>{await form.getByRole('button',{name:'Zaloguj się',exact:true}).click();await page.locator('input[name="password"]').waitFor({state:'hidden',timeout:25000});})(),unsafeSubmission]);
      }catch(error){if(error instanceof AuthenticationError)throw error;throw new AuthenticationError('PORTAL_LOGIN_FAILED','Nie zakończono logowania konta nauczyciela. Sprawdź MOJE_GWO_PROD_USERNAME i MOJE_GWO_PROD_PASSWORD w .env. Wykonano jedną próbę.');}
      finally{credentials.password='';await context.unroute('**/*',submissionGuard);}
      summary.mode='password-login';summary.portalLogin=true;
      identityPromise=waitForIdentity();
      await page.goto(catalogURL.href,{waitUntil:'domcontentloaded',timeout:30000});
    }
    summary.phase='verify-teacher';
    await verifyTeacher(page,settings,identityPromise,inspection);
    await necessaryCookiesOnly(page);
    if(blocked.size)throw new AuthenticationError('BLOCKED_AUTH_HOST','Podczas logowania zablokowano wymaganą domenę poza listą PROD/SSO.');
    await fs.mkdir(path.dirname(stateFile),{recursive:true});
    summary.phase='save-session';
    const temporary=stateFile+'.pending';
    await context.storageState({path:temporary,indexedDB:true});
    await fs.rename(temporary,stateFile);
    Object.assign(summary,{status:'PASS',finishedAt:new Date().toISOString(),userId:settings.accountUserId,accountDisplayName:settings.accountDisplayName});
    await fs.writeFile(summaryFile,JSON.stringify(summary,null,2));
    return summary;
  }catch(error){
    const safe=error instanceof AuthenticationError?error:new AuthenticationError('AUTH_FLOW_FAILED','Automatyczne logowanie nie powiodło się. Szczegóły formularza i dane dostępowe nie są zapisywane w raporcie.');
    if(currentPage){try{const u=new URL(currentPage.url());summary.lastOrigin=u.origin;summary.lastPath=u.pathname;}catch{}}
    summary.blockedOrigins=[...(contextBlocked||[])];
    Object.assign(summary,{status:'FAIL',finishedAt:new Date().toISOString(),code:safe.code,message:safe.message});
    await fs.mkdir(path.dirname(summaryFile),{recursive:true}).catch(()=>{});
    await fs.writeFile(summaryFile,JSON.stringify(summary,null,2)).catch(()=>{});
    throw safe;
  }finally{await context?.close();if(!providedBrowser)await browser?.close();}
}
