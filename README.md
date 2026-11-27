# Moje GWO — testy TEST i PROD

Wspólne repozytorium dwóch niezależnych projektów:

| Folder | Zawartość |
| --- | --- |
| `MojeGwo/` | Testy środowiska TEST, panel i testy obciążeniowe. |
| `MojeGwoProd/` | Testy środowiska PROD, panel, harmonogram i powiadomienia. |

Pliki źródłowe skopiowano z dotychczasowych folderów. Oryginały pozostają w swoich lokalizacjach. Dalsze zmiany w tym repozytorium i w oryginałach nie synchronizują się automatycznie.

## Instalacja

Wymagane: Node.js z npm oraz Git. W PowerShell, w folderze repozytorium:

```powershell
npm --prefix MojeGwo ci
npm --prefix MojeGwoProd ci
```

Przed pierwszym uruchomieniem testów przeglądarkowych zainstaluj Chromium:

```powershell
Push-Location MojeGwo
npx playwright install chromium
Pop-Location
```

## Osobna konfiguracja TEST i PROD

```powershell
Copy-Item MojeGwo/.env.example MojeGwo/.env
Copy-Item MojeGwo/config/test.example.json MojeGwo/config/test.local.json
Copy-Item MojeGwoProd/.env.example MojeGwoProd/.env
Copy-Item MojeGwoProd/config/prod.example.json MojeGwoProd/config/prod.local.json
```

Wykonaj kopiowanie tylko dla brakujących plików, aby nie nadpisać swoich ustawień. Uzupełnij dane logowania, konto, materiały i selektory osobno dla każdego środowiska. Wzorzec PROD ma `runEnabled: false`; przed świadomym uruchomieniem testów produkcyjnych wymaga kompletnej konfiguracji. Nigdy nie używaj sesji TEST jako sesji PROD.

Repozytorium nie zawiera haseł, lokalnych ustawień, profili nauczycieli, sesji przeglądarki, historii ani raportów. Potrzebne pliki `.env` i `config/*.local.json` możesz przenieść lokalnie z odpowiadających im oryginalnych folderów; pozostają ignorowane przez Git. Profile i zaszyfrowane hasła są związane z lokalną instalacją i kontem Windows.

## Uruchamianie

Polecenia wykonuj w folderze wybranego projektu:

```powershell
cd MojeGwo
npm run check:local
npm run panel
```

Dla PROD przejdź zamiast tego do `MojeGwoProd`. `npm test` uruchamia rzeczywiste testy wskazanego środowiska i wymaga konfiguracji oraz konta. `npm run check:local` sprawdza projekt lokalnie.

Testy obciążeniowe TEST wymagają dodatkowo lokalnego silnika `MojeGwo/tools/k6.exe`, który nie jest przechowywany w Git.

Szczegóły funkcji: [TEST](MojeGwo/README.md) i [PROD](MojeGwoProd/README.md). Dokumentacja tych projektów zawiera również historyczne wyniki i ścieżki pierwotnych instalacji; nie stanowią one wyników nowej kopii. Integrację z dotychczasowym Centrum należy skonfigurować osobno, jeśli ma wskazywać tę kopię.

## Wysłanie na GitHuba

Utwórz na GitHubie puste repozytorium, bez README, licencji i pliku `.gitignore`. Ze względu na kod i szczegóły infrastruktury firmowej zalecana widoczność to **Private**.

Następnie w głównym folderze tego repozytorium wykonaj poniższe polecenia, zastępując przykładowy adres adresem swojego repozytorium:

```powershell
git remote add origin https://github.com/TWOJ_LOGIN/NAZWA_REPOZYTORIUM.git
git push -u origin main
```

Pierwszy commit jest przygotowany lokalnie. Kolejne zmiany zapisuj i wysyłaj tak:

```powershell
git status
git add .
git commit -m "Opis zmian"
git push
```
