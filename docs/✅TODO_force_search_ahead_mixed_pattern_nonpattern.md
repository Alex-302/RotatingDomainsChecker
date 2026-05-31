# TODO: force_search_ahead mixed pattern/non-pattern canonicalization

## Статус

- [x] Highest priority runtime/spec task
- [x] Completed 2026-05-25

## Решение

- [x] Если найден хотя бы один живой pattern-домен, watcher остаётся в pattern-mode.
- [x] Canonical `last_known_mirror` выбирается только из pattern-подмножества working set.
- [x] Non-pattern домены из redirect chain / `additionalWorkingDomains` не попадают в replacement rules.
- [x] Отдельный summary warning не добавлялся: такие non-pattern токены просто игнорируются, чтобы не
      раздувать шум в отчётах.

## Контекст

На кейсе `dizipal2071.com` был подтверждён опасный mixed-set сценарий:

- watcher был в failed state на pattern-домене (`last_known_mirror: dizipal2050.com`);
- новый прогон нашёл живые pattern-домены `dizipal2062.com` ... `dizipal2073.com`;
- одновременно heuristic/redirect chain собрал non-pattern домен `dizipal2.com.tr`;
- в результате `last_known_mirror` стал `dizipal2.com.tr`, хотя живые pattern-домены были найдены.

Это ломает главный контракт pattern-watcher-а: canonical `last_known_mirror` не должен уходить в non-pattern,
если pattern-множество всё ещё живо.

## Предыстория расследования

### Что было до `force_search_ahead`

В ранней реализации `last_known_mirror` обновлялся из основного успешного результата (`result.newHost`).
Дополнительные домены не участвовали в выборе canonical watcher state.

### Что изменилось в `2ef1ab56`

В коммите `2ef1ab56` была введена canonicalization через:

```ts
const effectiveNewHost = selectFirstByOrder(result.newHost, result.additionalWorkingDomains);
site.last_known_mirror = effectiveNewHost;
```

Цель была разумной: при `force_search_ahead` детерминированно выбирать минимальный working domain и тем самым
стабилизировать `last_known_mirror`.

Но в этой логике было скрытое допущение: что `additionalWorkingDomains` содержит только pattern-домены.
На реальном кейсе это оказалось неверно: в список попал non-pattern домен из redirect chain.

### Что показало расследование

- проблема не уникальна для текущей ветки;
- это старый дефект контракта/реализации, проявившийся на реальном mixed-set кейсе;
- текущая защита pattern -> non-pattern работает только для основного результата (`result.newHost`), но не для
  `additionalWorkingDomains`;
- `selectFirstByOrder(...)` не различает pattern и non-pattern, поэтому non-pattern может выиграть natural sort.

## Целевое поведение

Для pattern-watcher-а должны действовать такие правила:

1. Если найден хотя бы один живой pattern-домен, watcher остаётся в pattern-mode.
2. В pattern-mode:
      - [x] `last_known_mirror` выбирается только из pattern-доменов;
      - [x] non-pattern домены не попадают в canonical watcher state;
      - [x] non-pattern домены не попадают в replacement rules для pattern-watcher-а;
      - [x] non-pattern домены не требуют отдельного summary warning; они игнорируются без лишнего шума.
3. Только если pattern-доменов не найдено вообще, разрешён переход в non-pattern mode:
      - [x] `last_known_mirror` сохраняет последний pattern anchor;
      - [x] новый non-pattern пишется в `non_pattern_mirror`;
      - [x] filter replacements не выполняются.

## Что нужно изменить в документации

### `docs/specs.md`

- [x] Явно описать mixed-set сценарий для `force_search_ahead`
- [x] Зафиксировать правило: если есть хотя бы один pattern, canonical выбирается только из pattern-подмножества
- [x] Зафиксировать правило: non-pattern из `additionalWorkingDomains` не участвует в replacement rules для
      pattern-watcher-а
- [x] Явно развести два режима:
      - pattern mode: продолжаем работать с pattern-доменами;
      - non-pattern mode: pattern anchors не найдены, replacements блокируются

### `README.md`

- [x] Коротко описать поведение `force_search_ahead` на mixed pattern/non-pattern кейсах
- [x] Объяснить, почему найденный non-pattern не становится `last_known_mirror`, если pattern всё ещё жив
- [x] Уточнить, что non-pattern из redirect chain не должен попадать в filter updates для pattern-watchers

## Что нужно изменить в runtime

- [x] Исправить выбор `effectiveNewHost` в `src/index.ts`, чтобы он не мог выбрать non-pattern,
      если `result.newHost`/дополнительные кандидаты содержат pattern-подмножество
- [x] Проверить, не нужно ли фильтровать non-pattern ещё раньше при подготовке replacement entries
- [x] Проверить antibot success branch на тот же mixed-set риск
- [x] Проверить, нужно ли логировать отдельный warning, когда non-pattern найден среди живых pattern-доменов

## Что нужно протестировать

### Runtime / state

- [x] `force_search_ahead`: pattern `newHost` + mixed `additionalWorkingDomains` с non-pattern
      -> `last_known_mirror` остаётся pattern
- [x] если среди candidates есть pattern и non-pattern, canonical выбирается только из pattern
- [x] если pattern не найден вообще, watcher остаётся на старом pattern anchor и пишет новый non-pattern в
      `non_pattern_mirror`
- [x] recovery case: после mixed-set прогона не ломается следующий heuristic run

### Replacements

- [x] non-pattern из `additionalWorkingDomains` не попадает в replacement map / filter rules
- [x] pattern aliases из mixed-set продолжают попадать в filter rules как и раньше
- [x] predicted-mirror cleanup не удаляет корректные pattern aliases после такого прогона

### Regression

- [x] existing pattern-only `force_search_ahead` сценарии не меняют поведение
- [x] existing non-pattern transition сценарии продолжают работать как раньше
- [x] alias-retention кейсы из `✅TODO_force_search_ahead_current_alias_loss.md` не ломаются

## Где смотреть

- `src/index.ts`
- `src/batch.ts`
- `src/replacer.ts`
- `docs/specs.md`
- `README.md`
- `__tests__/index.test.ts`
- `__tests__/batch.test.ts`
- `__tests__/replacer.test.ts`

## Открытые вопросы

- [x] Дополнительное хранение mixed-set non-pattern кроме логов не требуется, если pattern-домены уже найдены.
- [x] Отдельный warning в summary/reporting не нужен; это создаёт шум без практической пользы.
- [x] Replacer должен полностью игнорировать такие non-pattern tokens для pattern watcher replacement surface.

## Checklist

- [x] Прочитать релевантный runtime code (`src/index.ts`, `src/batch.ts`, `src/replacer.ts`)
- [x] Проверить `docs/specs.md` и `README.md`
- [x] Проверить существующие тесты в `__tests__/`
- [x] Обновить/добавить тесты под новый контракт
- [x] Обновить спецификацию и README в том же workstream
- [x] Запустить `yarn build`
- [x] Запустить `yarn test`
- [x] Запустить `yarn lint` при наличии/необходимости

## Связанные TODO

- `✅TODO_semantics.md`
- `✅TODO_heuristic_alias_canonicalization.md`