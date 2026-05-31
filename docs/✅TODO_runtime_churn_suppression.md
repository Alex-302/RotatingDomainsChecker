# TODO: success_since Churn Suppression (force_search_ahead)

**Status:** ✅ DONE
**Created:** 2026-05-24
**Priority:** High
**Related:** `docs/✅TODO_domain_wrapper_expansion.md` (spin-off, separate TODO)

---

## Problem Summary

`success_since` перезаписывается при каждом запуске скрипта для сайтов с
`force_search_ahead=true`, даже когда effective state (список рабочих доменов,
`effectiveNewHost` из `selectFirstByOrder`, `last_known_mirror`) **не изменились**.

**Symptom**: в `watchers.yml` для dizipal2071.com поле `success_since` обновляется
от `23:36` → `23:44:21` → `23:44:36` при трёх последовательных прогонах без каких-либо
реальных изменений на стороне сайта.

---

## Observed Behavior

### Three Consecutive Runs (2026-05-24)

**Run 1 (23:36):**
```yaml
dizipal2071.com:
  last_known_mirror: dizipal2070.com
  success_since: 2026-05-24 23:36
```

**Run 2 (23:44:21):**
- Phase 1: GET `2070.com` → 301 → `2073.com` → **hostChanged=true**
- Force search: collected `[2070, 2071, 2073]`
- `effectiveNewHost = selectFirstByOrder(2073, [2070, 2071])` = **2070** (MIN номер)
- Save `last_known_mirror` = `2070` ← без изменений
- `updateSuccessSince(23:44)` вызван ← **BUG**

```yaml
dizipal2071.com:
  last_known_mirror: dizipal2070.com
  success_since: 2026-05-24 23:44      # ← перезаписался!
```

**Run 3 (23:44:36):**
- Тот же flow, те же данные
- `success_since: 2026-05-24 23:44` обновляется ещё раз

---

## Root Cause

### Location: `src/index.ts` ~строки 446-463 (ветка `shouldUpdate`)

```typescript
} else if (result.shouldUpdate) {
  // ...
  if (result.result.success) {
    // ...

    // State transition: domain actually changed → always update success_since.
    updateSuccessSince(site, nowFormatted);   // ← БЕЗУСЛОВНЫЙ вызов

    // ...
    site.last_known_mirror = effectiveNewHost;
    // ...
  }
}
```

**Проблема**: `shouldUpdate = true` триггерится по `hostChanged=true` (Phase 1
`startedHost !== finalHost`), но это НЕ значит, что effective state изменился.

### Почему `hostChanged=true` повторяется?

`last_known_mirror = 2070.com` — это **алиас**, который всегда редиректит на `2073.com`.
Фаза 1 каждый раз стартует с `2070.com` и получает редирект на `2073.com` → `hostChanged=true`.

Но `selectFirstByOrder` вычисляет `effectiveNewHost` как минимум из списка
`[2073 (primary), 2070, 2071]` → **2070** (тот же, что уже сохранён).

Цикл:
```
last_known_mirror = 2070 (сохранено)
        ↓
Phase 1: 2070 → 301 → 2073  (hostChanged=true)
        ↓
collect [2070, 2071, 2073]
        ↓
effectiveNewHost = min = 2070
        ↓
last_known_mirror = 2070 (SAVE, unchanged)
        ↓
updateSuccessSince(now)  ← SHOULD be skipped (no actual change)
        ↓
[next run]: repeat loop forever
```

### Семантический конфликт

По типу в `src/types.ts` (строки 97-100):
> Only updated on **actual state transitions** (domain change, exit from failure, new phase).
> **Repeated identical success without state change does NOT rewrite this field.**

Но в `shouldUpdate` ветке код НЕ соблюдает этот контракт.

---

## Proposed Fix

Добавить guard: обновлять `success_since` только если `effectiveNewHost` **отличается**
от предыдущего `last_known_mirror` (real state transition).

### Location: `src/index.ts` ~строка 462

**Текущий код**:
```typescript
// State transition: domain actually changed → always update success_since.
updateSuccessSince(site, nowFormatted);
```

**Станет**:
```typescript
// State transition: domain actually changed → update success_since.
// Suppress churn when effectiveNewHost equals the previous last_known_mirror
// (e.g., force_search_ahead scenario where alias redirects to higher-numbered
// domain but selectFirstByOrder picks the same alias as canonical).
if (effectiveNewHost !== oldLastKnownMirror) {
  updateSuccessSince(site, nowFormatted);
}
```

`oldLastKnownMirror` уже доступен в scope — устанавливается перед блоком
`getReplacementSources(...)` (строка ~441).

---

## Current Behavior (Before Fix)

По коду `src/index.ts` (строки 353, 420, 462, 501), `success_since` сейчас обновляется при:

| Сценарий | Место в коде | Обновляется | Корректно? |
|----------|-------------|------------|-----------|
| Анти-бот детект (antibotAccepted branch) | ~353 | Всегда при `antibotActuallyChanged` или prior failure | ✅ |
| `shouldUpdate` + success | ~462 | **Всегда (без проверки)** | ❌ churn |
| `shouldUpdate=false` + success + prior failure | ~501 | При `hadFailureBeforeThisRun.get(...)` | ✅ exit-from-failure |
| Pattern → non-pattern phase | другие места | — | (не рассматривалось) |

**Только** случай `shouldUpdate + success + effective state unchanged` создаёт
проблему. Это и есть dizipal сценарий.

---

## Answer to User Question (2026-05-24)

> **Q**: Если список найденных доменов или `last_known_mirror` не изменились, то
> `success_since` не меняется?

**A (expected per type contract):** ДА — если список рабочих доменов и
`last_known_mirror` не изменились, `success_since` ДОЛЖЕН оставаться неизменным.

**A (current runtime behavior):** НЕТ — для сайтов с `force_search_ahead=true` +
алиас-редиректом (dizipal кейс), `success_since` перезаписывается при каждом run.
Это баг, который надо фиксить (Proposed Fix ↑).

После фикса `success_since` будет обновляться **только** при:
1. Реальном изменении `effectiveNewHost` (новый canonical домен)
2. Изменении списка рабочих доменов (новые `additionalWorkingDomains`)
3. Выходе из failure state (`failed_since`, `failed_days`, `potentially_dead` были set)
4. Переходе на non-pattern phase

---

## Action Items

### Phase 1: Apply Guard Fix

- [x] Прочитать `src/index.ts` строки 430-470 (shouldUpdate success branch)
- [x] Применить fix с guard `effectiveNewHost !== oldLastKnownMirror`
- [x] Проверить, что `oldLastKnownMirror` в scope и корректно объявлен
- [x] Запустить `yarn build`

### Phase 2: Add Tests

- [x] Прочитать `__tests__/index.test.ts` секция 11.4/11.5 (existing state semantics)
- [x] Добавить тест: "repeated identical run does NOT update success_since"
  - Setup: `last_known_mirror = example001.com`, `success_since = '2026-05-24 12:00'`
  - Mock: Phase 1 редирект 001 → 003, force_search [001, 002, 003]
  - Expected: `success_since` останется `'2026-05-24 12:00'`
- [x] Добавить тест: "real domain change DOES update success_since" (regression)
  - Setup: `last_known_mirror = example001.com`
  - Mock: actual change to `example005.com`
  - Expected: `success_since` обновится на `nowFormatted`
- [x] Запустить `yarn test`

### Phase 3: Verify with Live Test

- [x] Запустить `npm run test_live` дважды с разницей в минуту
- [x] Проверить `watchers.yml`: `success_since` для dizipal2071.com НЕ должен прыгать
- [x] Проверить: другие сайты в `watchers.yml` без регрессий

### Phase 4: Documentation

- [x] Обновить `docs/specs.md` если контракт `success_since` официально изменился/уточнился
- [x] Обновить `README.md` если поведение user-facing
- [x] Проверить, что types.ts строки 97-100 теперь соответствуют runtime

---

## Test Case Sketch

```typescript
test('success_since not updated on identical repeated run (force_search_ahead)', async () => {
  const site = makeSite({
    last_known_mirror: 'example001.com',
    success_since: '2026-05-24 12:00',
    force_search_ahead: true,
  });

  // Mock: Phase 1 alias 001 redirects to 003, force_search finds [001, 002, 003]
  // effectiveNewHost = selectFirstByOrder(003, [001, 002]) = 001 (unchanged)
  const result = makeResult({
    shouldUpdate: true,            // yes, hostChanged=true from Phase 1
    hostChanged: true,             // 001 → 003 (redirect)
    startedHost: 'example001.com',
    newHost: 'example003.com',     // redirect final
    additionalWorkingDomains: ['example001.com', 'example002.com'],
  });

  await processSite(site, result);

  expect(site.success_since).toBe('2026-05-24 12:00');  // UNCHANGED
  expect(site.last_known_mirror).toBe('example001.com'); // unchanged
});

test('success_since DOES update on real domain change (regression)', async () => {
  const site = makeSite({
    last_known_mirror: 'example001.com',
    success_since: '2026-05-24 12:00',
  });

  const result = makeResult({
    shouldUpdate: true,
    hostChanged: true,
    startedHost: 'example001.com',
    newHost: 'example005.com',   // actual change
  });

  await processSite(site, result);

  expect(site.success_since).not.toBe('2026-05-24 12:00'); // changed
  expect(site.success_since).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
});
```

---

## Verification Checklist

- [x] `yarn build` passes
- [x] `yarn test` passes (all existing + 2 new tests)
- [x] `npm run test_live` on dizipal2071.com: `success_since` stable across 2 runs
- [x] No regression: real domain changes still update `success_since`
- [x] No regression: exit-from-failure still updates `success_since`
- [x] Documentation updated if behavior changed

---

## Related Files

- `src/index.ts` (success_since update logic, строки 353, 420, 462, 501)
- `src/types.ts` (success_since contract в JSDoc, строки 97-100)
- `__tests__/index.test.ts` (existing state semantics в секциях 11.4/11.5)
- `watchers.yml` (verify stability post-fix)
- `docs/specs.md` (contract update if needed)

---

**Last Updated:** 2026-05-24 (narrowed scope: only success_since churn; $domain extraction into separate TODO)
