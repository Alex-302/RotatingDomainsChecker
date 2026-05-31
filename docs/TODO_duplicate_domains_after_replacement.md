# TODO: Убрать дубликаты доменов в правилах после replacements

## Проблема

На конфиге discovery-entrypoint для `woe.sx` наблюдается дубликат одного и того же домена в результирующей строке
правила:

```text
kathyinformationwhether.com,kathyinformationwhether.com,rebeccasciencestreet.com,...#%#//scriptlet('prevent-addEventListener', 'contextmenu')
```

Это не критичная поломка runtime, но это шумный и явно некорректный результат в filter line.

## Контекст кейса

Конфиг:

```yaml
woe.sx:
  initial_domain: https://voe.sx/e/nemg6vqtnrkf
  skip_text_allow:
    - Redirecting...
  path: e/nemg6vqtnrkf
  last_known_mirror: kathyinformationwhether.com
  last_seen: 2026-05-20
```

Семантически это discovery-entrypoint case:

- `initial_domain` — URL with path;
- по spec такой entrypoint не должен сам становиться replacement source;
- replacement source должен идти от предыдущего `last_known_mirror`.

## Предварительная гипотеза

Наиболее вероятная причина сейчас в `src/replacer.ts`, в `processDomainList()`:

1. сначала выполняется обычная замена `replaceDomain()` для каждого домена списка;
2. после этого нет безусловной дедупликации результата;
3. дедуп сейчас вызывается только в отдельных ветках:
   - numeric-pattern cleanup / `removePredictedMirrors()`;
   - append/replace через `additionalDomainsMap`;
4. если один из соседних доменов заменился в тот же домен, который уже был в списке, в non-pattern line остаётся
   duplicate.

Практически это выглядит так:

```text
oldA,kathyinformationwhether.com,...
```

после replacement превращается в:

```text
kathyinformationwhether.com,kathyinformationwhether.com,...
```

и дальше не очищается.

## Почему это важно

- засоряет filter rules;
- создаёт ненужный churn в PR diff;
- делает результаты менее читаемыми;
- повышает риск новых шумных различий в discovery-entrypoint / non-pattern cases.

## Что проверить

### 1. Подтвердить точный path возникновения дубля

- [ ] Воспроизвести case на тестовом фильтре / unit test
- [ ] Подтвердить, что duplicate появляется уже после `replaceDomain()` до append extras
- [ ] Проверить, участвует ли в кейсе `additionalDomainsMap` или проблема возникает без него

### 2. Проверить корректное место для дедупликации

- [ ] Решить, должна ли `processDomainList()` всегда делать финальную дедупликацию перед возвратом
- [ ] Убедиться, что такая дедупликация не ломает intentional distinctions (`www` vs non-`www`) там, где они
  действительно нужны
- [ ] Сверить с discovery-entrypoint semantics из `docs/specs.md` и `docs/specs_discovery_entrypoint.md`

### 3. Добавить регрессионные тесты

- [ ] discovery-entrypoint / non-pattern line: replacement creates duplicate -> final line deduplicated
- [ ] case with `www` + non-`www`: expected behavior explicitly fixed in tests
- [ ] case with `additionalDomainsMap`: no duplicate when extra and replaced domain normalize to same host

### 4. Обновить документацию в том же work

- [ ] После фикса обновить `docs/specs.md`, если целевая семантика дедупликации будет явно зафиксирована или
  изменена
- [ ] После фикса обновить `README.md`, если user-facing описание replacement behavior / domain-list handling станет
  точнее или изменится
- [ ] Не оставлять fix только в runtime/tests: docs тоже должны быть актуализированы в том же work

## Где смотреть

- `src/replacer.ts`
- `src/index.ts`
- `docs/specs.md`
- `docs/specs_discovery_entrypoint.md`
- `__tests__/replacer.test.ts`
- `TestFilters/TestFilter/testfilter.txt`

## Комментарий по приоритету

Это стоит держать выше других мелких reporting/UX дефектов, потому что баг уже попадает в конечные filter rules и
создаёт лишний diff в PR.

## Требования AGENTS.md (после завершения)

- [ ] Обновить/добавить тесты в `__tests__/` для новой функциональности
- [ ] Задокументировать breaking changes (если есть)
- [ ] Проверить backward compatibility
- [ ] Обновить `README.md` или соответствующую спецификацию в `docs/`,
      если поведение изменилось
- [ ] Запустить `yarn build` для проверки сборки
- [ ] Запустить `yarn test` для проверки тестов
- [ ] Запустить `yarn lint` для проверки стиля кода
