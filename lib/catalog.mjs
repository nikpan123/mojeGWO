import {websiteScenarios} from './website-availability.mjs';
import {loadScenarios} from './load-testing.mjs';
import {loadHealthConfig,endpointScenarios,acceptanceScenarios} from './service-health.mjs';
import {fileURLToPath} from 'node:url';
export function functionalScenarios(settings) {
  const project=settings.environment==='prod'?'moje-gwo-prod':'moje-gwo',label=settings.environment.toUpperCase();
  const panel = { id: project+':HC-01', code: 'HC-01', title: 'Panel i sesja właściwego nauczyciela', steps: 'Otwórz panel wybranego środowiska z zapisaną sesją. Sprawdź nazwę w panelu, identyfikator konta i zweryfikowaną rolę nauczyciela.', expected: 'Panel działa i sesja należy do konta ' + settings.accountEmail + '.' };
  return [panel, ...settings.resources.flatMap(r => [
    { id: project+':HC-02/' + r.id, code: 'HC-02/' + r.id, title: 'Aktywny dostęp: ' + r.title, steps: 'Otwórz katalog posiadanych materiałów i znajdź właściwą kartę: ' + r.description, expected: 'Materiał znajduje się w posiadanych dostępach nauczyciela i dostęp nie jest zakończony.' },
    ...(r.checkMode==='access'?[]:[{ id: project+':HC-03/' + r.id, code: 'HC-03/' + r.id, title: 'Działanie: ' + r.title, steps: 'Otwórz zasób, poczekaj na treść i wykonaj jedną skonfigurowaną czynność bez zapisu.', expected: 'Treść jest załadowana, a po czynności pojawia się oczekiwany rezultat.' }])
  ])].map(t => ({ ...t, project, type: 'automatic', module: 'Smoke funkcjonalny '+label, file: 'tests/health.spec.mjs', tags: [label, 'health-check', 'Playwright'], preconditions: ['Wyłącznie '+settings.baseURL, 'Uzupełniona konfiguracja i osobna sesja środowiska.'], blocker: settings.resources.find(r=>t.id.endsWith('/'+r.id))?.pendingFunctionalSetup || (settings.workflow==='portal-v1'?'':'Szkielet wymaga uzupełnienia konfiguracji i sesji.'), source: 'Playwright — moje.gwo; gotowość i rzeczywiste wyniki w panelu projektu' }));
}

export function scenarios(settings,{healthConfig=loadHealthConfig(fileURLToPath(new URL('../',import.meta.url)),settings.environment)}={}){return [...functionalScenarios(settings),...(settings.environment==='test'?loadScenarios():websiteScenarios()),...endpointScenarios(settings.environment,healthConfig),...acceptanceScenarios(settings.environment)];}
