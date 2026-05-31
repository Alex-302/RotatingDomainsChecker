# TODO: Согласование спецификаций и runtime

Source: open questions from `rdc_docs/specs.md` and remaining gaps between docs, types, and actual runtime behavior.

## Цель

Убрать расхождения между:

- `rdc_docs/specs.md`
- `README.md`
- `src/types.ts`
- текущим runtime behavior

## Задачи

### 1. Формат и семантика `success_since` (ранее `last_seen`)

- [x] Зафиксировать один формат значения: `YYYY-MM-DD HH:MM`
- [x] Align `specs.md`, `README.md`, comments in `src/types.ts`, and runtime state serialization with the chosen format
- [x] Согласовать это решение с треком `TODO_state_semantics.md` (rename `last_seen` → `success_since` + миграция
  + noise suppression — статус 2026-05-24)

> **Статус (2026-05-24, окончательный):** формат `YYYY-MM-DD HH:MM` унифицирован. В рамках согласования с
> `TODO_state_semantics.md` также выполнены: rename поля `last_seen` → `success_since` в `src/types.ts`,
> `src/index.ts`, `src/batch.ts`, тестовой базе; миграция legacy `last_seen` при загрузке через `loadWatchers()`;
> явное подавление state churn — `success_since` обновляется только при state transition (domain change,
> exit from failure, pattern→non-pattern transition); `saveWatchers()` никогда не пишет legacy поле обратно.
> `docs/specs.md` §3.2/§4.2/§8.4 обновлены, `README.md` пример переведён.

### 2. `non_pattern_mirror`

- [x] Проверить, нужен ли `non_pattern_mirror` как реальное runtime-поле
- [x] Если нужен: добавить его в типы, serialization path и документацию
- [x] Если подтверждается как runtime-semantic, вести implementation в `✅TODO_non_pattern_mirror_runtime.md`, а здесь
  оставить только doc/type alignment
- [x] До реализации убрать из `README.md` видимость, будто `non_pattern_mirror` уже поддержан как рабочее
  auto-generated поле
- [x] Если не нужен: убрать упоминания из docs, чтобы не создавать ложное ожидание поддержки

> **Статус (2026-05-24):** все подпункты закрыты в треке `✅TODO_non_pattern_mirror_runtime.md`. Runtime полностью
> реализован (`src/batch.ts:108-122`, `src/index.ts:333-334`), типы добавлены (`src/types.ts:71`), `docs/specs.md` §
> «non_pattern_mirror» описывает целевую модель. `README.md` обновлён: заголовок блока изменён на «managed by runtime
> during pattern ↔ non-pattern transitions», поля раскомментированы.

### 3. Forced DNS helper-path

- [x] Перепроверить, что docs ссылаются на актуальный helper-path и фактический runtime route
- [x] Re-verify `specs.md`, `README.md`, the test helper, and the main pipeline before the next merge/release

> **Статус (2026-05-24):** runtime реализован (`src/dnsResolver.ts`: `FORCED_DNS_SERVERS`, `forcedDnsResolver`,
> `getForcedDnsResolver()`), тесты `__tests__/batch.test.ts` и `__tests__/index-dns.test.ts` покрывают поведение.
> `TODO: clarify` удалён из `docs/specs.md` Open Questions секции.

### 4. Терминология `pattern_changed` / non-pattern flow

- [x] Align the terms between `README.md`, `specs.md`, and the code
- [x] До runtime fix явно пометить текущее поведение как unresolved/inconsistent, а не как целевой contract
- [x] После runtime fix описать целевую модель: `last_known_mirror` остаётся pattern anchor, `non_pattern_mirror`
  хранит текущий non-pattern host, filter files не меняются до возврата к pattern-domain

> **Статус (2026-05-24):** термины согласованы между `src/types.ts` (JSDoc на полях `non_pattern_mirror`,
> `pattern_changed`, `heuristic_history`), `docs/specs.md` § «pattern_changed» / «heuristic_history» /
> «non_pattern_mirror», и `README.md` (пример с обновлёнными комментариями). Целевая модель зафиксирована в specs.md.

## Требования AGENTS.md (после завершения)

- [x] Задокументировать breaking changes (если есть — например, rename полей)
- [x] Проверить backward compatibility с форматом `watchers.yml`
- [x] Обновить/добавить тесты в `__tests__/` для новой функциональности
- [x] Обновить `README.md` или соответствующую спецификацию в `docs/`, если поведение изменилось
- [x] Запустить `yarn build` для проверки сборки
- [x] Запустить `yarn test` для проверки тестов
- [x] Запустить `yarn lint` для проверки стиля кода

> **Статус (2026-05-24, окончательный):** все 4 задачи закрыты.
>
> - **Задача 1 (формат + rename):** унифицировано к `YYYY-MM-DD HH:MM`. Rename `last_seen` → `success_since`
>   выполнен в `src/types.ts`, `src/index.ts`, `src/batch.ts`, во всех тестах и документации. Миграция legacy
>   поля реализована в `loadWatchers()` (`src/config.ts`), `saveWatchers()` никогда не пишет legacy поле
>   обратно. State churn suppression: `success_since` обновляется только при state transition (через helper
>   `updateSuccessSince()` и snapshot `hadFailureBeforeThisRun`).
> - **Задача 2 (`non_pattern_mirror`):** runtime-семантика полностью реализована в предыдущем треке
>   (`✅TODO_non_pattern_mirror_runtime.md`).
> - **Задача 3 (forced DNS):** runtime стабилизирован в `dnsResolver.ts`, Open Questions удалены.
> - **Задача 4 (терминология):** согласована.
>
> **Breaking changes:** soft rename `last_seen` → `success_since` в watchers.yml. Старые `last_seen` значения
> автоматически мигрируются при загрузке; при следующем save поле будет записано как `success_since`. Для
> пользователей это прозрачно — старые конфиги с `last_seen: 2026-01-21` продолжат работать.
>
> **Backward compatibility:** полная, через миграцию в `loadWatchers()` и `calculateDaysSince()` (последний
> принимает оба формата через `.replace(" ", "T")`).
>
> **Хвост:** все закрыто. `TODO_state_semantics.md` также закрыт (кроме micro-optimization `failed_days`
> day-bucket check — отдельный трек).
