# moje.gwo PROD — Centrum testów

Zestaw jest włączony za zgodą użytkownika. Ostatni przebieg z 23.11.2026: **5 zaliczonych, 0 niezaliczonych**, około 31 sekund. Nie ma harmonogramu automatycznych uruchomień.

Centrum: http://127.0.0.1:4180/#projects → **moje.gwo PROD**. Osobny panel: http://127.0.0.1:4183/.

## Uruchomienie

1. Zamknij inne sesje tego konta lub wstrzymaj ponowne logowanie na czas testów. Kolejne logowanie może unieważnić sesję testową.
2. Otwórz panel moje.gwo PROD w Centrum.
3. Kliknij **Uruchom 5 testów na PROD**.
4. Wynik i szczegóły otwórz w historii Centrum albo panelu PROD.

Testy sprawdzają zapisaną sesję i w razie potrzeby logują ponownie z własnego `.env`. PROD używa logowania portalu bez GitLaba. Dane TEST nie są używane jako zastępcze.

## Ustawienia

Folder instalacji: `C:\Users\npanek\Documents\ChatGPT\MojeGwoProd`.

- `.env`: `MOJE_GWO_PROD_USERNAME`, `MOJE_GWO_PROD_PASSWORD`. Pola `GITLAB_PROD_*` pozostają niewymagane przy `authMode:portal`.
- `config/prod.local.json`: produkcyjne konto, materiały, adresy i selektory.
- `playwright/.auth/prod/teacher.json`: osobna sesja PROD.
- `.health/history.json`: historia; `.health/runs/<ID>/report/`: raporty.
- `runEnabled:false`: blokuje uruchamianie, także przed logowaniem. Sam zapis konfiguracji nie uruchamia testów.

## Aktualne wyniki

Raport: http://127.0.0.1:4183/report/2e202dc5-b56e-4de4-8264-5dbb8b3cdf42/.

| Kontrola | Wynik |
|---|---|
| Panel, konto Nikodem Panek, ID 5316225, rola nauczyciela | Zaliczone |
| Aktywny dostęp: To nasz świat. Geografia. Klasa 5. Wersja nauczycielska | Zaliczone |
| Otwarcie i działanie tego multipodręcznika | Zaliczone — obrazy stron załadowane, potwierdzona zmiana stron |
| Aktywny dostęp: Kompozytor klasówek i kart pracy. To nasz świat. Fizyka | Zaliczone |
| Kompozytor: wejście do klasy 7 i lista „Twoje zestawy” | Zaliczone |

Multipodręcznik uruchamia się z karty w moje.gwo przez dopuszczony przez użytkownika pośrednik `old-ksiegarnia.gwo.pl`, następnie `launcher-multipodreczniki.apps.gwo.pl` i docelowy czytnik `multipodreczniki.apps.gwo.pl`. Test sprawdza identyfikator właściwego podręcznika, widoczność i załadowanie obrazów. Po otwarciu pierwszej rozkładówki przechodzi dalej i wymaga zmiany numerów stron oraz źródeł obrazów. Dowód jest zapisany w załączniku „zmiana-strony”. Poprzedni niezaliczony przebieg pozostaje w historii.

Kompozytor automatycznie akceptuje rozpoznany regulamin To nasz świat. Fizyka zgodnie z wyraźną zgodą użytkownika z 23.11.2026. Akceptacja jest odnotowana w raporcie. Testy nie tworzą, nie edytują, nie drukują i nie usuwają zestawów.

## Kontrola domen i danych

Dozwolone hosty: `moje.gwo.pl`, `kompozytorklasowek.apps.gwo.pl`, `multipodreczniki.apps.gwo.pl`, `old-ksiegarnia.gwo.pl`, `launcher-multipodreczniki.apps.gwo.pl`. Pozostałe domeny są blokowane. Opcjonalne fonty, portalowa obsługa zgód i okładki z `files.gwo.pl` pozostają zablokowane i są osobno wykazane w załączniku „kontrola-domen”. Przekierowania nawigacji nie są traktowane jako opcjonalne.

Logowanie odbywa się bez nagrywania formularza. Ślady sieciowe PROD są wyłączone. `.env`, sesje i raporty są wykluczone z Git. Skan ostatniego raportu, obejmujący 8 plików/elementów, nie znalazł haseł z `.env`.

`npm run check:local` sprawdza lokalnie izolację danych i blokadę nieaktywnego wzorca konfiguracji, bez kontaktu z produkcją. Pięć kontroli lokalnych przeszło.

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

## Harmonogram lokalny
W panelu PROD wybierz Harmonogram, ustaw odstęp w minutach (1–10080), zestawy i nauczyciela, zaznacz Włącz automatyczne wykonywanie i zapisz. Następny termin jest liczony od zapisu. Zapisany nauczyciel jest niezależny od ręcznego wyboru profilu; materiały pochodzą z jego bieżącej konfiguracji. Wyłącz harmonogram zatrzymuje kolejkę po bieżącym zestawie. Uruchom zapisany cykl teraz wykonuje jeden cykl i nie zmienia kolejnego terminu.
Panel serwera i komputer muszą działać. Zamknięcie karty przeglądarki nie zatrzymuje automatu. Komputer nie jest wybudzany. Po przerwie wykonywany jest najwyżej jeden zaległy cykl. Nie uruchamiamy równoległych testów; zajęty termin jest pomijany. Zestawy są uruchamiane kolejno nawet po niezaliczonym wyniku pierwszego. Błędy konfiguracji są widoczne w dzienniku harmonogramu; raporty wykonanych testów trafiają do historii i Centrum testów.
Ustawienia i ostatnie 100 zdarzeń: .health/schedule.json. Dziennik i przyciski są dostępne tylko lokalnie. Harmonogram nie wysyła wiadomości do zespołu. Adresy stron głównych nie zastępują endpointów zdrowia.

## Powiadomienia Mattermost
Panel PROD → Powiadomienia. Wiadomości wysyłane wyłącznie po FAIL, zarówno dla przebiegów ręcznych, jak i z harmonogramu. Webhook utwórz w Mattermost: Integracje → Incoming Webhooks → dodaj, wybierz kanał i zapisz. Ustaw jego adres HTTPS w lokalnym .env: MOJE_GWO_MATTERMOST_WEBHOOK_URL. Nie udostępniaj tego adresu w rozmowie, kodzie ani raportach. W panelu wpisz osobisty @login i zapisz; włącz powiadomienia i wyślij wiadomość kontrolną. Webhook jest odczytywany z .env bez restartu panelu. Powiadomienia pozostają wyłączone do konfiguracji.
Raporty są pod adresem 127.0.0.1 i otwierają się tylko na komputerze uruchamiającym testy. Nie wysyłamy haseł, sesji ani surowych logów. Błąd dostarczenia jest widoczny w panelu, nie zmienia wyniku testu i nie uruchamia ponownego wysyłania. Nie zmieniamy kanału wybranego przy tworzeniu webhooka. Obecne niewłaściwe endpointy usług powodują FAIL w każdym cyklu i po włączeniu powiadomień będą generować wzmianki.

## Dostępność stron
Zestaw websites / npm run test:pages sprawdza 3 strony anonimowo: moje.gwo.pl/, multipodreczniki.apps.gwo.pl/ oraz kompozytorklasowek.apps.gwo.pl/matematyka. Każdy scenariusz potwierdza HTTP 200, HTML i tytuł aplikacji, oczekiwany publiczny ekran oraz czas do 15 sekund. Pusta sesja, brak logowania i żądań zapisu. Panel logowania jest poprawnym wynikiem anonimowego wejścia; w Kompozytorze oczekujemy komunikatu Brak autoryzacji z przyciskiem Przejdź do logowania. Samo HTTP 200 oraz ekran 404 nie wystarczają. Nie jest to sprawdzenie wszystkich zależności backendu ani dostępów nauczyciela.
W harmonogramie dostępność stron zastępuje endpointy usług. Endpointy pozostają osobnym zestawem ręcznym, do wykorzystania po otrzymaniu adresów od zespołów.
