# Session Handoff — 2026-05-29 — Versioning Scheme & Changelog

## What Was Done

### Versioning Infrastructure
- Inverted sync direction: `package.json` is now the single source of truth for version.
- Added SemVer validation (`^\d+\.\d+\.\d+$`) to `sync-version.js`.
- Created `sync-version.d.ts` TypeScript declarations.
- Added npm release scripts: `release:patch`, `release:minor`, `release:major`.
- Rewrote `__tests__/sync-version.test.ts` to import exported functions directly (removed `jest` unused import, fixed test structure).

### CHANGELOG
- Created `CHANGELOG.md` with Keep a Changelog structure.
- Reconstructed historical entries from git history mapped to old manual version numbers (1.0.0 → 1.1.50).
- Filled 1.1.51 entry from actual commit 68e4901 (`message: any` → `message: unknown`).
- Fixed chronological order to newest-first.

### Documentation
- Added **Versioning And Changelog** section to `AGENTS.md` with all rules (SemVer, changelog format, "Minor refinements" phrase, summary-first formatting).
- Added **Versioning** section to `README.md`.
- Added **Release Finalization** section (2.7) to `docs/specs.md`.

### Version Bump
- Bumped from `1.1.51\`` (corrupted) → `1.2.0` via `npm run release:minor`.

## Confirmed Runtime Facts

| Fact | Value |
|------|-------|
| Current version | `1.2.0` |
| Version source of truth | `package.json` |
| Sync direction | `package.json` → `src/index.ts` + `package-lock.json` |
| Validation regex | `^\d+\.\d+\.\d+$` |
| Release scripts | `release:patch`, `release:minor`, `release:major` |
| Version bump trigger | Only code changes (not docs/comments/lint/formatting) |
| Changelog update time | Only during chat finalization + handoff |
| Changelog format | Summary-first, human-readable technical prose |

## Decisions Made

1. **MAJOR** = breaking runtime/config/contract change.
2. **MINOR** = important non-breaking code change, new capability, materially changed behavior.
3. **PATCH** = bug fix or small code correction without contract break.
4. "Minor refinements" is the standard phrase for small non-bug code changes instead of "Minor fixes".
5. Changelog entries follow summary-first formatting (problem summary on line 1, user impact on line 2+).
6. No rigid punctuation templates — human-readable technical prose is preferred.
7. Docs-only, comment-only, lint-only, formatting-only changes do NOT bump version.

## Open TODO Files (not affected by this session)

Active open TODOs:
- `TODO_duplicate_domains_after_replacement.md`
- `TODO_redirects.md`
- `TODO_heuristic.md`
- `TODO_leading_zeros.md`
- `TODO_parked_domain.md`
- `TODO_same_pattern_watcher_isolation.md`
- `TODO_monitoring.md`
- `TODO_publish.md`
- `TODO_atomic_writes.md`
- `TODO_summary_reporting.md`
- `TODO_watchers_comments.md`
- `TODO_spec_runtime_drift.md`
- `TODO_artifact_link.md`
- `⏳TODO_code_audit_agents.md`
- `⏳TODO_plan.md`

## Tests & Build

- 403 tests passing, 0 failing.
- 0 lint errors, 14 pre-existing warnings.
- Build successful.

## Key Files

- `sync-version.js` — version sync tool
- `sync-version.d.ts` — TypeScript declarations
- `CHANGELOG.md` — changelog
- `__tests__/sync-version.test.ts` — version sync tests
- `AGENTS.md` — versioning rules for future agents
- `README.md` — versioning section
- `docs/specs.md` — Release Finalization spec section

## To Continue

The branch `feat/versioning-scheme-and-changelog` was already created. Changes are partly staged, partly unstaged. To commit and push, review the diff then:

```bash
git add -A
git commit -m "feat: introduce structured versioning workflow and changelog"
git push origin feat/versioning-scheme-and-changelog
# Then create PR on GitHub
```

The `feat/versioning-scheme-and-changelog` branch already exists; if creating a new branch from master instead, use `git checkout -b <new-branch-name> master`.
