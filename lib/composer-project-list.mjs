import {expect} from '@playwright/test';
const normalized=value=>String(value||'').replace(/\s+/g,' ').trim();

export async function checkComposerProjectList(page,{openLibrary,surface=page,timeout=15000}){
 const origin=new URL(page.url()).origin;
 let receive,timer;
 const responseReady=new Promise(resolve=>receive=resolve);
 const listener=response=>{
  const url=new URL(response.url());
  if(response.request().method()==='GET'&&url.origin===origin&&/\/libraries\/[^/]+\/user-projects\/?$/.test(url.pathname))receive(response);
 };
 page.on('response',listener);
 try{
  // Register before choosing a class, so a fast response cannot be missed.
  await openLibrary();
  const response=await Promise.race([responseReady,new Promise(resolve=>timer=setTimeout(()=>resolve(null),timeout))]);
  if(!response)throw new Error('Kompozytor nie zwrócił listy Twoich zestawów w wymaganym czasie.');
  if(response.status()!==200)throw new Error('Pobranie listy Twoich zestawów zakończyło się HTTP '+response.status()+'.');
  const contentType=(await response.allHeaders())['content-type']||'';
  let projects;try{projects=await response.json();}catch{throw new Error('Lista Twoich zestawów zawiera niepoprawny JSON.');}
  if(!Array.isArray(projects)||projects.some(project=>!project||!['string','number'].includes(typeof project.id)||typeof project.name!=='string'||!normalized(project.name)))throw new Error('Niepoprawne dane listy Twoich zestawów.');
  const libraryId=decodeURIComponent(new URL(response.url()).pathname.match(/\/libraries\/([^/]+)\/user-projects\/?$/)[1]);
  if(surface===page)await expect(page,'Lista musi należeć do wybranej klasy lub biblioteki').toHaveURL(url=>url.pathname.split('/').some(segment=>decodeURIComponent(segment)===libraryId),{timeout});
  const tab=surface.getByRole('button',{name:'Twoje zestawy',exact:true});
  await expect(tab).toBeVisible({timeout});await tab.click();
  const list=surface.locator('excp-user-project-list');
  await expect(list,'Załadowany widok listy Twoich zestawów').toBeVisible({timeout});
  await expect(surface.locator('exc-loader-element:visible,excp-root-loader:visible,[role="progressbar"]:visible'),'Ładowanie listy musi się zakończyć').toHaveCount(0,{timeout});
  await expect(surface.getByText('Pobieranie zestawów nie powiodło się.',{exact:true})).toBeHidden({timeout});
  const rows=list.locator('excp-user-project-item');
  await expect(rows,'Liczba zestawów w widoku zgodna z odpowiedzią serwera').toHaveCount(projects.length,{timeout});
  if(projects.length){
   const titles=rows.locator('[data-cy="project-title"]');
   await expect(titles).toHaveCount(projects.length,{timeout});
   const displayedNames=()=>titles.evaluateAll(nodes=>nodes.map(node=>{
    const input=node.matches('input,textarea')?node:node.querySelector('input,textarea');
    return input?input.value:node.textContent;
   }));
   await expect.poll(async()=>(await displayedNames()).map(normalized).sort(),{timeout,message:'Widok powinien zawierać nazwy zestawów otrzymane z serwera'}).toEqual(projects.map(project=>normalized(project.name)).sort());
  }else{
   await expect(list.getByText('Nie masz jeszcze utworzonego zestawu zadań.',{exact:true}),'Potwierdzona pusta lista zestawów').toBeVisible({timeout});
  }
  return {httpStatus:response.status(),contentType,libraryId,projectCount:projects.length,empty:projects.length===0,rendered:true};
 }finally{clearTimeout(timer);page.off('response',listener);}
}
