import {isVisualAsset} from './visual-assets.mjs';
import {applyProfile,loadRegistry} from './profile-store.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=fileURLToPath(new URL('../',import.meta.url));
export function readBaseSettings(){
 const local=path.join(root,'config/prod.local.json');
 return JSON.parse(fs.readFileSync(fs.existsSync(local)?local:path.join(root,'config/prod.example.json'),'utf8'));
}
export function readSettings({profileId}={}) {
 const base=readBaseSettings();
 if(process.env.MOJE_GWO_RUN_CONFIG){
  const file=path.resolve(process.env.MOJE_GWO_RUN_CONFIG),relative=path.relative(path.join(root,'.health','runs'),file);
  if(!/^[a-f0-9-]{36}[\\/]config\.json$/.test(relative))throw new Error('Nieprawidłowa konfiguracja przebiegu.');
  return JSON.parse(fs.readFileSync(file,'utf8'));
 }
 return applyProfile(base,loadRegistry(path.join(root,'.health','profiles.json'),base),profileId||process.env.MOJE_GWO_PROFILE_ID);
}
export function assertSafeURL(raw,settings){
 const url=new URL(raw),host=url.hostname.toLowerCase();
 if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443'))throw new Error('Dozwolone są wyłącznie jawnie skonfigurowane adresy HTTPS produkcji.');
 if(/(^|\.)gwo(test|dev)\.pl$/.test(host)||!settings.allowedHosts.includes(host))throw new Error('Host poza listą PROD: '+host);
 return url;
}
export function validateSettings(settings,{complete=false}={}){
 if(settings.environment!=='prod'||typeof settings.runEnabled!=='boolean')throw new Error('Wymagana osobna konfiguracja PROD z flagą runEnabled.');
 if(settings.baseURL&&new URL(settings.baseURL).origin!=='https://moje.gwo.pl')throw new Error('Konfiguracja PROD może wskazywać wyłącznie https://moje.gwo.pl.');
 if(!Array.isArray(settings.allowedHosts)||!Array.isArray(settings.resources))throw new Error('Brak listy hostów lub materiałów PROD.');
 const authDirectory=path.join(root,'playwright','.auth','prod')+path.sep;
 if(!settings.sessionFile||!path.resolve(root,settings.sessionFile).startsWith(authDirectory))throw new Error('Sesja PROD musi pozostać w playwright/.auth/prod/.');
 if(complete){
  const missing=[];
  for(const key of ['baseURL','accountEmail','accountDisplayName','accountUserId','requiredUserFunction','identityAPI','authenticatedUserSelector','catalogPath'])if(!settings[key])missing.push(key);
  if(!['portal','gitlab-and-portal'].includes(settings.authMode))missing.push('authMode (potwierdź sposób logowania produkcji)');
  if(!settings.resources.length)missing.push('co najmniej jeden materiał');
  for(const resource of settings.resources)for(const key of ['title','accessAPI','catalogTab','entitlementSelector','launchSelector',...((resource.pendingFunctionalSetup||resource.checkMode==='access')?[]:['readySelector','actionSelector','resultSelector'])])if(!resource[key])missing.push(resource.id+'.'+key);
  if(missing.length)throw new Error('Uzupełnij config/prod.local.json: '+missing.join(', '));
  assertSafeURL(settings.baseURL,settings);
  assertSafeURL(new URL(settings.catalogPath,settings.baseURL).href,settings);
  const identity=assertSafeURL(new URL(settings.identityAPI,settings.baseURL).href,settings);
  if(identity.origin!==new URL(settings.baseURL).origin)throw new Error('API tożsamości musi należeć do portalu PROD.');
  for(const resource of settings.resources){
   assertSafeURL(new URL(resource.accessAPI,settings.baseURL).href,settings);
   if(resource.entryURL)assertSafeURL(resource.entryURL,settings);
  }
 }
 return settings;
}
export function assertRunnable(settings=readSettings()){
 validateSettings(settings);
 if(!settings.runEnabled){const error=new Error('PROD jest przygotowane i nieaktywne. Najpierw uzupełnij konto, materiały i konfigurację; uruchamianie pozostaje wyłączone.');error.code='PROD_DISABLED';throw error;}
 return validateSettings(settings,{complete:true});
}
export async function protectContext(context,settings){
 const blocked=new Set();blocked.optional=new Set();
 await context.route('**/*',async route=>{
  try{
   if(!settings.runEnabled)throw new Error('PROD_DISABLED');
   if(isVisualAsset(route.request(),settings.environment)){await route.continue();return;}
   assertSafeURL(route.request().url(),settings);
   await route.continue();
  }catch{
   const url=new URL(route.request().url());
   if(!route.request().isNavigationRequest() && (url.hostname==='www.googletagmanager.com'||(['fonts.gstatic.com','fonts.googleapis.com'].includes(url.hostname)&&['font','stylesheet'].includes(route.request().resourceType()))||(url.hostname==='zgody.gwo.pl'&&['script','stylesheet'].includes(route.request().resourceType()))||(url.hostname==='files.gwo.pl'&&route.request().resourceType()==='image')))blocked.optional.add(url.origin);
   else blocked.add(url.origin);
   await route.abort('blockedbyclient');
  }
 });
 await context.routeWebSocket('**/*',ws=>{blocked.add(new URL(ws.url()).origin);ws.close();});
 return blocked;
}
