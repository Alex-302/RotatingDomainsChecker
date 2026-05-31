# TODO: Проверить семантику heuristic alias collection vs final redirect host

## Контекст

На кейсе `PapazSports (papazsports*.pro)` наблюдается такое поведение:

- исходный `initial_domain` / старый starting point: `papazsports922.pro`;
- прямые проверки `www.papazsports922.pro` и `papazsports922.pro` падают по DNS;
- затем запускается heuristic search;
- working candidates `papazsports1009.pro`, `papazsports1010.pro`, `papazsports1011.pro`, `papazsports1012.pro`,
  `papazsports1013.pro` проходят проверку;
- все они редиректят на один и тот же final host: `www.papazsports1013.pro`;
- при `force_search_ahead: true` runtime сохраняет candidate-host aliases, а затем выбирает минимальный natural-sorted
  canonical домен: `papazsports1009.pro`.

Именно поэтому в PR `papazsports1009.pro` появился как новый `last_known_mirror` и был добавлен в filter domain lists.

## Что уже подтверждено

По логам это не выглядит как "нашли через direct redirect от initial_domain":

- сначала был DNS fail для `www.papazsports922.pro`;
- затем fallback на `initial_domain: papazsports922.pro`;
- затем снова DNS fail;
- затем heuristic DNS/HTTP checks нашли `papazsports1009.pro` и соседние домены;
- лог явно показывает:

```text
Heuristic SUCCESS: https://papazsports1009.pro
Heuristic redirect chain: https://papazsports1009.pro (301) -> https://www.psgiris.pro/ (302) -> https://www.papazsports1013.pro/ (200)
force_search_ahead: collected working domain papazsports1009.pro from https://papazsports1009.pro (final: www.papazsports1013.pro)
```

## Статус

- [x] Resolved by spec/tests: the canonical mirror is the smallest reachable pattern alias.

## Решение

Canonical mirror в таких кейсах считается так:

1. `finalHost` после redirect chain
2. минимальный working candidate alias, даже если он редиректит на другой final host

Зафиксирован вариант 2: при `force_search_ahead` canonical mirror — это минимальный reachable pattern alias.
`finalHost` сам по себе не переопределяет canonical watcher state, если он не является минимальным
pattern-доменом.

## Почему это требует доисследования

Текущее поведение частично соответствует спецификации, но спецификация недостаточно явно формулирует этот нюанс:

- в `docs/specs.md` зафиксировано, что при нескольких heuristic successes нужно выбрать минимальный candidate natural
  sort;
- но не проговорено достаточно явно, что candidate-host alias может быть сохранён даже если фактический `finalHost` у
  всех успешных кандидатов одинаков и отличается от alias;
- не до конца очевидно, должен ли `last_known_mirror` представлять:
  - canonical reachable alias для фильтров, или
  - фактический final redirect target.

## Что проверить

### 1. Согласованность runtime и spec

- [x] Проверить sections `6.5`, `6.6`, `7.x` в `docs/specs.md`
- [x] Явно решить, допустимо ли хранить alias как canonical `last_known_mirror`, если final host другой
- [x] Если это intended behavior, дописать spec/README более явно
- [x] Если это не intended behavior, определить, где исправлять runtime

### 2. Семантика filter replacement

- [x] Проверить, должны ли в filter domain lists сохраняться alias-hosts, которые редиректят на единый final host
- [x] Проверить, должен ли `www.papazsports1013.pro` сохраняться наряду с `papazsports1013.pro`
- [x] Проверить, не создаёт ли это лишний churn в filters между прогонами

### 3. Семантика watcher state

- [x] Должен ли `last_known_mirror` быть стабильным alias-каноникалом для следующего heuristic run
- [x] Или он должен быть равен фактическому final redirect host
- [x] Проверить, не конфликтует ли это с будущим треком `TODO_state_semantics.md`

### 4. Тесты

- [x] Добавить regression tests на case: many candidates -> one final redirect target
- [x] Зафиксировать отдельно expected behavior для:
  - canonical alias selection
  - final-host normalization
  - `www` / non-`www` coexistence

## Где смотреть

- `src/batch.ts`
- `src/index.ts`
- `src/replacer.ts`
- `docs/specs.md`
- `README.md`
- `__tests__/batch.test.ts`
- `__tests__/replacer.test.ts`

## Комментарий по приоритету

Это не похоже на срочную поломку поиска доменов: current behavior детерминированный и объяснимый по логам. Но это
важный semantic/design question, потому что именно он определяет, какой домен считается "главным" для watcher state и
filter updates.

## Требования AGENTS.md (после завершения)

- [x] Обновить/добавить тесты в `__tests__/` для новой функциональности
- [x] Задокументировать breaking changes (если есть)
- [x] Проверить backward compatibility
- [x] Обновить `README.md` или соответствующую спецификацию в `docs/`,
      если поведение изменилось
- [x] Запустить `yarn build` для проверки сборки
- [x] Запустить `yarn test` для проверки тестов
- [x] Запустить `yarn lint` для проверки стиля кода

## Связанные TODO

- `✅TODO_semantics.md`
- `✅TODO_force_search_ahead_mixed_pattern_nonpattern.md`
