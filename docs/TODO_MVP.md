# План доработки (на основе анализа PDF)

## Приоритет 1: Ядро наряда (критично для MVP)

### 1.1 Обновить типы данных

**Файл:** `src/features/roster/generator/types.ts`

Нужно привести к структуре из `docs/ROSTER_STRUCTURE.md`:

```typescript
// Сотрудник с префиксом
export type RosterEmployee = {
  fullName: string      // "Рыжакова А.А."
  prefix?: string       // "С", "Д", "Н"
}

// Выездная бригада
export type BrigadeRow = {
  type: 'БИТ' | 'Пед' | 'Лин' | 'Перев'
  number: string        // "1110", "1150"
  shiftDay: string      // "8\20"
  shiftNight: string    // "20\8"
  employeesDay: RosterEmployee[]
  employeesNight: RosterEmployee[]
}

// Вспомогательная служба
export type SupportService = {
  name: 'ДИСПЕТЧЕРСКАЯ' | 'ЗАПРАВОЧНЫЙ БЛОК' | 'УБОРЩИК ПОМЕЩЕНИЙ' | 'УБОРЩИК ТЕРРИТОРИИ'
  positions: SupportPosition[]
}

export type SupportPosition = {
  shiftDay: string
  shiftNight: string
  employeeDay?: RosterEmployee
  employeeNight?: RosterEmployee
}

// Наряд
export type RosterData = {
  date: string          // "ДД.ММ.ГГГГ"
  scheduleMonthKey: string
  brigades: BrigadeRow[]
  supportServices: SupportService[]
  notes: string[]       // 5 строк примечаний
  doctorName: string
  doctorSignature: string
  nurseName: string
  nurseSignature: string
}
```

### 1.2 Обновить генератор наряда

**Файл:** `src/features/roster/generator/generateRoster.ts`

- [ ] Генерация выездных бригад (БИТ, Пед, Лин, Перев)
- [ ] Генерация вспомогательных служб из графика
- [ ] Разделение на день/ночь по сменам (8\20, 20\8, etc.)
- [ ] Подстановка подписей из настроек

### 1.3 Обновить UI страницы "Наряд"

**Файл:** `src/pages/RosterPage.tsx`

Нужно переделать полностью по образцу PDF:

```tsx
<Card title="Наряд">
  {/* Заголовок + дата */}
  <RosterHeader date={selectedDate} />

  {/* Страница 1: Выездные бригады */}
  <RosterBrigadesTable
    brigades={rosterData.brigades}
    onCellEdit={handleCellEdit}
    onSwap={handleSwap}
  />

  {/* Страница 2: Вспомогательные службы */}
  <RosterSupportTable
    services={rosterData.supportServices}
    onCellEdit={handleCellEdit}
  />

  {/* Примечания + подписи */}
  <RosterNotes
    notes={rosterData.notes}
    doctorName={rosterData.doctorName}
    nurseName={rosterData.nurseName}
  />

  {/* Блок "Внимание!" */}
  <RosterAttention />

  {/* Кнопки действий */}
  <RosterActions
    onGenerate={handleGenerate}
    onSave={handleSave}
    onExport={handleExport}
  />
</Card>
```

### 1.4 Обновить экспорт XLSX

**Файл:** `src/features/roster/export/exportRosterToXlsx.ts`

Нужно полное соответствие PDF:

- [ ] **Страница 1**: Выездные бригады (таблица 7-8 колонок)
- [ ] **Страница 2**: Вспомогательные службы (4 секции)
- [ ] **Стили**:
  - Шрифт Calibri/Arial 10-12pt
  - Границы тонкие чёрные
  - Выравнивание: лево/центр
  - Merges для заголовков секций
  - Ширины колонок как в примере
- [ ] **Примечания**: 5 пустых строк
- [ ] **Подписи**: Врач СМП, Фельдшер
- [ ] **Блок "Внимание!"**: 3 пункта

---

## Приоритет 2: Редактирование

### 2.1 Inline редактирование

**Компонент:** `src/pages/RosterPage/RosterCell.tsx`

```tsx
export function RosterCell({ value, onChange, mode = 'text' }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialValue)

  // По клику → input
  // По blur/Enter → сохранить
  // По Escape → отмена
}
```

### 2.2 Drag&drop swap

**Файл:** `src/pages/RosterPage/RosterDragDrop.tsx`

Использовать `@dnd-kit/core`:

```tsx
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core'

// При drop → обмен значениями между ячейками
```

### 2.3 Undo

**Хук:** `src/hooks/useRosterHistory.ts`

```tsx
function useRosterHistory(initialState) {
  const [history, setHistory] = useState([])
  const [current, setCurrent] = useState(initialState)

  const undo = () => { /* pop from history */ }
  const commit = (newState) => { /* push to history */ }

  return { current, undo, commit }
}
```

---

## Приоритет 3: Страница "Настройки"

**Файл:** `src/pages/SettingsPage.tsx`

Нужна форма с полями:

- [ ] № подстанции
- [ ] Врач СМП (ФИО + подпись)
- [ ] Фельдшер (ФИО + подпись)
- [ ] Руководители (список)

---

## Приоритет 4: Полировка

- [ ] Лоадеры при загрузке/генерации
- [ ] Toast уведомления (сохранено, экспортировано)
- [ ] Предупреждения при нехватке сотрудников
- [ ] Автосохранение при изменении
- [ ] Базовая адаптивность (mobile)

---

## Чек-лист готовности MVP

### Данные
- [ ] Типы данных обновлены (ROSTER_STRUCTURE.md)
- [ ] IndexedDB операции для нарядов
- [ ] Загрузка настроек

### График
- [ ] Импорт XLSX работает
- [ ] Валидация показывает ошибки
- [ ] Сохранение в IndexedDB

### Наряд
- [ ] Генерация из графика + настроек
- [ ] UI таблица (по образцу PDF)
- [ ] Inline редактирование
- [ ] Drag&drop swap
- [ ] Undo
- [ ] Сохранение в IndexedDB

### Экспорт
- [ ] XLSX страница 1 (выездные бригады)
- [ ] XLSX страница 2 (вспомогательные службы)
- [ ] Стили (границы, шрифты, merges)
- [ ] Полное соответствие PDF

### Навигация
- [ ] Верхнее меню
- [ ] Все 6 страниц работают
- [ ] Роутинг настроен

---

## Следующие шаги

1. **Обновить типы** (`src/features/roster/generator/types.ts`)
2. **Переписать генератор** (`generateRoster.ts`)
3. **Переделать UI наряда** (`RosterPage.tsx`)
4. **Обновить экспорт XLSX** (`exportRosterToXlsx.ts`)
5. **Добавить редактирование** (inline + drag&drop)
6. **Доработать настройки**
