# TODO: Изолировать watcher-ы с одинаковым numeric pattern друг от друга

## Проблема

Сейчас два разных watcher-а могут независимо существовать в `watchers.yml`, но при filter replacement /
predicted-mirror cleanup они не полностью изолированы, если их домены попадают в один и тот же numeric pattern family.

Пример risk-case:

- watcher A: `last_known_mirror = dizipal2071.com`
- watcher B: `last_known_mirror = dizipal1553.com`

Оба домена соответствуют одной и той же pattern family:

```text
dizipal{N}.com
```

Из-за этого replacement/cleanup logic может рассматривать их как одну общую группу predicted mirrors, хотя семантически
это разные сайты с разным контентом и разными watcher entries.

## Что уже подтверждено

По runtime path:

- redirect resolution и watcher state update выполняются независимо по `siteName`;
- один watcher не должен напрямую переписывать `last_known_mirror` другого.

Но по replacer path:

- `matchesSamePattern()` / `extractBasePattern()` опираются только на pattern вида `domain{N}.tld`;
- `priorityMap` и `removePredictedMirrors()` работают по общему pattern family, а не по watcher identity;
- gap в нумерации (`1553` vs `2071`) не даёт никакой изоляции, если base pattern одинаковый.

## Почему это опасно

- один watcher может косвенно влиять на cleanup domain lists другого watcher-а;
- filter rules для двух разных сайтов с одинаковым numeric pattern могут начать "защищать" или "чистить" чужие
  predicted mirrors;
- это создаёт труднообъяснимый churn в filter files и делает поведение зависимым не только от конкретного watcher-а, но
  и от других watcher-ов с тем же pattern family.

## Целевое поведение

Два разных watcher-а с одинаковым numeric pattern должны оставаться изолированными не только на уровне state checks, но
и на уровне filter replacement / predicted-mirror cleanup.

Практическое правило:

- watcher A не должен удалять, защищать, canonicalize-ить или иным образом менять domain-list entries watcher-а B
  только потому, что оба используют одинаковый numeric pattern.

## Что сделать

### 1. Локализовать точный scope пересечения

- [ ] Подтвердить все места, где grouping идёт по pattern family вместо watcher identity
- [ ] Отдельно проверить `priorityMap`, `initialToLastKnownMap`, `removePredictedMirrors()`, `processDomainList()`
- [ ] Проверить, не затрагивает ли это только cleanup, или также additional domains / canonical selection

### 2. Исправить runtime isolation

- [ ] Ввести watcher-scoped isolation для predicted-mirror cleanup
- [ ] Убедиться, что exact replacements продолжают работать как раньше
- [ ] Не ломать current behavior для одного watcher-а с обычным numeric pattern rotation

### 3. Добавить регрессионные тесты

- [ ] two watchers, same pattern family, different content -> independent state updates
- [ ] two watchers, same pattern family -> one watcher must not prune the other's domain list entries
- [ ] gap in numbering (`1553` vs `2071`) must not be relied upon; isolation must come from watcher scope, not numeric
  distance
- [ ] exact replacement still works for each watcher's own domains
- [ ] no cross-watcher predicted mirror contamination in replacer tests

### 4. Обновить документацию

- [ ] Уточнить в `docs/specs.md`, что watcher identity has precedence over shared numeric pattern family
- [ ] Уточнить в `README.md`, что одинаковый numeric pattern у разных watcher-ов допускается только при изолированной
  обработке
- [ ] Если останутся ограничения, описать их явно, а не оставлять неявными

## Где смотреть

- `src/batch.ts`
- `src/index.ts`
- `src/replacer.ts`
- `src/types.ts` при необходимости
- `__tests__/replacer.test.ts`
- `__tests__/index.test.ts`
- `docs/specs.md`
- `README.md`

## Комментарий по приоритету

Это не cosmetic issue: если пользователь добавляет два разных watcher-а с одинаковым numeric pattern, текущая неполная
изоляция может привести к неожиданным изменениям в filter domain lists. Это стоит держать как отдельный runtime/spec
task, а не только как заметку в reporting backlog.

## Требования AGENTS.md (после завершения)

- [ ] Обновить/добавить тесты в `__tests__/` для новой функциональности
- [ ] Задокументировать breaking changes (если есть)
- [ ] Проверить backward compatibility
- [ ] Обновить `README.md` или соответствующую спецификацию в `docs/`,
      если поведение изменилось
- [ ] Запустить `yarn build` для проверки сборки
- [ ] Запустить `yarn test` для проверки тестов
- [ ] Запустить `yarn lint` для проверки стиля кода
