# Session Handoff 2026-05-28 - versioning workflow

## Confirmed facts

- Versioning now uses SemVer-style classification with `package.json` as the single source of truth.
- `sync-version.js` validates SemVer and syncs `src/index.ts` plus `package-lock.json` from `package.json`.
- Current finalized version is `1.2.0`.
- Changelog tracking baseline remains `1.1.51`; the versioning workflow itself was released as `1.2.0`.

## Current target behavior / decisions

- Bump version only for code changes.
- Skip version bumps for docs-only, comment-only, lint-only, formatting-only, and similar non-runtime changes.
- Perform version bump and changelog update only in the chat finalization step, together with handoff update.
- Use `release:patch`, `release:minor`, or `release:major` scripts to classify completed work.

## Open questions

- None currently.

## Active TODOs

- None created for versioning workflow.

## Key files

- `package.json`
- `sync-version.js`
- `src/index.ts`
- `CHANGELOG.md`
- `README.md`
- `AGENTS.md`

## Useful commands

- `npm run release:patch`
- `npm run release:minor`
- `npm run release:major`
- `yarn build`
- `yarn test`
- `yarn lint`