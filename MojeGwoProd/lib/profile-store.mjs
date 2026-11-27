import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const clone=value=>JSON.parse(JSON.stringify(value));
export const profileError=(message,status=400)=>Object.assign(new Error(message),{status});
export function validId(id){return typeof id==='string'&&/^[a-z0-9][a-z0-9-]{0,70}$/.test(id);}
export const permittedAppHost=(host,base)=>host.endsWith(base.environment==='prod'?'.apps.gwo.pl':'.apps.gwotest.pl');
export function initialRegistry(base){return {version:1,revision:0,selectedId:'default',teachers:[{id:'default',label:base.accountDisplayName||base.accountEmail||'Dotychczasowy nauczyciel',accountEmail:base.accountEmail||'',accountDisplayName:base.accountDisplayName||'',accountUserId:base.accountUserId||null,credentialMode:'env',enabled:true,sessionFile:base.sessionFile,resources:clone(base.resources||[]),catalog:[]}]};}
export function loadRegistry(file,base){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return initialRegistry(base);throw e;}}
export function applyProfile(base,registry,id){
 const teacher=registry.teachers.find(t=>t.id===(id||registry.selectedId));
 if(!teacher||!teacher.enabled)throw profileError('Wybierz aktywnego nauczyciela.',409);
 const resources=clone(teacher.resources.filter(r=>r.enabled!==false));
 const appHosts=resources.flatMap(r=>{try{const u=new URL(r.entryURL);return permittedAppHost(u.hostname,base)?[u.hostname]:[];}catch{return [];}});
 return {...base,allowedHosts:[...new Set([...base.allowedHosts,...appHosts])],profileId:teacher.id,profileLabel:teacher.label,accountEmail:teacher.accountEmail,accountDisplayName:teacher.accountDisplayName,accountUserId:teacher.accountUserId,sessionFile:teacher.sessionFile,resources};
}
export const scenarioCount=settings=>settings.suite==='websites'?3:settings.suite==='services'?9:1+settings.resources.reduce((n,r)=>n+1+(r.checkMode==='access'?0:1),0);
function text(value,max=500){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008]/.test(value))throw profileError('Nieprawidłowy tekst formularza.');return value.trim();}
export function buildResource(input,base,previous){
 const id=input.id||randomUUID();if(!validId(id))throw profileError('Nieprawidłowy identyfikator materiału.');
 const title=text(input.title);if(!title)throw profileError('Podaj pełną nazwę materiału.');
 const kind=input.kind;if(!['multipodrecznik','aplikacja'].includes(kind))throw profileError('Wybierz rodzaj materiału.');
 const adapter=input.adapter||'access';if(!['access','reader','composer','worksheets','template'].includes(adapter))throw profileError('Wybierz sposób sprawdzania materiału.');
 const template=(base.resources||[]).find(r=>r.id===input.templateId);
 if(adapter==='template'&&!template&&!previous)throw profileError('Nie znaleziono wzorca testu.');
 if((adapter==='reader'&&kind!=='multipodrecznik')||(['composer','worksheets'].includes(adapter)&&kind!=='aplikacja')||(adapter==='template'&&template&&template.kind!==kind))throw profileError('Rodzaj materiału nie pasuje do wybranego sposobu sprawdzania.');
 let r=adapter==='template'?clone(template||previous):{};
 Object.assign(r,{id,title,kind,enabled:input.enabled!==false,adapter,templateId:input.templateId||'',checkMode:adapter==='access'?'access':'functional',groupLabel:text(input.groupLabel||''),description:text(input.description||''),displayTitle:text(input.displayTitle||title),accessAPI:kind==='multipodrecznik'?'/api/v3/my_accesses/mhb':'/api/v3/my_accesses/app',catalogTab:kind==='multipodrecznik'?'Multipodręczniki / Multićwiczenia':'Aplikacje',launchSelector:'.product-card__icon.--circled'});
 r.entitlementSelector='mat-card:visible:has(mat-card-title:text-is('+JSON.stringify(r.displayTitle)+'))';
 r.entryURL=text(input.entryURL||'',2000);
 if(r.entryURL){let url;try{url=new URL(r.entryURL);}catch{throw profileError('Podaj poprawny adres HTTPS materiału.');}if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||(!base.allowedHosts.includes(url.hostname)&&!permittedAppHost(url.hostname,base))||(url.port&&url.port!=='443'))throw profileError('Adres materiału musi być bez parametrów i należeć do dopuszczonych aplikacji tego środowiska.');}
 if(adapter==='reader')Object.assign(r,{functionalMode:'reader-next',readySelector:'img.page-img.show:visible',actionSelector:'button.nav-btn.next',resultSelector:'button.pages',readerOpenFirstSpread:true,previousPageSelector:'button.nav-btn.prev'});
 if(adapter==='composer'){
  const library=text(input.libraryLabel||'');if(!library)throw profileError('Podaj nazwę klasy lub biblioteki w Kompozytorze.');
  Object.assign(r,{libraryLabel:library,readySelector:'button.library-info-btn:has-text('+JSON.stringify(library)+')',actionSelector:'button.library-info-btn:has-text('+JSON.stringify(library)+')',resultSelector:'button.navigation-block__tab-trigger-btn:has-text("Twoje zestawy")'});
 }
 if(adapter==='worksheets'){
  const host=base.environment==='prod'?'kartypracy.apps.gwo.pl':'kartypracy.apps.gwotest.pl';
  if(r.entryURL!=='https://'+host+'/25/EW/1')throw profileError('Katalog klas 1–3 wymaga adresu https://'+host+'/25/EW/1');
  Object.assign(r,{functionalMode:'worksheet-catalog',actionSelector:'button[data-cy="user-projects-create-new-project-btn"]',resultSelector:'exc-exercise-action-block',readySelector:'button[data-cy="user-projects-create-new-project-btn"]',description:'Katalog zadań dla klas 1–3; bez zapisywania zestawu.'});
 }
 // Zgoda dotyczy tylko rozpoznanego regulaminu ze sprawdzonego wzorca.
 delete r.approvedRules;
 if(input.acceptRules===true){let rules=null;const suffix=base.environment==='prod'?'gwo.pl':'gwotest.pl';
 if(r.entryURL==='https://kompozytorklasowek.apps.'+suffix+'/matematyka'&&adapter==='composer')rules={origin:'https://kompozytorklasowek.apps.'+suffix,path:'/matematyka/rules',subject:'Matematyka. Szkoła podstawowa.'};
 if(adapter==='worksheets')rules={origin:'https://kartypracy.apps.'+suffix,path:'/25/EW/1/rules',subject:'Edukacja wczesnoszkolna. Matematyka.',requiredText:'Udostępnione materiały są własnością spółki'};
 rules=rules||(previous?.entryURL===r.entryURL?previous.approvedRules:null)||template?.approvedRules;
 if(!rules)throw profileError('Najpierw dopasuj wzorzec rozpoznanego regulaminu tej aplikacji.');r.approvedRules=clone(rules);r.approvedRules.authorizedAt=new Date().toISOString().slice(0,10);}
 r.acceptRules=!!r.approvedRules;
 if(previous?.observedAccess&&previous.title===title)r.observedAccess=clone(previous.observedAccess);
 if(input.observedAccess&&Number.isSafeInteger(input.observedAccess.id))r.observedAccess={id:input.observedAccess.id};
 delete r.pendingFunctionalSetup;return r;
}
export class ProfileStore{
 constructor({file,baseProvider}){this.file=file;this.baseProvider=baseProvider;this.queue=Promise.resolve();}
 read(){return loadRegistry(this.file,this.baseProvider());}
 settings(id){return applyProfile(this.baseProvider(),this.read(),id);}
 async mutate(revision,fn){const task=this.queue.then(async()=>{const data=this.read();if(revision!==data.revision)throw profileError('Konfiguracja zmieniła się. Odśwież listę i spróbuj ponownie.',409);const result=await fn(data);data.revision++;fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.pending',JSON.stringify(data,null,2));fs.renameSync(this.file+'.pending',this.file);return result;});this.queue=task.catch(()=>{});return task;}
 async save({revision,teacher,credentials},saveCredentials){
  return this.mutate(revision,async data=>{
   const base=this.baseProvider(),existing=teacher.id?data.teachers.find(t=>t.id===teacher.id):null;
   if(teacher.id&&!existing)throw profileError('Nie znaleziono nauczyciela.',404);
   const id=existing?.id||randomUUID(),label=text(teacher.label||''),accountEmail=text(teacher.accountEmail||'',250);
   if(!label||!/^\S+@\S+\.\S+$/.test(accountEmail))throw profileError('Podaj nazwę profilu i e-mail nauczyciela.');
   const accountDisplayName=text(teacher.accountDisplayName||'');const accountUserId=teacher.accountUserId===''||teacher.accountUserId==null?null:Number(teacher.accountUserId);
   if(accountUserId!==null&&(!Number.isSafeInteger(accountUserId)||accountUserId<=0))throw profileError('Identyfikator konta musi być dodatnią liczbą.');
   const emailChanged=existing&&existing.accountEmail!==accountEmail;
   const next={...existing,id,label,accountEmail,accountDisplayName,accountUserId,enabled:teacher.enabled!==false,sharedGitlab:teacher.sharedGitlab!==false,credentialMode:emailChanged?'vault':existing?.credentialMode||'vault',resources:existing?.resources||[],catalog:emailChanged?[]:existing?.catalog||[]};
   if(!next.enabled&&data.teachers.filter(t=>t.enabled&&t.id!==id).length===0)throw profileError('Pozostaw przynajmniej jeden aktywny profil.');
   if(emailChanged||credentials?.portalPassword||credentials?.gitlabPassword){await saveCredentials(id,{...credentials,portalLogin:accountEmail},emailChanged);next.credentialMode='vault';}
   const identityChanged=!existing||emailChanged||existing.accountUserId!==accountUserId||existing.accountDisplayName!==accountDisplayName||credentials?.portalPassword||credentials?.gitlabPassword;
   if(identityChanged)next.sessionFile='playwright/.auth/'+(base.environment==='prod'?'prod/':'')+'profiles/'+id+'/'+randomUUID()+'/teacher.json';
   if(existing)data.teachers[data.teachers.indexOf(existing)]=next;else data.teachers.push(next);
   if(!data.teachers.find(t=>t.id===data.selectedId)?.enabled)data.selectedId=data.teachers.find(t=>t.enabled).id;
   return id;
  });
 }
 async select({revision,id}){return this.mutate(revision,data=>{if(!data.teachers.some(t=>t.id===id&&t.enabled))throw profileError('Wybierz aktywnego nauczyciela.');data.selectedId=id;});}
 async archive({revision,id}){return this.mutate(revision,data=>{const t=data.teachers.find(t=>t.id===id);if(!t)throw profileError('Nie znaleziono nauczyciela.',404);if(!data.teachers.some(other=>other.id!==id&&other.enabled))throw profileError('Nie można wyłączyć ostatniego aktywnego nauczyciela.');t.enabled=false;if(data.selectedId===id)data.selectedId=data.teachers.find(t=>t.enabled).id;});}
 async resource({revision,teacherId,resource,removeId}){return this.mutate(revision,data=>{const teacher=data.teachers.find(t=>t.id===teacherId);if(!teacher)throw profileError('Nie znaleziono nauczyciela.',404);if(removeId){teacher.resources=teacher.resources.filter(r=>r.id!==removeId);return;}if(teacher.resources.length>=100&&!teacher.resources.some(r=>r.id===resource.id))throw profileError('Maksymalnie 100 materiałów w profilu.');const previous=teacher.resources.find(r=>r.id===resource.id),next=buildResource(resource,this.baseProvider(),previous);if(previous)teacher.resources[teacher.resources.indexOf(previous)]=next;else teacher.resources.push(next);});}
 async imported(id,result){return this.mutate(this.read().revision,data=>{const teacher=data.teachers.find(t=>t.id===id);if(!teacher)throw profileError('Nie znaleziono nauczyciela.',404);if(!teacher.accountUserId){teacher.accountUserId=result.identity.userId;teacher.accountDisplayName=result.identity.name;}teacher.catalog=result.materials;teacher.inspectedAt=new Date().toISOString();});}
}
