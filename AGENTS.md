# AGENTS.md - Instructions for AI Agents

## 🤖 Guidelines for AI Assistants

This document contains specific instructions for AI agents working with the Rotating Domains Checker codebase.

---

## 🛡️ CRITICAL: Git Operations Require Explicit Approval

**NEVER execute any git-mutating command without the user's explicit confirmation in the same turn.**

This rule is absolute and has no exceptions. Treat it as a hard safety constraint.

### Operations that REQUIRE explicit approval (propose first, wait for OK, then execute)

- `git commit` (even local-only, even with `--amend`)
- `git push` (any form — NEVER assume "commit" implies "push")
- `git checkout -b` / `git branch <new>` (creating or switching branches that change state)
- `git merge`, `git rebase`, `git reset` (history/state mutations)
- `git stash`, `git restore`, `git checkout <file>` (anything that can discard working-tree changes)
- `git rm`, `git mv`
- `git tag`
- Any other command that modifies refs, the index, or the working tree

### Operations that are OK without asking

- Read-only: `git status`, `git log`, `git diff`, `git show`, `git blame`, `git branch` (listing),
  `git remote`, `git rev-parse`, `git ls-files`
- Editing source / test / docs files via the editor tools
- Running `yarn build`, `yarn test`, `yarn lint`, `yarn <read-only-script>`

### Default workflow when in doubt

1. **Propose** the exact git command (or sequence) in the reply, with a short rationale.
2. **Wait** for the user's explicit "go" / "ok" / "да" / equivalent approval.
3. **Execute** only what was approved. Do not chain additional git commands.

A task description like "поправь feature X" or "закрой TODO" is a code/documentation task, NOT an
implicit git-commit request. If the work naturally leads to a commit, propose the commit explicitly
after the work is done and reviewed.

**Why this is critical:** past incidents showed agents committing changes before the user could
review the state of the repo, the test outcomes, or the branch strategy. Git history is shared
and often published — recovering from a premature commit or push is annoying at best and
destructive at worst. Respect the user's decision space.

---

## 🧪 Testing Requirements

### **CRITICAL: Update Tests After Code Changes**

**After ANY code changes, you MUST:**

1. **Review and update relevant tests** in `__tests__/` directory
2. **Add new test cases** for any new functionality
3. **Update existing test cases** if behavior changes
4. **Remove obsolete test cases** if features are removed

**Process:**

- Read existing test files in `__tests__/` to understand current test coverage
- Identify which test files relate to your changes (e.g., `batch.test.ts`, `replacer.test.ts`)
- Add/modify test cases to match new behavior
- Ensure edge cases are covered
- Update test data/fixtures in `__tests__/fixtures/` if needed

**Why this is critical:**

- Tests must reflect actual code behavior
- Outdated tests lead to false confidence
- Comprehensive tests prevent regressions
- Future AI agents rely on accurate test documentation

### **Bug Fix Testing Requirements**

**When fixing bugs or issues, you MUST:**

1. **Update existing tests** that cover the bug scenario
2. **Add new test cases** if no test exists for the bug
3. **Ensure the test case reproduces the bug** before the fix
4. **Verify the test passes** after implementing the fix
5. **You must check `README.md` and relevant specs** for outdated or incorrect logic that may have described the
   bugged behavior

**Process:**

- Identify the root cause and affected code paths
- You must check `README.md`, `docs/specs.md`, and `docs/specs_discovery_entrypoint.md` for behavior that may now be
   stale or incorrect because of the bug
- Check if `__tests__/` already has tests for this scenario
- If tests exist: update them to cover the bug case
- If no tests exist: add comprehensive test cases
- Test both the bug reproduction and the fix
- Include edge cases related to the bug
- You must update the docs in the same work if the bug fix changes or corrects previously documented behavior

**Examples:**

- Fixing domain pattern matching → update `replacer.test.ts` pattern tests
- Fixing HTTP error handling → add tests in `httpResolver.test.ts`
- Fixing heuristic logic → update `batch.test.ts` heuristic tests
- Fixing configuration parsing → add tests in `config.test.ts`

---

## 🔧 Code Modification Guidelines

### Before Making Changes

1. **You must **read relevant source files** to understand current implementation
2. **You must **check existing tests** in `__tests__/` for current test coverage
3. **You must **read the relevant specы first** in `docs/specs.md` and, for discovery-entrypoint / replacement-source
   behavior, `docs/specs_discovery_entrypoint.md`
4. **You must **understand the impact** on filter processing logic

### When Behavior Is Ambiguous

1. **Do not guess** if the current runtime behavior, intended behavior, or expected contract is unclear
2. **Ask the human** to clarify the expected behavior, edge case, or priority
3. **After clarification, update the documentation** if the discussion affects how the script should work
4. **Record script-behavior decisions** in `README.md`, `docs/specs.md`, or `docs/specs_discovery_entrypoint.md` so
   future agents do not need to rediscover the same rule

### After Making Changes

1. **You must **update/add tests** in `__tests__/` with new/modified test cases
2. **You must **document any breaking changes**
3. **Consider backward compatibility**
4. **You must update `README.md` and `specs.md`** when behavior changes. This is mandatory, not optional. If the change affects runtime behavior, semantics, or contracts, the spec must reflect the new behavior in the same commit. Failure to update specs.md creates spec-runtime drift and misleads future agents.
5. **You must update `README.md`** if the change affects user-facing behavior or configuration examples.
6. **You must run `yarn build`** after fixes to verify the project still builds successfully
7. **You must run `yarn test`** after `yarn build` to verify the test suite still passes

### Editing Long Files Safely

When editing long files, you must avoid broad tail rewrites and weak end-of-file anchors.

1. **Prefer one function-sized patch at a time** instead of rewriting a whole trailing section
2. **Anchor edits to the exact function/class body** with enough unique surrounding context
3. **Do not replace from a section header to EOF** unless the whole tail is intentionally being rewritten
4. **If a patch touches one function, validate immediately** before touching the next function
5. **If a patch fails or applies ambiguously, re-read the local function and retry a smaller patch**
6. **Do not use generated whole-file rewrites as recovery** when a small local patch would suffice

When using file edit tools:

- Never use placeholder comments such as `// ...existing code...`, `/* existing code */`, or similar in actual edits
- Use exact anchors or exact line replacements instead
- Prefer minimal diffs over rewriting whole files
- Do not include unchanged surrounding code unless the tool explicitly requires it
- For single-line changes, replace the exact line with the exact new text

For files like `src/replacer.ts`, helper-section headings such as `// Helper Functions` are not reliable edit anchors by
themselves because they sit near the tail of the file and can cause accidental replacement of everything that follows.

### ⚠️ CRITICAL: Always Verify After insert_edit_into_file

The `insert_edit_into_file` tool can silently produce corrupted results (duplicate blocks, lost content, malformed
lines). **Never assume the edit succeeded just because no error was returned.**

**Mandatory verification after every `insert_edit_into_file` call:**

1. **Re-read the file immediately** to confirm the edit applied as expected
2. **Check file length** — sudden large changes (e.g., 400 → 3900 lines) indicate duplication
3. **Count expected sections** — if you added one H2 header, verify exactly one new H2 header exists
4. **Check boundaries** — read 10 lines around the edit site to confirm no corruption, missing content, or duplicated
   blocks
5. **Verify no content was lost below the edit** — compare `## ` header count before/after; if it dropped, content was
   swallowed

**Known failure modes observed in this repo:**

- **Silent duplication**: tool returns `Response contained no choices` error, but a retry/recovery mechanism inserts
  the target block 25+ times in a row (observed: AGENTS.md grew from 398 to 3968 lines)
- **Line concatenation**: two adjacent lines get merged into one (observed: `` `docs/specs.md` /
  `docs/specs_discovery_entrypoint.md## 🎯 Common Tasks`` — the closing backtick + next line merged)
- **Tail truncation**: content below the edit site disappears entirely (observed: Emergency Procedures + Test Domain
  Naming sections lost after trimming Documentation Standards)
- **Encoding corruption**: LLM output may mangle non-ASCII characters (e.g., `→` becomes `тЖТ`, or other Unicode
  becomes garbled). This happens when the edit tool interprets the model's text response through an intermediate
  encoding layer (CP1252 or Windows-1251) instead of UTF-8. Always verify non-ASCII characters after edits to
  TypeScript source files. If you see garbled characters, re-read the file and fix immediately — do not proceed
  with other edits on the same file until encoding is restored.

**Safe alternatives for large structural edits:**

- For **inserting new sections** in Markdown/docs: prefer `create_file` with the full desired content if the file is
  being created fresh, or use PowerShell to splice line ranges:
  ```powershell
  $c = Get-Content file.md
  $new = $c[0..421] + @('') + @('new section') + $c[422..($c.Count-1)]
  $new | Set-Content file.md -Encoding UTF8
  ```
- For **removing sections**: use PowerShell line-range extraction instead of edit-tool deletion
- For **multiple edits to the same file**: do one edit, verify, then do the next — never batch

**Rule of thumb**: if you did not re-read the file after the edit, you did not do the edit.

---

## 🧱 Technical Stack & Coding Standards

### Runtime Environment

- Node.js 22+
- TypeScript 5.x
- ESM modules
- Yarn package manager

### TypeScript Rules

- Prefer explicit types for public APIs
- Avoid `any`; use `unknown` when type is not yet known
- Use named exports instead of default exports
- Prefer functional style over unnecessary classes
- Use async/await instead of raw Promise chains
- Keep functions focused and reasonably small
- Avoid premature abstractions

### Imports

- Group imports by:
  1. Node built-ins
  2. External packages
  3. Internal modules
- Use `import type` where appropriate
- Avoid circular dependencies

### Error Handling

- Never silently swallow errors
- Include actionable context in thrown errors
- Preserve original error causes where useful
- Test both success and failure paths

### Logging

- Logs should be concise and actionable
- Avoid noisy debug logging in committed code
- Never log secrets, tokens, or credentials

### Performance

- Prefer streaming and incremental processing for large files
- Avoid unnecessary allocations in hot paths
- Consider parallelism impact before increasing concurrency

### Build Validation

Before completing work, you must run:

```bash
yarn build
yarn test
```

If linting exists in the repository, also run:

```bash
yarn lint
```

---

## 📋 Key Files to Understand

### Core Logic

- `src/batch.ts` - Domain processing and heuristics
- `src/replacer.ts` - Filter file replacement logic
- `src/httpResolver.ts` - HTTP request handling
- `src/index.ts` - Main application flow

### Configuration

- `src/config.ts` - YAML configuration handling
- `config.yml` - Runtime configuration
- `watchers.yml` - Sites to monitor

### Specification / Docs

- `docs/specs.md` - Main project specification
- `docs/specs_discovery_entrypoint.md` - Discovery-entrypoint and replacement-source rules
- `README.md` - User-facing behavior and operational guidance

### Testing

- `__tests__/` - Test files (MUST BE UPDATED after code changes)
- `__tests__/fixtures/` - Test data and fixtures
- `TestFilters/TestFilter/testfilter.txt` - Test filter rules

---

## 🎯 Common Tasks

### Adding New Heuristic Patterns

1. Update pattern matching in `replacer.ts`
2. Update candidate generation in `batch.ts`
3. Add test cases to `__tests__/batch.test.ts`
4. Add integration tests to `__tests__/integration.test.ts`

### Modifying Filter Processing

1. Understand current logic in `replacer.ts`
2. Check impact on predicted mirror removal
3. Update test cases in `__tests__/replacer.test.ts`
4. Test with real filter examples

### HTTP/Network Changes

1. Review `httpResolver.ts` implementation
2. Consider impact on retry logic and timeouts
3. Update test cases in `__tests__/httpResolver.test.ts`
4. Test error handling scenarios

---

## ⚠️ Critical Considerations

### Domain Pattern Matching

- **NEVER break existing patterns** without updating tests
- **Test regex escaping** for special characters
- **Consider edge cases** (www prefixes, URLs, hashes)

### Filter File Processing

- **Preserve existing functionality** when adding features
- **Test mixed domain scenarios** (different sites in same line)
- **Validate predicted mirror removal** logic

### Performance Impact

- **Consider parallel processing** implications
- **Test with large filter files**
- **Monitor memory usage** for heuristic operations

---

## 🔄 Review Checklist

Before completing any task:

- [ ] Have I read the relevant source code?
- [ ] Have I checked the relevant section in `docs/specs.md` / `docs/specs_discovery_entrypoint.md`?
- [ ] Have I checked existing tests in `__tests__/` for related tests?
- [ ] Have I updated/added test cases for my changes?
- [ ] Have I considered edge cases and error scenarios?
- [ ] If behavior was clarified during discussion, have I updated `README.md` or the spec?
- [ ] Have I documented any breaking changes?
- [ ] Have I tested with real-world examples?

**Process:**

- Read the checklist in the TODO file you are working on
- Verify each item is either done or not applicable
- If you find gaps, address them before marking the TODO complete
- Update the checklist in the TODO file to reflect completed items

---

## 📝 Documentation Standards

### Test Case Format

```markdown
- [ ] `input` → `expected_output` (description)
```

### Documentation Formatting

- When writing or updating documentation (`README.md`, `docs/*.md`, TODO files), keep line length at 120 characters max

### Session Handoff Files

- When a workstream grows long or is likely to continue in a new chat, you must create or update a dated session
   handoff file under `docs/`
- You must use a filename with a date suffix and topic, for example `session_handoff_2026-05-22_✅TODO_force_search_ahead_current_alias_loss.md`
- If the session is tied to a specific TODO file, use `✅TODO_<name>` (for completed) or `TODO_<name>` (for open) as
  suffix
- If no TODO, use a brief topic description (e.g. `session_handoff_2026-05-22_lint_fixes.md`)
- You should prefer one handoff file per active date/workstream and keep updating it instead of creating many near-
  duplicate files on the same day unless the topics are clearly unrelated
- If the user explicitly signals that the current work is wrapping up or should continue in a later chat, you must
   update the current session handoff file before sending the final reply
- You must keep the handoff concise and factual; do not dump the full transcript
- If the work changes release-relevant code, version bumping and `CHANGELOG.md` updates must happen only in the
  finalization step of the chat, together with the handoff update
- You must record:
  - confirmed runtime facts
  - current target behavior / decisions already made
  - open questions
  - active TODO files or backlog items created
  - key files, commands, or reproducible cases needed to continue work quickly
- If a decision is already part of the repo contract, you must also update `README.md`, `docs/specs.md`, or another
  relevant spec instead of relying only on the session handoff file

### Versioning And Changelog

- Use SemVer: `MAJOR.MINOR.PATCH`
- `MAJOR`: breaking runtime/config/contract change
- `MINOR`: important non-breaking code change, new capability, or materially changed behavior
- `PATCH`: bug fix or small code correction without contract break
- Do not bump version for docs-only, comment-only, lint-only, formatting-only, or similar non-code changes
- Treat `package.json` as the single source of truth for version
- `src/index.ts` and `package-lock.json` must be synchronized from `package.json`
- Update version and `CHANGELOG.md` only when the task is being finalized, marked done, and the current handoff is
  being written or updated
- New changelog entries should describe code changes only; exclude pure docs/lint/comment churn
- For small code-only cleanups or tiny non-bug refactors, use the standard changelog phrase `Minor refinements`
  instead of `Minor fixes`
- Each changelog item should be concise, but may use one or two short sentences when needed for clarity
- Write changelog text as human-readable technical prose: summarize the problem/change first, then briefly state the
  user-facing impact or behavior effect
- Prefer summary-first formatting: first line for the fix/change summary, next line for effect, scope, or user-facing
  detail when that reads better
- Do not force semicolon-based or other rigid punctuation templates if they make the entry harder to read

### TODO Management

- Todos are tracked in two places:
  - **Individual TODO files**: `docs/TODO_<topic>.md` (detailed specification, steps, and status)
  - **Index file**: `docs/TODO.md` (master list with links to all TODO files)
- **Statuses must be synchronized** between the individual file and `docs/TODO.md`
- **Use checkboxes `[ ]` / `[x]`** for status — never use strikethrough (`~~text~~`)
- **When creating a new TODO**, include a transparent manual-testing section whenever manual verification is possible.
  It must describe the reproducible setup, not just say "test manually".
- When a TODO is completed:
  1. Mark all finished item checkboxes in the individual file as `[x]`
  2. Mark the corresponding entry in `docs/TODO.md` as `[x]`

### Manual testing instructions in TODOs

If a TODO describes behavior that can be verified without inventing new tooling, add a short manual-testing section.

Minimum contents:

- exact watcher/config snippet needed to reproduce the scenario;
- example filter rule or input data when replacement behavior is involved;
- exact command or runtime path to execute;
- expected observable result before/after the fix.

Good manual instructions are concrete enough that another agent or human can reproduce the case quickly without
reverse-engineering the setup from the whole repository.

TODO files live in `docs/` and follow the conventions already described later in this file (see
"TODO Management" under "📝 Documentation Standards"). This section adds status-marker rules
that apply across all TODO files.

### Status markers

Every actionable checkbox in a TODO file MUST use one of these markers:

| Marker | Meaning |
|--------|---------|
| `[ ]`  | Not started / pending |
| `[⏳]` | In progress — work has started but is not finished |
| `[x]` | Fully done and verified |

Use `[⏳]` (hourglass) for items that are **currently being worked on**. Do NOT use it for
"might revisit someday" or "blocked but not abandoned" — those stay as `[ ]` with a note
explaining the blocker.

### Keeping statuses accurate

- **Mark `[⏳]` when you start work** on an item in the current session.
- **Mark `[x]` only after verification** (tests pass, lint clean, docs updated, manual check done).
  Do not mark done based on intent or plan.
- **If a TODO file is closed (renamed to `✅TODO_*.md`), every actionable item must genuinely
  be `[x]`.** If you find a leftover `[ ]` in a closed file, either:
  - complete the item and flip to `[x]`, or
  - move it to the appropriate open TODO, or
  - revert the file's name back to `TODO_*.md` (remove the ✅ prefix) and update `docs/TODO.md`.
- **If you discover stale `[x]` marks** (item claims done but runtime/code/docs do not reflect it),
  flip the checkbox back to `[ ]` or `[⏳]` and add a short note. Accurate status matters more
  than keeping green marks.
- **`docs/TODO.md` must stay in sync** with individual TODO files — when you change a status in a
  TODO file, update the master index accordingly in the same work session.

### When to audit

- Before marking a TODO closed (rename to `✅TODO_*.md`): scan the entire file for stale checks.
- When resuming work from a session handoff: re-verify statuses against reality before trusting them.
- Whenever the user asks: do a full audit of the target TODO file against code, tests, and docs.

---


### Code Comments

- Use English for all code comments
- Explain complex logic clearly
- Document edge cases and assumptions

### Commit Messages

- Use conventional commit format
- Reference relevant test cases
- Explain breaking changes if any

---

## 📋 Universal Completion Checklist

### How to Use

This is a **tiered** checklist. Before finishing any task, determine its tier and run through
the corresponding items plus the **Mandatory Gates** that apply to all tiers. Do not skip items
that are not applicable without annotating why.

### Legend

| Marker | Meaning |
|--------|---------|
| `[TIER-n]` | Run this tier's items |
| `(if X)` | Conditional — only run if the condition is true |
| `→` | Brief rationale for the item |

### Tier Selection Table

| Tier | When to Use | Version Bump Examples |
|------|-------------|----------------------|
| **Tier 0** | Docs-only, comments, formatting, lint-only changes | No bump |
| **Tier 1** | Bug fix, small code correction, internal refactor without behavioral change | `PATCH` |
| **Tier 2** | New capability, materially changed behavior, new config option, new test coverage area | `MINOR` |
| **Tier 3** | Breaking runtime/config/contract change, removed feature, changed default behavior | `MAJOR` |
| **Tier 4** | Release finalization (version bump + changelog + handoff) | Depends on tier 1-3 scope |

### Mandatory Gates (ALL Tiers)

Run these **every time** before declaring a task done, regardless of tier:

```
[ ] Updated/added tests in __tests__/ for the change
    (if Tier 0 docs-only: verify existing tests still pass)
    → § 🧪 Testing Requirements
[ ] Ran `yarn build` — verify successful
    → § 🔧 Code Modification Guidelines > After Making Changes
[ ] Ran `yarn test` — all tests pass (current baseline: 415)
    → § 🔧 Code Modification Guidelines > After Making Changes
[ ] Ran `yarn lint` — 0 errors (pre-existing warnings are OK)
    → § 🔧 Code Modification Guidelines > Build Validation
[ ] Checked line endings — all modified tracked files use LF (\n), not CRLF (\r\n)
    (on Windows: `$hasCRLF = [bool]((Get-Content <file> -Raw) -match '\r\n')`)
    → § 🧬 Test Domain Naming Conventions > ⚠️ CRITICAL: Line Endings Policy (LF Only)
[ ] Re-read every edited file after the last tool call — verify no corruption,
    duplication, truncation, or encoding mangling
    → § ⚠️ CRITICAL: Always Verify After insert_edit_into_file
[ ] Checked that existing watchers.yml / config.yml files are not broken by the change
    (backward compatibility)
    → § 🔧 Code Modification Guidelines > After Making Changes
```

### Tier 0 — Docs / Comments / Formatting / Lint Only

No code behavior changes. Use when editing markdown, fixing typos, reformatting, or
suppressing lint warnings.

```
[ ] (if source file touched) Verify type-check: `yarn build` — if it fails, the change
    is NOT Tier 0, reclassify as Tier 1+
[ ] (if docs/specs.md or docs/specs_discovery_entrypoint.md edited) Verify no broken
    internal cross-references (section numbers, anchor links)
[ ] (if docs/TODO_*.md edited) Sync status with docs/TODO.md master index
[ ] (if workstream is closing) Update today's session handoff file and/or create handoff
[ ] Ran Mandatory Gates (ALL Tiers) — build, test, lint, line endings, re-read, backward compat
    → § 📋 Universal Completion Checklist > Mandatory Gates (ALL Tiers)
```

**Skip:** version bump, changelog (unless the doc change is part of a
larger task being finalized).

### Tier 1 — Bug Fix / Small Code Correction

Non-breaking fix or refactor. Examples: fixing a regex, adding a null guard, converting
`any` → `unknown`.

```
[ ] Added a test that reproduces the bug BEFORE the fix, and passes AFTER the fix
    (see § 🧪 Testing Requirements > Bug Fix Testing Requirements)
[ ] Checked docs/specs.md, docs/specs_discovery_entrypoint.md, and README.md for
    descriptions of the now-fixed behavior — if the spec described the bug, update it
[ ] (if edge cases exist) Added edge-case tests
[ ] Verified backward compatibility — existing watchers.yml / filter files still work
[ ] (if TODO file exists for this bug) Updated individual TODO checkboxes and
    synced status to docs/TODO.md master index; renamed TODO_ → ✅TODO_ on completion
[ ] Updated or created session handoff file
[ ] Determined version bump: PATCH for bug fix
[ ] Ran Mandatory Gates (ALL Tiers) — build, test, lint, line endings, re-read, backward compat
    → § 📋 Universal Completion Checklist > Mandatory Gates (ALL Tiers)
```

### Tier 2 — New Capability / Material Behavior Change

Adding a feature, new config field, new runtime behavior, or materially changing how
existing logic works.

```
[ ] Read docs/specs.md and docs/specs_discovery_entrypoint.md sections relevant to the
    changed code before starting — update them after the change
[ ] Read existing tests in __tests__/ related to the changed area
[ ] Added comprehensive tests: happy path, edge cases, error paths
[ ] Updated docs/specs.md — new section or updated subsection describing the new behavior
[ ] Updated docs/specs_discovery_entrypoint.md (if discovery-entrypoint or replacement-source
    logic is affected)
[ ] Updated README.md — user-facing behavior changes, new config options, new output fields
[ ] (if the change affects state serialization) Checked docs/TODO_watchers_comments.md —
    comment/layout preservation may need attention
[ ] (if runtime behavior changes) Verified that summary reporting categories still make sense
    (see docs/TODO_summary_reporting.md for known pitfalls)
[ ] (if TODO file exists for this feature) Updated individual TODO checkboxes and
    synced status to docs/TODO.md master index; renamed TODO_ → ✅TODO_ on completion
[ ] Updated or created session handoff file
[ ] Determined version bump: MINOR for new capability
[ ] Ran Mandatory Gates (ALL Tiers) — build, test, lint, line endings, re-read, backward compat
    → § 📋 Universal Completion Checklist > Mandatory Gates (ALL Tiers)
```

### Tier 3 — Breaking Change

Removing a feature, changing defaults, breaking YAML schema, altering git workflow.

```
[ ] ALL Tier-2 items
[ ] Documented breaking changes in CHANGELOG.md under a `### Breaking` sub-header
[ ] Added a migration note in README.md (e.g., config migration, old-field deprecation)
[ ] (if YAML schema changed) Verified backward-compatible loading: old watchers.yml without
    new fields must not crash
[ ] (if git workflow changed) Updated action.yml and any CI examples in README.md
[ ] Determined version bump: MAJOR for breaking change
[ ] Ran Mandatory Gates (ALL Tiers) — build, test, lint, line endings, re-read, backward compat
    → § 📋 Universal Completion Checklist > Mandatory Gates (ALL Tiers)
```

### Tier 4 — Release Finalization

Run only at the end of a workstream, after all code and doc changes are verified.

```
[ ] Determined version bump: PATCH (Tier 1), MINOR (Tier 2), or MAJOR (Tier 3)
    Docs/lint-only = no bump
[ ] Updated `package.json` version
[ ] Ran `node sync-version.js` — syncs src/index.ts and package-lock.json
[ ] Updated `CHANGELOG.md`:
    - New `[VERSION]` header with today's date
    - Entries describe code changes only (not docs/lint/format churn)
    - Summary-first phrasing: problem/change, then user-facing effect
[ ] Ran `yarn build` (ncc bundles dist/index.js with updated version string)
[ ] Ran `yarn test` — verify version-related tests pass
[ ] Updated or created session handoff file:
    - docs/session_handoff_YYYY-MM-DD_topic.md
    - Records: runtime facts, decisions, open questions, key files, commands
[ ] (if TODO was completed) Renamed `docs/TODO_*.md` → `docs/✅TODO_*.md`
[ ] (if TODO was completed) Updated `docs/TODO.md` master index — mark as `[x]`
[ ] Ran Mandatory Gates (ALL Tiers) — build, test, lint, line endings, re-read, backward compat
    → § 📋 Universal Completion Checklist > Mandatory Gates (ALL Tiers)

**Rule:** Version bump, CHANGELOG, and handoff happen in the SAME step. Never bump version
in isolation without handoff, and never finalize a handoff without syncing the version.
```

### Quick Reference: Which Specs to Update

| Affected Code Area | Required Doc Updates |
|--------------------|---------------------|
| `src/httpResolver.ts` — redirects, probe, skip text | `docs/specs.md` §5.x (redirect handling) |
| `src/batch.ts` — heuristic, candidates | `docs/specs.md` §6.x (heuristic), `README.md` patterns section |
| `src/replacer.ts` — filter replacement | `docs/specs_discovery_entrypoint.md`, `README.md` Replacement Logic |
| `src/index.ts` — state update, summary | `docs/specs.md` §8.x (state), `README.md` Check Results |
| `src/config.ts` — YAML I/O | `docs/specs.md` §3.x (config), `README.md` Configuration |
| `src/types.ts` — new / changed fields | All specs that reference the affected types |
| `watchers.yml` schema / fields | `docs/specs.md` §3.2, `README.md` watchers.yml reference |

---

## 🚨 Emergency Procedures

If tests are failing after changes:

1. **STOP** - Do not proceed
2. **Review** the failing test cases
3. **Identify** the root cause
4. **Fix** the implementation or update tests
5. **Verify** all related functionality works

---

## 🧬 Test Domain Naming Conventions

### **Purpose**

Tests use fictional domains to ensure independence from real-world domain availability and changes. This section
defines the naming conventions for test domains.

### **Principles**

1. **Independence** - Tests must not depend on real domain availability
2. **Consistency** - Use standardized naming patterns across all tests
3. **Clarity** - Domain names should clearly indicate they are test fixtures
4. **Minimalism** - Minimize unique domain variations to reduce maintenance

### **⚠️ CRITICAL: Never Use Real Domains in Tests**

**All test domains must be fictional.** Since HTTP/DNS calls are mocked, there is no reason to use real-world domains,
or any other actual site in tests.

**Why this is mandatory:**

- Real domains create false dependencies on external availability
- Future domain changes can break tests even with mocks
- Tests should be self-contained and independent
- Mocked requests work identically with any domain name

**Enforcement:**

- Code reviewers must reject PRs with real doma
 s in tests
- Use `example.com` base or descriptive fictional names (see patterns below)
- If you're tempted to use a real domain for clarity, use a fictional equivalent instead

### **⚠️ CRITICAL: Line Endings Policy (LF Only)**

**All source files must use LF (`\n`) line endings, not CRLF (`\r\n`).**

**Rules:**

- **Default**: All files use LF line endings
- **On Windows, verify after edits**: `.gitattributes` defines repo policy (`*.md text eol=lf`, etc.), but tools such as
  `apply_patch`, PowerShell writers, or editor formatters may still re-save the working-tree file as CRLF. Always
  verify line endings after editing tracked text files; do not assume the write tool preserved LF.
- **Never convert**: Do not run `dos2unix`, `unix2dos`, or similar tools that convert line endings
- **Preserve originals**: When processing input files (filters, watchers, configs), preserve their original line ending
  format
- **Check before committing**: Verify files use LF before committing

**Why:**

- Git normalizes line endings automatically
- Mixed line endings cause spurious diffs and merge conflicts
- CI/CD tools expect consistent formatting
- PowerShell scripts and batch files may have special requirements, but our codebase does not

**Enforcement:**

- If a file shows CRLF in `gitf`, convert to LF before committing
- Use `.gitattributes` with `* text=auto` to enforce LF in repository
- Editors should be configured with LF as default

### **Pattern Domains (with numeric patterns)**

Use `example.com` as the base for all pattern-based test domains:

**Pattern Types:**

1. **`domain[N].tld`** - Number at end
   - Format: `example001.com`, `example002.com`, `example003.com`
   - Range: `001-099` for basic patterns

2. **`[N]domain.tld`** - Number at start
   - Format: `14example.com`, `15example.com`, `16example.com`
   - Range: `10-99` for prefix patterns

3. **`domain[N][text].tld`** - Number in middle with suffix
   - Format: `example126tv.com`, `example127tv.com`, `example128tv.com`
   - Range: `100-199` for middle patterns with suffix

4. **`www.domain[N].tld`** - With www prefix, number at end
   - Format: `www.example375.com`, `www.example376.com`
   - Range: `200-399` for www + suffix patterns

5. **`www.[N]domain.tld`** - With www prefix, number at start
   - Format: `www.91example.com`, `www.92example.com`
   - Range: `10-99` for www + prefix patterns

**Guidelines:**

- Always use `.com` TLD for pattern domains
- Use leading zeros for consistency: `001` not `1`
- Keep base name simple: prefer `example` over variations
- Number ranges help identify pattern type at a glance
- **Flexibility**: When necessary, use variations of listed domains (e.g., `test001.com`, `sample14.com`,
  `demo126tv.com`) to avoid conflicts or confusion in specific tests

### **Non-Pattern Domains (without numeric patterns)**

Use simple, descriptive names for domains that should NOT match numeric patterns:

**Standard Non-Pattern Domains:**

1. **`nopattern.com`** - Primary non-pattern test domain
   - Use when testing non-pattern domain behavior
   - No numbers in the domain name

2. **`testsite.com`** - Alternative non-pattern domain
   - Use for generic test scenarios
   - No numbers in the domain name

3. **Descriptive names** - For specific test scenarios
   - `old.com` - Represents an old/previous domain
   - `new.com` - Represents a new/updated domain
   - `dead.com` - Represents a failed/dead domain
   - `mirror.com` - Represents a mirror domain
   - `example.com` - Generic example (when context is clear)

**Hash-Based Non-Pattern Domains (future consideration):**

- Format: `example{hash}.com` where `{hash}` is 8-char hex
- Example: `example0d7142f0.com`, `examplec3a8b9e1.com`
- Use to simulate real-world non-pattern domains
- Currently not implemented - use simple names above

### **Examples in Tests**

```typescript
// Pattern domain test
test('domain[N].tld: example001.com → generates example002..006', async () => {
  const site = makeSite({ last_known_mirror: 'example001.com' });
  // ... test expects example002.com, example003.com, etc.
});

// Non-pattern domain test
test('no numeric pattern → empty candidates, no heuristic', async () => {
  const site = makeSite({ last_known_mirror: 'nopattern.com' });
  // ... test expects no heuristic candidates
});
```

### **Migration Notes**

When updating tests to use new domain conventions:

1. Replace real domains with appropriate test domains
2. Maintain test logic - only change domain names
3. Update test descriptions to reflect new domains
4. Verify all tests pass after migration

See `TODO_tests.md` for detailed migration plan and domain mapping.

---

**Remember:** Tests are not optional - they are essential for maintaining code quality and preventing regressions.
Always update tests after making code changes!
