# Session Handoff 2026-05-24

## Completed Work

### `non_pattern_mirror` Runtime Implementation

**Issue:** Pattern → non-pattern transition was silently overwriting `last_known_mirror` with non-pattern domains, creating semantic inconsistency between watcher state and filter rules.

**Original Case (from 2026-05-22 handoff):**
- Watcher: `dizipal2040.com` (now appears as `dizipal2071.com` in watchers.yml)
- Bug: `last_known_mirror` was set to non-pattern `dizipal2.com.tr`
- Filter rules remained on numeric mirrors around `dizipal2072.com`
- Result: state said "non-pattern" but filters still pointed to pattern family

**Solution Implemented:**
1. Added `non_pattern_mirror?: string` field to `WatcherSite` type
2. Updated `updateDomainHistory()` in `src/batch.ts`:
   - Sets `site.non_pattern_mirror` when switching to non-pattern
   - Clears `site.non_pattern_mirror` and `site.pattern_changed` when returning to pattern
3. Fixed `isHeuristicNonPattern` branch in `src/index.ts`:
   - Stores non-pattern canonical in `site.non_pattern_mirror`
   - **Does NOT overwrite** `last_known_mirror` — preserves last pattern domain
   - Filter files NOT updated during non-pattern phase

**Files Changed:**
- `src/types.ts` — added field
- `src/batch.ts` — updated `updateDomainHistory()`
- `src/index.ts` — fixed `isHeuristicNonPattern` branch
- `__tests__/batch-history.test.ts` — added `non_pattern_mirror` assertions
- `README.md` — documented fields
- `docs/specs.md` — comprehensive documentation
- `docs/TODO.md` — marked task completed
- `docs/TODO_non_pattern_mirror_runtime.md` — all subtasks completed

**Validation:**
- ✅ `yarn build` — success
- ✅ `yarn test` — 369 tests pass (11 suites)
- ✅ `yarn lint` — 0 errors (only pre-existing warnings)
- ✅ `npm run test_live` — success

**Backward Compatibility:**
- `non_pattern_mirror` is optional field
- Existing watchers without it continue working
- Field only set on pattern → non-pattern transition
- Filter replacement logic unchanged for pattern → pattern rotations

**Branch & Commit:**
- Branch: `fix/non-pattern-mirror-runtime`
- Commit: `fix(batch): preserve last_known_mirror on pattern→non-pattern transition`

## Confirmed Runtime Facts

- ✅ `non_pattern_mirror` now fully implemented and tested
- `last_known_mirror` no longer overwritten by non-pattern domains
- Filter rules correctly stay on pattern anchor until new pattern domain found
- `force_search_ahead` still pre-populates Phase 1 with `r.newHost` (final host), not current alias / `startedHost` — this can drop still-working current alias (e.g., `dizipal2065.com`)
- Duplicate domains after replacement still possible — unconditional final deduplication not applied in `processDomainList()`

## Current Target Behavior

- ✅ Non-pattern transition now has stable supported runtime contract
- ✅ `last_known_mirror` preserved as pattern anchor
- ✅ Non-pattern success stored in `non_pattern_mirror`
- ✅ Filter rules unchanged until return to pattern domain
- Documentation updated in same work as implementation

## Open Questions (inherited)

- Should `force_search_ahead` always retain current working alias if it redirects to shared final host?
- Should canonical selection be based on candidate aliases or only on final redirect hosts in mixed alias/final-host cases?
- Should `www` be canonicalized away, or should form returned by redirect chain be preserved?
- When duplicate domains are removed, should `www` and non-`www` always be treated as same final token?

## Active TODO Files

- `docs/TODO_force_search_ahead_current_alias_loss.md` (high priority)
- `docs/TODO_duplicate_domains_after_replacement.md` (high priority)
- `docs/✅TODO_heuristic_alias_canonicalization.md`
- `docs/TODO_spec_alignment.md`

**Completed:**
- ~~`docs/TODO_non_pattern_mirror_runtime.md`~~ (DONE 2026-05-24)

## Key Files

- `src/batch.ts` — `updateDomainHistory()` manages `non_pattern_mirror`
- `src/index.ts` — `isHeuristicNonPattern` branch preserves `last_known_mirror`
- `src/types.ts` — `non_pattern_mirror` field defined
- `src/replacer.ts` — unchanged, continues working from pattern anchor
- `__tests__/batch-history.test.ts` — comprehensive coverage
- `docs/specs.md` — `non_pattern_mirror` behavior documented
- `README.md` — runtime fields documented
- `watchers.yml` — current state (dizipal2071.com with last_known_mirror: dizipal2073.com)

## Repro Cases (inherited)

- ✅ `dizipal2040.com` / `dizipal2071.com`: pattern → non-pattern transition now handled correctly
- `dizipal2065.com`: current working alias can disappear from final filter lists (Phase 1 collects only final host, heuristic starts from `+1`)
- `woe.sx`: replacement can produce duplicate domains in single filter rule

## Useful Commands

- `npm run test_live`
- `yarn build`
- `yarn test`
- `yarn lint`

## Current Stop Point

- `non_pattern_mirror` runtime semantic fully implemented, tested, and documented
- All 369 tests pass, build succeeds, lint clean
- Ready to commit and merge
- Next implementation work can continue with:
  1. `TODO_force_search_ahead_current_alias_loss.md` (retain current alias in `force_search_ahead`)
  2. `TODO_duplicate_domains_after_replacement.md` (add final deduplication)
  3. Any other high-priority TODO
