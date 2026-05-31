# TODO: Семантика watcher state

Source: `rdc_docs/specs.md`, section `Open Questions / TODO`, items 7-8.

## Проблема

Сейчас watcher state обновляется слишком шумно и не до конца согласован по смыслу:

- `last_seen` по факту ведет себя как "последний успешный запуск", а целевая семантика ближе к `success_since`;
- `failed_since`, `failed_days`, `potentially_dead` могут переписываться даже без реального изменения состояния;
- при повторных identical runs теряется понятность, было ли настоящее изменение домена/статуса или просто очередной
  запуск.

## Цель

Сделать watcher state детерминированным и малошумным:

- не переписывать state-поля без реального изменения статуса;
- не обновлять day-based счетчики без смены day bucket;
- явно разделить "текущее успешное состояние длится с ..." и "последний раз успешно проверили в ...";
- согласовать документацию, типы и runtime behavior.

## Основные задачи

### 1. Подавление state churn

- [x] Не переписывать `failed_since`, если сайт уже находится в той же failure-серии
- [x] Не обновлять `failed_days`, если day bucket не изменился (DONE 2026-05-24:
  main-failure branch теперь считает `calculateDaysSince()` и перезаписывает `failed_days`
  только если полученное integer-значение отличается от текущего;
  pattern-change alert branch сохраняет существующий `failed_since` и также применяет
  day-bucket suppression. Раньше `failed_since = nowFormatted` перезаписывал старое
  значение и терял момент первого сбоя — этот баг тоже исправлен.)
- [x] Не трогать `potentially_dead`, если его значение не изменилось (поле ставится единожды на сбой)
- [x] Не переписывать success-state поля при identical success без смены домена/статуса (через `updateSuccessSince`)

### 2. Пересмотр семантики `last_seen`

- [x] Зафиксировать целевую семантику: **rename `last_seen` → `success_since`** (статус 2026-05-24)
- [x] If a rename is chosen: обновить `src/types.ts`, `src/index.ts`, `README.md`, `specs.md`, тесты,
  и формат `watchers.yml`
- [x] (n/a — rename выбран) явно документировать текущее поведение

### 3. Миграция и совместимость

- [x] Обратная совместимость для старого поля `last_seen` — **да, через loadWatchers()**
- [x] Описать migration path при загрузке/сохранении watcher state (в `src/config.ts` + `src/types.ts`)
- [x] Добавить тесты на repeated identical runs и на смену success/failure state
  (backward-compat тесты в `__tests__/config.test.ts`)

## Где менять

- `src/index.ts`
- `src/types.ts`
- `src/config.ts` и YAML serialization path при необходимости
- `__tests__/index.test.ts`
- `__tests__/config.test.ts`
- `rdc_docs/specs.md`
- `README.md`

## Что не входит

- Нотификации / monitoring
- Heuristic improvements
- Discovery-entrypoint semantics

## Связанный трек

Этот TODO стоит выполнять вместе с `docs/TODO_watchers_comments.md`.

Причина:

- изменения state semantics почти неизбежно проходят через тот же serialization/update path для `watchers.yml`;
- если делать state churn fix отдельно от comment-preservation, можно сначала стабилизировать state fields, а потом
  повторно ломать/менять тот же save path;
- общий цикл позволяет сразу зафиксировать и semantic invariants, и требование не терять user-authored comments.

Минимальный состав совместного цикла:

- state update invariants в `src/index.ts`;
- comment-preserving save path в `src/config.ts`;
- узкие tests в `__tests__/index.test.ts` и `__tests__/config.test.ts`.

## Требования AGENTS.md (после завершения)

- [x] Задокументировать breaking changes (если есть) — поле last_seen в watchers.yml считается legacy,
  мигрируется автоматически при loadWatchers()
- [x] Проверить backward compatibility (особенно при rename `last_seen`) — да, через миграцию в config.ts
- [x] Обновить/добавить тесты в `__tests__/` для новой функциональности (config.test.ts + mass rename в
  batch/batch-history тестов)
- [x] Задокументировать breaking changes (если есть)
- [x] Обновить `README.md` или соответствующую спецификацию в `docs/`,
      если поведение изменилось (README.md пример + specs.md §8.4 / §3.2)
- [x] Запустить `yarn build` для проверки сборки (✅ 678 kB dist/index.js)
- [x] Запустить `yarn test` для проверки тестов (✅ 383 tests passed — +8 новых для
  calculateDaysSince и failed_days day-bucket)
- [x] Запустить `yarn lint` для проверки стиля кода (✅ 0 ошибок, 23 pre-existing warnings)

## Статус (2026-05-24)

**Rename + миграция + noise suppression + day-bucket optimization — завершены.**

Сделано:

- `src/types.ts`: поле `success_since` (основное) + deprecated `last_seen` (опциональное для миграции)
- `src/config.ts`:
  - `loadWatchers()` — миграция legacy `last_seen` → `success_since` при чтении;
  - `saveWatchers()` — никогда не пишет `last_seen` обратно
- `src/index.ts`:
  - helper `updateSuccessSince(site, newValue)` — обновляет только при фактическом изменении;
  - snapshot `hadFailureBeforeThisRun` per site — для определения transition failure → success;
  - все 4 присваивания переведены на `updateSuccessSince`:
    - **case 1** (heuristic non-pattern transition): всегда обновлять (state change);
    - **case 2** (antibot accepted): обновлять если `antibotActuallyChanged` ИЛИ был prior failure;
    - **case 3** (successful change): всегда обновлять (domain change);
    - **case 4** (success no change): обновлять ТОЛЬКО если был prior failure (exit from failure),
      иначе подавлять churn
- `src/batch.ts`: quick-start optimization переведён на `success_since`
- `watchers.yml`: 6 сайтов переведены с `last_seen: 2026-05-24` на `success_since: "2026-05-24 12:00"`
- `README.md`: пример `success_since: "2026-01-21 12:34"` + комментарий о новой семантике
- `docs/specs.md`: §3.2/§4.2 уточнённое описание, §8.4 explicit list state transitions, §8.4.1
  State Noise Suppression
- `__tests__/config.test.ts`: добавлены 3 теста — миграция legacy value, приоритет explicit success_since,
  saveWatchers never writes legacy field
- `__tests__/batch-history.test.ts` и `__tests__/batch.test.ts`: массовый rename fixtures
- `src/index.ts` (main-failure branch, ~строка 323): `failed_days` перезаписывается только
  если `calculateDaysSince(site.failed_since) !== site.failed_days` (day-bucket suppression)
- `src/index.ts` (pattern-change alert branch, ~строка 474): сохраняет оригинальный `failed_since`
  (исправлен баг с потерей момента первого сбоя) + тот же day-bucket suppression
- `calculateDaysSince()` exported + whitespace-only guard (`''` и `'   '` → 0 вместо NaN)
- `__tests__/index.test.ts`: +8 тестов (375 → 383), секции 11.4 (calculateDaysSince) и 11.5
  (failed_days day-bucket), все даты с Z-суффиксом UTC для CI-timezone portability
