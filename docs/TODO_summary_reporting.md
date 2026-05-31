# TODO: Согласовать summary / commit-message reporting с реальным изменением mirror

## Проблема

Сейчас разные части отчётности используют разные критерии "обновления домена":

- таблица `Redirected domains` честно показывает, что стартовый/redirect source домен ушёл на другой домен;
- блок `Updated domains` в commit message иногда показывает те же сайты как "обновлённые", даже если целевой рабочий
  mirror относительно предыдущего `last_known_mirror` фактически не изменился.

Из-за этого в операторском сообщении появляются отвлекающие ложные обновления.

## Наблюдаемый пример

Из GitHub Actions:

```text
Redirected domains
Turkifsaclub (turkifsaclub*.sbs)  turkifsaclub124.sbs  -> turkifsaclub125.sbs
PapazSports (papazsports*.pro)    papazsports922.pro   -> papazsports1010.pro
```

Ниже в commit message / summary:

```text
Updated domains:
Turkifsaclub (turkifsaclub*.sbs)       turkifsaclub124.sbs  → turkifsaclub125.sbs
HDFilmCehennemi (hdfilmcehennemi*.org) t.co                 → hdfilmcehennemi27.org
voe.sx                                 voe.sx               → ericeastweight.com
PapazSports (papazsports*.pro)         papazsports922.pro   → papazsports1010.pro
```

При этом `HDFilmCehennemi` и `PapazSports` не должны попадать в `Updated domains`, если итоговый рабочий mirror
относительно исходного `last_known_mirror` не изменился.

Отдельно нужно доисследовать Turkifsaclub-like case, где по логике runtime/reporting не детектится, что домен уже
присутствует среди найденных/рабочих доменов и потому не должен выглядеть как новое обновление.

Рабочая формулировка проблемы:

- если `newHost` или домен из diagnostic/reporting already-present среди canonical/collected working domains для этого
  watcher-а,
- summary не должен создавать впечатление, что найден "новый" mirror, если по факту это уже известный/учтённый домен.

Пример для отдельной проверки:

- GitHub Actions run `26191737421`, job `77061571109`
- `Turkifsaclub`: не было корректно отражено, что `turkifsaclub126.sbs` уже присутствует / уже учтён, из-за чего
  reporting получился шумным и двусмысленным.

## Предварительная гипотеза / локализованная причина

Сейчас критерии расходятся между слоями:

- в `src/index.ts` есть логика `hasUniqueDomainChanges`, которая уже умеет отличать реальное изменение mirror от
  простого resolution через entrypoint / redirect source;
- в `src/git.ts` блок `Updated domains` фильтрует записи по условию `startedHost || oldHost !== newHost`, то есть по
  факту сравнивает стартовый источник проверки с найденным доменом, а не найденный домен с исходным `last_known_mirror`
  до начала обработки.

Следствие:

- discovery-entrypoint кейсы (`t.co`, `voe.sx`, gateway domains);
- redirect-only кейсы;
- possible `force_search_ahead` / alias-collection side-effects

могут выглядеть как "обновление домена" в commit summary, хотя это не update replacement-target.

## Ожидаемое поведение

Нужно разделить две разные сущности и не смешивать их в одном сообщении:

1. `Redirected domains`
   - показывает, что стартовый/проверяемый домен редиректился на другой домен;
   - это диагностическая информация;
   - может включать discovery-entrypoint кейсы.

2. `Updated domains`
   - показывает только реальные изменения целевого mirror / replacement-target;
   - site должен попадать сюда только если итоговый `newHost` отличается от исходного `last_known_mirror`, который был
     до запуска.

Практическое правило:

- если изменился только `startedHost` / redirect source, но итоговый mirror остался прежним, site не должен попадать в
  `Updated domains`.

## Задачи

### 1. Унифицировать критерий "real update"

- [x] Вынести или переиспользовать единое условие реального обновления mirror
- [x] Использовать его одинаково в `src/index.ts`, `src/git.ts` и связанных summary paths
- [x] Убедиться, что критерий опирается на original `last_known_mirror`, а не только на `startedHost`

#### 🐛 Блокирующая проблема: `buildCommitMessage()` в `git.ts` не имеет доступа к `originalLastKnownMirrors`

**Почему это проблема:**
Сейчас `buildCommitMessage()` фильтрует по `startedHost !== newHost`:
```typescript
const uniqueChanges = [...primaryBySite.values()].filter(r => {
  const fromHost = r.startedHost || r.oldHost;
  return fromHost !== r.newHost;
});
```

Для `t.co → hdfilmcehennemi27.org`, где `originalLastKnownMirror` уже был
`hdfilmcehennemi27.org`, `startedHost = t.co !== hdfilmcehennemi27.org` = `true` →
сайт попадает в "Updated domains", хотя это не обновление mirror.

В `replacer.ts` и `hasUniqueDomainChanges` в `index.ts` эта же логика уже
исправлена (проверяет `originalMirrors`), но `git.ts` её не имеет.

**Варианты решения:**

**Вариант A:** Добавить поле `originalLastKnownMirror` в `ReplacementPair`, заполнять
его в `index.ts` при вызове `addReplacementEntries()`. Тогда `buildCommitMessage()`
сможет фильтровать, не требуя внешнего Map-а.

- Плюс: git.ts получает данные автономно, не требует изменения сигнатуры.
- Минус: данные дублируются в каждом replacement-объекте; нужно заполнять
  корректно во всех местах вызова `addReplacementEntries()`.

**Вариант B:** Передавать `originalLastKnownMirrors` как отдельный параметр в
`buildCommitMessage()` / `commitOrCreatePR()`.

- Плюс: единый источник правды, не дублируется.
- Минус: нужно менять сигнатуру методов `GitManager`.

**Вариант C:** Вынести функцию `isRealDomainChange(replacement, originalLastKnownMirrors)`
в `src/utils.ts` и переиспользовать её в:
- `src/index.ts` (заменить `hasUniqueDomainChanges`)
- `src/replacer.ts` (заменить фильтр в `Redirected domains` таблице)
- `src/git.ts` (заменить фильтр в `buildCommitMessage`)

- Плюс: единая реализация, тестируется один раз, все три слоя синхронизированы.
- Рекомендуется.

#### 💡 Улучшение: вынести `isRealDomainChange()` в shared utils

- [x] Создать функцию `isRealDomainChange(replacement, originalLastKnownMirrors): boolean`
      в `src/utils.ts`
- [x] Переиспользовать в `src/index.ts` (hasUniqueDomainChanges), `src/replacer.ts`
      (фильтр Redirected domains), `src/git.ts` (buildCommitMessage)
- [x] Добавить unit-тесты на неё в `__tests__/utils.test.ts`
- [x] Добавить integration-тесты в `__tests__/git.test.ts` (discovery entrypoint excluded,
      redirect-only excluded, real change included, no-map fallback)

### 2. Развести reporting semantics

- [x] Явно определить, чем отличаются секции вывода (см. § Целевой формат summary):
  - `Redirected domains` — диагностика, все redirect-цепочки
  - `🔄 Mirror updates` — только смена last_known_mirror
  - `📋 Pattern domains list updates` — added/removed паттерновых доменов
  - `🚩 Changed pattern → non-pattern domains` — переходы
- [x] Проверить, не попадают ли redirect-only / discovery-only кейсы в Mirror updates
- [x] Проверить, не попадают ли already-known / already-collected домены в Mirror updates как будто это новый mirror
- [x] При необходимости переименовать/уточнить подписи, чтобы оператору было понятно, что именно изменилось
- [x] Консольный счётчик: `├─ Updated sites` → `├─ 🔄 Mirror updates`
- [x] Добавлены счётчики: `📋 Pattern list updates`, `🚩 Pattern→non-pattern`
- [x] Секция `🚩 Changed pattern → non-pattern domains` в блоке warnings
- [x] Секция `📋 Pattern domains list updates` (вывод diff, когда `patternDiffs` не пуст)

#### 🐛 `Summary` type: решение — НЕ добавлять поля

**Решено:** не добавлять поля в `Summary` (согласно спецификации `02_summary_semantics.md`).
Причины:
- `mirrorUpdates` вычисляется на ходу из `isRealDomainChange(replacements, originalLastKnownMirrors)`
- `patternDiffs` живёт в возвращаемом типе `applyReplacements()`, не в Summary
- `nPatternToNonPattern` считается фильтрацией `summary.warnings`

- [x] Консольный вывод в `src/index.ts` обновлён — использует вычисляемые счётчики вместо единого `summary.updated`
- [x] Агрегация корректна — счётчики вычисляются на ходу, `summary.updated` сохранён для формулы валидации

### 3. Регрессионные тесты — выполнено (кроме task 04)

**Unit (isRealDomainChange, utils.test.ts):**
- [x] discovery-entrypoint + mirror unchanged → `false`
- [x] redirect-source changed + mirror unchanged → `false`
- [x] real mirror change → `true`
- [x] redirect-source changed + mirror changed → `true`
- [x] no-map fallback → legacy behaviour (entrypoint = change, same-host = no-change)

**Integration (buildCommitMessage, git.test.ts):**
- [x] discovery-entrypoint + mirror unchanged → **нет** в `🔄 Mirror updates`
- [x] redirect-only + mirror unchanged → **нет** в `🔄 Mirror updates`
- [x] real mirror change → **есть** в `🔄 Mirror updates`
- [x] no-map fallback → legacy behaviour

**Остальные тесты (из `04_regression_tests.md`):**
- [ ] force_search_ahead: last_known_mirror жив + найдены новые → `📋 Pattern domains list updates`
- [ ] pattern→non-pattern → `🚩 Changed pattern → non-pattern domains`
- [ ] non-pattern→pattern (эвристика) → `🔄 Mirror updates` + `📋 Pattern domains list updates`
- [ ] clone watchers с одинаковым паттерном → diff раздельный

### 4. Вывод diff-а по паттерновым доменам (из данных реплейсера)

Вместо смешивания всего в `Updated domains`, добавить отдельный блок в лог/summary
с diff-ом по каждому watcher: какие паттерновые домены добавлены и удалены.

**Источник данных:** `ReplacementPair[]` + `additionalWorkingDomains`.
Новых persistent полей не требуется — вся информация уже есть в реплейсере.

**Логика diff:**
```
Для каждого replacement:
  added   = [newHost] + additionalWorkingDomains - [oldHost]
  removed = [oldHost] - [newHost] - additionalWorkingDomains
```

**Формат вывода (пример):**
```
[betist] added:   betist221tv.live
         removed: betist219tv.live
         active:  betist220tv.live (+ 2 additional)
```

**Важно: diff считается per-watcher (по siteName), а не per-pattern.**
Если два разных watcher имеют одинаковый числовой паттерн (клоны, например
`dizipal*.com`(1000+) и `dizipal*.com`(2000+)), их diff не смешивается — каждый watcher
обрабатывается отдельно. Даже если oldHost совпадает, разные siteName дают
разные записи в `replacementPairs`, и diff корректно разделяется.

**Задачи:**
- [ ] Собирать diff в `src/replacer.ts` после обработки замен

      **TODO:** Нужно определиться с API сбора diff.
      Текущий возвращаемый тип `applyReplacements()`:
      ```typescript
      { filesScanned, filesModified, totalLineEdits, replacerSeconds }
      ```
      Новый возвращаемый тип (предлагается):
      ```typescript
      interface ReplacerStats {
        filesScanned: number;
        filesModified: number;
        totalLineEdits: number;
        replacerSeconds: string;
        /** Per-watcher pattern diff collected during replacement */
        patternDiffs: Array<{
          siteName: string;
          added: string[];
          removed: string[];
          active: string;        // canonical last_known_mirror после замен
          additionalCount: number; // сколько additionalWorkingDomains активно
        }>;
      }
      ```
      `patternDiffs` собирается внутри `applyReplacements()` инкрементально:
      при обработке каждого файла/каждой линии с заменой, накапливается,
      какие oldHost были заменены на newHost, и какие дополнительно
      добавлены/удалены. После завершения — возвращается в `main()`.

- [ ] Выводить блоки в summary/log:
  - `🔄 Mirror updates` — смена last_known_mirror
  - `📋 Pattern domains list updates` — added/removed по паттерновым доменам
  - `🚩 Changed pattern → non-pattern domains` — переходы
- [ ] Убедиться, что Mirror updates считает только `newHost !== оригинальный last_known_mirror`
- [ ] Переименовать счётчики в console summary:
  - `Updated sites` → `Mirror updates`
  - Добавить `Pattern domains list updates`
  - Добавить `Changed pattern → non-pattern domains`
- [ ] Проверить корректность для force_search_ahead (много additional → diff не путается)
- [ ] Проверить корректность для одинаковых паттернов у разных watcher (клоны)
- [ ] Добавить тесты:
  - [ ] force_search_ahead: last_known_mirror жив + найдены новые → Pattern domains list updates
  - [ ] два watcher с одинаковым паттерном → diff раздельный
  - [ ] oldHost совпадает у двух watcher → diff раздельный
  - [ ] pattern→non-pattern → Changed pattern → non-pattern domains
  - [ ] non-pattern→pattern → Mirror updates + Pattern domains list updates

### 5. Дополнительные технические задачи (найдены при code review)

#### 🔧 Console summary в `src/index.ts`: переименовать счётчики

Сейчас вывод выглядит так:
```
  ├─ Updated sites: ${summary.updated}
```

Должно быть:
```
  ├─ 🔄 Mirror updates: ${summary.mirrorUpdates}
  ├─ 📋 Pattern list updates: ${summary.patternDomainsUpdated}
  ├─ 🚩 Pattern→non-pattern: ${summary.patternToNonPatternCount}
```

- [ ] Заменить `Updated sites` на `🔄 Mirror updates`
- [ ] Добавить строку `📋 Pattern list updates`
- [ ] Добавить строку `🚩 Pattern→non-pattern`
- [ ] Убедиться, что `summary.unchanged` не считает watcher-ы, которые попали
      в pattern-to-nonpattern или pattern-list-updates (чтобы не было двойного
      учёта)

#### 🔧 `isRealDomainChange()` — expected signature

```typescript
/**
 * Проверяет, является ли замена реальным обновлением mirror.
 * @param replacement — объект ReplacementPair
 * @param originalLastKnownMirrors — Map<siteName, original last_known_mirror>
 * @returns true если это реальное обновление (newHost !== original last_known_mirror)
 */
export function isRealDomainChange(
  replacement: ReplacementPair,
  originalLastKnownMirrors?: Map<string, string>,
): boolean {
  // Если есть originalLastKnownMirrors, сравниваем newHost с оригинальным mirror
  // Если originalLastKnownMirrors нет или siteName не найден — fallback на fromHost !== newHost
}
```

#### ⚠️ Замечание: Redirected domains таблица уже существует

В `src/replacer.ts`, метод `applyReplacements()`, строки ~250-280 уже формируют
таблицу `Redirected domains` с фильтрацией через `originalMirrors`. Это **НЕ**
нужно реализовывать с нуля. При реализации задач по TODO нужно:

1. Убедиться, что эта таблица использует единую функцию `isRealDomainChange()`
2. Синхронизировать её с форматом из "Целевой формат summary" (возможно,
   добавить колонку Time или изменить заголовки)
3. Убедиться, что она корректно фильтрует discovery-entrypoint кейсы

#### ⚠️ Замечание: `buildCommitMessage` не получает `originalLastKnownMirrors`

См. блокирующую проблему в разделе 1. Это главный источник расхождения между
console summary и commit message. **Исправить в первую очередь** — без этого
остальная работа по разведению semantics не имеет смысла для commit message.

## Целевой формат summary

### Redirected domains

Показывает redirect-цепочку для всех сайтов, где стартовый домен не совпал с финальным.
**Без фильтрации** — диагностическая информация.

```
Redirected domains
Site                     From                          To                              Time
───────────────────────────────────────────────────────────────────────────────────────────────
HDFilmCehennemi          t.co                          hdfilmcehennemi27.org             1.23s
Turkifsaclub             turkifsaclub124.sbs            turkifsaclub125.sbs              2.34s
PapazSports              papazsports922.pro             papazsports1010.pro              1.11s
voe.sx                   voe.sx                        rebeccacostthousand.com           3.45s
newsite                  newsite.com                    10news.com                       2.00s     ← pattern найден
```

Сюда попадают все сайты, где `startedHost !== newHost`. Включая discovery-entrypoint, redirect-only,
pattern→non-pattern переходы. Это raw diagnostic.

### Updated domains

Только реальные смены целевого mirror: `newHost !== original(сохранённый до старта) last_known_mirror`.

```
Updated domains
Site                     From (last_known)              To                                Time
───────────────────────────────────────────────────────────────────────────────────────────────
Turkifsaclub             turkifsaclub124.sbs            turkifsaclub125.sbs              2.34s      ← pattern mirror сменился
newsite                  newsite.com                    10news.com                       2.00s      ← non-pattern→pattern
randomsite               randomsite.com                 mirror002.com                    1.50s      ← non-pattern сменился
```

**Не попадают:**
- HDFilmCehennemi — `last_known_mirror` (= hdfilmcehennemi27.org) **не изменился**, только redirect source
- voe.sx — `last_known_mirror` (= rebeccacostthousand.com) **не изменился**, обновлён в прошлом run
- PapazSports — `last_known_mirror` (= papazsports1010.pro) **не изменился**, redirect-only

### Pattern domains diff

Дополнительный блок для каждого watcher, где **изменился набор паттерновых доменов**
в фильтрах. Показывает diff независимо от того, изменился `last_known_mirror` или нет.

#### Сценарии (перечень всех возможных)

```
# 1. Non-pattern — updated (last_known_mirror сменился на другой non-pattern или pattern)
#    → Updated domains + Redirected domains
[HDFilmCehennemi] Updated (mirror): t.co → hdfilmcehennemi28.org
[HDFilmCehennemi] Non-pattern domain, no pattern diff

# 2. Non-pattern — not updated (last_known_mirror не изменился)
#    → Redirected domains только если был redirect
[HDFilmCehennemi] No change (mirror: hdfilmcehennemi27.org, unchanged)

# 3. Pattern — updated (last_known_mirror сменился на другой номер)
#    → Updated domains + Redirected domains + Pattern diff
[Turkifsaclub] Updated (mirror): turkifsaclub124.sbs → turkifsaclub125.sbs
[Turkifsaclub] Pattern domains diff:
               added:   [turkifsaclub125.sbs]
               removed: [turkifsaclub124.sbs]
               active:  turkifsaclub125.sbs

# 4. Pattern — not updated (ничего не изменилось, force_search_ahead нет)
#    → Nothing (даже не показывать в summary)
[betist] No changes (mirror: betist220tv.live, all candidates checked)

# 5. Pattern — updated + force_search_ahead/cleanup
#    (last_known_mirror сменился, дополнительно найдены/удалены паттерновые домены)
#    → Updated domains + Redirected domains + Pattern diff (содержит все изменения)
[sahbet] Updated (mirror): sahatv5.top → sahatv6.top
[sahbet] Pattern domains diff:
         added:   [sahatv6.top, sahatv7.top, sahatv8.top]
         removed: [sahatv4.top]
         active:  sahatv6.top (+ 2 additional)

# 6. Pattern — not updated, но изменились force_search_ahead/cleanup
#    (last_known_mirror не сменился, но найдены/удалены дополнительные домены)
#    → Redirected domains + Pattern domains list updates (без Mirror updates)
[betist] Pattern domains list update:
         added:   [betist222tv.live]
         removed: [betist218tv.live]
         active:  betist220tv.live (+ 1 additional)

# 7. Pattern → Non-pattern (last_known_mirror ушёл на non-pattern)
#    → Redirected domains (но не Mirror updates — не меняем фильтры)
#    → Changed pattern → non-pattern domains
[betist] Changed pattern → non-pattern domain
         old (pattern): betist220tv.live
         new (non-pattern): betist-nonpattern.xyz
         History saved: [betist220tv.live]

# 8. Non-pattern→Pattern (эвристика по heuristic_history нашла новый pattern)
#    → Updated domains + Redirected domains + Pattern diff
[oldwatcher] Updated (mirror): site-nonpattern.com → site001.com
[oldwatcher] Pattern domains diff:
             added:   [site001.com, site002.com]
             active:  site001.com (+ 1 additional)

# 9. Site failed (не найден рабочий домен)
#    → Error/warning в summary, не попадает ни в Updated ни в Redirected
[deadwatcher] FAILED: no working domain found (checked candidates 001..010)
```

### Сводная таблица: что куда попадает

| # | Сценарий | Redirected | Mirror updates | Pattern domains list updates | Changed → non-pattern |
|---|----------|------------|----------------|-----------------------------|----------------------|
| 1 | Non-pattern updated | ✅ | ✅ | — | — |
| 2 | Non-pattern not updated | если redirect | — | — | — |
| 3 | Pattern updated | ✅ | ✅ | ✅ | — |
| 4 | Pattern not updated, ничего | — | — | — | — |
| 5 | Pattern updated + force/cleanup | ✅ | ✅ | ✅ | — |
| 6 | Pattern not updated + force/cleanup | если redirect | — | ✅ | — |
| 7 | Pattern→Non-pattern | ✅ | — | — | ✅ |
| 8 | Non-pattern→Pattern (эвристика) | ✅ | ✅ | ✅ | — |
| 9 | Failed | — | — | — | — |

## Где смотреть

- `src/index.ts` — console summary (названия секций, hasUniqueDomainChanges, агрегация)
- `src/git.ts` — `buildCommitMessage()` (commit message formatting, фильтр Updated domains)
- `src/replacer.ts` — `applyReplacements()` (Redirected domains таблица + сбор diff-а)

  **Важно:** Redirected domains таблица УЖЕ существует в `replacer.ts` (строка ~268)
  и уже использует `originalMirrors` для фильтрации. Не нужно создавать её заново.
  Нужно только переименовать секцию, если её название меняется, и адаптировать
  под новый формат вывода.
- `src/types.ts` — Summary interface (новые поля), ReplacementPair (возможно,
  добавить originalLastKnownMirror)
- `src/utils.ts` — новая shared функция `isRealDomainChange()`
- `__tests__/index.test.ts`
- `__tests__/git.test.ts`
- `__tests__/utils.test.ts` — новые тесты на `isRealDomainChange()`
- `__tests__/replacer.test.ts` — тесты на Redirected domains таблицу и сбор diff
- `docs/specs.md`
- `README.md` если пользовательское описание summary/commit message нужно уточнить

## Комментарий по scope

Это не блокирующий runtime bug в поиске доменов, а reporting bug. Но он создаёт шум и мешает быстро читать результаты
прогона, поэтому его полезно держать как узкий follow-up после state semantics.

## Требования AGENTS.md (после завершения)

- [ ] Обновить/добавить тесты в `__tests__/` для новой функциональности
- [ ] Задокументировать breaking changes (если есть)
- [ ] Проверить backward compatibility
- [ ] Обновить `README.md` или соответствующую спецификацию в `docs/`,
      если поведение изменилось
- [ ] Запустить `yarn build` для проверки сборки
- [ ] Запустить `yarn test` для проверки тестов
- [ ] Запустить `yarn lint` для проверки стиля кода
