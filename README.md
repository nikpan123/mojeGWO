# Moje GWO — testy TEST i PROD

Wspólny panel do sprawdzania kont nauczycieli, materiałów i usług GWO. Środowisko TEST lub PROD wybierasz w panelu albo w poleceniu.

## Instalacja

Wymagane: **Git, Node.js 22+ i npm**. Polecenia dla PowerShell:

```powershell
git clone https://github.com/nikpan123/mojeGWO.git
cd mojeGWO
npm.cmd ci
npx.cmd playwright install chromium
Copy-Item .env.test.example .env.test
Copy-Item .env.prod.example .env.prod
Copy-Item config/test.example.json config/test.local.json
Copy-Item config/prod.example.json config/prod.local.json
```

Uzupełnij dane kont w `.env.test` i `.env.prod`, a ustawienia środowisk w `config/*.local.json`. PROD wymaga `runEnabled: true` i poprawnego `authMode`. Przy aktualizacji istniejącej instalacji zachowaj własne pliki ustawień.

```powershell
npm.cmd run panel
```

Otwórz adres wyświetlony w terminalu. Panel próbuje portu **4182**, następnie **4184**, a w razie konfliktu wybiera inny wolny port. W panelu dodawaj nauczycieli, pobieraj ich dostępy i wybieraj materiały do testów.

## Technologie i zakres testów

- **Node.js / JavaScript (ES Modules)** — lokalny serwer HTTP, panel i obsługa środowisk.
- **Playwright / Chromium** — sprawdzanie konta i roli nauczyciela, aktywnych dostępów, otwierania materiałów, zmiany stron czytnika oraz skonfigurowanych funkcji aplikacji. Dostępne są logi, podgląd i raporty.
- **Healthchecki usług** — HTTPS, odpowiedź JSON, czas i nagłówki cache. Adresy wymagają konfiguracji osobno dla TEST i PROD.
- **PROD** — dodatkowe anonimowe testy dostępności trzech stron.
- **k6, opcjonalnie** — ręczne testy obciążeniowe wyłącznie na TEST; silnik umieść w `tools/k6.exe`.
- **Windows DPAPI** — szyfrowanie haseł zapisanych w profilach. Pliki kont, sesji i wyników pozostają lokalne i są wykluczone z Git.

## Testy ręczne

W panelu wybierz **TEST/PROD → Uruchom testy**, a następnie zestaw i nauczyciela. Z terminalu:

```powershell
npm.cmd test -- --env test
npm.cmd test -- --env prod
npm.cmd run test:services -- --env prod
npm.cmd run test:pages -- --env prod
npm.cmd run test:list -- --env test  # sama lista, bez uruchamiania
npm.cmd run check:local             # lokalne kontrole kodu i panelu
```

Bez parametru środowiska wybierany jest TEST. Przed testami przeglądarkowymi sesja jest sprawdzana i w razie potrzeby odnawiana z lokalnych danych konta.

## Harmonogram

W panelu **PROD → Harmonogram** wybierz odstęp, zestawy i nauczyciela, włącz automatyczne wykonywanie i zapisz. Komputer i panel muszą działać; samą kartę przeglądarki można zamknąć. Zestawy wykonują się kolejno, a zajęty termin jest pomijany. Harmonogram można wyłączyć w tym samym widoku. Testy obciążeniowe nie są uruchamiane z harmonogramu.

Historia i raporty są dostępne w panelu, osobno dla TEST i PROD. Opcjonalne powiadomienia Mattermost konfiguruje się w panelu PROD; webhook zapisuje się wyłącznie w `.env.prod` jako `MOJE_GWO_MATTERMOST_WEBHOOK_URL`.
