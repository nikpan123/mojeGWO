export const normalizeName=value=>String(value??'').normalize('NFC').replace(/\s+/g,' ').trim();
export function composerLibrary(surface,label){
 const cards=surface.locator('button.library-info-btn');
 return /^\d{1,2}$/.test(label)?cards.filter({has:surface.getByText(label,{exact:true})}):cards.filter({hasText:label});
}
const sameId=(a,b)=>a!==undefined&&a!==null&&b!==undefined&&b!==null&&String(a)===String(b);
export async function openAccessGroup(page,label,{timeout=8000}={}){
 if(!label)return;
 const group=page.getByRole('button',{name:label,exact:true}).or(page.getByText(label,{exact:true})).filter({visible:true}).first();
 await group.waitFor({state:'visible',timeout});
 // Zwykły nagłówek (np. Nauczanie wielopoziomowe) nie wymaga kliknięcia.
 const expanded=await group.getAttribute('aria-expanded');
 if(expanded==='false')await group.click();
}
export function resolveExpectedAccess(accesses,resource){
 const matches=accesses.filter(a=>normalizeName(a.name)===normalizeName(resource.title)&&(resource.observedAccess?.id==null||sameId(a.id,resource.observedAccess.id)));
 if(matches.length!==1)throw new Error(matches.length?'Nazwa materiału nie jest jednoznaczna. Pobierz dostępy i przypisz materiał z identyfikatorem.':'Brak oczekiwanego dostępu o pełnej nazwie i identyfikatorze: '+resource.title);
 return matches[0];
}
export function matchCard(snapshot,accesses){
 // Wyłącznie jawne oznaczenie identyfikatora API, nie przypadkowy numer elementu DOM lub licencji.
 const explicit=accesses.filter(a=>snapshot.apiId&&sameId(a.id,snapshot.apiId));
 if(explicit.length===1)return {access:explicit[0],method:'api-id'};
 const titles=(snapshot.titles||[]).map(normalizeName);
 const exact=accesses.filter(a=>titles.includes(normalizeName(a.name)));
 if(exact.length===1)return {access:exact[0],method:'full-title'};
 if(exact.length>1)return null;
 const text=normalizeName(snapshot.text);
 const full=accesses.filter(a=>text.includes(normalizeName(a.name)));
 return full.length===1?{access:full[0],method:'full-title-in-details'}:null;
}
async function snapshot(card){
 return card.evaluate(n=>({
  apiId:n.getAttribute('data-access-api-id'),
  displayTitle:n.querySelector('mat-card-title')?.textContent?.trim()||'',
  groupLabel:n.closest('mat-expansion-panel')?.querySelector('mat-expansion-panel-header')?.textContent?.trim()||'',
  text:n.textContent||'',
  titles:[...n.querySelectorAll('mat-card-title,[title],[aria-label],h1,h2,h3,h4,h5,h6,[class*="title"],[class*="header"]')].flatMap(e=>[e.getAttribute('title'),e.getAttribute('aria-label'),e.textContent]).filter(Boolean)
 }));
}
function possible(snapshot,accesses){
 const title=normalizeName(snapshot.displayTitle),prefix=title.replace(/(?:\.\.\.|…)$/,'').trim();
 return accesses.filter(a=>normalizeName(a.name)===title||((title.endsWith('...')||title.endsWith('…'))&&normalizeName(a.name).startsWith(prefix)));
}
async function visibleUnique(locator){const visible=locator.filter({visible:true});return await visible.count()===1?visible:null;}
async function details(page,card,accesses){
 const more=await visibleUnique(card.locator('mat-icon').filter({hasText:/^\s*more_vert\s*$/}))||await visibleUnique(card.getByRole('button',{name:/^(więcej|więcej opcji|szczegóły|informacje o dostępie)$/i}));
 if(!more)return null;
 let result=null,opened=false;
 try{
  await more.click({timeout:1500});opened=true;
  const menu=await visibleUnique(page.getByRole('menuitem',{name:/^(informacje o dostępie|szczegóły dostępu)$/i}));if(menu)await menu.click({timeout:1500});
  for(let i=0;i<12;i++){const data=await snapshot(card);const match=matchCard(data,accesses);if(match){result={...match,snapshot:data,method:'details-full-title'};break;}await new Promise(r=>setTimeout(r,100));}
 }finally{
  if(opened){
   const close=await visibleUnique(card.locator('mat-icon').filter({hasText:/^\s*close\s*$/}))||await visibleUnique(card.getByRole('button',{name:/^(zamknij|close)$/i}));
   if(close)await close.click({timeout:1500});else await page.keyboard.press('Escape');
  }
 }
 return result;
}
export async function indexAccessCards(page,accesses,{targetAccessId,discoverDetails=true}={}){
 const cards=page.locator('mat-card:visible');const entries=[];
 if(!accesses.length)return entries;
 await cards.first().waitFor({state:'visible',timeout:6000}).catch(()=>{});
 // Read the visible grid in one browser operation; tab switches can replace it.
 const snapshots=await cards.evaluateAll(nodes=>nodes.map(n=>({
  apiId:n.getAttribute('data-access-api-id'),displayTitle:n.querySelector('mat-card-title')?.textContent?.trim()||'',
  groupLabel:n.closest('mat-expansion-panel')?.querySelector('mat-expansion-panel-header')?.textContent?.trim()||'',text:n.textContent||'',
  titles:[...n.querySelectorAll('mat-card-title,[title],[aria-label],h1,h2,h3,h4,h5,h6,[class*="title"],[class*="header"]')].flatMap(e=>[e.getAttribute('title'),e.getAttribute('aria-label'),e.textContent]).filter(Boolean)
 })));
 for(let index=0;index<snapshots.length;index++){
  const card=cards.nth(index),initial=snapshots[index];let match=matchCard(initial,accesses),data=initial;
  const candidates=possible(initial,accesses);
  if(!discoverDetails&&!match&&candidates.length===1)match={access:candidates[0],method:'unique-caption-hint'};
  if(discoverDetails&&!match&&candidates.length&&(targetAccessId==null||candidates.some(a=>sameId(a.id,targetAccessId)))){const resolved=await details(page,card,accesses);if(resolved){match=resolved;data={...resolved.snapshot,displayTitle:initial.displayTitle,groupLabel:initial.groupLabel};}}
  entries.push({index,accessId:match?.access.id??null,fullName:match?.access.name??null,method:match?.method||'unresolved',displayTitle:data.displayTitle,groupLabel:data.groupLabel});
 }
 return entries;
}
export async function findAccessCard(page,access,accesses){
 const deadline=Date.now()+8000;
 do{
  const entries=await indexAccessCards(page,accesses,{targetAccessId:access.id}),matches=entries.filter(e=>sameId(e.accessId,access.id)&&normalizeName(e.fullName)===normalizeName(access.name));
  if(matches.length===1)return {card:page.locator('mat-card:visible').nth(matches[0].index),recognition:matches[0]};
  // Skrót wskazuje tylko kandydata. Szczegóły mogą nie być jeszcze załadowane;
  // ponawiamy odczyt do limitu czasu, nadal wymagając pełnej nazwy lub ID.
  if(matches.length>1)break;
  await new Promise(r=>setTimeout(r,150));
 }while(Date.now()<deadline);
 throw new Error('Nie potwierdzono jednoznacznej karty materiału po pełnej nazwie: '+access.name+'. Skrót z kafelka nie wystarcza. Sprawdź grupę i odczyt dostępów.');
}
export async function resolveComposerLibrary(surface,label){
 const candidates=composerLibrary(surface,label);
 await candidates.first().waitFor({state:'visible'});
 if(await candidates.count()===1)return {library:candidates,selection:{class:label,candidates:1}};
 const entries=await candidates.evaluateAll(nodes=>nodes.map((n,index)=>({index,title:n.querySelector('.library-card-back-side__header-content')?.textContent.trim(),status:n.querySelector('.back-side-content__access-status-name')?.textContent.trim(),expiry:n.querySelector('.back-side-content__access-time')?.textContent.trim()})));
 if(entries.some(e=>!e.title||e.title!==entries[0].title))throw new Error('Niejednoznaczne biblioteki tej klasy — wymagane doprecyzowanie nazwy.');
 const active=entries.flatMap(e=>{const d=e.expiry?.match(/(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})/);if(!d||e.status!=='rozpoczęty')return [];const until=new Date(+d[3],+d[2]-1,+d[1],+d[4],+d[5]).getTime();return until>Date.now()?[{...e,until}]:[];}).sort((a,b)=>b.until-a.until);
 if(!active.length||active[0].until===active[1]?.until)throw new Error('Nie potwierdzono jednoznacznego aktywnego dostępu do biblioteki.');
 return {library:candidates.nth(active[0].index),selection:{class:label,candidates:entries.length,title:active[0].title,expiry:active[0].expiry,policy:'Ten sam katalog; aktywny dostęp z najpóźniejszą datą ważności.'}};
}
