# Changelog

This project follows Keep a Changelog structure with SemVer-oriented release numbers.

## [1.4.1] - 2026-06-08

### Fixed

- Phase 2 antibot handler could overwrite a successful Phase 1 result when `force_search_ahead`
  is enabled and both Phase 1 and heuristic candidates return antibot accepted. The handler now
  checks whether the site was already resolved from Phase 1 before overwriting the primary result.
  Prevents LKM regression (e.g., 1015 → 1016 pattern) when the original mirror (1015) is alive through the gateway
  but not directly reachable from the checking environment due to geo-blocking.

## [1.4.0] - 2026-06-02

### Added

- Shared `isRealDomainChange()` predicate in `src/utils.ts` that unifies mirror-change
  detection across all reporting layers. Uses pre-run `last_known_mirror` instead of
  `startedHost`, so discovery-entrypoint and redirect-only scenarios no longer produce
  false "mirror update" noise.
- Split summary reporting into three semantic sections:
  `🔄 Watchers with active mirror changed`, `📋 Watchers with filter mirror list changed`,
  and `🚩 Pattern→non-pattern`. Console and PR/commit outputs are now watcher-oriented
  with consistent wording.
- Per-watcher pattern-domain diff collection in `applyReplacements()`: displays added
  and removed domains alongside the active mirror. Each watcher's diff is independent
  even when multiple watchers share the same numeric pattern.
- `gitSkipReason()` guard prevents `test_live` mode from attempting real git/PR operations
  when `gh` CLI is unavailable (ENOENT).

### Fixed

- Pattern diffs were non-empty on repeat runs (idempotency). Added `usedAdditionalKeys`
  tracking through `processDomainList` to detect when the filter already contained all
  additional domains.
- Pattern diffs block was displayed inside the `Problems:` section. Moved it before the
  Problems heading in console output.
- Stale `docs/TODO_summary_reporting.md` monolithic file removed (superseded by sub-folder).

## [1.3.0] - 2026-05-31

### Added

- Early exit on JS redirect when `probe_text` matched on the current domain.
  If a client-side JS redirect (`location.replace`, `window.location`, `location.href`) is detected
  after `probe_text` is confirmed, the resolver stops following the chain and returns the current
  domain as the working mirror. This prevents decoy redirects from leading to false failures.
  Meta refresh redirects are always followed (server-like behavior).
  When `force_search_ahead` is enabled, heuristic search continues after early exit to find
  additional working domains.

## [1.2.1] - 2026-05-30

### Changed

- Replaced full-file read with streaming in filter replacement (`readline/promises` + `createReadStream`).
  Large filter files are processed incrementally, reducing peak memory per file.
- Converted config I/O to async (`fs.promises`) for all three exports — `loadConfig`, `loadWatchers`, `saveWatchers`.
  Config loading no longer blocks the event loop.

## [1.2.0] - 2026-05-28

### Added

- Structured versioning policy for release finalization.
- SemVer validation and explicit patch/minor/major release scripts.

### Changed

- Version source of truth is now `package.json`; sync updates `src/index.ts` and `package-lock.json`.
- Version and changelog updates are expected only during task/chat finalization together with handoff.

## [1.1.51] - 2026-05-28

### Fixed

- Replaced `message: any` with `message: unknown` in diagnostics handling and aligned related helper usage.
  Diagnostics/event processing became stricter and safer without changing user-facing runtime behavior.

### [1.1.50]

- Finalized state semantics and made heuristic alias retention order-independent.
  Watchers now handle success/failure transitions more predictably, and async completion order no longer changes the
  final replacement set.

### [1.1.40]

- Added complete blocker marker coverage and fixed pattern/non-pattern transition handling plus shared-host alias
  retention.
  Replacement logic now covers more filter syntax, keeps the last pattern anchor, and preserves reachable aliases.

### [1.1.3]

- Sorted `force_search_ahead` collected domains by natural order.
  Canonical mirror selection and replacement sets became deterministic across repeated runs.

### [1.1.24]

- Switched to a forced resolver path and implemented discovery-only entrypoint replacement semantics.
  Gateway and shortener entrypoints can discover mirrors without corrupting replacements, and DNS became more stable
  across environments.

### [1.1.23]

- Prevented shortener hostnames from `initial_domain` URLs entering the replacement host map.
  Discovery-only gateway hosts stop leaking into actual filter replacements.

### [1.1.22]

- Reverted the `dns.lookup()` approach after GitHub Actions lockups.
  DNS checks became safer for CI, even though this version label was only a temporary test suffix.
- Preserved original LF or CRLF line endings in rewritten filter files.
  Replacement runs no longer create unrelated line-ending diffs.

### [1.1.21]

- Added glob-like matching for `filterDirPattern`.
  Filter selection works better in repositories that use varying directory naming patterns.

### [1.1.20]

- Fixed predicted-domain cleanup during replacement.
  Valid candidate domains are less likely to disappear from resulting filter updates.

### [1.1.19]

- Added DNS pre-flight validation before main execution.
  The tool now fails fast when DNS is broadly broken instead of reporting many downstream site failures.

### [1.1.16]

- Added per-site `skip_text_allow`.
  Individual watchers can suppress specific global parked-page phrases without weakening the global rule set.

### [1.1.15]

- Prevented false domain updates when an entrypoint resolves to an already known mirror.
  Stable sites no longer produce churn just because checks start from a redirect alias.

### [1.1.13]

- Prevented spurious PRs caused by redirect shorteners in `initial_domain`.
  Entry aliases no longer look like real domain changes by themselves.

### [1.1.12]

- Improved heuristic fallback for non-pattern `initial_domain` values.
  Watchers can still find the next pattern mirror even when discovery starts from a non-pattern entrypoint.

### [1.1.11]

- Added deterministic natural-order selection for `last_known_mirror`.
  The canonical mirror stops bouncing between equally valid candidates.

### [1.1.10]

- Fixed host map overwrites and DNS-check timer leakage.
  Multi-domain replacements became more reliable and batch runs avoid unnecessary lingering timers.

### [1.1.9]

- Continued heuristic search for `force_search_ahead` sites even after a Phase 1 success.
  Additional working mirrors can now be collected even when the entrypoint already resolves.

### [1.1.7]

- Added heuristic history with pattern change detection and stabilized GitHub Action packaging.
  Pattern-based mirror tracking became more resilient and the packaged action became safer to run in CI.

### [1.1.2]

- Prioritized `probe_text` over `skip_text`.
  Real mirrors are less likely to be rejected when expected content appears alongside parked-page text.

### [1.1.0]

- Added JavaScript and meta refresh redirect support with heuristic history improvements.
  Mirror discovery now works for more redirect styles and keeps better continuity across repeated runs.

### [1.0.2]

- Added global `skip_text` handling and the `force_search_ahead` flow.
  Parked pages are rejected more reliably, and sites can continue searching beyond the first candidate when needed.

- Improved antibot and probe handling during heuristic fallback.
  Protected mirrors no longer interfere as much with continued candidate collection.

### [1.0.1]

- Preserved YAML comments during config and watcher rewrites, and added `[N]domain.tld` pattern support.
  Commented YAML files survive updates, and heuristic discovery can follow prefix-numbered mirrors.

### [1.0.0]

- Initial release of the rotating-domain checker.
  The project could resolve mirrors, update filter files, and drive git-based update workflows.
