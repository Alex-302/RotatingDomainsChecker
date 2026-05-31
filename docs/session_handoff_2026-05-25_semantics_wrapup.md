# Session Handoff 2026-05-25 - semantics wrap-up

## Confirmed runtime facts

- `src/index.ts` uses pattern-aware canonical selection via `selectPatternAwareWorkingSet(...)` in both normal-success
  and antibot-accepted branches.
- Mixed pattern/non-pattern `force_search_ahead` sets keep pattern mode when at least one live pattern domain exists.
- `success_since` no longer rewrites on repeated identical successful runs without effective state change.
- `success_since` is deleted on success -> failed transition in the failure branches.
- Single-domain wrapper `[$domain=old.com]` is routed through the shared domain-list pipeline in `src/replacer.ts`.
- Current replacer cleanup still groups predicted mirrors by numeric pattern family, not by watcher identity.

## Current target behavior / decisions

- Canonical mirror for `many candidates -> one final host` is the smallest reachable pattern alias, not necessarily the
  shared final redirect host.
- Non-pattern tokens discovered alongside live pattern mirrors must not overwrite `last_known_mirror` and must not
  enter replacement rules for that pattern watcher.
- Closed TODO files were renamed with `✅TODO_*.md` prefix and synced in `docs/TODO.md`.
- Test fixtures and spec examples were cleaned up to use fictional/example-like domains instead of real domains.

## Open questions

- `TODO_same_pattern_watcher_isolation.md`: same numeric pattern across different real sites/clones is still open.
  Example risk class: `dizipal2045.com` and `dizipal1545.com` can currently be treated as one family by replacer
  cleanup if watcher-scoped isolation is not introduced.
- There may still be older handoff/notes files referencing pre-rename TODO filenames; runtime/docs contract files are
  already synced, but auxiliary historical notes were not exhaustively normalized.

## Active backlog / TODOs to continue from

- `docs/TODO_same_pattern_watcher_isolation.md`
- `docs/TODO_duplicate_domains_after_replacement.md`
- `docs/TODO_spec_runtime_drift.md`
- `docs/TODO_watchers_comments.md`
- `docs/TODO_summary_reporting.md`

## Key files

- `src/index.ts`
- `src/replacer.ts`
- `src/batch.ts`
- `README.md`
- `docs/specs.md`
- `docs/TODO.md`
- `docs/✅TODO_semantics.md`
- `docs/TODO_same_pattern_watcher_isolation.md`

## Useful validation / repro commands

- `yarn test`
- `yarn build`
- `yarn lint`
- `npm run test_live`

## Repro / reasoning note for next chat

- If a user asks whether lower-numbered stale domains like `dizipal2045.com` should survive when current
  `last_known_mirror` is `dizipal2050.com`, the current answer is: no special protection exists for lower numbers.
  Survival depends on membership in the watcher's current keep set (`last_known_mirror`, `initial_domain`,
  `workingDomains`), not on numeric ordering alone.