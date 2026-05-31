# Shared Utilities: Refactor Duplicated Functions into `src/utils.ts`

Проблема: две функции продублированы в разных файлах проекта.

## `naturalCompare(a, b)`

**Сейчас:**

- `src/batch.ts:7` — локальная функция, используется внутри класса
  `BatchProcessor`
- `src/index.ts:21` — экспортированная функция (`export function`),
  используется для сортировки результатов

Тело функции идентично (natural sort с учётом числовых чанков).

**Что сделать:**

1. Создать `src/utils.ts` с экспортом:
   ```typescript
   export function naturalCompare(a: string, b: string): number {
     const re = /(\d+)|(\D+)/g;
     const chunksA = a.match(re) ?? [a];
     const chunksB = b.match(re) ?? [b];
     for (let i = 0; i < Math.max(chunksA.length, chunksB.length); i++) {
       const ca = chunksA[i] ?? '';
       const cb = chunksB[i] ?? '';
       const na = parseInt(ca, 10);
       const nb = parseInt(cb, 10);
       if (!isNaN(na) && !isNaN(nb)) {
         if (na !== nb) return na - nb;
       } else {
         if (ca < cb) return -1;
         if (ca > cb) return 1;
       }
     }
     return 0;
   }
   ```

2. В `src/batch.ts`:
   - Удалить локальную `function naturalCompare`
   - Добавить `import { naturalCompare } from './utils.js'`

3. В `src/index.ts`:
   - Удалить `export function naturalCompare` (строка 21)
   - Если `naturalCompare` используется в других файлах (импортируется из
     index.ts), заменить импорт на `src/utils.ts`

## `calculateDaysSince(dateStr)`

**Сейчас:**

- `src/batch.ts:146` — приватный метод класса `BatchProcessor`
- `src/index.ts:150` — локальная функция в main-модуле

Реализация идентична, но в `batch.ts` дополнительная проверка
`dateStr.trim() === ''`.

**Что сделать:**

1. В `src/utils.ts` добавить экспорт:
   ```typescript
   export function calculateDaysSince(dateStr: string): number {
     if (!dateStr || dateStr.trim() === '') return 0;
     try {
       const past = new Date(dateStr.replace(" ", "T"));
       const now = new Date();
       const diffTime = Math.abs(now.getTime() - past.getTime());
       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
       return diffDays;
     } catch {
       return 0;
     }
   }
   ```
   Использовать версию с `trim()` (более строгую).

2. В `src/batch.ts`:
   - Заменить приватный метод на вызов `this.calculateDaysSince` →
     прямой вызов импортированной функции
   - Удалить метод из класса

3. В `src/index.ts`:
   - Удалить локальную `function calculateDaysSince`
   - Добавить импорт

## После изменений

- `src/index.ts` должен остаться экспортировать `naturalCompare` (или
  реэкспортировать) — он используется в `selectFirstByOrder`, которая
  тоже экспортируется. Лучше импортировать из `utils.ts`, а из
  `index.ts` удалить экспорт.

## Тестирование

- Убедиться, что тесты, использующие `naturalCompare` или
  `calculateDaysSince` (если есть), продолжают работать.
- `yarn build` → `yarn test`.

## Приоритет

Низкий — код работает, дублирование не вызывает багов. Хорошая задача
для первого знакомства с проектом.

- [ ] Проверить backward compatibility (экспорт `naturalCompare` из `index.ts`)
- [ ] Обновить/добавить тесты в `__tests__/` для новой функциональности
- [ ] Задокументировать breaking changes (если есть)
- [ ] Обновить `README.md` или соответствующую спецификацию в `docs/`,
      если поведение изменилось
- [ ] Запустить `yarn build` для проверки сборки
- [ ] Запустить `yarn test` для проверки тестов
- [ ] Запустить `yarn lint` для проверки стиля кода
