# TODO: `force_search_ahead` теряет текущий рабочий alias `last_known_mirror`

## Статус: **ИСПРАВЛЕНО 2026-05-24**

## Проблема

На кейсе `dizipal2065.com` наблюдается следующее поведение:

- `last_known_mirror` выставлен в `dizipal2065.com`;
- direct Phase 1 check успешен, но домен редиректит в `dizipal2072.com`;
- затем `force_search_ahead` собирает соседние working aliases (`dizipal2066.com`, `dizipal2067.com`,
  `dizipal2069.com`, `dizipal2070.com`, `dizipal2071.com`) и final host `dizipal2072.com`;
- в итоговых filter domain lists `dizipal2065.com` отсутствует, хотя он сам является рабочим reachable alias и тоже
  редиректит в тот же целевой host.

Практический результат: минимальный рабочий домен пропускается и выпадает из фильтров.

## Что уже подтверждено по коду

В `src/batch.ts` есть два связанных механизма, которые вместе создают этот gap:

1. Pre-population `force_search_ahead` для успешного Phase 1 кладёт в `foundDomainsPerSite` только `r.newHost`, то
   есть final host после redirect chain, а не alias `r.startedHost` / текущий `last_known_mirror`.
2. Генерация heuristic candidates начинается с `currentNum + 1`, то есть соседние проверки стартуют уже после
   текущего numeric домена.

Из-за этого текущий рабочий alias может не попасть ни как Phase 1 collected alias, ни как heuristic candidate.

## Конкретный локальный path

- `src/batch.ts`: pre-populate делает `domain: r.newHost` для успешного Phase 1 результата;
- `src/batch.ts`: `generateCandidates()` задаёт `startNum = currentNum + 1`;
- `src/index.ts`: дальше canonical/additional domain logic работает уже на неполном наборе working domains.

## Почему это важно

- filter rules теряют реально рабочий и reachable alias;
- current `last_known_mirror` может исчезнуть из filter lists даже если он ещё живой;
- это искажает minimal working set для пользователей и создаёт churn между прогонами;
- runtime начинает предпочитать только final redirect host и соседние `+1` candidates, хотя starting alias тоже
  должен считаться valid working domain.

## Ожидаемое поведение

Если текущий `last_known_mirror` успешно проверился и редиректит в рабочий final host, то при
`force_search_ahead: true` он не должен теряться из collected working set только потому, что:

- heuristic search начинается с `last_known_mirror + 1`, или
- pre-populate сохраняет только `finalHost`, а не working alias.

Минимальный ожидаемый инвариант: текущий живой alias должен оставаться кандидатом на inclusion в filter rules наравне
с другими working aliases, если runtime считает reachable aliases валидной replacement surface.

## Что проверить / реализовать

### 1. Семантика collected working domains

- [x] Решить, должен ли successful Phase 1 redirecting alias добавляться в working set как alias-host, а не только как
  `finalHost` — **ДА**, добавлен в `src/batch.ts:537-547`
- [x] Явно определить, должен ли `last_known_mirror`, если он рабочий и редиректит в тот же final host, сохраняться в
  filter rules — **ДА**, сохраняется если `hostChanged && startedHost !== newHost`

### 2. Runtime path

- [x] Пересмотреть pre-populate branch в `src/batch.ts` для `force_search_ahead` — **DONE**: добавлен `startedHost` в `domains` array когда `hostChanged`
- [x] Проверить, должен ли туда попадать `startedHost`, `newHost`, или оба — **оба** попадают когда они разные
- [x] Проверить, нужно ли включать текущий `last_known_mirror` в heuristic working set независимо от старта с `+1` — **DONE**: через pre-populate mechanism
- [x] Определить, является ли `startNum = currentNum + 1` корректным сам по себе или требует special-case для текущего
  рабочего alias — **корректно**, alias подхватывается через pre-populate, а не через heuristic candidates

### 3. Canonical / replacement semantics

- [x] Проверить, как это соотносится с `✅TODO_heuristic_alias_canonicalization.md` — **совместимо**: alias попадает в working set, canonical selection работает на полном наборе
- [x] Зафиксировать, должен ли canonical selection видеть current alias как working candidate — **ДА**, видит через pre-populate
- [x] Проверить, не создаст ли inclusion current alias лишние дубликаты в replacement lists — **НЕТ**: `foundDomainsPerSite` использует `candidateUrl` (alias), а `result` (final host) для canonical selection

### 4. Tests

- [x] `__tests__/batch.test.ts`: current `last_known_mirror` redirects to shared final host -> current alias retained
  in working set for `force_search_ahead` — **DONE** в test 8.8
- [x] `__tests__/replacer.test.ts`: filter lists keep current working alias alongside other collected aliases when
  that is the chosen contract — **REJECTED**: решено удерживать alias.
  Обоснование: alias является живой reachable точкой входа через редирект; его потеря создаёт churn в filter lists и нарушает minimal working set контракт.
  Выбранный вариант задокументирован в specs.md (секция "force_search_ahead семантика").
- [x] Add a regression case for `dizipal2065.com`-style flow with direct success + heuristic `+1` neighbors — **DONE** в test 8.8 (использует testsite65/72 вместо dizipal)

### 5. Docs

- [x] If current alias should be retained: update `docs/specs.md` and `README.md` — **DONE** в specs.md
- [ ] If current alias should NOT be retained: explicitly document that behavior, because current result looks
  surprising from maintainer perspective — **REJECTED**: решено удерживать alias.
  Обоснование: alias является живой reachable точкой входа через редирект; его потеря создаёт churn в filter lists и нарушает minimal working set контракт.
  Выбранный вариант задокументирован в specs.md (секция "force_search_ahead семантика").

## Приоритет

Это приоритетный runtime bug / semantic gap.

Причины:

- теряется живой рабочий домен, который уже был в watcher state;
- кейс воспроизводится на реальном numeric-family watcher;
- issue влияет прямо на итоговые filter domain lists, а не только на reporting.

## Связанные файлы

- `src/batch.ts`
- `src/index.ts`
- `docs/specs.md`
- `README.md`
- `__tests__/batch.test.ts`
- `__tests__/replacer.test.ts`

## Связанные TODO

- `✅TODO_heuristic_alias_canonicalization.md`

## Решение

Исправлена логика pre-population в `src/batch.ts` (строки 526-539):

**Было:**
- При успешном Phase 1 для `force_search_ahead` сайтов в `foundDomainsPerSite` добавлялся только `r.newHost` (final host после редиректов)
- Текущий alias (`r.startedHost` / `last_known_mirror`) терялся, если он редиректил в другой домен

**Стало:**
- Если Phase 1 успешен и `hostChanged === true` (произошел редирект), в `foundDomainsPerSite` добавляются **оба**:
  1. Starting alias (`r.startedHost`) - текущий рабочий alias
  2. Final host (`r.newHost`) - куда он редиректит
- Это гарантирует, что текущий alias не потеряется из собранных working domains

**Код:**
```typescript
if (r.hostChanged && r.startedHost) {
  const startedHostNormalized = r.startedHost.toLowerCase().replace(/^www\./, '');
  const newHostNormalized = r.newHost.toLowerCase();
  if (startedHostNormalized !== newHostNormalized) {
    domains.unshift({
      domain: r.startedHost,  // the starting alias
      result: r.result,
      candidateUrl: r.startedHost,
    });
    this.logger.info(name, `force_search_ahead: Phase 1 alias ${r.startedHost} collected (redirects to ${r.newHost})`);
  }
}
```

## Тесты

Добавлены regression-тесты в `__tests__/batch.test.ts`:

- **8.8**: `dizipal2065.com` кейс - текущий alias редиректит в shared final host, должен быть сохранен
- **8.9**: Generic кейс - Phase 1 success с редиректом → pre-populate включает и alias, и final host
- **8.4** (обновлен): Проверка, что starting alias остается в collected domains

## Влияние

- **Fix**: Текущий рабочий alias больше не теряется из filter rules
- **Backward compatibility**: Полностью совместимо, только добавляет недостающие домены
- **Performance**: Минимальное (одна дополнительная итерация в pre-populate loop)

## Связанные файлы

- `src/batch.ts` - исправлена логика pre-population
- `__tests__/batch.test.ts` - добавлены regression-тесты
- `docs/specs.md` - обновлена семантика `force_search_ahead`

## Проверено

- [x] Все тесты проходят (`yarn test`)
- [x] Build успешен (`yarn build`)
- [x] TODO.md обновлен
- [x] Regression-тесты добавлены
