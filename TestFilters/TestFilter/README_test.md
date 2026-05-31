# Test Filter File Guide

This document describes the structure and purpose of test filter files in `TestFilters/TestFilter/`.

## replacer_test_rules.txt

Comprehensive test filter containing all rule types covered by `__tests__/replacer.test.ts`.

**Purpose:** Provide a single, organized reference file demonstrating every blocker syntax form that the replacer must handle correctly.

**Domain Naming Convention:** Follows AGENTS.md § Test Domain Naming Conventions
- Numeric patterns: `example001.com`, `14example.com`, `example126tv.com`, `www.91example.com`
- Non-pattern domains: `nopattern.com`, `testsite.com`, `old.com`, `new.com`

### File Structure

#### Section 1: Comments and Skipped Lines
- Comment lines (`!`)
- Regex rules (`/pattern/`)
- Wildcard URL rules without cosmetics

**Test coverage:** `shouldSkipLine()` function

#### Section 2: Cosmetic Rules (##)
Basic element hiding rules with domain scoping.

- Single domain
- Comma-separated domain lists
- Mixed pattern + non-pattern domains
- All three numeric patterns: `domain[N].tld`, `domain[N][text].tld`, `[N]domain.tld`
- www prefix handling

**Test coverage:** Tests 2.1-2.7 in `processLine — Cosmetic rules`

#### Section 3: Exception Cosmetic Rules (#@#)
Element hiding exceptions.

- Basic exceptions
- Exception lists
- `#@##` regression case (exception with `##` in selector)

**Test coverage:** Test 2.13 `processLine — Exception markers`

#### Section 4: CSS Injection Rules (#$#)
AdGuard CSS injection syntax.

**Test coverage:** Part of marker detection in `processLine`

#### Section 5: CSS Exception Injection Rules (#@$#)
Exception variants of CSS injection.

**Test coverage:** Test 2.14 `processLine — Dollar-based cosmetic markers`

#### Section 6-9: Extended CSS Rules
Extended CSS selectors with `:-abp-has()`, `:-abp-contains()`.

- `#?#` - Extended CSS
- `#@?#` - Extended CSS exception
- `#$?#` - Extended CSS injection
- `#@$?#` - Extended CSS injection exception

**Test coverage:** Marker detection and domain list processing

#### Section 10-11: Script Rules (#%#, #@%#)
JavaScript injection and scriptlet rules.

**Test coverage:** Cosmetic marker processing with scriptlet bodies

#### Section 12-13: Content Rules ($$, $@$)
HTML filtering rules using `$$` and `$@$` markers.

**Critical:** Must not conflict with `$domain=` parameter parsing.

**Test coverage:** Test 2.14 `processLine — Dollar-based cosmetic markers`

#### Section 14-15: uBO Forms
uBlock Origin-specific syntax.

- `##^` - HTML filtering shorthand
- `#@#^` - HTML filtering exception
- `##+js()` - Scriptlet shorthand
- `#@#+js()` - Scriptlet exception

**Note:** These use base markers (`##`, `#@#`) with body modifiers (`^`, `+js`).

**Test coverage:** Test 2.15 `processLine — uBO forms`

#### Section 16: URL Rules (||domain^)
Network request blocking rules.

- Basic URL rules
- URL rules with modifiers (`$third-party`)
- URL rules with `$domain=` parameters

**Test coverage:** Tests 2.2 `processLine — URL rules`

#### Section 17: List-Valued Parameter Modifiers
Domain list parameters in network rules.

- `$domain=` (ABP/uBO/AdGuard)
- `$from=` (uBO alias for `$domain=`)
- `$denyallow=` (uBO/AdGuard)
- `$to=` (AdGuard)

**Test coverage:** Test 2.16 `processLine — List-valued modifiers`

#### Section 18: Wrapper Syntax [$domain=...]
AdGuard wrapper form for domain-scoped rules.

- Wrapper with various markers (`#%#`, `###`, `#@#`)
- Single domain and domain lists
- Regexp values (must NOT be replaced)

**Test coverage:** Test 2.17 `processLine — Wrapper syntax`

#### Section 19: Wildcard Domains
Domains containing `*` that must be preserved, not replaced.

- Wildcard in cosmetic rules
- Mixed lists with wildcards and full domains
- Wildcards with exception markers

**Test coverage:**
- Test 2.18 `shouldSkipLine — Wildcard with exception/uBO markers`
- Test 2.19 `processLine — Wildcard domains preserved`

#### Section 20: Discovery Entrypoint and Non-Pattern Domains
Rules for shorteners, gateways, and non-pattern mirrors.

- Shortener domains (`t.co`)
- Non-pattern mirrors from pattern→non-pattern transitions
- Popup rules with domain lists

**Test coverage:** Discovery entrypoint logic in `batch.ts` and `replacer.ts`

#### Section 21: Predicted Mirror Scenarios
Multiple predicted mirrors that should be cleaned up during rotation.

- `domain[N].tld` predicted mirrors
- `[N]domain.tld` predicted mirrors

**Test coverage:** `removePredictedMirrors()` function

#### Section 22: Scheme Change Scenarios
Domains that redirect to non-pattern (link shorteners, etc.).

**Test coverage:** `hasSchemeChangeInList()`, `handleSchemeChange()`

#### Section 23: Complex Combined Rules
Real-world rule combinations.

- URL rules with multiple modifiers
- Platform-conditional blocks (`!#if`)

**Test coverage:** End-to-end `processLine()` and `applyReplacements()`

#### Section 24: Edge Cases and Regressions
Known edge cases and historical bugs.

- `$badfilter` modifier
- URL rules with paths
- Mixed pattern/non-pattern in `$domain=` lists

**Test coverage:** Regression tests in `replacer.test.ts`

## Usage

The test filter is used by:

1. **findTargetFiles tests** - Verifies file discovery with `*Filter` pattern
2. **Manual testing** - Run `yarn test_dry` to see replacer behavior on all rule types
3. **Reference documentation** - Shows all supported blocker syntax forms

## Related Files

- `__tests__/replacer.test.ts` - Unit tests for replacer logic
- `docs/TODO_blocker_syntax_coverage.md` - Known gaps in blocker syntax coverage
- `src/replacer.ts` - Implementation of rule parsing and domain replacement

## Maintenance

When adding new test cases to `replacer.test.ts`:

1. Add corresponding example rule to appropriate section
2. Update section comments if adding new rule types
3. Keep domain names consistent with AGENTS.md conventions
4. Add cross-reference to test number in section header if applicable
