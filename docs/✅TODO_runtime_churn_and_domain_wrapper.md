# TODO: Runtime Churn & $domain Wrapper Coverage

**Status:** ✅ DONE
**Created:** 2026-05-24
**Completed:** 2026-05-25
**Priority:** High

---

## Problem Summary

Three related runtime issues discovered during `npm run test_live` runs (23:44:21 + 23:44:36 on dizipal2071.com):

1. **success_since churn**: `success_since` updates on every run for dizipal even when state is unchanged ✅ **FIXED**
2. **[$domain=...] with single domain not expanded**: `[$domain=dizipal2070.com]##rule` does not expand to `[$domain=dizipal2070.com|dizipal2071.com|dizipal2073.com]##rule` ✅ **FIXED** (split to `✅TODO_domain_wrapper_expansion.md`)
3. **Root cause of #1**: `last_known_mirror` stores alias (dizipal2070.com) that always redirects to another domain (2073.com), causing `hostChanged=true` on every run → perpetual cycle ⚠️ **DEFERRED** (minimal fix sufficient)

---

## Implementation Summary

### Phase 1: success_since Churn (Issue 1) ✅

**Change**: `src/index.ts` line ~481

Added guard in `shouldUpdate` branch:
```typescript
if (effectiveNewHost !== oldLastKnownMirror) {
  updateSuccessSince(site, nowFormatted);
}
```

**Why**: Previously called unconditionally when `hostChanged=true`. In force_search_ahead scenarios, `hostChanged` comes from Phase 1 alias redirect (e.g., 2070→2073), but `selectFirstByOrder` picks back the same `last_known_mirror` (2070). Without guard, `success_since` rewrote on every run.

**Tests**: Added 2 tests in `__tests__/index.test.ts` section 11.6:
- `force_search_ahead: effectiveNewHost === oldLastKnownMirror does NOT update success_since`
- `actual domain change DOES update success_since`

**Verification**: Consecutive `npm run test_live` runs show watchers.yml unchanged ✓

---

### Phase 2: $domain Single Expansion (Issue 2) ✅

**Split to**: [`✅TODO_domain_wrapper_expansion.md`](✅TODO_domain_wrapper_expansion.md)

**Change**: `src/replacer.ts` lines 658-689

Improved single-domain wrapper expansion to handle two cases:
- **(a)** Wrapped domain is primary key in `additionalDomainsMap` → use its extras
- **(b)** Wrapped domain is an extra in another key's list → scan all entries, use primary + all extras

**Why**: Original fix only handled case (a). In dizipal scenario, `additionalDomainsMap` key was `dizipal2069.com` (primary), but filter rule had `[$domain=dizipal2070.com]` (an extra). Expansion failed until case (b) was added.

**Tests**: Added 3 tests in `__tests__/replacer.test.ts` section 2.17:
- `[$domain=...] wrapper: single domain expands via additionalDomainsMap`
- `[$domain=...] wrapper: single domain replaces AND expands when new host differs`
- `[$domain=...] wrapper: pipe-list still works with additionalDomainsMap (regression)`

**Verification**: `[$domain=dizipal2070.com]##.header-banner` → `[$domain=dizipal2069.com|dizipal2073.com|dizipal2070.com]##.header-banner` ✓

---

### Issue 3: last_known_mirror Semantics (Deferred)

**Decision**: Deferred indefinitely. The guard in Phase 1 (Issue 1) eliminates the symptom (success_since churn). Changing `last_known_mirror` to store final redirect host instead of alias would require deeper semantic changes and could break other logic. Not needed unless other problems emerge.

---

## Phase 3: success_since Cleanup on Failure (2026-05-25) ✅

**Problem**: When a site transitions from success → failed state (no working mirror found), `success_since` was not deleted. This created semantic conflict: both `success_since` and `failed_since` coexisted in watchers.yml.

**Example** (Turkifsaclub):
```yaml
last_known_mirror: turkifsaclub136.sbs
success_since: "2026-05-24 23:44"  # ❌ Should not exist in failed state
failed_since: "2026-05-25 00:34"
failed_days: 0
potentially_dead: true
```

**Root Cause**: In `src/index.ts` failure branches (lines ~320 and ~510), the code set `failed_since`, `failed_days`, `potentially_dead` but never deleted `success_since`.

**Fix**: Added `delete site.success_since` in both failure branches:
- Real failure (line ~335): after setting `potentially_dead = true`
- Pattern-change failure (line ~520): after setting `potentially_dead = true`

**Rationale** (from specs.md):
- `success_since` — "marks the moment the current continuous **successful** state began"
- `failed_since` — "stores the moment the current continuous **failure** series began"
- Semantically mutually exclusive: a site is either in success or failed state, not both

**Code Changes**:

`src/index.ts` (real failure, ~line 335):
```typescript
site.potentially_dead = true;
// State transition: success → failed. Remove success_since to keep failed state clean.
// When site recovers, success_since will be set again in success branches.
delete site.success_since;
```

`src/index.ts` (pattern-change failure, ~line 520):
```typescript
site.potentially_dead = true;
// State transition: success → failed. Remove success_since to keep failed state clean.
delete site.success_since;
```

**Tests**: Added 3 tests in `__tests__/index.test.ts` section 11.7:
- `real failure deletes success_since (success → failed state)`
- `pattern-change failure deletes success_since`
- `recovery: failed → success sets new success_since`

**Spec Update**: Updated `docs/specs.md`:
- Section 392: Added "Removed" clause to `success_since` description
- Section 8.3: Added `delete success_since` to failure pseudocode

**Test Results**:
```
Test Suites: 11 passed, 11 total
Tests:       388 passed, 388 total (385 previous + 3 new)
```

---

## Test Results

### Unit Tests
```
Test Suites: 11 passed, 11 total
Tests:       385 passed, 385 total (383 existing + 2 new Phase 1 tests)
```

### Live Verification
```bash
# Consecutive runs
npm run test_live  # Run 1
npm run test_live  # Run 2
```

**watchers.yml**: IDENTICAL between runs ✓
**TestFilter expansion**: `[$domain=dizipal2069.com|dizipal2073.com|dizipal2070.com]##.header-banner` ✓

---

## Related TODOs

- [`✅TODO_domain_wrapper_expansion.md`](✅TODO_domain_wrapper_expansion.md) — Detailed $domain expansion specification (split from Phase 2)
