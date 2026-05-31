# 03. Replacer Pattern Diff

## Goal

Собирать per-watcher pattern-domain diff из данных реплейсера и выводить отдельным блоком,
чтобы было видно, какие паттерновые домены добавлены/удалены — независимо от того, изменился
`last_known_mirror` или нет.

## Источник данных

`ReplacementPair[]` (уже есть в параметрах `applyReplacements()`).
Новых persistent полей не требуется — вся информация уже есть в реплейсере
в момент вызова.

## Логика diff — не инкрементальная, а пост-вычислительная

**Diff НЕ нужно собирать построчно при обработке файлов.**
Вместо этого вычислить его после всех замен из `ReplacementPair[]` +
внутренних структур (`additionalDomainsMap`, `seenPrimary`):

```
Для каждого siteName:
  oldHosts = все r.oldHost для этого siteName
  newHosts = все r.newHost для этого siteName (primary + additional)
  added   = newHosts - oldHosts
  removed = oldHosts - newHosts
```

Так проще, надёжнее и не требует состояния между файлами.

## Формат вывода (пример)

```
[betist] added:   betist221tv.live
         removed: betist219tv.live
         active:  betist220tv.live (+ 2 additional)
```

## Важно: diff per-watcher, не per-pattern

Если два разных watcher имеют одинаковый числовой паттерн (клоны, например
`dizipal*.com`(1000+) и `dizipal*.com`(2000+)), их diff не смешивается — каждый watcher
обрабатывается отдельно по `siteName`. Даже если `oldHost` совпадает, разные `siteName`
дают разные записи в `replacementPairs`, и diff корректно разделяется.

## Возвращаемый тип `applyReplacements()`

Текущий:
```typescript
{ filesScanned, filesModified, totalLineEdits, replacerSeconds }
```

Новый:
```typescript
{ filesScanned, filesModified, totalLineEdits, replacerSeconds, patternDiffs }
```

Где `patternDiffs: Array<{
  siteName: string;
  added: string[];
  removed: string[];
  active: string;          // canonical last_known_mirror
  additionalCount: number;
}>`.

**Не нужно выделять отдельный интерфейс `ReplacerStats`** — достаточно добавить поле
в возвращаемый объект. Экономит: тип, импорт, правки в тестах.

## Подзадачи

- [x] В `applyReplacements()`, после цикла по файлам, вычислить `patternDiffs`
      из `ReplacementPair[]` + `seenPrimary` + `additionalDomainsMap`
- [x] Добавить `patternDiffs` в возвращаемый объект
- [x] В `src/index.ts`, после `applyReplacements()`, вывести `Pattern domains list updates`
      из `patternDiffs` (если не пусто)
- [x] Проверить корректность для force_search_ahead (много additional → diff не путается)
      (additionalDomainsMap уже агрегирует per-watcher, `seenPrimary` first-wins)
- [x] Проверить корректность для одинаковых паттернов у разных watcher (клоны)
      (`additionalDomainsMap` ключится по normalizeDomain(primaryNewHost),
       разные primary → разные записи diff)

## Где смотреть

- `src/replacer.ts` — `applyReplacements()`, вычисление `patternDiffs` после цикла файлов
- `src/index.ts` — приём `patternDiffs` из возврата, вывод секций

## Зависимости

Не зависит от 01 (не пользуется `isRealDomainChange()`).
Не зависит от 02 (только возвращает данные, формат вывода опционален).
**Может выполняться параллельно с 01 и 02.**
