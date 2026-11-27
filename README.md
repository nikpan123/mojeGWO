# Moje GWO — TEST i PROD

Jeden projekt, jedna instalacja i wspólny panel. Środowisko wybierasz w polu **Środowisko** albo parametrem `--env test` / `--env prod`. Domyślnie wybierany jest TEST.

## Instalacja i panel

Wymagane: Node.js 22 lub nowszy oraz npm.

```powershell
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd run panel
```

Otwórz **http://127.0.0.1:4182**. Panel umożliwia przełączanie TEST i PROD. Adresy `/test/` i `/prod/` można też otworzyć w osobnych kartach. Zmiana środowiska nie przenosi kont i nie zmienia środowiska trwających testów. Otwarcie panelu nie uruchamia testów; wcześniej zapisany i włączony harmonogram PROD wznawia działanie po otwarciu tego środowiska.

## Konfiguracja

Skopiuj wzorce tylko dla plików, których jeszcze nie masz:

```powershell
Copy-Item .env.test.example .env.test
Copy-Item .env.prod.example .env.prod
Copy-Item config/test.example.json config/test.local.json
Copy-Item config/prod.example.json config/prod.local.json
```

Uzupełnij konto, materiały, adresy i selektory osobno dla każdego środowiska.

| Środowisko | Plik | Nauczyciel | GitLab |
| --- | --- | --- | --- |
| TEST | `.env.test` | `MOJE_GWO_TEST_USERNAME`, `MOJE_GWO_TEST_PASSWORD` | `GITLAB_TEST_USERNAME`, `GITLAB_TEST_PASSWORD` |
| PROD | `.env.prod` | `MOJE_GWO_PROD_USERNAME`, `MOJE_GWO_PROD_PASSWORD` | `GITLAB_PROD_USERNAME`, `GITLAB_PROD_PASSWORD`, jeśli używany |

Zmienne procesu mają pierwszeństwo przed plikiem danego środowiska. Brakujące dane PROD nie są zastępowane danymi TEST. PROD wymaga kompletnej konfiguracji, potwierdzonego `authMode` i świadomego ustawienia `runEnabled: true`. Sam wybór PROD nie włącza testów.

## Polecenia

```powershell
npm.cmd run panel                       # wspólny panel, start w TEST
npm.cmd run panel -- --env prod          # wspólny panel, start w PROD
npm.cmd run test:list -- --env test      # lista bez logowania i testowania
npm.cmd run test:list -- --env prod
npm.cmd test -- --env test               # rzeczywiste testy TEST
npm.cmd test -- --env prod               # rzeczywiste testy PROD
npm.cmd run auth:check -- --env test
npm.cmd run test:services -- --env prod
npm.cmd run test:pages -- --env prod
npm.cmd run report -- --env test
npm.cmd run check:local                  # lokalne kontrole obu środowisk
npm.cmd run check:local -- --env prod
```

Można też ustawić `MOJE_GWO_ENV=test` lub `MOJE_GWO_ENV=prod`. Inne nazwy są odrzucane.

## Funkcje

- **Oba środowiska:** profile nauczycieli, materiały, weryfikacja konta, testy funkcjonalne, logi, podgląd przeglądarki, raporty i healthchecki usług.
- **TEST:** ręczne testy obciążeniowe k6. Silnik umieść lokalnie w `tools/k6.exe`. Obciążenie na PROD jest blokowane również w API.
- **PROD:** anonimowa dostępność trzech stron, harmonogram lokalny i powiadomienia Mattermost. Harmonogram wymaga działającego panelu i komputera. Powiadomienia są domyślnie wyłączone; webhook wpisz do `.env.prod` jako `MOJE_GWO_MATTERMOST_WEBHOOK_URL`.

Adresy healthchecków wymagają potwierdzenia i są zapisywane osobno w `config/service-health.test.local.json` i `config/service-health.prod.local.json`. Strona główna nie zastępuje endpointu healthcheck.

## Układ projektu

```text
config/                  wzorce i konfiguracja środowisk
checks/                  kontrole lokalne i integracyjne
dashboard/              wspólny panel i obsługa środowisk
lib/                     wspólne biblioteki
scripts/                 wspólne polecenia
tests/                  wspólne scenariusze Playwright
load/                    scenariusz obciążenia TEST
.health/test/            lokalne profile, historia i raporty TEST
.health/prod/            lokalne profile, historia i raporty PROD
playwright/.auth/test/   sesje TEST
playwright/.auth/prod/   sesje PROD
```

Hasła, sesje, lokalne ustawienia i wyniki są ignorowane przez Git. Nowe hasła profili są szyfrowane dla bieżącego konta Windows. Instalacja z GitHuba wymaga własnej konfiguracji.

## Przeniesienie ze starego układu

Oryginalne foldery poza tym repozytorium pozostają bez zmian. Przenosząc konfigurację TEST, zmień nazwy zmiennych na `*_TEST_*` i `sessionFile` na `playwright/.auth/test/teacher.json`. Konfigurację PROD przenieś do `config/prod.local.json`, a jego `.env` do `.env.prod`. Nie kopiuj sesji między środowiskami. Najprościej ponownie dodać nauczycieli i zalogować ich ze wspólnego panelu. Dawne integracje wskazujące osobne porty należy skierować na `/test/` lub `/prod/` nowego panelu. Kopia w tym repozytorium nie synchronizuje się automatycznie z pierwotnymi folderami.

## GitHub

Repozytorium: [nikpan123/mojeGWO](https://github.com/nikpan123/mojeGWO).

```powershell
git add .
git commit -m "Opis zmian"
git push
```
