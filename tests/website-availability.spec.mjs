import {test as base,expect} from '@playwright/test';
import {readSettings,protectContext} from '../lib/settings.mjs';
import {websiteDefinitions,websiteLimitMs,websiteReadiness,expectPublicScreen} from '../lib/website-availability.mjs';
const settings=readSettings();
const test=base.extend({context:async({browser},use)=>{
 const ready=websiteReadiness(settings);if(!ready.ready)throw new Error(ready.message);
 const context=await browser.newContext({storageState:{cookies:[],origins:[]},viewport:{width:1920,height:1080},serviceWorkers:'block',ignoreHTTPSErrors:false,acceptDownloads:false});
 const blocked=await protectContext(context,settings);
 // Publiczna kontrola nie wykonuje żadnych zapisów ani logowania.
 await context.route('**/*',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.fallback():route.abort());
 try{await use(context);}finally{await test.info().attach('kontrola-domen',{body:JSON.stringify({niedozwolone:[...blocked]}),contentType:'application/json'});await context.close();expect([...blocked],'Wyłącznie skonfigurowane hosty PROD').toEqual([]);}
}});
for(const site of websiteDefinitions)test('WEB-01/'+site.id+' — '+site.name+': dostępność ekranu wejścia',async({page})=>{
 const start=performance.now();let httpStatus,elapsedMs,finalURL;
 try{
  await test.step('HTTPS, odpowiedź HTTP i HTML właściwej aplikacji',async()=>{
   const response=await page.goto(site.url,{waitUntil:'domcontentloaded',timeout:20000});httpStatus=response?.status();expect(httpStatus).toBe(200);expect(response.headers()['content-type']).toMatch(/^text\/html(?:;|$)/i);
   const html=await response.text();const title=html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];expect(title,'Tytuł w odpowiedzi wejściowej aplikacji').toBe(site.entryTitle);
  });
  await test.step('Oczekiwany ekran anonimowego wejścia, bez logowania',()=>expectPublicScreen(page,site,expect));
  elapsedMs=Math.round(performance.now()-start);const url=new URL(page.url());finalURL=url.origin+url.pathname;
  await test.step('Czas do oczekiwanego ekranu — maksymalnie 15 sekund',async()=>{expect(elapsedMs).toBeLessThanOrEqual(websiteLimitMs);});
 }finally{
  await test.info().attach('pomiar-dostepnosci-strony',{body:JSON.stringify({url:site.url,httpStatus,elapsedMs,finalURL,limitMs:websiteLimitMs,anonymous:true,scope:'Dostępność publicznego ekranu; bez potwierdzania dostępu do materiałów i zależności backendu.'}),contentType:'application/json'});
  await test.info().attach('ekran-strony',{body:await page.screenshot({fullPage:false,mask:[page.locator('input')]}),contentType:'image/png'});
 }
});
