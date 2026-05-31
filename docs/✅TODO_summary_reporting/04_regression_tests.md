# 04. Regression Tests

## Goal

Добавить регрессионное покрытие для split reporting и edge cases, найденных при code review.

## Подход

**Не нужно тестировать все 9 сценариев как отдельные интеграционные тесты** —
9-сценарная матрица из `02_summary_semantics.md` — это **документация**, а не тест-план.
Если `isRealDomainChange()` покрыт unit-тестами, из него выводятся все сценарии тривиально.

Достаточно:
1. **Unit**: `isRealDomainChange()` — все edge cases
2. **Integration**: `buildCommitMessage()` — 1 кейс с discovery-entrypoint
3. **Integration**: console summary — 1 кейс с проверкой категорий

## Unit-тесты `isRealDomainChange()`

Все тесты с mocked `originalLastKnownMirrors`:

- [x] discovery-entrypoint: `t.co → hdfilmcehennemi27.org`,
      `originalLastKnownMirror = hdfilmcehennemi27.org` → `false`
- [x] discovery-entrypoint: `voe.sx → rebeccacostthousand.com`,
      `originalLastKnownMirror = rebeccacostthousand.com` → `false`
- [x] real mirror change: `example001.com → example020.com`,
      `originalLastKnownMirror = example001.com` → `true`
- [x] redirect-source changed + mirror unchanged:
      `papazsports922.pro → papazsports1010.pro`,
      `originalLastKnownMirror = papazsports1010.pro` → `false`
- [x] redirect-source changed + mirror changed:
      `papazsports922.pro → papazsports1020.pro`,
      `originalLastKnownMirror = papazsports1010.pro` → `true`
- [x] backward compat: `originalLastKnownMirrors = undefined` → fallback на
      `fromHost !== newHost`

## Integration: `buildCommitMessage()`

- [x] Discovery-entrypoint + mirror unchanged (`t.co → hdfilmcehennemi27.org`,
      `originalLastKnownMirror = hdfilmcehennemi27.org`) → нет в `Mirror updates` секции
- [x] Real mirror change → есть в `Mirror updates`
- [x] Empty `originalLastKnownMirrors` (undefined) → fallback на старое поведение

## Integration: console summary

- [x] Проверить, что при `isRealDomainChange() === true` для replacement-а
      счётчик Mirror updates увеличивается
- [x] Проверить, что `patternDiffs.length` отражается в `Pattern list updates`
- [x] Проверить, что `pattern_changed` warning считается в `Pattern→non-pattern`

## Diff collection (из 03_replacer_pattern_diff.md)

- [x] force_search_ahead: два additional домена → all three in added
- [x] два watcher с одинаковым паттерном → diff раздельный
- [x] `oldHost` совпадает у двух watcher → diff раздельный

## Зависимости

Выполнять **после** этапов 01-03, чтобы утверждения соответствовали финальной семантике.
