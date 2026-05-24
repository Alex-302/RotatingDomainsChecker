# RotatingDomainsChecker Specification

## 1. Project Purpose

`RotatingDomainsChecker` automates the discovery of current mirrors for websites with frequently changing domains and
updates related filter files.

The project solves a typical problem in ad blocking / anti-adblock filters: a website continues to operate under a new
domain, but filter rules, `watchers.yml`, and derived lists still point to the old domain. As a result, rules stop
working or begin pointing to dead / parked domains.

The project is needed for filter lists that:

- contain domain rules for mirrors that regularly change hostnames;
- use numbered-domain schemes like `example123.com`, `14example.com`, `example126tv.com`;
- rely on redirect resolution, `probe_text`, `path`, antibot-detection, and parked-domain detection;
- want to run updates either as a local CLI tool or as a GitHub Action.

The project is not a general-purpose browser crawler. It is designed for deterministic checking of pre-known entrypoint
domains and mirrors with limited heuristics.

## 2. Main Usage Scenarios

### 2.1 Standalone Execution

A developer or maintainer runs the project locally via `tsx src/index.ts` or npm scripts:

- `npm run prod_live`
- `npm run prod_dry`
- `npm run test_live`
- `npm run test_dry`

Typical goals for standalone execution:

- test a new watcher;
- debug heuristic search;
- inspect redirect chain and `probe_text`;
- verify replacement logic on test filters;
- manually reproduce DNS / HTTP / skip_text issues.

### 2.2 GitHub Action

The project is published as a GitHub Action and can be invoked from an external filter repository via
`uses:Alex-302/RotatingDomainsChecker@...`.

The action accepts:

- `config-path`
- `mode`
- `filters-path`

Action outputs:

- `updated-count`
- `commit-sha`
- `pr-number`

### 2.3 Production Mode

Production mode uses the production filter directory (`filtersdir`) and in `prod_live` may perform real git operations.

### 2.4 Test Mode

Test mode uses the test filter directory (`filtersdir_test`) and is designed for safe local or CI verification of
replacement logic without modifying production filters.

### 2.5 Dry Run

A dry run performs network checks, builds a summary, displays future replacements and future commit messages, but does
not write changes to filter files and `watchers.yml`.

### 2.6 Live Run

A live run performs actual writing of `watchers.yml` and filter files. In a production live run, additional git
operations may be performed.

## 3. Terms and Entities

### watcher

A record in `watchers.yml` describing a single monitored site and the rules for checking it.

### site

Runtime representation of a watcher. In the code, this is `WatcherSite`.

### initial_domain

The starting point for checking. Can be:

- a bare domain, such as `example123.com`;
- a bare gateway domain, such as `patronspor.is`;
- a URL, including URLs with path and shortener / redirect URLs, such as `https://example.sx/e/abc` or `t.co/xyz`.

`initial_domain` is used to start the check but is not always the source for replacement in filter files.

`initial_domain` has two modes:

- `replaceable source domain` — the hostname can be used as a source domain for replacement;
- `discovery entrypoint` — the hostname/URL is used only as an entry point to find the current mirror via redirect
  chain and must not appear in the replacement map.

### last_known_mirror

The last known working mirror domain. This is the primary auto-updated reference that guides:

- quick start on recent `last_seen`;
- heuristic fallback;
- replacement logic;
- failure state.

### mirror

The actual working domain of the website found after traversing the redirect chain, JS/meta refresh, and additional
checks.

### redirect chain

A sequence of HTTP/JS/meta refresh transitions from the starting URL to the final URL. In the code, it is stored as an
array `RedirectChainEntry`.

### heuristic candidate

A candidate URL generated based on a numeric pattern from the current mirror or history. It is checked via DNS
pre-filter and then via HTTP resolver.

### probe_text

A list of strings that must be present in the response body. Used to confirm that the final page actually belongs to
the target site and not a third-party landing page.

### skip_text

A list of strings considered indicators of a parked / expired / dummy / unwanted landing page. If `skip_text` is found
and `probe_text` is not confirmed, such a domain is not considered working.

### accept_antibot

A watcher option allowing antibot / Cloudflare responses to be considered conditionally working. Used for sites where
protection interferes with full HTTP validation but the domain itself is considered relevant.

### force_search_ahead

A watcher option requiring heuristic search to continue even after finding the first working candidate. Needed to
accumulate a full set of working mirrors and deterministically select the smallest domain.

When `force_search_ahead` is enabled:

- Heuristic search continues after the first successful candidate
- All working domains (including the starting alias if it redirected to a different final host) are collected
- The canonical domain is selected via natural sort (smallest number wins)
- Additional working domains are stored in `additionalWorkingDomains`
- Filter files are updated with all collected domains to prevent loss of reachable aliases

**Important**: If Phase 1 check succeeds and the starting alias redirects to a different final host, both the alias
and the final host are included in the collected working domains. This ensures that the current `last_known_mirror`
is not lost from filter rules when it remains a valid working alias.

### failed_since / failed_days / potentially_dead

Auto-updated degradation fields:

- `failed_since` — the moment of first recorded failure;
- `failed_days` — the number of days since the start of the failure series;
- `potentially_dead` — a flag indicating that a working mirror was not found.

### pattern_changed

A flag indicating that a watcher transitioned from a numeric pattern domain to a non-pattern domain. Used as a signal
that filter files should not yet be updated to match the non-pattern mirror until a new pattern domain is found.

### heuristic_history

History of the last pattern domains, used during pattern → non-pattern transitions and subsequent returns to pattern.

### non_pattern_mirror

When a pattern-based watcher transitions to a non-pattern domain (e.g., `example123.com` → `example.com`), the
non-pattern domain is stored in `non_pattern_mirror` instead of overwriting `last_known_mirror`. This maintains a
clear separation:

- `last_known_mirror` continues to hold the last confirmed pattern domain, which serves as the replacement anchor for
  filter files.
- `non_pattern_mirror` holds the current non-pattern domain found by runtime.
- `pattern_changed = true` explicitly indicates the watcher is in non-pattern phase.

Filter files are NOT updated while the watcher is in non-pattern phase. The old pattern domain remains in filter rules
until a new pattern domain is found. When a new pattern domain is discovered, both `non_pattern_mirror` and
`pattern_changed` are cleared, and filter files are updated from the old pattern anchor to the new pattern domain.

## 4. Configuration

### 4.1 `config.yml`

`config.yml` sets global parameters for HTTP, DNS, heuristic, git, and logging.

#### `http`

- `timeout` — fallback timeout;
- `resolveTimeout` — timeout for the main resolve phase;
- `heuristicTimeout` — timeout for heuristic HTTP phase;
- `retries` — number of retries in `fetchWithRetry()`;
- `userAgent` — User-Agent for all requests.

#### `processing`

- `parallel` — legacy/global fallback for the number of tasks processed concurrently in phases without a more specific
  limit; in the current code, it is used as a fallback for `resolveParallel` (how many watchers simultaneously go
  through the main `processSite()` / resolve phase) and for `heuristicParallel` (how many heuristic HTTP candidate
  checks execute concurrently after DNS pre-filter);
- `resolveParallel` — parallelism of the main `processSite()` phase;
- `heuristicParallel` — parallelism of HTTP checks for heuristic candidates;
- `redirectDepth` — limit on redirect chain depth.

#### `dnsPreCheck`

- `enabled` — enable DNS pre-check before HTTP;
- `timeout` — timeout for DNS lookup;
- `retryOnce` — single retry on `EAI_AGAIN`.

#### `contentProbe`

- `enabled` — global toggle for `probe_text` verification.

#### `antibot`

- `detectCodes` — HTTP status codes considered antibot;
- `detectUrlPattern` — URL pattern signaling Cloudflare / antibot challenge.

#### `thresholds`

- `failedDaysWarning` — number of continuous failure days after which a warning is generated.

#### `heuristic`

- `enabled` — global enable for heuristic search;
- `maxAttempts` — how many numeric candidates to generate ahead;
- `skipOnAntibot` — stop heuristic if antibot is caught and watcher doesn't accept antibot;
- `attemptParallel` — limit of concurrent attempts per site in unified heuristic queue;
- `dnsParallel` — limit of concurrent DNS checks for heuristic candidates;
- `forceHeuristicOnCodes` — list of HTTP status codes that should trigger heuristic.

#### `skip_text`

Global list of parked / expired / dummy phrases. Used by `HttpResolver.containsSkipText()`.

#### `logging`

- `saveToFile`
- `incremental`
- `filePath`

#### `git`

- `mode`: `prod` or `debug`;
- `branch` — target branch for direct push or base branch for PR;
- `prBranchPrefix` — prefix for temporary PR branch.

#### `filtersdir` and `filtersdir_test`

- `repoPath`
- `filterDirPattern`
- `filePattern`

`filtersdir` is used for production runs, `filtersdir_test` for test runs.

### 4.2 `watchers.yml`

`watchers.yml` contains a map of `sites` where the key is the watcher's logical name and the value is `WatcherSite`.

#### Fields that the User Must Set

A watcher minimally must have:

- the watcher name as a key in `sites`;
- at least one meaningful entrypoint field:

  - `initial_domain`, or
  - `last_known_mirror`.

Minimal valid example:

```yaml
sites:
  Example (example*.com):
    last_known_mirror: example243.com
```

In practice, a new watcher is typically set via `initial_domain`, and `last_known_mirror` is later auto-updated.

#### Optional User Fields

- `path`
  Purpose: fixes the expected pathname of the final URL.
Logic: if after all redirects the final URL has a different path, the result is not considered valid even with
successful HTTP status.
When to use: when the domain alone is insufficient for validation and you need to confirm a specific route, such as
`/e/abc123`. Logged in the log.

- `probe_text`
  Purpose: confirms that the final page truly belongs to the target site.
Logic: all strings from the list must be present in `finalBody`. If any string is missing, the result becomes a failure
`Content probe failed`.
  When to use: when the domain might redirect to a common landing page, parking page, or unrelated content.

- `replace_initial_domain`
Purpose: controls whether a bare-domain `initial_domain` is considered a replacement source or only a discovery
entrypoint.
  Logic: makes sense only for bare domain `initial_domain`.
  Rules:
  `true` / absence of the field — bare domain remains a replaceable source domain.
  `false` — bare domain is converted to discovery-only mode and must not appear in the replacement map.
When to use: when `initial_domain` is a stable gateway domain that redirects to the current mirror but should itself
remain in filter files without replacement.

- `disable_heuristic`
  Purpose: completely disables heuristic fallback for a watcher.
  Logic: on main check failure, the script will not generate numeric candidates for this site.
  When to use: if the site doesn't use supported numeric patterns or heuristic regularly produces false candidates.

- `accept_antibot`
  Purpose: allows antibot / Cloudflare responses to be considered conditionally working.
Logic: antibot response is not considered fatal failure and can update `last_known_mirror` but remains marked in logs
and summary.
When to use: if the domain is considered valid even with a challenge page and the maintainer consciously accepts this
compromise.

- `force_search_ahead`
  Purpose: forces heuristic to collect all working candidates rather than stopping at the first found.
Logic: after the first success, the search continues and all successful domains enter the set for deterministic
canonical selection and `additionalWorkingDomains`.
When to use: for numbered-domain families where it's important to gather multiple live mirrors and select the minimum
canonical domain.

- `geoblock`
  Purpose: informational mark for geo-blocking.
Logic: does not directly affect check algorithm, replacement, or heuristic; used as diagnostic context in logs and for
maintainers.
  When to use: if the site behaves differently depending on country.

- `skip_text_allow`
  Purpose: excludes specific phrases from global `skip_text` for this watcher.
  Logic: exact-match phrases from the allow list are not considered parked/expired indicators for this site.
  When to use: if a phrase from global `skip_text` appears on valid pages of this watcher, such as `Redirecting...`.

#### Auto-Updated Fields

- `last_known_mirror`
  Purpose: stores the last known working mirror domain.
Logic: updated on successful check or accepted antibot success. For multi-success heuristic scenarios, the canonical
domain is saved after deduplication and natural sort, i.e., the domain with the smallest number in natural sort among
all successful candidates. Example: if `dizipal9.com`, `dizipal10.com`, and `dizipal11.com` are simultaneously working,
canonical should be `dizipal9.com`, not `dizipal10.com`, because natural sort compares the numeric part as a number,
not a string. This is needed so that on the next run, the range can be traversed sequentially from the smallest working
number upward, rather than starting only from newer numbers and gradually losing checking of older but still valid
mirrors.
  Role in next run: can be used as a quick starting URL, heuristic fallback, and main source for replacement.

- `last_seen`
  Purpose: records the last successful run for a watcher.
Logic: updated on confirmed success that changes the watcher's runtime state: for example, on failure -> success
transition, on `last_known_mirror` change, or on first confirmed success for a watcher. Repeated success without state
change and without domain change should not rewrite `last_seen` just for a new timestamp to avoid unnecessary diff and
noise in logs. Used by the "recent success" optimization when the script first tries `last_known_mirror`.

- `failed_since`
  Purpose: stores the moment the current continuous failure series began.
  Logic: recorded on first failure and not reset until the next success.

- `failed_days`
  Purpose: stores the duration of the current failure series in days.
Logic: calculated from `failed_since` as an integer number of continuous failure days. To reduce noise, the field
should not be rewritten on each repeated failure if the integer value of `failed_days` hasn't changed. That is,
repeated failure within the same day bucket should not create a new diff just to rewrite the same counter.

- `potentially_dead`
  Purpose: signals that a working mirror is not currently found.
Logic: in the current code, set on final per-site failure, i.e., when after all normal checks and possible heuristic
fallback a working domain is not found. This includes DNS/HTTP/probe/skip_text failures, rejected antibot, and
pattern-change branch requiring manual review. Cleared on any final success: on normal success, success without domain
change, accepted antibot success, and heuristic non-pattern success.
  Practical meaning: helps quickly see watchers that require manual review or removal from filters.

- `pattern_changed`
  Purpose: records the transition of a pattern-domain watcher to a non-pattern mirror.
Logic: target behavior is to record a non-pattern phase without rewriting filter files until returning to a new pattern
domain. Current runtime is not fully aligned with this target behavior in all canonical-selection paths.

- `heuristic_history`
  Purpose: stores previous pattern domains for pattern → non-pattern → pattern scenarios.
  Logic: helps retain context of the last pattern family and is used in heuristic fallback / replacement-related logic.

#### What Should Not Be Changed Manually Without Reason

Fields `last_known_mirror`, `last_seen`, `failed_since`, `failed_days`, `potentially_dead`, `pattern_changed`,
`heuristic_history` are runtime state and should be considered data owned by the script.

Reason: these fields are not merely reference data. They directly affect:

- selection of check starting point;
- replacement source selection;
- heuristic fallback;
- pattern/non-pattern transition logic;
- calculation of failure duration and warnings;
- decision whether to consider a domain potentially dead.

Manual changes to these fields can result in:

- false replacement updates;
- skipped necessary heuristic search;
- loss of pattern rotation history;
- incorrect warnings about long-failing sites;
- jumps in `last_known_mirror` between runs.

Manual editing is acceptable only:

- when recovering from erroneous updates;
- during bulk migration of watchers;
- during manual stale state cleanup.

If runtime state must be changed manually, it should be done consciously with understanding of consequences:

- changing `last_known_mirror` changes both next starting point and replacement source;
- removing `failed_since` / `failed_days` resets degradation history;
- removing `pattern_changed` / `heuristic_history` can break expected return logic from non-pattern mirror to pattern
  mirror.

### 4.3 Default Modes

- If `last_seen` is recent, the code first tries `last_known_mirror`, but on failure must fall back to `initial_domain`
  if it is set.
- If `initial_domain` is absent, `last_known_mirror` is used.
- If `path` is set, it is automatically appended to bare domain / root URL during checks.
- If `probe_text` is not set, body-based positive validation is not performed.
- If `skip_text_allow` is not set, global `skip_text` is applied entirely.
- If `initial_domain` is set as a bare domain without path, it is by default considered a replaceable source domain.
- If `initial_domain` is set as a URL with non-empty path, it is by default considered a discovery entrypoint.
- If `replace_initial_domain: false`, bare domain `initial_domain` is also considered a discovery entrypoint.

## 5. Domain Check Algorithm

### 5.1 Starting Point Selection

Pseudocode:

```text
if site.last_seen is recent (< 2 days) and site.last_known_mirror exists:
    urlToCheck = appendSitePath(last_known_mirror, path)
  if first attempt is not a confirmed success and initial_domain exists:
    urlToCheck = appendSitePath(initial_domain, path)
else:
    baseUrl = initial_domain or last_known_mirror
    urlToCheck = appendSitePath(baseUrl, path)
```

If both `initial_domain` and `last_known_mirror` are absent, the watcher immediately returns failure `No URL
configured`.

Practical meaning: recent-success optimization should not lock in a stale `last_known_mirror`. If the old mirror is
already dead but the watcher has a discovery entrypoint (`initial_domain` URL with path or bare gateway in
discovery-only mode), the script should make a second pass through the entrypoint, find the current mirror, and only
then decide if there is an update.

### 5.2 DNS Pre-Check

Before HTTP resolver, a DNS pre-check is performed. If the hostname doesn't resolve, the HTTP request is not executed
and the result is marked as `DNS resolution failed` with `shouldTriggerHeuristic = true`.

### 5.3 HTTP Request

`HttpResolver.resolve()` normalizes the URL, performs a `fetch()` with `redirect: manual`, and manually traverses the
chain.

Uses:

- `User-Agent` from config;
- explicit timeouts via `AbortSignal.timeout()`;
- retry with exponential backoff;
- network error classification by `code`, `syscall`, `address`, `port`.

### 5.4 HTTP Redirect Handling

All HTTP 3xx transitions are recorded in `redirectChain`. Relative `Location` is converted to absolute URL via
`new URL(location, currentUrl)`.

If a redirect without `Location` is found, it's a failure.

If `redirectDepth` is exceeded, it's a failure.

### 5.5 JavaScript Redirect Handling

The HTML body is searched for patterns:

- `location.replace(...)`
- `window.location.href = ...`
- `window.location = ...`
- `location.href = ...`

If a JS redirect is found, it is considered a continuation of the redirect chain and is not treated as an end
successful page.

In the current code, there is no separate option like `follow_js_redirects` / `follow_meta_refresh`. Follow behavior
for JS redirect and meta refresh is always enabled and controlled only by the general `processing.redirectDepth` limit.

### 5.6 Meta Refresh Redirect Handling

The syntax `<meta http-equiv="refresh" content="0;URL=...">` and equivalent reverse attribute order are supported.

### 5.7 Final Domain Determination

The final domain is the `hostname` of the final URL after traversing:

- HTTP redirects;
- JS redirects;
- meta refresh redirects.

### 5.8 `path` Verification

If a watcher has `path` set, the final URL must have the same pathname. Otherwise, the result is not considered working
even if the domain resolves and returns successful HTTP status.

This protects against false success scenarios where the mirror redirects:

- to root;
- to another route;
- to unrelated landing page.

### 5.9 `probe_text` Verification

If `probe_text` is set, all strings from the list must be present in `finalBody`. If any string is missing, the result
is considered failure `Content probe failed`.

Exception: if watcher has `accept_antibot: true` and antibot is caught, `probe_text` is not checked.

### 5.10 `skip_text` Verification

After reading the body, a search by global `skip_text` is performed, taking into account the watcher's
`skip_text_allow`.

If `skip_text` is found and full `probe_text` is not found, the result is considered failure `Skipped by skip_text` and
should trigger heuristic.

### 5.11 Parked / Expired Domain Detection

There is no separate parked-domain detection module. In the current implementation, parked / expired / dummy domains
are determined via `skip_text`.

Consequence:

- quality of parked detection is determined by quality of `skip_text` list;
- false positives are suppressed via `probe_text` and `skip_text_allow`;
- new parked patterns should be added to `config.yml` and accompanied by tests.

### 5.12 Antibot / Cloudflare Detection

Antibot is detected if:

- HTTP status code is in `antibot.detectCodes`, or
- URL contains `antibot.detectUrlPattern`.

If `accept_antibot: false`, the result is failure.

If `accept_antibot: true`, the result is considered conditional success, can update `last_known_mirror`, but is logged
separately as warning/error category `antibot_accepted`.

In practice, this works well with `force_search_ahead`: if the first found candidate hits antibot, the watcher can
still continue searching and collect additional working domains, among which a more reliable mirror without antibot
challenge might be found.

## 6. Heuristic Search

### 6.1 Supported Numeric Patterns

Three schemes are supported:

1. `domain[N].tld`
2. `domain[N][text].tld`
3. `[N]domain.tld`

Patterns are recognized via runtime domain tokenization, not by a fixed list of TLDs or sites.

### 6.2 Candidate Generation

Candidates are generated increment-only, starting from `currentNum + 1` up to `maxAttempts`.

The generator preserves:

- protocol;
- `www.` prefix;
- suffix;
- optional middle text;
- `path` if present in original URL.

### 6.3 Forward Search

Candidates first pass DNS pre-filter, then HTTP checks.

If `force_search_ahead: false`, after the first found working candidate, further search for site may be stopped.

If `force_search_ahead: true`, search continues and all found working domains enter `additionalWorkingDomains`.

Does not change success/failure selection rules. It changes only the strategy after first success: whether to continue
collecting additional working mirrors.

### 6.4 `disable_heuristic`

Completely disables heuristic fallback for a specific watcher.

### 6.5 Selecting New `last_known_mirror`

If one working domain is found, it is used as `newHost`.

If multiple are found (`force_search_ahead`), `selectFirstByOrder()` is applied, i.e., deduplication, then natural
sort, then selecting the first element as canonical mirror:

```text
allWorkingDomains = [primarySuccess, ...additionalWorkingDomains]
deduplicate
sort with naturalCompare()
pick first
```

### 6.6 Deterministic Heuristic Candidate Selection

During heuristic search, multiple valid candidate mirrors may be found.

Examples:

```text
dizipal1551.com
dizipal1552.com
dizipal1553.com
```

or:

```text
papazsports921.pro
papazsports922.pro
papazsports923.pro
```

Since DNS and HTTP checks execute in parallel, the order of request completion is non-deterministic. Without additional
normalization, this can lead to:

- different results between runs;
- race-condition-like behavior;
- random mirror selection;
- unnecessary git diff and commits;
- unstable tests;
- "jumping" replacement updates.

Therefore, heuristic candidate selection must be deterministic.

#### Algorithm for Heuristic Mirror Selection

After all heuristic checks complete, the system should:

1. collect all successful candidates;
2. remove duplicates;
3. sort candidates by natural sort;
4. select the minimum domain from the sorted list;
5. use only it as canonical heuristic result.

Pseudocode:

```text
successful = collect all successful heuristic candidates
unique = deduplicate(successful)
sorted = natural_sort(unique)
canonical = sorted[0]
```

#### Deduplication

Deduplication must be performed before sorting.

Example:

```text
[
  "dizipal1553.com",
  "dizipal1552.com",
  "dizipal1553.com"
]
```

After dedup:

```text
[
  "dizipal1552.com",
  "dizipal1553.com"
]
```

#### Natural Sort / Numeric-Aware Sort

Sorting must treat numeric parts of domains as numbers, not strings.

Incorrect:

```text
dizipal10.com
dizipal2.com
```

Correct:

```text
dizipal2.com
dizipal10.com
```

That is:

```text
2 < 10
```

not:

```text
"10" < "2"
```

#### Canonical Selection

After natural sort, the minimum domain is selected.

Example:

```text
[
  "papazsports921.pro",
  "papazsports922.pro",
  "papazsports923.pro"
]
```

Selected will be:

```text
papazsports921.pro
```

Even if:

- `923` responded faster;
- `922` was found first;
- requests completed in different order.

#### Reason for This Behavior

Deterministic canonical selection is needed to ensure:

- stable results between runs;
- absence of random mirror churn;
- minimal git diff;
- predictable replacements;
- identical behavior with parallelism;
- independence from timing and network jitter.

### 6.8 Why Deterministic Natural Sort is Used

Heuristic checks execute in parallel. Without deterministic selection, the result could depend on the order of network
request completion.

`naturalCompare()` compares numeric parts as numbers, not strings, so:

- `site9.com < site18.com`
- `piabettv18.live < piabettv20.live`

This guarantees stable selection of the smallest mirror regardless of response order.

## 7. Replacement Logic

### 7.1 Which Domains Are Replaced

Replacement is applied to filter files found in `filtersdir` or `filtersdir_test` and targets explicit domain-bearing
parts of blocker rules.

This includes:

- comma-separated domain lists written directly before blocker markers for domain-scoped cosmetic, HTML, script, or
  scriptlet rules;
- direct network host tokens such as `||domain^`;
- list-valued rule modifiers/options where blocker syntax encodes domains as `param=value1|value2|...`.

Cross-blocker notes for list-valued domain modifiers:

- ABP / EasyList-style syntax uses `domain=...` for source-page restriction lists;
- uBO also documents `from=` as an alias of `domain=`, plus list-valued `denyallow=` and `to=` modifiers;
- AdGuard documents `$domain=` with alias `$from=`, plus `$denyallow=` and `$to=`; for non-basic rules it also
  documents wrapper forms such as `[$domain=...]`.

Cross-blocker notes for domain-list markers before non-network rules:

- hostname lists before `##` / `#@#` belong to the common cross-blocker family;
- AdGuard additionally documents domain-scoped forms such as `$$` / `$@$`, `#?#` / `#@?#`, `#$?#` / `#@$?#`, and
  `#%#` / `#@%#`;
- uBO uses its own marker spellings for some of the same domain-scoped families, notably `##^...` for HTML filtering
  and `##+js(...)` / `#@#+js(...)` for scriptlets.

For this project, the replacement surface is the domain list itself, regardless of which blocker-specific marker or
modifier spelling carries that list.

### 7.2 Which Domains Are Not Replaced

Not replaced:

- comments;
- regex lines like `/.../`;
- wildcard rules without cosmetic/parameter context;
- unrelated domains absent from replacement maps;
- discovery-only entrypoint hostnames.

### 7.3 Discovery Entrypoint and Replacement Source

`initial_domain` can be used in two different modes:

1. `Replaceable source domain` — the domain is considered an old mirror and can be replaced in filter files.
2. `Discovery entrypoint` — the domain/URL is used only to discover the current mirror via redirect chain and is not
   replaced in filter files.

#### Default Mode

If `initial_domain` is set as a bare domain without path:

```yaml
initial_domain: oldmirror123.sx
```

it is considered a `replaceable source domain`.

If the check discovers a new mirror:

```text
oldmirror123.sx -> newmirror124.sx
```

replacement is allowed:

```text
oldmirror123.sx -> newmirror124.sx
```

#### URL with Path

If `initial_domain` is set as a URL with non-empty path:

```yaml
initial_domain: "https://example.sx/e/nemg6vqtnrkf"
```

it is automatically considered a `discovery entrypoint`.

In this mode:

- hostname from `initial_domain` is used only as the starting point for checking;
- script traverses the `redirect chain`;
- final redirect hostname is recorded in `last_known_mirror`;
- hostname from `initial_domain` is not added to the replacement map;
- filter rules with hostname from `initial_domain` are not changed;
- replacements are performed only from old `last_known_mirror` to new final hostname.

Example:

```text
https://example.sx/e/nemg6vqtnrkf
  -> https://new_example_mirror.sx/e/nemg6vqtnrkf
```

Result:

```yaml
last_known_mirror: new_example_mirror.sx
```

Do not replace:

```text
example.sx -> new_example_mirror.sx
```

Replace only if old mirror existed:

```text
previous_example_mirror.sx -> new_example_mirror.sx
```

#### Bare Domain as Discovery Entrypoint

Sometimes `initial_domain` is set as an ordinary domain without path but is actually a stable gateway/entrypoint domain
that redirects to the current mirror.

Example:

```yaml
initial_domain: patronspor.is
```

If it redirects to:

```text
patronmac86.cfd
```

it's not always correct to replace:

```text
patronspor.is -> patronmac86.cfd
```

because `patronspor.is` might be a stable entry point that should remain in filters.

For such cases, the watcher should explicitly set:

```yaml
initial_domain: patronspor.is
replace_initial_domain: false
```

This means: apply the same logic to bare domain as to URL with path.

In this mode:

- `patronspor.is` is used only to find the current mirror;
- `patronspor.is` is not replaced in filter files;
- found final hostname is recorded in `last_known_mirror`;
- if old `last_known_mirror` existed, only it is replaced.

Example:

```yaml
initial_domain: patronspor.is
replace_initial_domain: false
last_known_mirror: patronmac85.cfd
```

Redirect result:

```text
patronspor.is -> patronmac86.cfd
```

Then:

```yaml
last_known_mirror: patronmac86.cfd
```

Replacement:

```text
patronmac85.cfd -> patronmac86.cfd
```

But NOT:

```text
patronspor.is -> patronmac86.cfd
```

#### Replacement Source Selection

Algorithm for selecting source domains for replacement:

```text
if initial_domain is URL with non-root path:
  initial_domain host is discovery-only
  replacement sources = [previous last_known_mirror], if present

else if replace_initial_domain === false:
  initial_domain host is discovery-only
  replacement sources = [previous last_known_mirror], if present

else:
  initial_domain host is replaceable
  replacement sources = [initial_domain host, previous last_known_mirror], deduplicated
```

If there is no old `last_known_mirror`, discovery-only watcher updates only `watchers.yml` but should not change filter
files.

### 7.5 How False Replacements Are Prevented

Current protection against false replacements is built on several levels:

- `path` validation;
- `probe_text` validation;
- `skip_text` parked-domain detection;
- discovery-only exclusion for URL with path and bare domain with `replace_initial_domain: false`;
- deduplication and first-write-wins in replacement map;
- deduplication of the final domain list after replacements are applied;
- predicted mirror cleanup only on actual pattern rotation;
- natural sort scheme for deterministic primary mirror.

### 7.5.1 Final Domain-List Deduplication

After replacements and additional-domain appending are complete, the resulting domain list in an adblocker rule must
not contain duplicates.

This applies to:

- comma-separated hostname lists before blocker-specific cosmetic, HTML, script, or scriptlet markers;
- pipe-separated domain lists inside blocker modifiers/options such as `domain=`, `from=`, `denyallow=`, and `to=`,
  including AdGuard `$...` spellings and wrapper forms like `[$domain=...]`;
- mixed discovery-entrypoint / non-pattern cases where replacement can collapse two different source domains into the
  same resulting host.

Practical rule:

- if two entries normalize to the same domain after replacement, only one entry should remain in the final serialized
  domain list;
- deduplication should happen on the final processed list, not only on heuristic candidate selection or
  replacement-source selection.

Reason:

- duplicate domains in final filter lines are noise;
- they create unnecessary PR diff churn;
- they make resulting rules harder to review;
- they do not add any functional value.

### 7.6 Updating Production/Test Directories

The mode selects one directory:

- production modes → `filtersdir`
- test modes → `filtersdir_test`

Files are selected recursively by the pair `filterDirPattern` + `filePattern`.

## 8. Failure Handling

### 8.1 What Is Considered Failure

Failure is any result where no confirmed working mirror is found and which is not an accepted antibot or heuristic
non-pattern success.

Examples of failure:

- DNS failed;
- timeout / network errors;
- 4xx/5xx without `accept_antibot`;
- `probe_text` mismatch;
- `path` mismatch;
- parked / expired page via `skip_text`;
- redirect loop / exceeded redirect depth;
- redirect without `Location`.

### 8.2 When a Domain Is Considered Potentially Dead

If the final processing of a watcher completes without a found working domain, the watcher receives
`potentially_dead = true`.

By current implementation, this means:

- main check ended in failure and was not converted to accepted success;
- heuristic fallback did not provide a working mirror;
- or pattern-change scenario was detected but its final check failed and requires manual review.

The flag must NOT remain set if the watcher's final result is successful, even if:

- domain didn't change;
- success was accepted antibot;
- heuristic found non-pattern domain and filter files were not updated.

### 8.3 How `failed_since`, `failed_days`, `potentially_dead` Are Updated

Pseudocode:

```text
if first failure:
    failed_since = now
    failed_days = 0
    potentially_dead = true
else if repeated failure:
  nextFailedDays = days_since(failed_since)
  if nextFailedDays != failed_days:
    failed_days = nextFailedDays
    potentially_dead = true
```

Consequence: repeated failure without failure-state change and without day bucket change should not create an entry
just to update the same values.

`potentially_dead` is a result-level state flag, not a counter: it is either set on the current failure series or
cleared on success and should not be rewritten as a separate noise source without state change.

### 8.4 When Failure Is Reset

On any confirmed success:

- `last_seen` is updated;
- `failed_since` is removed;
- `failed_days` is removed;
- `potentially_dead` is removed.

This applies also to accepted antibot success.

### 8.4.1 State Noise Suppression

If a run doesn't change watcher status and doesn't change domain, state fields should not be rewritten just for a new
timestamp or re-recording the same value.

Practical rules:

- repeated success on the same `last_known_mirror` should not update `last_seen` without actual state transition;
- repeated failure should not rewrite `failed_since`;
- repeated failure should rewrite `failed_days` only if integer number of days changed;
- absence of state change should not produce unnecessary git diff and noisy logs.

### 8.5 Which Errors Are Considered Temporary

Temporary errors are those that trigger heuristic and may disappear on next run:

- timeout;
- abort;
- some connection errors;
- some HTTP codes from `forceHeuristicOnCodes`;
- parked/skip_text false positives if config is later corrected.

## 9. Batch Processing and Parallelism

### 9.1 Global Parallel

`processing.parallel` — legacy/global fallback for two types of parallelism if specialized limits are not explicitly
set:

- how many watchers simultaneously go through the main check phase (`processSite()` / resolve phase);
- how many heuristic HTTP candidate checks execute concurrently after DNS pre-filter.

That is, it's not a separate independent third queue but a common fallback limit for phase settings `resolveParallel`
and `heuristicParallel`. In the current code, specialized phase limits are more important.

### 9.2 `resolveParallel`

Parallelism of the main `processSite()` phase, i.e., how many watchers simultaneously go through the complete primary
check pipeline before heuristic fallback: starting URL selection, DNS pre-check, HTTP/redirect resolution, `path` /
`probe_text` / `skip_text` validation, and primary result classification.

### 9.3 `heuristicParallel`

Parallelism of HTTP checks for heuristic candidates.

### 9.4 Why You Can't Blindly Increase Parallelism

Too high parallelism can:

- increase DNS load;
- trigger stronger rate limit / antibot reaction;
- increase number of timeout / connection reset errors;
- make logs harder to diagnose;
- increase likelihood of flaky behavior on weak network.

### 9.5 What Operations Run in Parallel

Parallel:

- main site checks;
- DNS pre-filter heuristic candidates;
- heuristic HTTP candidate checks.

Not all operations are fully independent: selection of primary mirror must remain deterministic despite parallel
execution.

## 10. DNS Preflight / DNS Resolver

### 10.1 Why Pre-Flight DNS Check Is Needed

Before main work begins, the project checks that DNS is available at all. This prevents mass false failures if the
execution environment loses DNS.

### 10.2 Which Domains Are Checked

Checked:

- `google.com`
- `cloudflare.com`
- `adguard.com`

### 10.3 Which DNS Servers Are Used

Current project specification assumes a forced DNS resolver with servers:

- `8.8.8.8`
- `1.1.1.1`

This resolver should be used:

- for DNS preflight;
- for DNS pre-check before HTTP;
- for manual smoke/debug script.

### 10.4 What Behavior Is Fatal

If at least one of the three preflight hosts doesn't resolve via forced DNS resolver, the run is fatal and must
terminate immediately.

### 10.5 Why Unit Tests Shouldn't Mock Entire Node `dns` Module

Tests should not blindly replace the entire built-in module if a specific resolver-path is being checked. Better to
mock the specific API through which code actually does DNS lookup. Otherwise, you easily lose coverage of real logic
for choosing resolver implementation.

### 10.6 `test-dns-resolvers.mjs`

`test-dns-resolvers.mjs` is a manual smoke/debug tool, not part of the production pipeline.

Purpose:

- manually check forced DNS servers;
- compare resolve of major sites and problematic domains;
- quickly understand if the issue is in code or in the environment / network itself.

## 11. Git Integration

### 11.1 When a Commit Is Created

Only in `prod_live` and only if there are actual changes for which a skip reason didn't apply.

### 11.2 When a PR Is Created

If `git.mode = debug`, production live run creates a temporary branch and then a PR via GitHub CLI.

### 11.3 How `prod` and `debug` Differ

- `prod` — direct commit/push to target branch;
- `debug` — separate branch + PR.

### 11.4 Which Modes Don't Do Git Operations

- `test_live` — git logic is completely skipped;
- `test_dry` — commit/PR only simulated in logs;
- `prod_dry` — commit/PR only simulated in logs.

### 11.5 What Permissions GitHub Action Needs

For full functionality, example workflows require:

- `contents: write`
- `pull-requests: write`

Also needs accessible `GITHUB_TOKEN`.

## 12. Logging

### 12.1 What Events Are Logged

Logged:

- run start and selected mode;
- DNS preflight;
- start of site check;
- DNS pre-check;
- redirect chain;
- `probe_text` success/failure;
- skip_text detection;
- heuristic candidate checks;
- replacements;
- errors/warnings/summary;
- git mode / simulated commit info.

### 12.2 Where Logs Are Written

- to console;
- to file if `logging.saveToFile = true`.

### 12.3 What's Important for Diagnostics

Especially important:

- redirect chain;
- checked domain / actualCheckedDomain;
- error type (`dns`, `http`, `probe`, `network`, `skip_text`, `antibot_*`);
- `failed_days` warnings;
- replacement diff by files.

### 12.4 How to Read Redirect Chain

Redirect chain is an ordered trace of transitions. For long chains, formatter may abbreviate the middle, keeping start
and end.

## 13. Safety Guarantees / Invariants

- Dry run must not modify filter files.
- Test modes must not execute real production git operations.
- Discovery entrypoint / shortener domain must not be replaced instead of final mirror.
- URL with path is always discovery-only, even if hostname looks like ordinary mirror.
- `replace_initial_domain: false` makes bare domain discovery-only.
- If there is no old `last_known_mirror`, discovery-only watcher should update only `watchers.yml` but not filter files.
- If old `last_known_mirror` exists, replacement should execute only from old mirror to new mirror.
- You cannot automatically decide by redirect fact whether bare domain is gateway or old mirror; for this you need
  explicit `replace_initial_domain: false`.
- Parked / expired domain should not be considered working mirror on 200 OK alone.
- Unrelated redirect should not be accepted as valid success without passing `path` / `probe_text` / `skip_text` logic.
- Order of network request completion must not affect selected mirror.
- Same set of successful heuristic candidates must always result in same selected mirror.
- Deduplication must be performed before sorting.
- Sorting must be numeric-aware / natural sort.
- Heuristic selection must be deterministic even with parallel execution.
- New heuristic candidate should not automatically be considered "better" just because it has higher numeric suffix.
- Selected heuristic mirror must be minimum canonical candidate among all successful results.
- Predicted mirror cleanup must not remove all domains from rule without fallback.
- `force_search_ahead` must not break first-write-wins in primary replacement.
- Final domain lists in rewritten filter rules must not contain duplicate domains after replacement.

## 14. Testing

### 14.1 Test Types

The repository has:

- unit tests for helper functions and small modules;
- integration-like tests for resolver/replacer/batch behavior with mocks;
- manual smoke/debug tools (`test-dns-resolvers.mjs`);
- workflow examples for manual GitHub Action integration verification.

### 14.2 What Unit Tests Should Check

Minimally:

- pattern detection;
- redirect parsing;
- skip_text / probe_text interplay;
- heuristic deduplication and deterministic canonical selection;
- numeric-aware / natural sorting;
- replacement logic;
- git operation branching;
- DNS preflight behavior.

### 14.3 What Manual/Integration Tests Can Check

- real DNS paths;
- flaky external redirects;
- actual GitHub Action environment;
- interaction with test filter directories.

### 14.4 Why Real DNS/HTTP Tests Can Be Flaky

Because they depend on:

- external network;
- domain availability;
- rate limiting;
- Cloudflare / antibot;
- temporary DNS issues.

### 14.5 Which Scenarios Must Be Covered When Making Changes

- any heuristic generation changes;
- any heuristic canonical selection, deduplication, and sorting changes;
- any replacement map selection changes;
- any discovery-entrypoint semantic changes;
- new skip_text / parked-domain rules;
- new antibot handling branches;
- DNS resolver path changes.

## 15. Typical Scenarios for Adding New Sites

### 15.1 Ordinary Numbered Domain

```yaml
sites:
  Example (example*.com):
    initial_domain: example001.com
```

Suitable for standard pattern-based heuristic.

### 15.2 Site via Shortener / Redirect URL

```yaml
sites:
  Example:
    initial_domain: https://short.link/abc123
```

If this is discovery entrypoint, the entrypoint host must not appear in replacement source.

### 15.3 Bare Gateway Domain Without Replacing initial_domain

```yaml
sites:
  Example:
    initial_domain: gateway.example
    replace_initial_domain: false
    last_known_mirror: mirror85.example
```

Used when `gateway.example` is needed only as stable entry point and replacements in filter files should execute only
on old `last_known_mirror`.

### 15.4 Site with Cloudflare / Antibot

```yaml
sites:
  Example:
    initial_domain: example001.com
    accept_antibot: true
```

### 15.5 Site with Path Verification

```yaml
sites:
  Example:
    initial_domain: https://mirror.example/e/xyz
    path: e/xyz
```

### 15.6 Site with Parked-Domain False Positives

```yaml
sites:
  Example:
    initial_domain: example001.com
    probe_text:
      - Unique marker
    skip_text_allow:
      - Redirecting...
```

## 16. Typical Errors and Diagnostics

### DNS Failed

Check:

- DNS preflight;
- forced DNS servers;
- `test-dns-resolvers.mjs`;
- environment/network.

### Redirect Loop

Check `redirectDepth` and full redirect chain.

### Probe_text Mismatch

Check `finalBody`, correctness of `probe_text`, whether you landed on landing page / antibot / parked page.

### Path Mismatch

Check `site.path` and `finalUrl`. Usually means mirror redirects to wrong endpoint.

### Parked Domain Detected

Check triggered `skip_text`, page body, whether you need `skip_text_allow` or more precise `probe_text`.

### No Replacement Found

Check:

- was there actual `hostChanged`;
- is `initial_domain` discovery-only;
- is `replace_initial_domain: false` enabled;
- is heuristic result non-pattern;
- does final host match already known `last_known_mirror`.

### No Changes Detected

Usually means:

- all domains are already up to date;
- changes only affected transient entrypoint resolution;
- filter cleanup didn't produce line edits.

Important: `No changes detected` and `Unchanged sites` list should be determined by comparing final `newHost` with
previous `last_known_mirror` that was in the watcher before run start. Discovery entrypoint itself is not a basis for
this classification. That is, a watcher should not be considered unchanged just because the starting URL was
shortener/gateway and `startedHost` differed from replacement source.

### GitHub Token Permissions Problem

Check workflow permissions and availability of `GITHUB_TOKEN`.

## 17. Rules for Future Changes

- Make minimal patches and don't mix independent changes.
- Don't change Jest/TS/ESM infrastructure without separate reason and separate validation.
- Don't mock built-in Node modules too broadly; mock specific API/use-site.
- New features and bugfixes must be accompanied by tests.
- Replacement algorithm changes require especially careful review because they can mass-rewrite filter files.
- Discovery-entrypoint semantic changes should be accompanied by separate test cases for shortener/gateway scenarios.
- `skip_text` changes should be verified for false positive / false negative scenarios.

## Open Questions / TODO

1. `TODO: clarify` format of `last_seen`. README.md shows date-only form, `src/types.ts` comment says `YYYY-MM-DD
   HH:MM`, but `src/index.ts` actually saves date-only.
2. `TODO: clarify` final implementation of forced DNS helper in current worktree. Codebase and local file state must be
   verified before branch merge to ensure specification requirement for forced DNS resolver unambiguously matches
   actual helper-path.
