import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {chromium} from '@playwright/test';
import {inspectTeacher,InspectionError} from '../lib/inspect-teacher.mjs';

async function fixture(invalid=false){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'gwo-inspection-'));
 const sessionFile=path.join(directory,'session.json');await fs.writeFile(sessionFile,JSON.stringify({cookies:[],origins:[]}));
 const installed=await fs.access(chromium.executablePath()).then(()=>true,()=>false);
 const datasets={mhb:{accesses:[{id:1,name:'Podręcznik A. Pełna nazwa',isTeacherAccess:true,isExpired:false},{id:2,name:'Podręcznik B. Pełna nazwa',isTeacherAccess:true,isExpired:false}]},app:{accesses:[{id:3,name:'Aplikacja C',isTeacherAccess:true,isExpired:false}]}};
 if(invalid)datasets.mhb={accesses:'invalid'};
 const html=`<button role="tab" onclick="render('mhb')">Multipodręczniki / Multićwiczenia</button><button role="tab" onclick="render('app')">Aplikacje</button><div id="grid"></div><script>
 const records={mhb:[{id:1,title:'Podręcznik A…'},{id:2,title:'Podręcznik B…'}],app:[{id:3,title:'Aplikacja C'}]};
 function render(kind){document.querySelector('#grid').replaceChildren();setTimeout(()=>{document.querySelector('#grid').innerHTML=records[kind].map(row=>'<mat-card data-access-api-id="'+row.id+'"><mat-card-title>'+row.title+'</mat-card-title></mat-card>').join('');},50);}
 Promise.all([fetch('/api/v3/my_accesses/mhb'),fetch('/api/v3/my_accesses/app')]).then(()=>render('mhb'));
 </script>`;
 const settings={environment:'prod',baseURL:'https://moje.gwo.pl',catalogPath:'/accesses',allowedHosts:['moje.gwo.pl'],sessionFile};
 try{return await inspectTeacher(settings,{ensure:async()=>({userId:99,accountDisplayName:'Przykładowy nauczyciel'}),launch:()=>chromium.launch({headless:true,...(installed?{}:{channel:'msedge'})}),protect:async context=>{
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==settings.baseURL)throw Error('Unexpected network request');if(url.pathname==='/accesses')return route.fulfill({contentType:'text/html; charset=utf-8',body:html});const key=url.pathname.split('/').at(-1);if(datasets[key])return route.fulfill({json:datasets[key]});return route.abort();});return new Set();
 }});}finally{await fs.rm(directory,{recursive:true,force:true});}
}
test('odczyt obejmuje oba katalogi mimo wymiany kafelków po zmianie zakładki',async()=>{
 const result=await fixture();assert.equal(result.materials.length,3);assert.deepEqual(result.materials.map(material=>material.title),['Podręcznik A. Pełna nazwa','Podręcznik B. Pełna nazwa','Aplikacja C']);assert.equal(result.identity.userId,99);assert.ok(result.materials.every(material=>material.nameSource==='access-api'));
});
test('błędna lista z API daje czytelny komunikat bez nadpisania danych',async()=>{
 await assert.rejects(fixture(true),error=>error instanceof InspectionError&&error.code==='INVALID_ACCESS_DATA'&&error.message.includes('Dotychczasowe materiały pozostają zachowane'));
});
