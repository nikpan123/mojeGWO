import {isVisualAsset} from './visual-assets.mjs';
import {applyProfile,loadRegistry} from './profile-store.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export function readBaseSettings() {
  const local = path.join(root, 'config/test.local.json');
  const source = fs.existsSync(local) ? local : path.join(root, 'config/test.example.json');
  return JSON.parse(fs.readFileSync(source, 'utf8'));
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
export function assertSafeURL(raw, settings) {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error(`Niedozwolony adres: ${url.origin}`);
  }
  // Wspólny GitLab SSO jest dozwolony wyłącznie po jawnym wpisaniu jego hosta.
  const isGitLabSSO = host === 'gitlab.gwo.pl';
  if ((!isGitLabSSO && (host === 'gwo.pl' || host.endsWith('.gwo.pl'))) || !settings.allowedHosts.includes(host)) {
    throw new Error(`Host poza dozwoloną listą TEST: ${host}`);
  }
  return url;
}

export function validateSettings(settings, { complete = false } = {}) {
  if (settings.environment !== 'test' || new URL(settings.baseURL).origin !== 'https://moje.gwotest.pl') {
    throw new Error('Ten zestaw obsługuje wyłącznie https://moje.gwotest.pl (TEST).');
  }
  assertSafeURL(settings.baseURL, settings);
  if (!settings.accountEmail || !Array.isArray(settings.resources)) throw new Error('Brak konta lub zasobów.');
  const sessionPath = path.resolve(root, settings.sessionFile);
  const authDir = path.join(root, 'playwright', '.auth') + path.sep;
  if (!sessionPath.startsWith(authDir)) throw new Error('Sesję zapisz w playwright/.auth/.');
  assertSafeURL(new URL(settings.catalogPath, settings.baseURL).href, settings);
  for (const resource of settings.resources) {
    if (resource.entryURL) assertSafeURL(resource.entryURL, settings);
  }
  if (complete) {
    const missing = [];
    if(!settings.resources.length)missing.push('co najmniej jeden materiał');
    if (!settings.authenticatedUserSelector) missing.push('authenticatedUserSelector');
    if (settings.workflow === 'portal-v1') {
      for (const key of ['accountDisplayName', 'accountUserId', 'requiredUserFunction', 'identityAPI']) if (!settings[key]) missing.push(key);
      for (const r of settings.resources) {
        for (const key of ['entitlementSelector', 'accessAPI', 'catalogTab', 'launchSelector']) if (!r[key]) missing.push(`${r.id}.${key}`);
        if (!r.pendingFunctionalSetup && r.checkMode!=='access') for (const key of ['readySelector','actionSelector','resultSelector']) if (!r[key]) missing.push(`${r.id}.${key}`);
        assertSafeURL(new URL(r.accessAPI, settings.baseURL).href, settings);
      }
      assertSafeURL(new URL(settings.identityAPI, settings.baseURL).href, settings);
      if (missing.length) throw new Error(`Uzupełnij config/test.local.json: ${missing.join(', ')}`);
      return settings;
    }
    for (const r of settings.resources) {
      for (const key of ['entitlementSelector', 'entryURL', 'readySelector', 'actionSelector', 'resultSelector']) {
        if (!r[key]) missing.push(`${r.id}.${key}`);
      }
    }
    if (missing.length) throw new Error(`Uzupełnij config/test.local.json: ${missing.join(', ')}`);
  }
  return settings;
}

// Blokada obejmuje również zasoby strony, przekierowania, iframe i nowe karty.
export async function protectContext(context, settings) {
  const blocked = new Set();
  blocked.optional = new Set();
  await context.route('**/*', async route => {
    const raw = route.request().url();
    try {
      if(isVisualAsset(route.request(),settings.environment)){await route.continue();return;}
      assertSafeURL(raw, settings);
      await route.continue();
    } catch {
      // Nie zapisujemy query stringów, które mogą zawierać tokeny SSO.
      const url = new URL(raw);
      const optionalResource = !route.request().isNavigationRequest() && ['www.googletagmanager.com', 'zgody.gwo.pl'].includes(url.hostname);
      if (optionalResource) blocked.optional.add(url.origin);
      else blocked.add(url.origin);
      await route.abort('blockedbyclient');
    }
  });
  // WebSockety pozostają zablokowane w szkielecie, do świadomego skonfigurowania.
  await context.routeWebSocket('**/*', ws => {
    blocked.add(new URL(ws.url()).origin);
    ws.close();
  });
  return blocked;
}
