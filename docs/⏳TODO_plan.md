# TODO Plan - Next Cycle

## Цель следующего цикла

Закрыть самый полезный и наименее шумный инженерный трек:

- привести watcher state к детерминированному поведению;
- уменьшить лишние diff в `watchers.yml`;
- синхронизировать runtime, типы и документацию вокруг `last_seen` / `success_since`;
- не расползтись в широкий рефакторинг эвристики.

Комментарий:
Этот цикл лучше держать узким. Основная ценность не в новой функциональности, а в том, чтобы сделать последующие
прогоны и изменения предсказуемыми.

## Что брать в работу

### 1. Основной трек: state semantics

Источник:

- `docs/TODO_state_semantics.md`
- связанные пункты из `docs/TODO_spec_alignment.md`

Что сделать:

- [x] Разобрать текущий runtime update path для watcher state в `src/index.ts`
  (изучено и зафиксировано в ходе работы над `✅TODO_state_semantics.md`, 2026-05-24)
- [x] Зафиксировать целевую семантику `last_seen`: переименовать в `success_since`
  (реализовано 2026-05-24, см. `docs/session_handoff_2026-05-24_TODO_spec_alignment.md`)
- [x] Подавить state churn (DONE 2026-05-24):
  - [x] не переписывать `failed_since` без новой failure-series
  - [x] не переписывать `failed_days`, если day bucket не изменился
  - [x] не трогать `potentially_dead`, если значение не изменилось
  - [x] не переписывать success-state поля при identical success без изменения домена/статуса
    (через helper `updateSuccessSince()`)
- [x] Обновить тесты на repeated identical runs, success -> failure, failure -> success
  (383 теста, +8 новых для `calculateDaysSince` и `failed_days` day-bucket)
- [x] Обновить docs/spec после фиксации поведения (§4.2, §8.4, §8.4.1 в `docs/specs.md`)

Комментарий:
Это лучший кандидат на следующий цикл, потому что он уменьшает шум в состоянии и убирает двусмысленность, от которой
потом страдают и фильтры, и git diff, и диагностика.

## Что включить в этот же цикл как связанный хвост

### 2. Spec alignment только в пределах state semantics

Источник:

- `docs/TODO_spec_alignment.md`

Что сделать:

- [x] Зафиксировать один формат поля времени: `YYYY-MM-DD HH:MM`
  (унифицировано 2026-05-24 — см. `✅TODO_spec_alignment.md`, задача 1)
- [x] Привести к нему `docs/specs.md`, `README.md`, комментарии в `src/types.ts` и runtime serialization
- [x] Проверить, нет ли устаревших упоминаний старой семантики в docs

Комментарий:
Этот кусок не стоит делать отдельно. Его нужно закрывать в том же PR/цикле, иначе снова останется рассинхрон между
кодом и спецификацией.

### 2.5. Watchers comments preservation в тот же цикл

Источник:

- `docs/TODO_watchers_comments.md`

Что сделать:

- [ ] Уточнить целевую гарантию по comments/layout в `watchers.yml`
- [ ] Усилить `__tests__/config.test.ts` на top-level, site-local и inline comments
- [ ] Не отделять правку `saveWatchers()` от state-semantics changes

Комментарий:
Этот кусок лучше закрывать одновременно с state semantics. Оба трека меняют один и тот же persistence/serialization
path, и разделение на разные PR только повышает риск churn и потери comments.

## Что можно взять только если останется время

### 3. Узкий bugfix по redirect flow

Источник:

- `docs/TODO_redirects.md`

Что сделать:

- [x] Проверить сценарий: `probe_text` совпал на промежуточном домене, затем идёт JS redirect на decoy
- [x] Если гипотеза подтверждается, добавить ранний выход в `src/httpResolver.ts`
- [x] Протянуть флаг/результат через `src/types.ts`, `src/batch.ts`, `src/index.ts`
- [x] Добавить точечные тесты в `__tests__/httpResolver.test.ts` и связанные тесты batch/index при необходимости

Комментарий:
**DONE 2026-05-31.** Ранний выход реализован: если `probe_text` подтверждён на промежуточном домене и следующий
редирект — клиентский JS (`location.replace`, `window.location`, `location.href`), резолвер останавливает цепочку
и возвращает текущий домен как рабочий. Meta refresh всегда следует (сервер-подобный). 8 тестов в секции 6.12.

## Что не брать в следующий цикл

### Не брать: heuristic expansion

Источник:

- `docs/TODO_heuristic.md`

Почему не сейчас:

- это широкий трек;
- легко задеть replacement logic и сериализацию;
- список зеркал в `last_known_mirror` потянет типы, YAML, tests и invariants почти по всему pipeline.

### Не брать: monitoring

Источник:

- `docs/TODO_monitoring.md`

Почему не сейчас:

- это слой наблюдаемости поверх текущего поведения;
- сначала полезнее стабилизировать сами state transitions.

### Не брать: publish / marketplace

Источник:

- `docs/TODO_publish.md`

Почему не сейчас:

- это release-хвост;
- сначала лучше дожать state semantics и doc alignment.

## Порядок работы в цикле

1. Прочитать `docs/specs.md`, `docs/TODO_state_semantics.md`, `docs/TODO_spec_alignment.md`.
2. Найти точный state update path в `src/index.ts` и связанные типы в `src/types.ts`.
3. Сначала написать/обновить тесты на повторные идентичные прогоны и state transitions.
4. Затем внести минимальные правки в runtime state update logic.
5. Сразу после первой substantive правки прогнать узкие тесты.
6. После стабилизации runtime обновить `README.md` и `docs/specs.md`.
7. Только если всё прошло чисто, брать `docs/TODO_redirects.md` как отдельный узкий follow-up.

Комментарий:
Не надо в этом цикле смешивать state semantics и большие heuristic changes. Иначе станет тяжело доказать, что именно
вызвало изменение поведения.

## Файлы, которые почти наверняка будут затронуты

- `src/index.ts`
- `src/types.ts`
- `__tests__/index.test.ts`
- `__tests__/config.test.ts`
- `README.md`
- `docs/specs.md`

Возможные дополнительные файлы:

- `src/config.ts`
- `docs/TODO_state_semantics.md`
- `docs/TODO_spec_alignment.md`
- `__tests__/httpResolver.test.ts` только если в этот же цикл войдёт redirect bugfix

## Критерии готовности (DONE 2026-05-24)

- [x] identical success run не создаёт лишний diff в state
- [x] repeated failure не переписывает `failed_since`
- [x] `failed_days` меняется только при смене day bucket
- [x] `potentially_dead` меняется только при реальной смене состояния
- [x] семантика `last_seen` / `success_since` однозначно описана в коде и документации
      (rename завершён; specs §3.2/§4.2/§8.4/§8.4.1)
- [x] тесты покрывают repeated identical runs и success/failure transitions
      (+8 тестов в `__tests__/index.test.ts` секции 11.4/11.5)
- [x] `README.md` и `docs/specs.md` не противоречат runtime behavior

## Риски

- легко случайно поменять поведение summary и `Unchanged sites`;
- можно сломать совместимость существующего `watchers.yml`, если делать rename поля слишком резко;
- можно обновить docs не до конца и оставить старую терминологию в одном месте.

Комментарий:
Если в ходе цикла окажется, что rename `last_seen` слишком дорогой, нормальное решение для этого этапа: не делать
rename, а сначала жёстко зафиксировать текущую семантику и убрать churn. Rename можно оставить отдельным шагом после
стабилизации.

## Решение по scope по умолчанию

Если нет отдельного решения от человека:

- сначала делаем suppression of state churn;
- затем выравниваем docs/spec;
- rename `last_seen` делаем только если он укладывается без лишнего риска и без широкого migration tail.

Комментарий:
Это самый безопасный default scope для следующего цикла.
