import {resolveExpectedAccess,findAccessCard,openAccessGroup,composerLibrary,resolveComposerLibrary} from '../lib/access-cards.mjs';
import fs from 'node:fs';
import {startPreview} from '../lib/live-preview.mjs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import { test as base, expect } from '@playwright/test';
import { root, readSettings, validateSettings, protectContext,assertRunnable } from '../lib/settings.mjs';
import {necessaryCookiesOnly} from '../lib/cookies.mjs';

const settings = readSettings();
const sessionFile = path.resolve(root, settings.sessionFile);
const test = base.extend({
  context: async ({ browser }, use, testInfo) => {
    assertRunnable(settings);
    if (!fs.existsSync(sessionFile)) throw new Error('Automatyczne logowanie nie przygotowało sesji nauczyciela.');
    const authSummary=path.join(path.dirname(sessionFile),'last-auth.json');
    if(fs.existsSync(authSummary)) await testInfo.attach('logowanie',{body:fs.readFileSync(authSummary),contentType:'application/json'});
    const context = await browser.newContext({ viewport:{width:1920,height:1080}, screen:{width:1920,height:1080}, storageState: sessionFile, serviceWorkers: 'block', baseURL: settings.baseURL, acceptDownloads: false });
    const blocked = await protectContext(context, settings);
    const stopPreview=await startPreview(context,settings);
    try { await use(context); }
    finally {
      await stopPreview();
      await testInfo.attach('kontrola-domen', { body: JSON.stringify({ niedozwolone: [...blocked], celowoZablokowaneZasobyOpcjonalne: [...blocked.optional] }, null, 2), contentType: 'application/json' });
      await context.close();
      expect([...blocked], 'Żądania poza dozwoloną listą PROD i SSO').toEqual([]);
    }
  }
});

function responseFor(page, pathname) {
  const target = new URL(pathname, settings.baseURL);
  return page.waitForResponse(r => new URL(r.url()).origin === target.origin && new URL(r.url()).pathname === target.pathname);
}

async function openTeacherPanel(page, resource) {
  const identityResponse = responseFor(page, settings.identityAPI);
  const accessResponse = resource ? responseFor(page, resource.accessAPI) : null;
  const response = await page.goto(new URL(settings.catalogPath, settings.baseURL).href);
  expect(response?.ok(), 'Panel powinien odpowiedzieć bez błędu HTTP').toBeTruthy();
  const identityHTTP = await identityResponse;
  expect(identityHTTP.ok(), 'API tożsamości nauczyciela').toBeTruthy();
  const identity = await identityHTTP.json();
  expect(identity.userId, 'Sesja musi należeć do skonfigurowanego nauczyciela').toBe(settings.accountUserId);
  expect(identity.name).toBe(settings.accountDisplayName);
  expect(identity.userFunctions, 'Zweryfikowana rola nauczyciela').toContain(settings.requiredUserFunction);
  await expect(page.locator(settings.authenticatedUserSelector)).toHaveText(settings.accountDisplayName);
  await necessaryCookiesOnly(page);
  if (!accessResponse) return;
  const accessHTTP = await accessResponse;
  expect(accessHTTP.ok(), 'API posiadanych dostępów').toBeTruthy();
  return accessHTTP.json();
}

async function prepareResource(page, resource) {
  const data = await test.step('Panel nauczyciela i lista posiadanych dostępów', () => openTeacherPanel(page, resource));
  if(!Array.isArray(data.accesses))throw new Error('API nie zwróciło listy posiadanych dostępów.');
  const access = resolveExpectedAccess(data.accesses,resource);
  await test.info().attach('dostep', { body: JSON.stringify({ title:resource.title, actualFullTitle:access.name, accessId:access.id, found:!!access, teacher:access?.isTeacherAccess, expired:access?.isExpired, period:access?.period, endDate:access?.endDate }, null, 2), contentType:'application/json' });
  expect(access, `Brak posiadanego dostępu do „${resource.title}” na koncie ${settings.accountEmail}. Oferta sklepu nie jest dostępem.`).toBeTruthy();
  expect(access.isTeacherAccess, 'Wymagany dostęp nauczycielski').toBe(true);
  await page.getByRole('tab', { name:resource.catalogTab, exact:true }).click();
  await openAccessGroup(page,resource.groupLabel);
  const {card,recognition}=await test.step('Rozpoznanie karty po pełnej nazwie i identyfikatorze dostępu',()=>findAccessCard(page,access,data.accesses));
  await test.info().attach('rozpoznanie-pelnej-nazwy',{body:JSON.stringify({expectedFullTitle:resource.title,actualFullTitle:access.name,accessId:access.id,cardCaption:recognition.displayTitle,method:recognition.method},null,2),contentType:'application/json'});
  await expect(card).toBeVisible();
  // Skrócona etykieta kafelka nie jest kryterium tożsamości materiału.
  await expect(card).toContainText('Dostęp nauczycielski');
  return {access,card};
}

test('HC-01 — panel działa i sesja należy do właściwego nauczyciela', async ({ page }) => {
  await test.step('Tożsamość, rola nauczyciela i widoczny panel', () => openTeacherPanel(page));
});

for (const resource of settings.resources) {
  test(`HC-02/${resource.id} — nauczyciel ma aktywny dostęp: ${resource.title}`, async ({ page }) => {
    const {access} = await prepareResource(page, resource);
    await test.step('Ważność dostępu', async () => {
      expect(access.isExpired, 'Dostęp nie może być oznaczony jako wygasły').toBe(false);
      expect(access.period || '', 'Panel zwraca informację o zakończonym dostępie').not.toMatch(/dostęp zakończony/i);
    });
  });

  if(resource.checkMode==='access')continue;
  test(`HC-03/${resource.id} — otwarcie i podstawowa funkcja`, async ({ page, context }) => {
    const {card} = await prepareResource(page, resource);
    let app,selectedLibrary;
    await test.step('Uruchomienie przez kartę materiału w moje.gwo', async () => {
      const popup = context.waitForEvent('page');
      await card.locator(resource.launchSelector).click();
      app = await popup;
      try { await app.waitForURL(u => u.protocol === 'https:', { timeout:20000 }); } catch { if(resource.pendingFunctionalSetup) throw new Error(resource.pendingFunctionalSetup); throw new Error('Materiał nie otworzył strony HTTPS.'); }
      if(resource.pendingFunctionalSetup) throw new Error(resource.pendingFunctionalSetup);
      await app.waitForLoadState('domcontentloaded');
      await app.waitForLoadState('networkidle', { timeout:15000 }).catch(() => {});
      if(resource.entryURL) {
        const expected=new URL(resource.entryURL);
        await expect(app).toHaveURL(url=>url.origin===expected.origin && (url.pathname===expected.pathname||url.pathname.startsWith(expected.pathname+'/')));
      }
      if(resource.approvedRules && await app.getByRole('button',{name:'Zgadzam się',exact:true}).isVisible()) {
        const current=new URL(app.url());
        expect(current.origin).toBe(resource.approvedRules.origin);
        expect(current.pathname).toBe(resource.approvedRules.path);
        await expect(app.locator('body')).toContainText(resource.approvedRules.subject);
        await expect(app.locator('body')).toContainText(resource.approvedRules.requiredText||'Regulaminu korzystania z aplikacji');
        await app.getByRole('button',{name:'Zgadzam się',exact:true}).click();
        await test.info().attach('akceptacja-regulaminu',{body:JSON.stringify({subject:resource.approvedRules.subject,authorizationDate:resource.approvedRules.authorizedAt,scope:'Wyraźna zgoda użytkownika na automatyczną akceptację tego regulaminu w testach.'}),contentType:'application/json'});
      }
      await expect(app.getByRole('button',{name:'Zgadzam się',exact:true}),'Aplikację blokuje regulamin — skonfiguruj zgodę dla tego materiału.').toBeHidden();
      await expect(app.getByText('Brak autoryzacji',{exact:true}).first(),'Sesja aplikacji utraciła autoryzację.').toBeHidden();
      if(resource.adapter==='composer'&&resource.libraryLabel){const resolved=await resolveComposerLibrary(app,resource.libraryLabel);selectedLibrary=resolved.library;await expect(selectedLibrary).toBeVisible();await test.info().attach('wybor-dostepu-do-biblioteki',{body:JSON.stringify(resolved.selection),contentType:'application/json'});}
      else if(resource.readySelector) await expect(resource.functionalMode==='reader-next'?app.locator(resource.readySelector).first():app.locator(resource.readySelector)).toBeVisible();
      await test.info().attach('ekran-aplikacji', { body:await app.screenshot({fullPage:true}), contentType:'image/png' });
    });
    await test.step('Brak blokady dostępu, autoryzacji lub pierwszej akceptacji regulaminu', async () => {
      await expect((selectedLibrary||app).getByText('Dostęp zakończony', {exact:true}).first(),'Ważność wybranego dostępu; inne klasy nie należą do tego scenariusza.').toBeHidden();
      await expect(app.getByRole('button', {name:'Zgadzam się',exact:true}), 'Pozostała nieobsłużona blokada regulaminu').toBeHidden();
      await expect(app.getByText('Brak autoryzacji', {exact:true}).first()).toBeHidden();
    });
    if(resource.pendingFunctionalSetup) throw new Error(`Dalsze kroki wymagają konfiguracji po przywróceniu dostępu: ${resource.pendingFunctionalSetup}`);
    const surface = resource.frameSelector ? app.frameLocator(resource.frameSelector) : app;
    await test.step('Podstawowa czynność i widoczny rezultat', async () => {
      if(resource.functionalMode==='reader-next') {
        const pageNumber=surface.locator(resource.resultSelector);
        // Pierwszy ruch z okładki udostępnia nawigację rozkładówki; kolejny zmienia jej strony.
        if(resource.readerOpenFirstSpread && !await surface.locator(resource.previousPageSelector).isVisible()) {
          await surface.locator(resource.actionSelector).click();
          await expect(surface.locator(resource.previousPageSelector)).toBeVisible();
        }
        const before=await pageNumber.innerText();
        const images=surface.locator(resource.readySelector);
        const loaded=()=>images.evaluateAll(nodes=>nodes.length>0&&nodes.every(n=>n.complete&&n.naturalWidth>0));
        const signature=async()=>createHash('sha256').update(JSON.stringify(await images.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src')||'')))).digest('hex');
        await expect(images.first()).toBeVisible();
        await expect.poll(loaded).toBe(true);
        const beforeImage=await signature();
        await surface.locator(resource.actionSelector).click();
        await expect(pageNumber).not.toHaveText(before);
        await expect.poll(signature).not.toBe(beforeImage);
        await expect.poll(loaded).toBe(true);
        await test.info().attach('zmiana-strony',{body:JSON.stringify({before,after:await pageNumber.innerText(),imagesLoaded:true,visiblePages:await images.count()}),contentType:'application/json'});
        return;
      }
      if(resource.functionalMode==='worksheet-catalog'){
        const writes=[];
        await app.route('**/*',async route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){writes.push(new URL(route.request().url()).pathname);await route.abort();}else await route.fallback();});
        await expect(app.locator(resource.readySelector)).toBeVisible();
        await app.locator(resource.readySelector).click();
        await expect(app).toHaveURL(url=>url.pathname==='/25/EW/1/komponowanie');
        await expect(app.locator('body')).toContainText('Klasy 1–3');
        const proposals=app.getByRole('button',{name:/^Propozycje zadań \([1-9]\d*\)$/});
        await expect(proposals).toBeVisible();
        const tasks=app.locator('.block-item img[alt="Zadanie"]');
        await expect(tasks.first()).toBeVisible();
        await expect.poll(()=>tasks.count()).toBeGreaterThan(0);
        await expect.poll(()=>tasks.evaluateAll(ns=>ns.length>0&&ns.every(n=>n.complete&&n.naturalWidth>0))).toBe(true);
        await test.info().attach('katalog-zadan-klasy-1-3',{body:JSON.stringify({scope:'Katalog aplikacji dla klas 1–3',proposals:await proposals.innerText(),loadedTasks:await tasks.count(),blockedWrites:writes}),contentType:'application/json'});
        await test.info().attach('katalog-zadan',{body:await app.screenshot({fullPage:false}),contentType:'image/png'});
        expect(writes,'Przeglądanie katalogu nie powinno próbować zapisywać danych').toEqual([]);
        return;
      }
      const library=resource.adapter==='composer'&&resource.libraryLabel?selectedLibrary:null;
      await expect(library||surface.locator(resource.readySelector)).toBeVisible();
      await expect(surface.locator(resource.resultSelector)).toBeHidden();
      await (library||surface.locator(resource.actionSelector)).click();
      await expect(surface.locator(resource.resultSelector)).toBeVisible();
    });
  });
}
