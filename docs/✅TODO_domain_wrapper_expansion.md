# TODO: $domain Wrapper Single-Domain Expansion

**Status:** ✅ DONE
**Created:** 2026-05-24
**Priority:** Medium
**Split from:** `✅TODO_runtime_churn_and_domain_wrapper.md` (split on 2026-05-24)

---

## Problem Statement

Фильтровое правило с одним доменом внутри `[$domain=...]##rule` **не расширяется**
дополнительными рабочими доменами из `additionalDomainsMap`, в отличие от:

- `domain1,domain2##rule` (comma-list) ✅ расширяется
- `[$domain=x|y|z]##rule` (pipe-list) ✅ расширяется
- `[$domain=old.com]##rule` (single domain) ❌ остаётся одиночным

## Observed Behavior

**Input** (до запуска скрипта):
```
[$domain=dizipal2070.com]##.header-banner
dizipal2070.com,dizipal2073.com,dizipal2071.com##.video-wrapper
```

**Output** (после Run с `additionalDomainsMap = {2070 → [2071, 2073]}`):
```
[$domain=dizipal2070.com]##.header-banner                     ← unchanged (BUG)
dizipal2070.com,dizipal2073.com,dizipal2071.com##.video-wrapper   ← updated ✅
```

**Expected Output**:
```
[$domain=dizipal2070.com|dizipal2071.com|dizipal2073.com]##.header-banner
dizipal2070.com,dizipal2073.com,dizipal2071.com##.video-wrapper
```

## Comparison of Wrapper/Rule Parsing Paths

| Синтаксис | Location (`replacer.ts`) | `additionalDomainsMap` usage |
|-----------|-------------------------|------------------------------|
| `old1.com,old2.com##rule` | строки 667-680 (hash-based marker) | ✅ через `processDomainList` |
| `[$domain=x\|y\|z]##rule` | строки 653-656 | ✅ через `processDomainList` |
| **`[$domain=old.com]##rule`** | **строки 659-663** | ❌ **пропущен, только `replaceDomain`** |
| `$$` / `$@$` | строки 679-691 | ✅ через `processDomainList` |
| `$param=x\|y` (trailing) | строки 714+ | ✅ через `processDomainList` |

**Note**: `||old.com^` (URL правила) намеренно НЕ включены в этот TODO — для URL
правил поддерживаются wildcard-синтаксис в любом месте (например, `||*old*.com^`),
и замена конкретных доменов там не является приоритетом.

## Root Cause

**Location**: `src/replacer.ts` строки 659-663

```typescript
} else {
  // SINGLE domain path — no additionalDomainsMap expansion
  const r = replaceDomain(pv, hostMap, initialToLastKnownMap);
  if (r !== pv) return ["[" + pn + "=" + r + "]" + rest];
}
```

Проблема: `replaceDomain` делает только 1:1 mapping через `hostMap`/`initialToLastKnownMap`.
Он не знает про `additionalDomainsMap`.

Причина, по которой другие пути работают: они все используют `processDomainList`, который
на шаге 5 применяет `additionalDomainsMap` (см. `replacer.ts:455+`).

## Proposed Fix

Заменить single-domain path на расширение через pipe-list, когда есть extras:

```typescript
} else {
  const replaced = replaceDomain(pv, hostMap, initialToLastKnownMap);
  const key = normalizeDomain(replaced);
  const extras = additionalDomainsMap.get(key);

  if (extras && extras.length > 0) {
    // Expand to pipe-list using deduplicateDomains (used by comma-list path)
    const expanded = deduplicateDomains([replaced, ...extras]);
    return ["[" + pn + "=" + expanded.join("|") + "]" + rest];
  }
  // No extras — only return changed line if the replacement actually changed
  if (replaced !== pv) {
    return ["[" + pn + "=" + replaced + "]" + rest];
  }
}
```

**Почему `deduplicateDomains`**: уже используется в `processDomainList` (строка ~447) и в
comma-list пути для нормализации; здесь нужен тот же dedupe-эффект (если `replaced` уже
присутствует в extras, не дублировать через `|`).

## Test Cases to Add

В `__tests__/replacer.test.ts`:

### TC1: Single domain expands to pipe-list
```typescript
test('[$domain=old.com]##rule expands with additional domains', () => {
  const line = '[$domain=example001.com]##.banner';
  const hostMap = new Map([['example001.com', 'example001.com']]);
  const additionalDomainsMap = new Map([
    [normalizeDomain('example001.com'), ['example002.com', 'example003.com']]
  ]);

  const result = callReplaceLogic(line, hostMap, additionalDomainsMap);
  expect(result).toEqual([
    '[$domain=example001.com|example002.com|example003.com]##.banner'
  ]);
});
```

### TC2: Regression — existing pipe-list still works
```typescript
test('[$domain=x|y|z]##rule pipe-list unchanged (regression)', () => {
  const line = '[$domain=example001.com|example002.com|example003.com]##.banner';
  const hostMap = new Map();
  const additionalDomainsMap = new Map();

  const result = callReplaceLogic(line, hostMap, additionalDomainsMap);
  expect(result).toEqual([line]); // unchanged
});
```

### TC3: Single domain, no extras — no change
```typescript
test('[$domain=old.com]##rule without extras stays unchanged', () => {
  const line = '[$domain=example001.com]##.banner';
  const hostMap = new Map();
  const additionalDomainsMap = new Map();

  const result = callReplaceLogic(line, hostMap, additionalDomainsMap);
  expect(result).toEqual([line]);
});
```

### TC4: Single domain replaced + extras added - уточнить по спекам - non-parrter=>pattent
```typescript
test('[$domain=old.com]##rule: old replaced AND extras added', () => {
  const line = '[$domain=old.com]##.banner';
  const hostMap = new Map([['old.com', 'example001.com']]);
  const additionalDomainsMap = new Map([
    ['example001.com', ['example002.com', 'example003.com']]
  ]);

  const result = callReplaceLogic(line, hostMap, additionalDomainsMap);
  expect(result).toEqual([
    '[$domain=example001.com|example002.com|example003.com]##.banner'
  ]);
});
```

## Action Items

- [x] Прочитать `src/replacer.ts:643-664` (wrapper syntax path)
- [x] Применить фикс через общий `processDomainList` pipeline
- [x] Добавить regression tests в `__tests__/replacer.test.ts`
- [x] Убедиться, что `yarn build` и `yarn test` проходят
- [x] Обновить `docs/specs.md` если это изменение зафиксировано как контракт
- [x] Прогнать `npm run test_live` на dizipal2071.com и проверить
  `TestFilters/TestFilter/testfilter.txt` для строки `[$domain=dizipal2070.com]##.header-banner`

## Verification Checklist

- [x] `yarn build` passes
- [x] `yarn test` passes (все existing + новые)
- [x] Test live: `[$domain=dizipal2070.com]##.header-banner` → expansion via the shared domain-list pipeline
- [x] Regex/pipe-list rules НЕ регрессируют

## Related Files

- `src/replacer.ts` (строки 643-664 — wrapper syntax path)
- `__tests__/replacer.test.ts` (добавить новые тесты)
- `docs/specs.md` (если поведение контракта изменилось)
- `TestFilters/TestFilter/testfilter.txt` (live проверка)

---

**Last Updated:** 2026-05-24 (created as separate TODO, spin-off from churn fix)
