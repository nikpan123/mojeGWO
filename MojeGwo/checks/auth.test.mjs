import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from '@playwright/test';
import {ensureSession,readCredentials} from '../lib/auth.mjs';
import {readSettings} from '../lib/settings.mjs';

const canary='DUMMY_ONLY-do-not-persist-7!';
async function harness(options={}){
  const settings=readSettings();
  const directory=await fs.mkdtemp(path.join(tmpdir(),'mojegwo-auth-check-'));
  const stateFile=path.join(directory,'state.json');
  const summaryFile=path.join(directory,'summary.json');
  const browser=await chromium.launch({headless:true});
  let submissions=0,credentialReads=0,portalSubmissions=0,portalReads=0;
  const requests=[];
  const protect=async context=>{
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      requests.push(url.origin+url.pathname);
      if(options.portalGate&&url.origin===settings.baseURL&&url.pathname==='/uzytkownik/'){
        if(request.method()==='POST'){
          portalSubmissions++;
          assert.equal(new URLSearchParams(request.postData()).get('password'),canary+'-portal');
          return route.fulfill({contentType:'text/html; charset=utf-8',headers:{'Set-Cookie':'mock_session=1; Path=/; Secure; HttpOnly'},body:'<script>location.href='+JSON.stringify(settings.baseURL+'/accesses')+'</script>'});
        }
        return route.fulfill({contentType:'text/html; charset=utf-8',body:`<form method="post" action="${options.portalBadAction?'https://gitlab.gwo.pl/users/sign_in':'/uzytkownik/'}"><input name="login"><input name="password" type="password"><button>Zaloguj się</button></form>`});
      }
      if(url.origin===settings.baseURL && url.pathname===settings.identityAPI)return route.fulfill({json:{userId:options.wrongAccount?-1:settings.accountUserId,name:settings.accountDisplayName,userFunctions:[settings.requiredUserFunction]}});
      if(url.origin===settings.baseURL && (url.pathname==='/accesses'||request.headers().cookie?.includes('mock_session=1'))){
        return route.fulfill({contentType:'text/html; charset=utf-8',headers:{'Set-Cookie':'mock_session=1; Path=/; Secure; HttpOnly'},body:`<div class="main-toolbar__desktop"><div class="main-toolbar__user-name">${settings.accountDisplayName}</div></div><script>fetch(${JSON.stringify(settings.identityAPI)})</script>`});
      }
      if(url.origin===settings.baseURL)return route.fulfill({contentType:'text/html; charset=utf-8',body:'<script>location.href="https://gitlab.gwo.pl/users/sign_in"</script>'});
      if(url.origin==='https://gitlab.gwo.pl'&&request.method()==='GET')return route.fulfill({contentType:'text/html; charset=utf-8',body:options.challenge?'<input id="user_otp_attempt" autocomplete="one-time-code">':`<form method="post" action="${options.badAction?'https://files.gwotest.pl/collect':'/users/sign_in'}"><input id="user_login" name="login"><input id="user_password" type="password" name="password"><button type="submit">Sign in</button></form>`});
      if(url.origin==='https://gitlab.gwo.pl'&&request.method()==='POST'){
        submissions++;
        assert.equal(new URLSearchParams(request.postData()).get('password'),canary);
        return route.fulfill({contentType:'text/html; charset=utf-8',body:'<script>location.href='+JSON.stringify(settings.baseURL+(options.portalGate?'/uzytkownik/':'/accesses'))+'</script>'});
      }
      throw new Error('Test próbował wyjść poza przechwycony ruch lokalnego scenariusza.');
    });
    return new Set();
  };
  const run=extra=>ensureSession({settings,browser,stateFile,summaryFile,protect,credentialsProvider:async()=>{credentialReads++;return options.noCredentials?null:{login:'dummy-user',password:canary};},portalCredentialsProvider:async()=>{portalReads++;return options.portalNoCredentials?null:{login:'dummy-teacher',password:canary+'-portal'};},...extra}).catch(async error=>{if(process.env.AUTH_TEST_DIAGNOSTIC==='1')console.log(JSON.stringify({requests,summary:JSON.parse(await fs.readFile(summaryFile,'utf8'))}));throw error;});
  return {run,stateFile,summaryFile,directory,counts:()=>({submissions,credentialReads}),portalCounts:()=>({portalSubmissions,portalReads}),close:async()=>{await browser.close();await fs.rm(directory,{recursive:true,force:true});}};
}

test('wczytanie .env i pierwszeństwo zmiennych procesu bez ujawniania wartości',async()=>{
 const directory=await fs.mkdtemp(path.join(tmpdir(),'mojegwo-env-check-'));
 try{
   const envFile=path.join(directory,'.env');
   await fs.writeFile(envFile,"GITLAB_USERNAME='dummy'\nGITLAB_PASSWORD='"+canary+"'\n");
   assert.deepEqual(await readCredentials({env:{},envFile}),{login:'dummy',password:canary});
   assert.equal((await readCredentials({env:{GITLAB_USERNAME:'override'},envFile})).login,'override');
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('GitLab i konto nauczyciela używają osobnych danych i zapisują wspólną zweryfikowaną sesję',async()=>{
 const h=await harness({portalGate:true});
 try{
   const result=await h.run({forceFresh:true});
   assert.equal(result.gitlabLogin,true);assert.equal(result.portalLogin,true);
   assert.deepEqual(h.portalCounts(),{portalSubmissions:1,portalReads:1});
   assert.equal((await h.run()).mode,'saved-session');
   assert.deepEqual(h.portalCounts(),{portalSubmissions:1,portalReads:1});
   assert.ok(!(await fs.readFile(h.summaryFile,'utf8')).includes(canary));
 }finally{await h.close();}
});

for(const scenario of [
 {name:'brak danych portalu nie powoduje użycia hasła GitLaba',options:{portalGate:true,portalNoCredentials:true},code:'PORTAL_CREDENTIALS_MISSING',reads:1},
 {name:'obcy formularz portalu blokuje pobranie jego hasła',options:{portalGate:true,portalBadAction:true},code:'UNEXPECTED_PORTAL_FORM',reads:0}
])test(scenario.name,async()=>{
 const h=await harness(scenario.options);
 try{
   await assert.rejects(h.run({forceFresh:true}),e=>e.code===scenario.code&&!e.message.includes(canary));
   assert.equal(h.portalCounts().portalReads,scenario.reads);
   assert.equal(h.portalCounts().portalSubmissions,0);
 }finally{await h.close();}
});

test('świeże logowanie, ponowne użycie sesji i odnowienie po utracie ciasteczka',async()=>{
 const h=await harness();
 try{
   assert.equal((await h.run({forceFresh:true})).mode,'password-login');
   assert.equal((await h.run()).mode,'saved-session');
   assert.deepEqual(h.counts(),{submissions:1,credentialReads:1});
   const state=JSON.parse(await fs.readFile(h.stateFile,'utf8'));state.cookies=[];
   await fs.writeFile(h.stateFile,JSON.stringify(state));
   assert.equal((await h.run()).mode,'password-login');
   assert.deepEqual(h.counts(),{submissions:2,credentialReads:2});
   assert.ok(!(await fs.readFile(h.summaryFile,'utf8')).includes(canary));
   assert.ok(!(await fs.readFile(h.stateFile,'utf8')).includes(canary));
 }finally{await h.close();}
});

for(const scenario of [
 {name:'obcy adres formularza blokuje odczyt hasła',options:{badAction:true},code:'UNEXPECTED_LOGIN_FORM',reads:0},
 {name:'MFA wymaga obsługi użytkownika i nie pobiera hasła',options:{challenge:true},code:'INTERACTIVE_LOGIN_REQUIRED',reads:0},
 {name:'brak danych daje czytelny błąd bez wysyłania formularza',options:{noCredentials:true},code:'CREDENTIALS_MISSING',reads:1},
 {name:'inne konto nie zastępuje sesji właściwego nauczyciela',options:{wrongAccount:true},code:'WRONG_ACCOUNT',reads:1}
])test(scenario.name,async()=>{
 const h=await harness(scenario.options);
 try{
   await assert.rejects(h.run({forceFresh:true}),e=>e.code===scenario.code&&!e.message.includes(canary));
   assert.equal(h.counts().credentialReads,scenario.reads);
   assert.equal(await fs.access(h.stateFile).then(()=>true,()=>false),false);
   assert.ok(!(await fs.readFile(h.summaryFile,'utf8')).includes(canary));
 }finally{await h.close();}
});
