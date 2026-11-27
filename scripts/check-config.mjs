import { readSettings, validateSettings } from '../lib/settings.mjs';
try {
  const settings = validateSettings(readSettings(), { complete: true });
  console.log('Konfiguracja wybranego środowiska jest gotowa.');
  for(const r of settings.resources.filter(r=>r.pendingFunctionalSetup)) console.log('Dalsze kroki po przywróceniu dostępu — '+r.title+': '+r.pendingFunctionalSetup);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
