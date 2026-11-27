import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {root} from '../lib/environment.mjs';
import {createApplication} from '../dashboard/server.mjs';

test('panel przełącza TEST i PROD, zachowuje funkcje i działa na telefonie',async()=>{
 const server=await createApplication();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;let browser;
 try{
  const installed=await fs.access(chromium.executablePath()).then(()=>true,()=>false);
  browser=await chromium.launch({headless:true,...(installed?{}:{channel:'msedge'})});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/test/');await expect(page.locator('#environment-choice')).toHaveValue('test');
  await expect(page.locator('#teacher-choice option')).toHaveCount(1);
  await page.locator('nav a[href="#load"]').click();await expect(page.locator('#load-form')).toBeVisible();
  await expect(page.locator('#load-run')).toBeDisabled();
  await page.locator('#environment-choice').selectOption('prod');await page.waitForURL('**/prod/');
  await expect(page.locator('#environment-choice')).toHaveValue('prod');
  await expect(page.locator('#teacher-choice option')).toHaveCount(1);assert.equal(await page.locator('#load-form').count(),0);
  await page.locator('nav a[href="#run"]').click();await expect(page.locator('#run')).toBeDisabled();
  assert.equal(await page.locator('#suite-choice option[value="websites"]').count(),1);
  const dir=path.join(root,'.health','qa');await fs.mkdir(dir,{recursive:true});
  await page.screenshot({path:path.join(dir,'prod-panel.png'),fullPage:true});
  await page.locator('#environment-choice').selectOption('test');await page.waitForURL('**/test/');
  await expect(page.locator('#teacher-choice option')).toHaveCount(1);
  assert.equal(await page.locator('nav a[href="#schedule"]').count(),0);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(dir,'test-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});

test('dziennik wyróżnia wyniki, filtruje błędy i czyści tylko wpisy',async()=>{
 const server=await createApplication();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;let browser;
 try{
  const state=await(await fetch(origin+'/prod/api/state')).json();
  state.schedule.events=[{at:'2026-11-27T06:30:00Z',type:'PASS',suite:'functional',message:'Zakończono zestaw.',report:'/report/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/',counts:{passed:5,failed:0}},{at:'2026-11-27T06:29:00Z',type:'FAIL',suite:'websites',message:'Zakończono zestaw.',counts:{passed:2,failed:1}},{at:'2026-11-27T06:28:00Z',type:'START',message:'Rozpoczęto cykl.'}];
  const installed=await fs.access(chromium.executablePath()).then(()=>true,()=>false);
  browser=await chromium.launch({headless:true,...(installed?{}:{channel:'msedge'})});const page=await browser.newPage();let clears=0;
  await page.route('**/prod/api/state',route=>route.fulfill({json:state}));
  await page.route('**/prod/api/schedule/events/clear',route=>{assert.equal(route.request().method(),'POST');clears++;state.schedule.events=[];return route.fulfill({json:{schedule:state.schedule}});});
  await page.goto(origin+'/prod/#schedule');
  await expect(page.locator('.schedule-event')).toHaveCount(3);
  assert.equal(await page.locator('.schedule-event--pass').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(240, 250, 243)');
  assert.equal(await page.locator('.schedule-event--fail').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 243, 243)');
  await expect(page.locator('.schedule-event--pass a')).toHaveAttribute('href','/prod/report/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/');
  await page.locator('#schedule-event-filter').selectOption('failures');await expect(page.locator('.schedule-event')).toHaveCount(1);
  await page.locator('#schedule-form input[name="intervalMinutes"]').fill('45');
  await page.locator('#schedule-clear-events').click();await expect(page.locator('.schedule-event')).toHaveCount(0);
  await expect(page.locator('#schedule-events-message')).toContainText('Raporty i ustawienia zostały zachowane');
  await expect(page.locator('#schedule-clear-events')).toBeDisabled();
  await expect(page.locator('#schedule-form input[name="intervalMinutes"]')).toHaveValue('45');assert.equal(clears,1);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
