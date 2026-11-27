import {loadScenarios} from './load-testing.mjs';
import {loadHealthConfig,endpointScenarios,acceptanceScenarios} from './service-health.mjs';
import {fileURLToPath} from 'node:url';
export function functionalScenarios(settings) {
  const panel = { id: 'moje-gwo:HC-01', code: 'HC-01', title: 'Panel i sesja właściwego nauczyciela', steps: 'Otwórz panel TEST z zapisaną sesją. Sprawdź nazwę w panelu, identyfikator konta i zweryfikowaną rolę nauczyciela.', expected: 'Panel działa i sesja należy do konta ' + settings.accountEmail + '.' };
  return [panel, ...settings.resources.flatMap(r => [
    { id: 'moje-gwo:HC-02/' + r.id, code: 'HC-02/' + r.id, title: 'Aktywny dostęp: ' + r.title, steps: 'Otwórz katalog posiadanych materiałów i znajdź właściwą kartę: ' + r.description, expected: 'Materiał znajduje się w posiadanych dostępach nauczyciela i dostęp nie jest zakończony.' },
    ...(r.checkMode==='access'?[]:[{ id: 'moje-gwo:HC-03/' + r.id, code: 'HC-03/' + r.id, title: 'Działanie: ' + r.title, steps: 'Otwórz zasób, poczekaj na treść i wykonaj jedną skonfigurowaną czynność bez zapisu.', expected: 'Treść jest załadowana, a po czynności pojawia się oczekiwany rezultat.' }])
  ])].map(t => ({ ...t, project: 'moje-gwo', type: 'automatic', module: 'Smoke funkcjonalny TEST', file: 'tests/health.spec.mjs', tags: ['TEST', 'health-check', 'Playwright'], preconditions: ['Wyłącznie moje.gwotest.pl.', 'Uzupełniona konfiguracja i ważna sesja GitLab.'], blocker: settings.resources.find(r=>t.id.endsWith('/'+r.id))?.pendingFunctionalSetup || (settings.workflow==='portal-v1'?'':'Szkielet wymaga uzupełnienia konfiguracji i sesji.'), source: 'Playwright — moje.gwo TEST; gotowość i rzeczywiste wyniki w panelu projektu' }));
}

export function scenarios(settings,{healthConfig=loadHealthConfig(fileURLToPath(new URL('../',import.meta.url)),settings.environment)}={}){return [...functionalScenarios(settings),...loadScenarios(),...endpointScenarios(settings.environment,healthConfig),...acceptanceScenarios(settings.environment)];}
