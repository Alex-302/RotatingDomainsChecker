# Session Handoff 2026-05-22

## Confirmed Runtime Facts

- `non_pattern_mirror` is documented but not implemented as a real runtime field
- Current runtime can promote a non-pattern canonical domain into `last_known_mirror` without exposing separate
  `non_pattern_mirror` state
- In the `dizipal2040.com` case, `watchers.yml` was updated to `last_known_mirror: dizipal2.com.tr` while filter rules
  remained on numeric mirrors around `dizipal2072.com`
- `force_search_ahead` currently pre-populates Phase 1 collected domains with `r.newHost` (final host), not the
  current alias / `startedHost`
- Heuristic candidate generation currently starts from `currentNum + 1`
- This combination can drop a still-working current alias such as `dizipal2065.com` from final filter domain lists
- Duplicate domains after replacement are still possible because unconditional final deduplication is not applied in
  `processDomainList()`

## Current Target Behavior

- Non-pattern transition should not be treated as a stable supported runtime contract yet
- Target direction under discussion: keep `last_known_mirror` as the last pattern anchor, store non-pattern success in
  `non_pattern_mirror`, and leave filter rules unchanged until return to a new pattern domain
- Documentation should be updated in the same work whenever bug fixes or semantic clarifications change the contract

## Open Questions

- Should `force_search_ahead` always retain the current working alias if it redirects to a shared final host?
- Should canonical selection be based on candidate aliases or only on final redirect hosts in mixed alias/final-host
  cases?
- Should `www` be canonicalized away, or should the form returned by the redirect chain be preserved?
- When duplicate domains are removed, should `www` and non-`www` always be treated as the same final token?

## Active TODO Files

- `docs/TODO_non_pattern_mirror_runtime.md`
- `docs/TODO_force_search_ahead_current_alias_loss.md`
- `docs/TODO_duplicate_domains_after_replacement.md`
- `docs/✅TODO_heuristic_alias_canonicalization.md`
- `docs/TODO_spec_alignment.md`

## Key Files

- `src/batch.ts`
- `src/index.ts`
- `src/replacer.ts`
- `src/types.ts`
- `docs/specs.md`
- `README.md`
- `watchers.yml`
- `TestFilters/TestFilter/testfilter.txt`

## Repro Cases

- `dizipal2040.com`: `force_search_ahead + accept_antibot` can produce numeric filter lists while watcher state moves
  to non-pattern canonical `dizipal2.com.tr`
- `dizipal2065.com`: current working alias can disappear from final filter lists because Phase 1 collects only final
  host and heuristic starts from `+1`
- `woe.sx`: replacement can produce duplicate domains in a single filter rule

## Useful Commands

- `npm run test_live`
- `yarn build`
- `yarn test`

## Current Stop Point

- Session handoff workflow is now documented in `AGENTS.md`
- `AGENTS.md` now also requires updating the current handoff when the user explicitly says the work is wrapping up or
  moving to a later chat
- No runtime/code fixes were implemented after this handoff workflow work; latest changes in this tail step were
  documentation/process only
- The next implementation work can start directly from one of the high-priority TODO files without reconstructing the
  earlier chat history

## Session 2026-05-23 (continuation)

### Changes
- Added JSDoc documentation for uBO body forms (`##^...`, `#@#^...`, `##+js(...)`, `#@#+js(...)`) in `src/replacer.ts`
  next to `COSMETIC_MARKERS` to make it explicit that these are body forms processed after marker detection, not
  separate markers in the list
- Build and tests pass (`yarn build` + `yarn test`)

### Open Questions
- (inherited from previous session)

### Active TODO Files
- `docs/TODO_blocker_syntax_coverage.md` (documentation clarification completed; full implementation remains)
- `docs/TODO_non_pattern_mirror_runtime.md`
- `docs/TODO_force_search_ahead_current_alias_loss.md`
- `docs/TODO_duplicate_domains_after_replacement.md`
- `docs/✅TODO_heuristic_alias_canonicalization.md`
- `docs/TODO_spec_alignment.md`

### Current Stop Point
- Cosmetic markers documentation now explicitly covers uBO body forms in code
- Full blocker syntax coverage (TODO_blocker_syntax_coverage) remains open
- Ready to continue with any TODO item or new request

## Session 2026-05-23 (completion)

### Changes
- **Integration test**: Fixed failing integration test (`__tests__/replacer.test.ts` section 6) — added missing wrapper
  syntax lines (`[$domain=...]`) to the fixture content array
- **TODO_blocker_syntax_coverage.md**: All phases (Этап 1–5), all steps (1–8), Definition of Done, and AGENTS.md
  requirements marked as ✅ completed
- **Validation**: `yarn build` ✅, `yarn test` ✅ (369 tests, 11 suites), `yarn lint` ✅ (0 errors)

### Final State
- `TODO_blocker_syntax_coverage.md`: **ALL COMPLETE** — all code, tests, docs, and validation done
- All 149 replacer tests pass (including new integration test)
- Full test suite: 369 tests across 11 files, all passing
- Build produces valid dist/index.js (675KB)
