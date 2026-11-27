import {websiteScenarios} from './website-availability.mjs';
import {loadHealthConfig,endpointScenarios,acceptanceScenarios} from './service-health.mjs';
import {fileURLToPath} from 'node:url';
export function functionalScenarios(settings){
 const common={project:'moje-gwo-prod',type:'automatic',module:'Smoke funkcjonalny PROD',file:'tests/health.spec.mjs',tags:settings.runEnabled?['PROD']:['PROD','Nieuruchomione'],preconditions:['Uzupełniona osobna konfiguracja PROD i dane konta produkcyjnego.','W trakcie przebiegu nie loguj się równolegle na to konto.'],blocker:settings.runEnabled?'':'Uruchamianie wyłączone. Odczyt konfiguracji nie jest wynikiem testu.',source:'Osobny zestaw moje.gwo PROD'};
 const panel={id:'moje-gwo-prod:HC-01',code:'HC-01',title:'PROD — panel i konto nauczyciela',steps:'Zaloguj produkcyjne konto i potwierdź identyfikator, nazwę oraz rolę nauczyciela.',expected:'Właściwe konto ma dostęp do panelu produkcyjnego.'};
 return [panel,...settings.resources.flatMap(resource=>[
  {id:'moje-gwo-prod:HC-02/'+resource.id,code:'HC-02/'+resource.id,title:'PROD — aktywny dostęp: '+(resource.title||(resource.kind==='multipodrecznik'?'multipodręcznik do wskazania':'aplikacja do wskazania')),steps:'Sprawdź posiadany i aktywny dostęp nauczycielski.',expected:'Materiał jest dostępny dla wskazanego konta PROD.'},
  ...(resource.checkMode==='access'?[]:[{id:'moje-gwo-prod:HC-03/'+resource.id,code:'HC-03/'+resource.id,title:'PROD — działanie: '+(resource.title||(resource.kind==='multipodrecznik'?'multipodręcznik do wskazania':'aplikacja do wskazania')),steps:'Otwórz materiał i wykonaj jedną skonfigurowaną czynność odczytu.',expected:'Treść ładuje się i podstawowa funkcja działa bez zapisu lub usuwania danych.'}])
 ])].map(row=>({...common,...row}));
}

export function scenarios(settings,{healthConfig=loadHealthConfig(fileURLToPath(new URL('../',import.meta.url)),settings.environment)}={}){return [...functionalScenarios(settings),...websiteScenarios(),...endpointScenarios(settings.environment,healthConfig),...acceptanceScenarios(settings.environment)];}
