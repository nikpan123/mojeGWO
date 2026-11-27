import {indexAccessCards} from './access-cards.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {ensureSession} from './auth.mjs';
import {root,protectContext} from './settings.mjs';
import {permittedAppHost} from './profile-store.mjs';
export class InspectionError extends Error{constructor(code,message){super(message);this.name='InspectionError';this.code=code;}}
export async function inspectTeacher(settings,{ensure=ensureSession,launch=()=>chromium.launch({headless:true}),protect=protectContext}={}){
 const summary=await ensure({settings,forceFresh:false,inspection:true});
 const identity={userId:summary.userId,name:summary.accountDisplayName};
 let browser,phase='navigation';try{browser=await launch();}catch{throw new InspectionError('BROWSER_UNAVAILABLE','Nie można uruchomić przeglądarki. Zainstaluj Chromium poleceniem npx.cmd playwright install chromium.');}
 try{
  const context=await browser.newContext({viewport:{width:1920,height:1080},screen:{width:1920,height:1080},storageState:path.resolve(root,settings.sessionFile),serviceWorkers:'block',acceptDownloads:false});
  const blocked=await protect(context,settings);const page=await context.newPage();
  const kinds=[['multipodrecznik','/api/v3/my_accesses/mhb','Multipodręczniki / Multićwiczenia'],['aplikacja','/api/v3/my_accesses/app','Aplikacje']];
  const responses=kinds.map(([,pathname])=>page.waitForResponse(r=>r.ok()&&new URL(r.url()).origin===new URL(settings.baseURL).origin&&new URL(r.url()).pathname===pathname,{timeout:25000}).then(r=>r.json()));
  const allResponses=Promise.all(responses);allResponses.catch(()=>{});
  await page.goto(new URL(settings.catalogPath,settings.baseURL).href,{waitUntil:'domcontentloaded'});
  phase='access-data';const datasets=await allResponses;const materials=[];
  phase='catalog';
  for(let index=0;index<kinds.length;index++){
   if(!Array.isArray(datasets[index].accesses))throw new InspectionError('INVALID_ACCESS_DATA','Portal nie zwrócił poprawnej listy dostępów nauczyciela. Dotychczasowe materiały pozostają zachowane.');
   const [kind,,tab]=kinds[index];await page.getByRole('tab',{name:tab,exact:true}).click();
   if(datasets[index].accesses?.length)await page.locator('mat-card:visible,mat-expansion-panel-header').first().waitFor({state:'visible',timeout:6000}).catch(()=>{});
   const headers=page.locator('mat-expansion-panel-header:visible');for(let i=0;i<await headers.count();i++){try{const h=headers.nth(i);if(await h.getAttribute('aria-expanded',{timeout:2000})!=='true')await h.click({timeout:2000});}catch(error){if(error.name!=='TimeoutError')throw error;}}
   // Names, identifiers and entitlement status come from the API. DOM metadata
   // is optional here; opening details of every card can replace the grid.
   const cards=await indexAccessCards(page,datasets[index].accesses,{discoverDetails:false});
   for(const access of datasets[index].accesses||[]){
    const title=(access.name||'').trim();if(!title)continue;
    const matches=cards.filter(c=>String(c.accessId)===String(access.id)&&c.fullName===access.name);const card=matches.length===1?matches[0]:null;
    let entryURL='';try{const u=new URL(access.accessGenUrl,settings.baseURL);if(u.protocol==='https:'&&!u.username&&!u.password&&u.origin!==new URL(settings.baseURL).origin&&(settings.allowedHosts.includes(u.hostname)||permittedAppHost(u.hostname,settings)))entryURL=u.origin+u.pathname;}catch{}
    materials.push({id:String(access.id),title,kind,teacher:!!access.isTeacherAccess,expired:!!access.isExpired,displayTitle:card?.displayTitle||title,nameSource:'access-api',cardMatch:card?.method||'unresolved',groupLabel:card?.groupLabel||'',entryURL});
   }
  }
  if(blocked.size)throw new InspectionError('BLOCKED_CATALOG_HOST','Odczyt materiałów wymaga domeny spoza dozwolonej listy środowiska. Dotychczasowe materiały pozostają zachowane.');
  await context.close();return {identity,materials};
 }catch(error){
  if(error.name==='AuthenticationError'||error.name==='InspectionError')throw error;
  const message=phase==='access-data'?'Logowanie zakończyło się, ale portal nie zwrócił obu list materiałów. Spróbuj ponownie po odświeżeniu sesji.':phase==='catalog'?'Konto jest zalogowane, ale nie udało się odczytać widoku materiałów. Odśwież panel i ponów pobieranie.':'Nie udało się otworzyć katalogu nauczyciela. Sprawdź dostęp do portalu i połączenie z siecią.';
  throw new InspectionError('CATALOG_READ_FAILED',message);
 }finally{await browser.close();}
}
