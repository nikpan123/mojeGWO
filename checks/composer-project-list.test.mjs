import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {checkComposerProjectList} from '../lib/composer-project-list.mjs';

test('Kompozytor potwierdza odpowiedź API i zawartość widoku listy',async t=>{
 const installed=await fs.access(chromium.executablePath()).then(()=>true,()=>false);
 const browser=await chromium.launch({headless:true,...(installed?{}:{channel:'msedge'})});
 const projects=[{id:1,name:'Zestaw A'},{id:2,name:'Zestaw B'}];
 async function fixture({data=projects,status=200,mode='normal',raw,library='class6',contentType='application/json'}={}){
  const page=await browser.newPage();
  const html=`<button onclick="openLibrary()">6</button><button id="tab" hidden onclick="document.querySelector('excp-user-project-list')?.removeAttribute('hidden')">Twoje zestawy</button><div id="content"></div><script>
   async function openLibrary(){
    history.pushState({},'', '/matematyka/class6/zestawy');document.querySelector('#tab').hidden=false;
    if(${JSON.stringify(mode)}==='no-request')return;
    try{
     const data=await(await fetch('/api/libraries/${library}/user-projects')).json();
     if(${JSON.stringify(mode)}==='tab-only')return;
     const list=document.createElement('excp-user-project-list');list.hidden=true;list.style.display='block';
     if(${JSON.stringify(mode)}==='loading')document.querySelector('#content').innerHTML='<exc-loader-element style="display:block;width:20px;height:20px">Ładowanie</exc-loader-element>';
     const rows=${JSON.stringify(mode)}==='empty-view'?[]:Array.isArray(data)?[...data].reverse():[];
     if(rows.length){for(const row of rows){const item=document.createElement('excp-user-project-item');const title=document.createElement('div');title.dataset.cy='project-title';const name=${JSON.stringify(mode)}==='wrong-names'?'Błędna nazwa':row.name;if(${JSON.stringify(mode)}==='text-title')title.textContent=name;else{const input=document.createElement('input');input.value=name;title.append(input);}item.append(title);list.append(item);}}
     else if(${JSON.stringify(mode)}!=='blank-empty')list.textContent='Nie masz jeszcze utworzonego zestawu zadań.';
     document.querySelector('#content').append(list);
    }catch{document.querySelector('#content').textContent='Pobieranie zestawów nie powiodło się.';}
   }
  </script>`;
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin!=='https://composer.example')return route.abort();
   if(url.pathname==='/matematyka')return route.fulfill({contentType:'text/html; charset=utf-8',body:html});
   if(url.pathname.endsWith('/user-projects'))return route.fulfill({status,contentType,body:raw??JSON.stringify(data)});
   return route.abort();
  });
  try{await page.goto('https://composer.example/matematyka');return await checkComposerProjectList(page,{openLibrary:()=>page.getByRole('button',{name:'6',exact:true}).click(),timeout:600});}
  finally{await page.close();}
 }
 try{
  await t.test('lista z zestawami musi pokazać wszystkie nazwy z API',async()=>{const result=await fixture();assert.equal(result.projectCount,2);assert.equal(result.empty,false);});
  await t.test('nazwy mogą być też zwykłym tekstem w wierszu',async()=>{const result=await fixture({mode:'text-title'});assert.equal(result.projectCount,2);});
  await t.test('pusta lista wymaga API [] oraz jednoznacznego komunikatu',async()=>{const result=await fixture({data:[]});assert.equal(result.projectCount,0);assert.equal(result.empty,true);});
  await t.test('poprawne dane JSON działają także przy innym nagłówku serwera',async()=>{const result=await fixture({contentType:'text/plain; charset=utf-8'});assert.equal(result.projectCount,2);});
  await t.test('HTML zamiast danych listy nie zalicza testu',async()=>{await assert.rejects(fixture({contentType:'text/html',raw:'<html>Brak danych</html>'}),/niepoprawny JSON/);});
  await t.test('HTTP 500 nie jest pustą listą',async()=>{await assert.rejects(fixture({status:500,data:[]}),/HTTP 500/);});
  await t.test('niepoprawny JSON i inny format odpowiedzi nie zaliczają testu',async()=>{await assert.rejects(fixture({raw:'invalid'}),/niepoprawny JSON/);await assert.rejects(fixture({data:{error:'failure'}}),/Niepoprawne dane/);});
  await t.test('sama zakładka bez żądania API nie wystarcza',async()=>{await assert.rejects(fixture({mode:'no-request'}),/nie zwrócił listy/);});
  await t.test('sama zakładka bez widoku listy nie wystarcza',async()=>{await assert.rejects(fixture({mode:'tab-only'}));});
  await t.test('loader mimo odpowiedzi 200 nie zalicza testu',async()=>{await assert.rejects(fixture({mode:'loading'}));});
  await t.test('brak wierszy albo błędne nazwy nie zaliczają testu',async()=>{await assert.rejects(fixture({mode:'empty-view'}));await assert.rejects(fixture({mode:'wrong-names'}));});
  await t.test('pusty ekran bez komunikatu nie zalicza pustej listy',async()=>{await assert.rejects(fixture({data:[],mode:'blank-empty'}));});
  await t.test('odpowiedź innej biblioteki nie zalicza testu',async()=>{await assert.rejects(fixture({library:'class7'}));});
 }finally{await browser.close();}
});
