import {test as base,expect} from '@playwright/test';
import {readSettings,root} from '../lib/settings.mjs';
import {loadHealthConfig,validateHealthConfig,healthReadiness,inspectHealthResponse,inspectCache,probeService} from '../lib/service-health.mjs';
const settings=readSettings();
const config=settings.serviceHealth?validateHealthConfig(settings.serviceHealth,settings.environment):loadHealthConfig(root,settings.environment);
const test=base.extend({anonymous:async({playwright},use)=>{
 const readiness=healthReadiness(config,settings);if(!readiness.ready)throw new Error(readiness.message);
 const request=await playwright.request.newContext({ignoreHTTPSErrors:false,storageState:{cookies:[],origins:[]},extraHTTPHeaders:{Accept:'application/json'},userAgent:'moje-gwo-healthcheck/1.0'});
 try{await use(request);}finally{await request.dispose();}
}});
async function sample(request,service){
 const response=await probeService(request,service,config);
 const contract=inspectHealthResponse(response,service,config);
 await test.info().attach('pomiar-healthchecka',{body:JSON.stringify({service:service.id,httpStatus:response.status,elapsedMs:Math.round(response.elapsedMs),contract:contract.problems},null,2),contentType:'application/json'});
 expect(contract.problems,'Kontrakt publicznego healthchecka (bez zapisywania surowej odpowiedzi)').toEqual([]);
 return response;
}
for(const service of config.services){
 test(`EP-01/${service.id} — HTTPS, status, JSON i minimalna odpowiedź`,async({anonymous})=>{
  await test.step('Anonimowy GET i weryfikacja kontraktu',()=>sample(anonymous,service));
 });
 test(`EP-02/${service.id} — czas odpowiedzi`,async({anonymous})=>{
  const response=await test.step('Pomiar czasu bez pomijania poprawności odpowiedzi',()=>sample(anonymous,service));
  expect(response.elapsedMs,'Pełna odpowiedź healthchecka do 2 sekund').toBeLessThanOrEqual(config.responseLimitMs);
 });
 test(`EP-03/${service.id} — ochrona przed starą odpowiedzią z cache`,async({anonymous})=>{
  for(let i=0;i<2;i++)await test.step('Odczyt '+(i+1)+' i nagłówki cache',async()=>{const response=await sample(anonymous,service);expect(inspectCache(response.headers).problems,'Zakaz HTTP cache').toEqual([]);});
 });
}
