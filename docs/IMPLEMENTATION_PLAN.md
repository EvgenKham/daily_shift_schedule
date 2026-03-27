# План реализации Daily Shift Schedule

На основе:
- docs/MVP.md
- docs/ROUTES.md
- docs/ROSTER_STRUCTURE.md (анализ примера наряда)

---

## Этап 0: Подготовка и анализ

### 0.1 Анализ существующего кода
- [ ] Изучить текущую структуру проекта
- [ ] Проверить установленные зависимости
- [ ] Определить используемые библиотеки (React Router, SheetJS, etc.)

### 0.2 Настройка окружения
- [ ] Установить SheetJS (`xlsx`)
- [ ] Установить idb для IndexedDB (если нет)
- [ ] Установить dnd-kit или react-dnd для drag&drop

---

## Этап 1: Структуры данных (Data Layer)

### 1.1 Типы данных (TypeScript interfaces)

```typescript
// types/roster.ts

// Сотрудник
interface Employee {
  fullName: string;      // "Рыжакова А.А."
  prefix?: string;       // "С" (сутки), "Д" (день), "Н" (ночь)
}

// Бригада
interface Brigade {
  type: 'БИТ' | 'Пед' | 'Лин' | '1170';
  number: string;        // "1110", "1150", "1120"
  shiftDay: string;      // "8\20", "9\21", "7\19"
  shiftNight: string;    // "20\8", "21\9", "19\7"
  employeesDay: Employee[];
  employeesNight: Employee[];
  arrivalTimeDay?: string;
  arrivalTimeNight?: string;
}

// Вспомогательная служба
interface SupportService {
  name: 'ДИСПЕТЧЕРСКАЯ' | 'ЗАПРАВОЧНЫЙ БЛОК' | 'УБОРЩИК ПОМЕЩЕНИЙ' | 'УБОРЩИК ТЕРРИТОРИИ';
  positions: SupportPosition[];
}

interface SupportPosition {
  shiftDay: string;
  shiftNight: string;
  employeeDay?: Employee;
  employeeNight?: Employee;
  arrivalTimeDay?: string;
  arrivalTimeNight?: string;
}

// Наряд на дату
interface Roster {
  date: string;          // "ДД.ММ.ГГГГ"
  monthKey: string;      // "YYYY-MM"
  brigades: Brigade[];
  supportServices: SupportService[];
  notes: string[];       // Примечания (5 строк)
  seniorDoctor: string;    // Врач СМП (из настроек)
  seniorDoctorSignature: string; // "Юдаков Е.Ю."
  seniorNurse: string;     // Фельдшер
  seniorNurseSignature: string;  // "Лазарь Д.Г."
  lastModified: number;  // timestamp
}

// График месяца
interface MonthlySchedule {
  monthKey: string;      // "YYYY-MM"
  employees: string[];   // Список ФИО
  assignments: {
    [date: string]: {   // "DD"
      employee: string;
      brigadeType?: string;
      brigadeNumber?: string;
      shift?: string;
    }[]
  };
}

// Настройки
interface Settings {
  stationNumber: string; // № подстанции
  seniorDoctor: string;    // Врач СМП (Зав. п\с № 11)
  seniorDoctorSignature: string;
  seniorNurse: string;     // Фельдшер(Старший) п\с № 11
  seniorNurseSignature: string;
}
```

### 1.2 IndexedDB схема

```typescript
// db/schema.ts

const DB_NAME = 'daily-shift-schedule';
const DB_VERSION = 1;

const STORES = {
  SETTINGS: 'settings',      // key: 'current', value: Settings
  SCHEDULES: 'schedules',    // key: 'YYYY-MM', value: MonthlySchedule
  ROSTERS: 'rosters'         // key: 'YYYY-MM-DD', value: Roster
};
```

### 1.3 DB функции

```typescript
// db/operations.ts

// Settings
function getSettings(): Promise<Settings | null>
function saveSettings(settings: Settings): Promise<void>

// Schedules
function getSchedule(monthKey: string): Promise<MonthlySchedule | null>
function saveSchedule(schedule: MonthlySchedule): Promise<void>
function deleteSchedule(monthKey: string): Promise<void>

// Rosters
function getRoster(date: string): Promise<Roster | null>
function saveRoster(roster: Roster): Promise<void>
function deleteRoster(date: string): Promise<void>
```

---

## Этап 2: Страница "График" (`/schedule`)

### 2.1 Компоненты

```
src/pages/SchedulePage/
├── SchedulePage.tsx         # Основная страница
├── ScheduleImport.tsx       # Импорт XLSX
├── ScheduleViewer.tsx       # Просмотр графика месяца
└── ScheduleValidation.tsx   # Валидация и ошибки
```

### 2.2 Функционал

- [ ] Выбор месяца/года (datepicker)
- [ ] Кнопка "Импорт XLSX"
- [ ] Парсинг XLSX (SheetJS)
  - [ ] Распознавание колонок: ФИО, Бригада, Смена, Дата
  - [ ] Конвертация в MonthlySchedule
- [ ] Валидация данных
  - [ ] Проверка обязательных полей
  - [ ] Проверка формата дат
  - [ ] Проверка формата смен
- [ ] Отображение ошибок/предупупреждений
- [ ] Сохранение в IndexedDB
- [ ] Отображение графика (таблица/календарь)

### 2.3 Формат входного XLSX (график)

Ожидается формат, аналогичный "График Март.xlsx":
- Колонки: Дата, День недели, ФИО, Бригада, Смена, Часы
- Строки: дни месяца (1-31)

---

## Этап 3: Страница "Наряд" (`/roster`)

### 3.1 Компоненты

```
src/pages/RosterPage/
├── RosterPage.tsx           # Основная страница
├── RosterHeader.tsx         # Заголовок + выбор даты
├── RosterBrigades.tsx       # Таблица выездных бригад (стр. 1)
├── RosterSupport.tsx        # Таблица вспомогательных служб (стр. 2)
├── RosterNotes.tsx          # Примечания + подписи
├── RosterAttention.tsx      # Блок "Внимание!"
├── RosterCell.tsx           # Ячейка таблицы (inline edit)
├── RosterDragDrop.tsx       # Drag&drop swap
└── RosterActions.tsx        # Кнопки (сохранить, экспорт)
```

### 3.2 Генерация наряда

```typescript
// services/rosterGenerator.ts

function generateRoster(date: string, schedule: MonthlySchedule, settings: Settings): Roster {
  // 1. Получить assignments на дату
  // 2. Сгруппировать по бригадам (БИТ, Пед, Лин, Перев)
  // 3. Разделить на день/ночь по сменам
  // 4. Добавить вспомогательные службы
  // 5. Заполнить подписи из настроек
  // 6. Вернуть Roster
}
```

### 3.3 UI структура (по образцу PDF)

#### Страница 1: Выездные бригады

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Наряд                                                              12.03.2026 │
├───────────────────────────────────────────────────────────────────────────────┤
│                    ВЫЕЗДНЫЕ БРИГАДЫ                                           │
├──────────┬──────────────┬─────────────┬─────────┬───────────────┬─────────────┤
│Бригада\  │Состав (день) │Время прихода│Бригада\ │ Состав (ночь) |Время прихода|
│смена     │              │ухода подпись│смена    │               |ухода подпись│
├──────────┼──────────────┼──────┬──────┼─────────┼───────────────┼──────┬──────┤
│БИТ 1110  │С Рыжакова А.А│      │      │БИТ 1110 |С Рыжакова А.А |      │      │
│8\20      │С Хохлов В.А  │      │      │20\8     │С Хохлов В.А.  |      │      │
│          │              │      │      │         │Н слабко Л.В.  |      │      │
│          │              │      │      │         │               |      │      │
└──────────┴──────────────┴──────┴──────┴─────────┴───────────────┴──────┴──────┘
```

#### Страница 2: Вспомогательные службы

```
┌──────────────────────────────────────────────────────────────────────┐
│                    ДИСПЕТЧЕРСКАЯ                                     │
├──────────┬──────────────┬───────────┬──────┬────────────────┬────────┤
│смена     │Состав (день) │Время      │смена │  Состав(ночь)  │Время   │
├──────────┼──────────────┼────┬──────┼──────┼────────────────┼───┬────┤
│8\20      │Д Барауля Т.Л.│    │      │20\8  │Н Агафонова И.И.│   │    │
│8\20      │С Мыслейко К.С│    │      │20\8  │С Мыслейко К.С. │   │    │
└──────────┴──────────────┴────┴──────┴──────┴────────────────┴───┴────┘

┌─────────────────────────────────────────────────────────────────┐
│                    ЗАПРАВОЧНЫЙ БЛОК                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              УБОРЩИК ПОМЕЩЕНИЙ (СЛУЖЕБНЫХ)                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              УБОРЩИК ТЕРРИТОРИИ                                 │
└─────────────────────────────────────────────────────────────────┘

Примечания:
Опоздания, невыход на работу (больничный лист, повестка и т.д.)
[5 строк] ______________________________________________________

Должность и Ф.И.О. лица, внесшего данные
_________________________           Роспись _______________

Врач СМП(Зав. п\с № 11)             Юдаков Е.Ю.
Фельдшер(Старший) п\с № 11          Лазарь Д.Г.

Внимание!
1) Приступая к работе, включить радиостанцию...
2) При обнаружении очереди...
3) О любом изменении...
```

### 3.4 Функционал редактирования

- [ ] **Inline редактирование**
  - [ ] Клик на ячейку → contenteditable / input
  - [ ] Сохранение по blur / Enter
  - [ ] Отмена по Escape

- [ ] **Drag&drop swap**
  - [ ] Drag start на ячейке
  - [ ] Drop на целевой ячейке
  - [ ] Обмен значениями (swap)
  - [ ] Визуальная обратная связь (подсветка)

- [ ] **Undo**
  - [ ] История изменений (stack)
  - [ ] Ctrl+Z / кнопка "Отменить"
  - [ ] Сброс при закрытии наряда

### 3.5 Сохранение/восстановление

- [ ] Автосохранение при изменении
- [ ] Кнопка "Сохранить"
- [ ] Индикация последнего сохранения
- [ ] Восстановление при выборе даты

---

## Этап 4: Страница "Настройки" (`/settings`)

### 4.1 Компоненты

```
src/pages/SettingsPage/
├── SettingsPage.tsx
├── StationSettings.tsx        # № подстанции
├── DoctorSettings.tsx         # Врач СМП
├── NurseSettings.tsx          # Фельдшер
└── ManagersSettings.tsx       # Руководители
```

### 4.2 Функционал

- [ ] Форма настроек подстанции
- [ ] ФИО и подписи врача/фельдшера
- [ ] Список руководителей
- [ ] Сохранение в IndexedDB
- [ ] Загрузка из IndexedDB при открытии

---

## Этап 5: Экспорт в XLSX

### 5.1 Компоненты

```
src/services/
└── rosterExporter.ts          # Генерация XLSX
```

### 5.2 Функция экспорта

```typescript
// services/rosterExporter.ts

import * as XLSX from 'xlsx';

function exportRosterToXlsx(roster: Roster): Blob {
  const workbook = XLSX.utils.book_new();

  // Страница 1: Выездные бригады
  const sheet1 = createBrigadesSheet(roster);
  XLSX.utils.book_append_sheet(workbook, sheet1, 'Выездные бригады');

  // Страница 2: Вспомогательные службы
  const sheet2 = createSupportSheet(roster);
  XLSX.utils.book_append_sheet(workbook, sheet2, 'Вспомогательные службы');

  // Генерация Blob
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}

function createBrigadesSheet(roster: Roster): XLSX.WorkSheet {
  // Создать worksheet
  // Добавить заголовок "Наряд" + дата
  // Добавить таблицу бригад
  // Настроить:
  //   - merges (заголовки секций)
  //   - ширины колонок
  //   - высоты строк
  //   - границы
  //   - выравнивание
  //   - шрифт
}

function createSupportSheet(roster: Roster): XLSX.WorkSheet {
  // Создать worksheet
  // Добавить секции: Диспетчерская, Заправочный блок, Уборщики
  // Добавить примечания
  // Добавить подписи
  // Добавить блок "Внимание!"
}
```

### 5.3 Стили XLSX

```typescript
// Стили для ячеек (SheetJS не поддерживает стили напрямую)
// Используем xlsx-styled или создаём через XML

const styles = {
  header: {
    font: { name: 'Calibri', sz: 12, bold: true },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    }
  },
  cell: {
    font: { name: 'Calibri', sz: 10 },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: { /* ... */ }
  },
  signature: {
    font: { name: 'Calibri', sz: 10 },
    alignment: { horizontal: 'right' }
  }
};
```

### 5.4 Требования к выходному файлу

- [ ] **Полное соответствие** примеру PDF:
  - [ ] Та же структура таблиц
  - [ ] Те же заголовки
  - [ ] Те же ширины/высоты
  - [ ] Те же объединённые ячейки
  - [ ] Те же шрифты и стили
  - [ ] 2 страницы (или 2 листа)

---

## Этап 6: Страницы "Главная", "Помощь", "О нас"

### 6.1 Главная (`/`)

```
src/pages/HomePage/
└── HomePage.tsx
```

- [ ] Приветствие
- [ ] Кнопка "Перейти к наряду" (CTA)
- [ ] Краткий статус (последний сохранённый наряд)

### 6.2 Помощь (`/help`)

```
src/pages/HelpPage/
└── HelpPage.tsx
```

- [ ] Как загрузить график
- [ ] Как сгенерировать наряд
- [ ] Как редактировать (inline, drag&drop)
- [ ] Как экспортировать в XLSX

### 6.3 О нас (`/about`)

```
src/pages/AboutPage/
└── AboutPage.tsx
```

- [ ] Информация о приложении
- [ ] Версия
- [ ] Контакты (если нужны)

---

## Этап 7: Навигация и роутинг

### 7.1 Верхнее меню

```
src/components/Navigation/
└── NavBar.tsx
```

- [ ] Ссылки: Главная, Наряд, График, Настройки, Помощь, О нас
- [ ] Подсветка активной страницы
- [ ] Адаптивность (бургер для мобильных)

### 7.2 Роутинг

```typescript
// App.tsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/roster" element={<RosterPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Этап 8: Тестирование и полировка

### 8.1 Тестирование

- [ ] Ручное тестирование всех страниц
- [ ] Тестирование импорта графика
- [ ] Тестирование генерации наряда
- [ ] Тестирование редактирования
- [ ] Тестирование экспорта XLSX
- [ ] Сравнение выходного XLSX с примером PDF

### 8.2 Полировка

- [ ] Улучшение UI (отступы, цвета, шрифты)
- [ ] Анимации (переходы, hover)
- [ ] Обработка ошибок (toast уведомления)
- [ ] Лоадеры при загрузке данных
- [ ] Подтверждения перед удалением

---

## Сводный чек-лист задач

### Приоритет 1 (ядро MVP)

- [ ] Настроить IndexedDB (settings, schedules, rosters)
- [ ] Страница "График": импорт XLSX → JSON
- [ ] Страница "Наряд": генерация из графика + настроек
- [ ] Страница "Наряд": UI таблица (по образцу PDF)
- [ ] Страница "Наряд": inline редактирование
- [ ] Страница "Наряд": drag&drop swap
- [ ] Страница "Наряд": сохранение в IndexedDB
- [ ] Экспорт XLSX (полное соответствие PDF)

### Приоритет 2 (навигация и вспомогательные страницы)

- [ ] Верхнее меню (NavBar)
- [ ] Страница "Настройки"
- [ ] Страница "Главная"
- [ ] Страница "Помощь"
- [ ] Страница "О нас"
- [ ] Роутинг (React Router)

### Приоритет 3 (улучшения)

- [ ] Undo изменений
- [ ] Автосохранение наряда
- [ ] Валидация импорта графика
- [ ] Предупреждения при нехватке сотрудников
- [ ] Лоадеры и обработка ошибок
- [ ] Базовая адаптивность (mobile-friendly)

---

## Зависимости (package.json)

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "react-router-dom": "^6.x",
    "xlsx": "^0.18.x",
    "idb": "^7.x",
    "@dnd-kit/core": "^6.x",
    "@dnd-kit/sortable": "^7.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vite": "^5.x",
    "@types/react": "^18.x",
    "@types/react-dom": "^18.x"
  }
}
```

---

## Структура проекта

```
src/
├── App.tsx
├── main.tsx
├── components/
│   ├── Navigation/
│   │   └── NavBar.tsx
│   └── UI/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Modal.tsx
├── pages/
│   ├── HomePage/
│   ├── RosterPage/
│   │   ├── RosterPage.tsx
│   │   ├── RosterHeader.tsx
│   │   ├── RosterBrigades.tsx
│   │   ├── RosterSupport.tsx
│   │   ├── RosterNotes.tsx
│   │   ├── RosterCell.tsx
│   │   └── RosterActions.tsx
│   ├── SchedulePage/
│   │   ├── SchedulePage.tsx
│   │   ├── ScheduleImport.tsx
│   │   └── ScheduleViewer.tsx
│   ├── SettingsPage/
│   │   └── SettingsPage.tsx
│   ├── HelpPage/
│   │   └── HelpPage.tsx
│   └── AboutPage/
│       └── AboutPage.tsx
├── services/
│   ├── db.ts
│   ├── rosterGenerator.ts
│   └── rosterExporter.ts
├── types/
│   ├── roster.ts
│   ├── schedule.ts
│   └── settings.ts
└── utils/
    ├── date.ts
    └── parsers.ts
```
