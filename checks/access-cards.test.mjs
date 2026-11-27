import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {findAccessCard} from '../lib/access-cards.mjs';

test('rozpoznanie ponawia odczyt szczegółów, ale nie zalicza samego skrótu ani duplikatów',async t=>{
 const installed=await fs.access(chromium.executablePath()).then(()=>true,()=>false);
 const browser=await chromium.launch({headless:true,...(installed?{}:{channel:'msedge'})});
 const access={id:1,name:'Matematyka. Klasa 7. Wersja nauczycielska'};
 try{
  const page=await browser.newPage();
  await t.test('pierwszy odczyt bez pełnej nazwy, kolejny potwierdza materiał',async()=>{
   await page.setContent(`<mat-card style="display:block"><mat-card-title>Matematyka. Klasa 7…</mat-card-title><button aria-label="Więcej" onclick="showDetails()">Więcej</button><div id="details"></div></mat-card><script>
    window.opens=0;
    function showDetails(){window.opens++;document.querySelector('#details').innerHTML=(window.opens>1?'Matematyka. Klasa 7. Wersja nauczycielska':'Ładowanie szczegółów…')+'<button aria-label="Zamknij" onclick="this.parentElement.replaceChildren()">Zamknij</button>';}
   </script>`);
   const result=await findAccessCard(page,access,[access]);
   assert.equal(result.recognition.fullName,access.name);
   assert.equal(result.recognition.method,'details-full-title');
   assert.ok(await page.evaluate(()=>window.opens)>=2);
   assert.equal(await result.card.count(),1);
  });
  await t.test('niepotwierdzony skrót nadal kończy się błędem',async()=>{
   await page.setContent('<mat-card style="display:block"><mat-card-title>Matematyka. Klasa 7…</mat-card-title></mat-card>');
   await assert.rejects(findAccessCard(page,access,[access]),/Nie potwierdzono jednoznacznej karty/);
  });
  await t.test('dwa kafelki z tą samą pełną nazwą nie są jednoznaczne',async()=>{
   await page.setContent(('<mat-card style="display:block"><mat-card-title>'+access.name+'</mat-card-title></mat-card>').repeat(2));
   await assert.rejects(findAccessCard(page,access,[access]),/Nie potwierdzono jednoznacznej karty/);
  });
 }finally{await browser.close();}
});
