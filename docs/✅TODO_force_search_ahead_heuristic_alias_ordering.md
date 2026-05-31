# TODO: `force_search_ahead` loses redirecting heuristic aliases depending on completion order

## Проблема

На кейсе `Piabet TV (piabettv*.live)` подтверждено order-dependent поведение:

- `last_known_mirror: piabettv18.live` жив и остаётся в working set;
- heuristic candidate `piabettv19.live` тоже жив, но редиректит в `piabettv20.live`;
- иногда итоговый working set содержит `piabettv19.live`, а иногда нет;
- из-за этого в PR `piabettv19.live` то появляется, то удаляется из filter rules, хотя сам alias остаётся reachable.

Это не согласуется с уже зафиксированным alias-retention контрактом: живой reachable alias не должен выпадать из
replacement surface только из-за порядка завершения параллельных heuristic checks.

## Что уже подтверждено

### По PR / runtime behavior

- В PR `#232034` `piabettv19.live` был удалён из `TurkishFilter/sections/specific.txt`
- В PR `#232035` тот же домен был снова добавлен
- Локальные логи подтверждают оба варианта поведения на одном и том же watcher-сценарии

### По текущему коду

В `src/batch.ts` heuristic alias сохраняется только условно:

```ts
const alreadyKnownFinal = currentDomains.some(entry => entry.domain === newHost);
const collectedDomain = candidateHost !== newHost && ((knownPrimary && newHost === knownPrimary) || alreadyKnownFinal)
  ? candidateHost
  : newHost;
```

Практический смысл:

- если `piabettv19.live -> piabettv20.live` завершится раньше прямой проверки `piabettv20.live`, в working set попадёт
  только `piabettv20.live`;
- если `piabettv20.live` уже успел попасть в `currentDomains`, тогда `piabettv19.live` сохраняется как alias.

Дальше `src/replacer.ts` считает keep-set только по реально собранным `workingDomains`, поэтому alias, не попавший в
working set, удаляется как predicted mirror.

## Почему это баг по текущей спецификации

Текущий контракт в `docs/specs.md` и `README.md` уже зафиксирован так:

- filter files are updated with all collected domains to prevent loss of reachable aliases;
- if many working aliases redirect to one shared final host, the canonical mirror is still the smallest reachable
  pattern alias;
- reachable aliases are valid replacement surface and should not disappear between runs.

Следовательно, `piabettv19.live` **должен сохраняться**, если runtime признаёт его working alias через успешный
redirect chain.

## Формализация

### Runtime invariant

For a pattern watcher with `force_search_ahead: true`:

- if a heuristic candidate `candidateHost` resolves successfully;
- and `candidateHost` is itself a pattern alias;
- and the redirect chain ends at a pattern `finalHost`;

then `candidateHost` is part of the watcher's reachable working set and must be preserved in collected domains,
even if another candidate or direct check resolves to the same `finalHost`.

### Order-independence invariant

For the same set of successful candidates, the resulting collected working-domain set must not depend on the order in
which asynchronous heuristic checks complete.

Equivalent statement:

- given the same successful redirect graph;
- given the same watcher config and same pattern/non-pattern classification;
- changing only promise completion order must not change whether a reachable pattern alias is kept or removed.

### Replacement-surface invariant

If a pattern alias is accepted into the collected working set, it must survive predicted-mirror cleanup and remain in
the replacement surface for that watcher.

Equivalent statement:

- `workingDomains` is the source of truth for alias preservation;
- therefore alias collection must be complete before replacer cleanup runs;
- otherwise cleanup incorrectly converts an async-order artifact into a filter diff.

## Отличие от уже закрытого TODO

Это не тот же баг, что `✅TODO_force_search_ahead_current_alias_loss.md`.

Там был исправлен случай, когда терялся **starting alias / current `last_known_mirror`** на успешном Phase 1.
Здесь теряется **heuristic neighbor alias**, и потеря зависит от порядка завершения параллельных проверок.

## Что нужно сделать

### 1. Зафиксировать ожидаемый инвариант

- [x] Подтвердить в spec/runtime, что successful heuristic alias `candidateHost -> finalHost` должен сохраняться как
      alias-host, даже если `finalHost` ещё не был известен на момент завершения конкретного promise
- [x] Явно дописать, что alias retention для heuristic candidates должна быть order-independent, а не только
  Phase-1-safe

### 2. Исправить runtime

- [x] Пересмотреть heuristic collection branch в `src/batch.ts`
- [x] Убрать зависимость alias retention от completion order / `alreadyKnownFinal`
- [x] Проверить, не создаст ли это лишние дубликаты, если и alias, и final host уже собраны

### 3. Добавить regression tests

- [x] Тест: `candidate19 -> final20`, `candidate20 -> final20`, порядок завершения `19` раньше `20`
      -> в working set должны быть и `19`, и `20`
- [x] Тест: тот же сценарий, но `20` завершается раньше `19`
      -> результат должен быть идентичным
- [x] Тест на replacer cleanup: working alias не удаляется как predicted mirror только из-за порядка завершения checks

## Ручная проверка

Если нужно проверить поведение руками, воспроизводимый сценарий такой.

### Пример watcher

```yaml
sites:
  Example TV:
    last_known_mirror: example218.com
    force_search_ahead: true
    probe_text:
      - Example TV
```

### Пример filter rule

```text
example218.com,example219.com,example220.com,example221.com##.banner
```

### Что проверить

1. Смоделировать runtime, где `example219.com -> example220.com`, а `example220.com -> example220.com`.
2. Повторить прогон с двумя вариантами порядка завершения: сначала `19`, потом `20`, и наоборот.
3. Убедиться, что collected working set в обоих случаях содержит `example218.com`, `example219.com`,
  `example220.com`.
4. Убедиться, что после replacement/cleanup rule сохраняет `example219.com`, а `example221.com` удаляется как
   predicted mirror.

## Что должен спрашивать review

### Spec review

- [x] Зафиксирован ли инвариант “reachable pattern alias is preserved” не только для starting alias, но и для
  heuristic aliases?
- [x] Зафиксирована ли order-independence requirement для collected working set?
- [x] Ясно ли написано, что shared `finalHost` не даёт права выбрасывать alias только потому, что он завершился позже
  или раньше?

### Code review

- [x] Есть ли ветка, где alias retention зависит от mutable intermediate state вроде `alreadyKnownFinal`?
- [x] Может ли completion order менять `collectedDomain` при одинаковом redirect graph?
- [x] Не превращает ли replacer cleanup неполный `workingDomains` в удаление реально reachable alias?

### Test review

- [x] Есть ли парные тесты с одинаковым redirect graph, но разным порядком завершения async-checks?
- [x] Проверяют ли тесты не только canonical mirror, но и полный collected working-domain set?
- [x] Проверяется ли downstream effect: alias survives replacer cleanup and remains in filter lines?

## Почему это важно

- убирает шумные add/remove PR oscillation для живых alias-доменов;
- делает `force_search_ahead` действительно deterministic по содержимому, а не только по canonical mirror;
- согласует runtime с уже принятой alias-retention семантикой.
