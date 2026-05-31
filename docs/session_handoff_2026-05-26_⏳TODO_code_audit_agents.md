# Session Handoff 2026-05-26 - code audit normalization

## Confirmed facts

- `docs/TODO.md` and TODO filenames were normalized to match AGENTS.md status rules.
- `docs/⏳TODO_code_audit_agents.md` remains in progress because two actionable items are still open.
- `src/replacer.ts` still reads the whole filter file into memory and splits it into lines.
- `src/config.ts` still uses synchronous file I/O.
- `src/diagnostics.ts` now uses `message: unknown`; `subscriptions: any[]` remains as an accepted local exception.

## Current target behavior / decisions

- Keep `⏳TODO_code_audit_agents.md` open until streaming in `src/replacer.ts` and async config loading are either
  implemented or explicitly moved to another TODO.
- Treat `diagnostics.ts` `subscriptions: any[]` as a documented exception unless a safe typed unsubscribe pattern is
  found without reintroducing test teardown issues.

## Open questions

- Whether to complete the remaining low-priority code-audit items in the same TODO or split them into a dedicated
  follow-up performance/IO TODO.

## Active TODOs

- `docs/⏳TODO_code_audit_agents.md`
- `docs/TODO_same_pattern_watcher_isolation.md`
- `docs/TODO_duplicate_domains_after_replacement.md`
- `docs/TODO_watchers_comments.md`

## Key files

- `docs/TODO.md`
- `docs/⏳TODO_code_audit_agents.md`
- `src/replacer.ts`
- `src/config.ts`
- `src/diagnostics.ts`

## Useful commands

- `yarn build`
- `yarn test`
- `yarn lint`
