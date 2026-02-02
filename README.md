# 🗺️ InspectMap

**InspectMap** to nowoczesna aplikacja desktopowa oparta na technologii Electron i Quasar Framework, służąca do wizualizacji, planowania i zarządzania inspekcjami technicznymi w terenie.

Narzędzie umożliwia importowanie baz danych z plików Excel, automatyczne nanoszenie lokalizacji na mapę miasta oraz inteligentne zarządzanie przydziałami pracowników do konkretnych rejonów.

## 🚀 Główne Funkcje

### 📍 Wizualizacja i Mapy
* **Interaktywna mapa miasta:** Oparta na **MapLibre GL**, zapewniająca płynne działanie i wektorową dokładność.
* **Heatmapa (Mapa obłożenia):** Wizualizacja natężenia pracy na poszczególnych ulicach – kolory (zielony/żółty/czerwony) wskazują liczbę obiektów do sprawdzenia.
* **Podświetlanie ulic:** Kliknięcie lub wyszukanie ulicy automatycznie centruje mapę i podświetla jej przebieg.

### 📅 Planowanie i Terminy
* **Oś czasu (Timeline):** Możliwość filtrowania obiektów, których termin przeglądu przypada w wybranym zakresie miesięcy.
* **Filtrowanie:** Wyświetlanie danych tylko dla wybranych inspektorów/opiekunów.

### 🤖 Smart Street Matching (Inteligentne Dopasowanie)
Aplikacja posiada zaawansowany, autorski algorytm dopasowywania nazw ulic z bazy Excel do danych geograficznych:
* **Normalizacja:** Ignorowanie wielkości liter, polskich znaków oraz znaków specjalnych.
* **Usuwanie "szumu":** Algorytm automatycznie pomija tytuły (np. *Gen., Prof., Św.*), typy ulic (*Al., Plac, Rondo*) oraz popularne imiona, skupiając się na kluczowym członie nazwy (np. nazwisku).
* **Fuzzy Matching:** Obsługa literówek i drobnych błędów w pisowni (algorytm Levenshteina).
* **Niezależność od kolejności:** Poprawnie łączy *ul. Adama Mickiewicza* z *Mickiewicza Adama*.

### ✍️ Zarządzanie Przydziałami
* **Automatyczne przydzielanie:** Funkcja "Auto z Excela" pozwala błyskawicznie przypisać ulice do opiekunów na podstawie zaimportowanych danych.
* **Edycja manualna:** Możliwość ręcznego nadpisywania opiekuna dla konkretnej ulicy bezpośrednio z poziomu mapy.
* **Eksport/Import:** Zapisywanie i odczytywanie konfiguracji przydziałów do plików JSON.

## 🛠️ Technologie

Projekt zbudowany jest w oparciu o nowoczesny stos technologiczny:

* **[Quasar Framework](https://quasar.dev/)** (Vue.js 3) - Interfejs użytkownika.
* **[Electron](https://www.electronjs.org/)** - Opakowanie aplikacji jako program desktopowy (Windows).
* **[MapLibre GL JS](https://maplibre.org/)** - Silnik mapy.
* **[Pinia](https://pinia.vuejs.org/)** - Zarządzanie stanem aplikacji.
* **[SheetJS (XLSX)](https://sheetjs.com/)** - Parsowanie plików Excel.

## 📦 Instalacja i Uruchomienie

Aby uruchomić projekt lokalnie, upewnij się, że masz zainstalowane **Node.js** oraz **NPM/Yarn**.

1.  **Sklonuj repozytorium:**
    ```bash
    git clone [https://github.com/twoj-login/InspectMap.git](https://github.com/twoj-login/InspectMap.git)
    cd InspectMap
    ```

2.  **Zainstaluj zależności:**
    ```bash
    npm install
    ```

3.  **Uruchom w trybie deweloperskim (Electron):**
    ```bash
    quasar dev -m electron
    ```

## 🔨 Budowanie wersji produkcyjnej

Aby wygenerować plik wykonywalny `.exe` dla systemu Windows:

```bash
quasar build -m electron
