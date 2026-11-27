# moje.gwo — szybkie testy TEST

Zestaw działa wyłącznie na **https://moje.gwotest.pl**. Instalacja używana przez Centrum: `C:\Users\npanek\Documents\ChatGPT\MojeGwo`.

## Zakres pięciu testów

| Test | Sprawdzenie |
|---|---|
| HC-01 | Panel, właściwy identyfikator i nazwa konta oraz rola `teacher_verified`. |
| HC-02/testowy-developerski-5 | Aktywny dostęp nauczycielski do **TESTOWY DEVELOPERSKI**, klasa 5. |
| HC-03/testowy-developerski-5 | Uruchomienie przez kartę portalu, załadowana treść strony i przejście do następnej; zmienia się numer i obraz strony. |
| HC-02/matematyka-sp | Aktywny dostęp nauczycielski do **aplikacja ponadklasowa mat sp**. |
| HC-03/matematyka-sp | Uruchomienie matematyki, wybór klasy 6 i otwarcie listy „Twoje zestawy”. |

Testy nie tworzą, nie edytują, nie drukują i nie usuwają zestawów. Wyświetlona oferta sklepu nie jest traktowana jako posiadany dostęp. Sam widok karty nie wystarcza do potwierdzenia działania materiału.

## Logowanie z `.env` — jak w Octopusie

Używamy lokalnego pliku `.env` i zmiennych środowiskowych procesu. Zmienne procesu mają pierwszeństwo przed plikiem. Plik `.env.example` zawiera wyłącznie wzorzec:

```dotenv
GITLAB_USERNAME=''
GITLAB_PASSWORD=''
MOJE_GWO_USERNAME='npanek@gwo.pl'
MOJE_GWO_PASSWORD=''
```

To dwa różne konta/logowania: GitLab zapewnia wejście do środowiska TEST, a moje.gwo loguje nauczyciela. Wpisz właściwe hasło każdego z nich. Nie zakładamy, że są identyczne.

Przed każdym przebiegiem `globalSetup`:

1. Wczytuje zapisaną sesję, jeżeli istnieje, i otwiera moje.gwo TEST.
2. Jeśli trzeba, przechodzi przez GitLab SSO. Jeżeli również sesja GitLaba wygasła, wpisuje `GITLAB_USERNAME` i `GITLAB_PASSWORD` na sprawdzonym formularzu `https://gitlab.gwo.pl/users/sign_in`.
3. Jeśli portal wymaga własnego logowania, używa `MOJE_GWO_USERNAME` i `MOJE_GWO_PASSWORD` na ekranie `/uzytkownik/` w domenie TEST. Hasła obu usług nie są zamieniane ani używane jako wzajemny fallback.
4. Potwierdza rzeczywiste API tożsamości, skonfigurowany identyfikator konta, nazwę i rolę nauczyciela.
5. Obsługuje baner cookies przez ustawienia zaawansowane: wyłącza opcjonalne kategorie i potwierdza wybór niezbędnych cookies.
6. Zapisuje odnowioną sesję, po czym uruchamia pięć testów.

Wygaśnięcie sesji po 15 minutach nie wymaga ręcznego logowania, jeżeli oba zestawy danych w `.env` są poprawne. Logowanie jest przygotowywane raz przed krótkim zestawem, nie osobno przed każdym scenariuszem. Jeden worker i limit całego przebiegu 5 minut ograniczają niepotrzebne równoległe logowania.

Jeśli pojawi się MFA, CAPTCHA, nowe wymaganie ręcznej autoryzacji albo nieprawidłowe dane, przygotowanie zgłosi czytelny błąd. Nie omija zabezpieczeń i nie powtarza w pętli nieudanych prób hasła.

## Ochrona danych dostępowych

`.env` zawiera lokalne dane dostępowe tak jak w Octopusie. `.gitignore` wyklucza `.env`, lokalną konfigurację, sesje i raporty; wyjątkiem jest pusty `.env.example`. Nie udostępniaj `.env` ani katalogu `playwright/.auth`.

Etap wpisywania haseł działa w osobnym kontekście bez trace, wideo i zrzutów ekranu. Raporty zawierają jedynie bezpieczny status logowania, tryb użycia/odnowienia sesji i potwierdzenie właściwego konta. Wyjątki formularza są zastępowane komunikatami bez wartości pól i tokenów przekierowania.

GitLab przyjmuje dane wyłącznie na zweryfikowanym formularzu POST własnej domeny. Formularz JavaScript portalu ma dodatkową kontrolę żądań: dane nie mogą trafić do innej domeny ani zostać wysłane parametrem `password` w adresie GET.

## Uruchamianie w Centrum

Otwórz **Centrum testów → Projekty → moje.gwo → Przejdź do panelu testów**:

- Centrum: http://127.0.0.1:4180/#projects
- Panel moje.gwo: http://127.0.0.1:4182/

Przycisk „Uruchom 5 testów na TEST” najpierw przygotowuje logowanie, a następnie wykonuje kontrole. Otwarcie samego panelu nie uruchamia testów. Centrum uruchamia panel projektu na żądanie. Nie utworzono harmonogramu cyklicznego.

Po zakończeniu odśwież Centrum → Historia → moje.gwo. Zachowujemy poprzednie wyniki; nowy przebieg nie nadpisuje wcześniejszych raportów. Raporty otwierają się z wiersza historii.

## Uruchamianie w PowerShell

W folderze `C:\Users\npanek\Documents\ChatGPT\MojeGwo`:

```powershell
npm run check:config
npm test
npm run test:headed
```

Kontrola logowania bez uruchamiania materiałów:

```powershell
npm run auth:check
# Pełne logowanie od pustej sesji — do diagnostyki:
npm run auth:force
```

W razie potrzeby `npm run auth` nadal umożliwia ręczne zapisanie sesji. Nie jest to wymagany krok normalnego uruchamiania automatów.

## Pierwsza instalacja nowej kopii

Wymagany Node.js 22.13 lub nowszy:

```powershell
npm ci
npx playwright install chromium
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path config/test.local.json)) { Copy-Item config/test.example.json config/test.local.json }
notepad .env
```

Szablon konfiguracji wymaga dopasowania `accountUserId` i `accountDisplayName` do właściwego nauczyciela. Aktualna instalacja Centrum ma już uzupełnioną konfigurację i rzeczywiste selektory. Nie kopiuj pustego szablonu na jej konfigurację lokalną.

## Konfiguracja i zgody

`config/test.local.json` zawiera adresy środowiska, dokładną listę dozwolonych hostów, oczekiwaną tożsamość oraz definicje materiałów. `accessAPI` wskazuje posiadane dostępy; `catalogTab`, `groupLabel`, `entitlementSelector` i `launchSelector` opisują nawigację portalu. Test otwiera nową kartę przez portal, zamiast przechowywać tymczasowy token uruchomienia.

`readySelector`, `actionSelector` i `resultSelector` określają sprawdzaną czynność. Czytnik używa trybu `reader-next`, sprawdzającego zmianę numeru i załadowanej treści.

Użytkownik 23.11.2026 zezwolił na automatyczne potwierdzanie wskazanego regulaminu matematyki podczas testów. Lokalna sekcja `approvedRules` ogranicza to do testowego hosta Kompozytora, ścieżki `/matematyka/rules` i widocznego przedmiotu „Matematyka. Szkoła podstawowa.”. Wykonana akceptacja otrzymuje osobny załącznik w raporcie. Pusty szablon `.env` nie zawiera żadnych zgód ani sesji.

Produkcja moje.gwo i dev pozostają zablokowane. Kontrola sieci obejmuje przekierowania, nowe karty i iframe. Skrypty Tag Managera i produkcyjnej usługi zgód są celowo blokowane bez wysyłania żądań i odnotowywane osobno; niedozwolona nawigacja nadal powoduje błąd.

## Raporty

Przebiegi Centrum: `.health/runs/<id>/report/`, wynik maszynowy `results.json`, historia `.health/history.json`. Każdy test ma załącznik `logowanie` oraz kontrolę domen. Przy błędzie powstają zrzuty i trace samej kontroli materiałów, po zakończeniu etapu logowania.

Uruchomienie CLI zapisuje `playwright-report/` oraz `test-results/`. `npm run report` otwiera raport CLI. Raporty mogą zawierać dane panelu i sesji; pozostają lokalne i są wykluczone z Git.

`docs/przykladowy-raport.html` jest wyłącznie demonstracją formatu, nie wynikiem kontroli.

## Weryfikacja mechanizmu

```powershell
npm run check:local
npm run check:auth
npm run check:dashboard
```

Kontrole logowania używają przechwyconego ruchu i fikcyjnych danych: świeża sesja, wygaśnięcie ciasteczka, osobne hasła obu usług, brak danych, obcy formularz, inne konto i MFA. Nie wysyłają fikcyjnych danych do prawdziwego GitLaba ani GWO.

Rzeczywiste logowanie od pustej sesji sprawdzono poleceniem `auth:force`; właściwe konto i rola nauczyciela zostały potwierdzone. Wyniki pełnych kontroli są dostępne w historii Centrum.

## Panel, logi i podgląd przeglądarki

Od 24.11.2026 panel ma osobne widoki: Pulpit, Uruchom testy, Przebieg i logi, Historia oraz Scenariusze. Dostęp z Centrum → Projekty → moje.gwo / moje.gwo PROD.

W „Uruchom testy” można włączyć podgląd obrazu w panelu, pokazać dodatkowe okno przeglądarki, zmienić tempo czynności oraz wymusić ponowne logowanie. Po rozpoczęciu panel przechodzi do widoku „Przebieg i logi”. Pokazuje nazwę testu, bieżący krok i postęp. Obraz odświeża się mniej więcej co sekundę po zalogowaniu; formularz hasła jest wyłączony z podglądu. Kliknięcia w obraz nie sterują testem.

Logi zawierają nazwy etapów i wyniki, bez surowych danych formularza i argumentów akcji. Po zakończeniu logi i ostatni obraz pozostają przy przebiegu; wybierz go z listy albo w Historii. Pełny raport jest nadal dostępny osobno. Starsze przebiegi zachowują raporty, ale nie mają nowych logów ani obrazu podglądu.

Nowy interfejs sprawdzono lokalnie: uruchamianie i opcje, logi, obraz, historia, układ mobilny oraz ochrona formularza hasła. Pełny przepływ Playwright → logi → obraz sprawdzono na lokalnym czytniku zastępczym. Podczas tych kontroli nie logowano kont TEST ani PROD.
## Nauczyciele i materiały

W menu panelu jest zakładka „Nauczyciele i materiały”. Dotychczasowe konto, jego .env, materiały i sesja są widoczne jako pierwszy profil. Pierwszy odczyt listy profili nie zmienia tych plików.

1. Wybierz „Dodaj nauczyciela”, podaj nazwę profilu, e-mail i hasło konta. Znane dane tożsamości można wpisać w szczegółach; nieznane pozostaw puste.
2. Zapisz profil, a następnie użyj „Pobierz dostępy z konta”. Ta operacja loguje konto, potwierdza rolę i tożsamość oraz odczytuje listę przydzielonych materiałów. Nie loguj się jednocześnie na to samo konto. Kolejne odczyty nie mogą samoczynnie zmieniać potwierdzonej tożsamości.
3. Wybierz materiały z odczytanej listy albo dodaj je ręcznie. Oczekiwania są zapisywane osobno i nie znikają, gdy konto traci dostęp.
4. Wybierz wariant kontroli: sam dostęp; czytnik ze zmianą stron; Kompozytor z wejściem do klasy i listy zestawów; albo wcześniej skonfigurowany wzorzec. Dla innych aplikacji użyj kontroli dostępu do czasu dopasowania pełnego testu ich interfejsu. Nie oznaczamy ich działania jako sprawdzonego.
5. Wybierz profil do testów przyciskiem w jego karcie albo listą „Nauczyciel” w widoku uruchomienia. Liczba kontroli wynika z włączonych materiałów i zakresu ich sprawdzania.

Można edytować profil, zmieniać hasła, wyłączać nauczyciela, edytować i odłączać materiały oraz wyłączać pojedyncze kontrole materiałów. Wyłączenie profilu zachowuje historię. Nie można wyłączyć ostatniego aktywnego profilu. Zmiana konta lub hasła tworzy osobną lokalizację sesji. TEST i PROD pozostają oddzielone.

Profile są zapisane w `.health/profiles.json`; nowe hasła w `.health/credentials` są szyfrowane mechanizmem Windows DPAPI dla bieżącego konta Windows. Nie są zwracane do przeglądarki ani zapisywane w konfiguracji przebiegu. Puste pole hasła przy edycji oznacza zachowanie dotychczasowego; zmiana e-maila wymaga hasła nowego konta. W TEST można używać wspólnego logowania GitLaba z .env albo zapisać osobne. Portal nauczyciela nigdy nie używa hasła innego profilu jako zastępczego.

Każdy przebieg zapisuje nazwę nauczyciela i własną kopię oczekiwań. Edycja profili i odczyt konta są blokowane podczas przebiegu. Zmiana konfiguracji po zakończeniu nie zmienia starego raportu. Centrum pobiera katalog kontroli dla wybranego profilu.

Podgląd pomija ekran hasła. Zwykłe pola aplikacji (np. nazwy zestawów i sortowanie) nie są już zasłaniane różowymi maskami; zmiana dotyczy nowych obrazów podglądu, a zapisane wcześniej obrazy pozostają bez zmian.
## Endpointy healthcheck i odbiór usług

Dodano osobny zestaw „Endpointy healthcheck — 3 usługi”: moje.gwo, multipodręczniki i Kompozytor. Dziewięć automatów EP-01/EP-02/EP-03 sprawdza odpowiednio kontrakt HTTPS/JSON/minimalną odpowiedź, czas odpowiedzi oraz nagłówki cache przy dwóch odczytach. Każda usługa ma własne przypadki. Ten zestaw nie loguje nauczyciela i nie uruchamia przeglądarki.

Adresów nie zgadywano. W zakładce „Healthcheck usług” wpisz adresy otrzymane od właścicieli i potwierdź je. Puste lub niepotwierdzone adresy blokują wykonanie przed utworzeniem przebiegu. Sam zapis adresów nie wykonuje żądań. Konfiguracja jest osobna dla TEST i PROD w `config/service-health.local.json`.

Kontrakt przyjęty w testach: HTTPS bez danych logowania i parametrów; bez przekierowań; HTTP 200; Content-Type JSON; obiekt z `service` (moje-gwo / multipodreczniki / kompozytor) i `status: ok`. Opcjonalne checkedAt musi oznaczać świeży pomiar (maks. 15 sekund, tolerancja przyszłego czasu 5 sekund). Dodatkowe pola publiczne są odrzucane; surowe odpowiedzi nie są zapisywane w załącznikach. Limit odpowiedzi 4096 bajtów, cel czasu do 2 sekund, timeout 5 sekund. Wymagane Cache-Control: no-store, brak Age > 0 i sygnału cache HIT. Progi oraz schemat są propozycją kontraktu do zatwierdzenia przez zespoły aplikacyjne.

Uruchomienie z panelu: „Uruchom testy” → „Zestaw” → „Endpointy healthcheck”. Polecenie: `npm run test:services`; samo listowanie bez żądań: `npm run test:services:list`. Domyślne `npm test` pozostaje smoke funkcjonalnym nauczyciela. Healthchecki nie wymagają jego hasła ani zapisanej sesji.

Katalog Centrum zawiera również 24 ręczne scenariusze odbiorowe: po osiem na każdą usługę. Obejmują awarię krytycznej i opcjonalnej zależności, opóźnienia, cache podczas zmiany stanu, przywrócenie, koszt i skutki uboczne, błędy DNS/TLS/sieci oraz alarmowanie. To próby na uzgodnionym TEST, z właścicielem usługi i dowodami. Nie wykonują automatycznych awarii PROD i nie są liczone jako zaliczone kontrole cykliczne.

Pokrycie kryteriów: QA-01, QA-05 i publiczna część QA-10 → EP-01; czas odpowiedzi → EP-02; nagłówki i świeżość → EP-03. QA-02/03/04/06/07/08/09 oraz MON-01 → ręczny odbiór kontrolowanych warunków, osobno dla każdej usługi. Nagłówki no-store nie są dowodem poprawnego zachowania podczas awarii; taki dowód wymaga QA-06. Kontrola pól publicznych nie zastępuje przeglądu logów wewnętrznych przez właściciela.

Testy walidatora i interfejsów zostały sprawdzone lokalnie na odpowiedziach zastępczych. Nie oznacza to odbioru endpointów aplikacyjnych, które czekają na implementację lub potwierdzenie adresów.

## Rozpoznawanie pełnych nazw materiałów

Pełna nazwa i identyfikator dostępu pochodzą z API posiadanych dostępów. Skrócony podpis kafelka jest wyłącznie etykietą. Test potwierdza kartę po pełnym tytule w jej danych lub szczegółach dostępu; w razie potrzeby otwiera informacje i zamyka je przed uruchomieniem materiału. Niejednoznaczne dopasowanie kończy się błędem, bez wybierania pierwszego kafelka. Po zmianie zakładki test czeka na załadowanie właściwych kart. Raport zawiera załącznik „rozpoznanie-pelnej-nazwy” z pełnym tytułem, identyfikatorem i sposobem rozpoznania. Lista odczytanych materiałów w panelu pokazuje pełną nazwę z API i identyfikator.

## Zasoby wyglądu i grupy materiałów

Przeglądarka testowa może pobierać arkusze fontów z fonts.googleapis.com, fonty z fonts.gstatic.com oraz obrazy z files właściwego środowiska. Wyjątek dotyczy wyłącznie GET i wskazanych typów zasobów; nie dopuszcza nawigacji, skryptów ani wysyłania danych. Wyłączenie PROD nadal blokuje wszystkie żądania. Fonty i okładki nie są już celowo usuwane z wyglądu strony.

Grupy materiałów mogą być rozwijaną sekcją albo zwykłym nagłówkiem, takim jak „Nauczanie wielopoziomowe”. Test klika wyłącznie zamkniętą sekcję z aria-expanded=false. Numer klasy Kompozytora jest rozpoznawany jako osobne oznaczenie klasy, a nie fragment daty. Wartości wybrane przez użytkownika nie są samoczynnie zmieniane.

Zmiany dotyczą nowych przebiegów; stare raporty i ich zrzuty ekranu pozostają bez zmian.
Karty pracy (Edukacja wczesnoszkolna): adapter worksheets sprawdza katalog zadań klas 1–3 i załadowane propozycje. Otwiera niezapisany widok komponowania, blokuje żądania zapisu i nie dodaje zadań do zestawu.

Karty pracy (Edukacja wczesnoszkolna): adapter worksheets sprawdza katalog zadań klas 1–3 i załadowane propozycje. Otwiera niezapisany widok komponowania, blokuje żądania zapisu i nie dodaje zadań do zestawu.

## Obciążenie moje.gwo TEST
Centrum testów → moje.gwo TEST → Obciążenie TEST. Domyślny zapis: 5 użytkowników przez 5 minut; zakres 1–50 użytkowników i 1–10 minut. Zapis profilu nie wykonuje testu. Brak harmonogramu. Scenariusz public-page wykonuje GET HTML wejścia, teacher-panel wykonuje GET tożsamości i obu list dostępów. Przerwa 5 sekund po iteracji; liczba użytkowników nie jest liczbą żądań na sekundę. Brak renderowania przeglądarki i testów wnętrza aplikacji.
Dla teacher-panel wybierz przynajmniej tylu nauczycieli, ilu użytkowników. Loginy i identyfikatory muszą być odrębne. Przygotowanie/odnowienie sesji odbywa się dopiero po ręcznym starcie; nie w trakcie zapisu. Utrata sesji przerywa obciążenie. Nie loguj się jednocześnie na konta biorące udział w próbie. Konfiguracja kont i GitLaba pozostaje w dotychczasowych profilach i .env, nie w skrypcie k6.
Silnik k6 1.5.0 z oficjalnego wydania Grafana, suma SHA-256 sprawdzona, lokalnie tools/k6.exe. Tylko TEST; generator nie wykonuje logowania GitLaba ani nie kieruje ruchu na PROD. Tymczasowe nagłówki sesji służą wyłącznie do GET tego samego hosta, bez przekierowań; są usuwane po zakończeniu i nie trafiają do raportu. Wyłączono raportowanie użycia k6 i zewnętrzne wyjścia.
Wynik obejmuje 3 robocze kryteria: p95 żądań poniżej 2 s, błędy HTTP poniżej 1%, poprawność odpowiedzi minimum 99%. Progi do uzgodnienia z zespołem. Raport zawiera liczby żądań i iteracji, p95/p99, błędy oraz poprawność. Brak pomiarów nie jest zaliczeniem. Zatrzymanie przerywa generator i nie daje PASS. Zestaw nie został uruchomiony podczas przygotowania.
