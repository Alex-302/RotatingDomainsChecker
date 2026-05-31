# 02. Summary Semantics

## Goal

Развести reporting на отдельные смысловые секции, чтобы оператор видел не единую кучу "Updated domains",
а четыре разные категории с предсказуемыми критериями для каждой.

## Секции вывода

| Секция | Откуда берётся | Когда показывать |
|--------|---------------|------------------|
| `Redirected domains` | `replacer.ts` (уже есть) | всегда, если `startedHost !== newHost` |
| `🔄 Mirror updates` | из консольного вывода `index.ts` | при `newHost !== originalLastKnownMirror` |
| `📋 Pattern domains list updates` | из возврата `applyReplacements()` | при изменении набора (данные из `03_replacer_pattern_diff.md`) |
| `🚩 Changed pattern → non-pattern domains` | из возврата `applyReplacements()` | при `pattern_changed` без найденного pattern |

## Изменения

### Summary type (`src/types.ts`) — НЕ МЕНЯЕТСЯ

Новые поля `mirrorUpdates`, `patternDomainsUpdated`, `patternDiffs` **не добавлять** в `Summary`.
Причины:

- `mirrorUpdates` = количество `isRealDomainChange() === true` среди `summary.replacements`.
  Вычисляется на ходу при выводе.
- `patternDomainsUpdated` = количество `patternDiffs.length`. Приходит из возврата `applyReplacements()`.
- `patternDiffs` живёт в возвращаемом типе реплейсера, не в Summary.

Экономит: правку интерфейса, правку всех мест заполнения Summary, риск несинхронизации полей.

### Console summary (`src/index.ts`, ~строка 640)

Сейчас:
```
  ├─ Updated sites: ${summary.updated}
```

Должно быть:
```
  ├─ 🔄 Mirror updates: ${nMirrorUpdates}
  ├─ 📋 Pattern list updates: ${patternDiffs.length}
  ├─ 🚩 Pattern→non-pattern: ${nPatternToNonPattern}
```

Где:
- `nMirrorUpdates` = кол-во replacement-ов, где `isRealDomainChange()` = true
- `patternDiffs` = из возврата `applyReplacements()`
- `nPatternToNonPattern` = кол-во pattern-changed предупреждений (уже есть в `summary.warnings`)

### Redirected domains таблица (уже существует в `replacer.ts`, ~строки 250-280)

Таблица **уже** формируется в `applyReplacements()` с фильтрацией через `originalMirrors`.
Что нужно сделать:

1. [ ] Убедиться, что она использует единую `isRealDomainChange()` из шага 01
2. [ ] Синхронизировать заголовки с целевым форматом (колонки: Site, From, To, Time)
3. [ ] Убедиться, что discovery-entrypoint кейсы корректно фильтруются

### Когда что выводить

Самый простой порядок:

```
↓ index.ts выводит console summary (счётчики)
↓ replacer.ts выводит Redirected domains таблицу (диагностика, все redirect-цепочки)
↓ replacer.ts возвращает patternDiffs
↓ index.ts выводит Pattern domains list updates из patternDiffs (если не пусто)
↓ index.ts выводит Changed pattern→non-pattern из warnings (если есть)
↓ git.ts выводит commit message (Mirror updates только, без Redirected)
```

## ⚠️ Redirected domains таблица уже существует — не создавать заново

В `src/replacer.ts`, `applyReplacements()`, строки ~250-280 уже формируют таблицу
`Redirected domains` с фильтрацией через `originalMirrors`. Нужно только:

1. Переиспользовать `isRealDomainChange()` (шаг 01)
2. Привести заголовки к целевому формату
3. Проверить фильтрацию discovery-entrypoint

## Подзадачи

- [x] Переименовать `Updated sites` → `🔄 Mirror updates` в console summary
- [x] Добавить строку `📋 Pattern list updates: ${patternDiffs.length}`
- [x] Добавить строку `🚩 Pattern→non-pattern: ${nPatternToNonPattern}`
- [x] Убедиться, что `summary.unchanged` не дублирует счёт из других категорий
      (unchanged считает отдельно — успешные сайты без изменения last_known_mirror)
- [x] Синхронизировать заголовки `Redirected domains` таблицы в `replacer.ts`
      (уже были `["Site", "From", "To", "Time"]` — целевой формат)
- [x] Убедиться, что `buildCommitMessage()` в `git.ts` выводит только Mirror updates
      (уже использует `isRealDomainChange()` из шага 01)
- [x] Обновить `docs/specs.md`, если описание секций summary/commit message устарело
      (specs.md не содержит детальных описаний секций — не требует правок)
- [x] Проверить backward compatibility
      (`summary.updated` сохранён для формулы валидации, возвращаемый тип replacer'a расширен обратно-совместимо)

## 9 сценариев (справочно, из документации)

| # | Сценарий | Redirected | Mirror updates | Pattern list updates | Changed → non-pattern |
|---|----------|------------|----------------|---------------------|----------------------|
| 1 | Non-pattern updated | ✅ | ✅ | — | — |
| 2 | Non-pattern not updated | если redirect | — | — | — |
| 3 | Pattern updated | ✅ | ✅ | ✅ | — |
| 4 | Pattern not updated, ничего | — | — | — | — |
| 5 | Pattern updated + force/cleanup | ✅ | ✅ | ✅ | — |
| 6 | Pattern not updated + force/cleanup | если redirect | — | ✅ | — |
| 7 | Pattern→Non-pattern | ✅ | — | — | ✅ |
| 8 | Non-pattern→Pattern (эвристика) | ✅ | ✅ | ✅ | — |
| 9 | Failed | — | — | — | — |

## Зависимости

- **Основная часть (переименование, вывод)** — не зависит от 01.
- **Корректная фильтрация Mirror updates** — зависит от `isRealDomainChange()` из 01.
- **Pattern list updates и Pattern→non-pattern** — зависят от данных из 03.

Можно делать параллельно с 01 и 03, соберётся на этапе интеграции.

