import fs from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { chromium, expect } from '@playwright/test';
import { root, readSettings, validateSettings, protectContext,assertRunnable } from '../lib/settings.mjs';

const settings = validateSettings(readSettings());
assertRunnable(settings);
// Logowanie musi być dostępne przed rozpoznaniem elementów zalogowanego panelu.
// Gdy Chromium nie jest jeszcze pobrane, korzystamy z zainstalowanego Edge.
const browserInstalled = await fs.access(chromium.executablePath()).then(() => true, () => false);
const browser = await chromium.launch({ headless: false, ...(browserInstalled ? {} : { channel: 'msedge' }) });
const input = createInterface({ input: process.stdin, output: process.stdout });
try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const blocked = await protectContext(context, settings);
  const page = await context.newPage();
  await page.goto(settings.baseURL);
  console.log(`Zaloguj się ręcznie w wybranym środowisku jako ${settings.accountEmail}. Hasło wpisz tylko w przeglądarce.`);
  await input.question('Po powrocie do skonfigurowanego panelu wybranego środowiska naciśnij Enter tutaj: ');
  if (new URL(page.url()).origin !== new URL(settings.baseURL).origin) throw new Error('Wróć do panelu wybranego środowiska w pierwotnej karcie.');
  if (settings.authenticatedUserSelector) {
    await expect(page.locator(settings.authenticatedUserSelector)).toBeVisible();
    await expect(page.locator(settings.authenticatedUserSelector)).toContainText(settings.accountDisplayName || settings.accountEmail);
    if(settings.identityAPI && settings.accountUserId) {
      const identityResponse = await context.request.get(new URL(settings.identityAPI, settings.baseURL).href, {maxRedirects:0});
      if(!identityResponse.ok()) throw new Error('Nie udało się potwierdzić konta przez API wybranego środowiska.');
      const identity = await identityResponse.json();
      if(identity.userId !== settings.accountUserId || !identity.userFunctions?.includes(settings.requiredUserFunction)) throw new Error('Sesja innego konta lub brak wymaganej roli nauczyciela.');
    }
  } else {
    console.log('Element konta nie jest jeszcze skonfigurowany. Ten zapis sesji nie będzie automatycznym potwierdzeniem tożsamości.');
    const confirmedEmail = await input.question(`Sprawdź konto w panelu. Aby potwierdzić zalogowanie, wpisz tutaj ${settings.accountEmail}: `);
    if (confirmedEmail.trim().toLowerCase() !== settings.accountEmail.toLowerCase()) {
      throw new Error('Nie potwierdzono właściwego konta. Sesja nie została zapisana.');
    }
  }
  if (blocked.size) {
    // Żądania pozostają zablokowane. Poboczny zasób nie powinien kasować udanego logowania.
    console.warn(`Niektóre zasoby pozostały zablokowane: ${[...blocked].join(', ')}. Zweryfikujemy je przy konfiguracji testów.`);
  }
  const sessionFile = path.resolve(root, settings.sessionFile);
  await fs.mkdir(path.dirname(sessionFile), { recursive: true });
  await context.storageState({ path: sessionFile, indexedDB: true });
  console.log('Zapisano lokalną sesję nauczyciela.');
  console.log(`Plik sesji: ${sessionFile}`);
  if (!settings.authenticatedUserSelector) {
    console.log('Logowanie potwierdzono ręcznie. Przed testami trzeba jeszcze dobrać element konta i elementy aplikacji.');
  }
} finally {
  input.close();
  await browser.close();
}
