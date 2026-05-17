# Rotating Domains Checker

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Rotating%20Domains%20Checker-blue?logo=github)](https://github.com/marketplace/actions/rotating-domains-checker)
[![GitHub release](https://img.shields.io/github/v/release/Alex-302/RotatingDomainsChecker)](https://github.com/Alex-302/RotatingDomainsChecker/releases)

Automates redirect checking for ad blocking filter lists. Tracks frequently changing domains and automatically updates filter rules. Available as both a standalone tool and a GitHub Action.

## Table of Contents

- [Purpose](#purpose)
- [Installation](#installation)
- [GitHub Actions Integration](#github-actions-integration)
  - [Quick Setup](#quick-setup)
  - [Required Setup](#required-setup)
- [Usage](#usage)
  - [Run Modes](#run-modes)
- [Configuration](#configuration)
  - [config.yml](#configyml)
  - [watchers.yml](#watchersyml)
- [Integration Guide](#integration-guide)
  - [Integration with Filters Repository](#integration-with-filters-repository)
  - [Using Your Own Fork](#using-your-own-fork)
  - [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
  - [Testing Best Practices](#testing-best-practices)
  - [Integration Examples](#integration-examples)
- [Safety](#safety)
- [Check Results](#check-results)
- [Adding a New Site](#adding-a-new-site-to-watchersyml)
- [Replacement Logic](#replacement-logic)
- [Logging](#logging)
- [Project Structure](#project-structure)
- [Local Usage](#local-usage)
- [Troubleshooting](#troubleshooting)
- [Cloudflare / Antibot Sites with Rotating Domains](#cloudflare--antibot-sites-with-rotating-domains)
- [Requirements](#requirements)
- [License](#license)

## Installation

Create `.github/workflows/rotating-domains-checker.yml` in your repository:

<details>
<summary>Workflow YAML example</summary>

```yaml
name: Rotating Domains Checker

on:
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:
    inputs:
      mode:
        description: 'Run mode'
        required: false
        default: 'prod_live'
        type: choice
        options:
          - ''
          - 'prod_live'
          - 'prod_dry'
          - 'test_live'
          - 'test_dry'

jobs:
  check-domains:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v6
      - name: Configure git user
        run: |
          git config --global user.email "github-actions[bot]@users.noreply.github.com"
          git config --global user.name "github-actions[bot]"
      - uses: Alex-302/RotatingDomainsChecker@v1
        with:
          mode: ${{ github.event.inputs.mode || '' }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

</details>

Then add [`config.yml`](#configyml) and [`watchers.yml`](#watchersyml) to your repository root.

For advanced use cases (fork, customization), see the [Integration Guide](#integration-guide).

## Purpose

- Track HTTP redirects to new website mirrors with loop protection
- Follow JavaScript and `<meta>` refresh redirects (`location.replace()`, `window.location.href`, `location.href`, `<meta http-equiv="refresh">`)
- Heuristics for sequentially numbered domains:
  - `domain[N].tld` - number after domain name (e.g., `example1916.com`)
  - `domain[N][text].tld` - number with text suffix (e.g., `example126aa.de`)
  - `[N]domain.tld` - number before domain name (e.g., `7example.com`)
- Verify key phrases in HTML using `probe_text`
- Verify URLs/paths via `path` to avoid redirects to unrelated sites
- Log complete redirect chains
- Automatic replacement in filter files
- Detect and handle antibot/Cloudflare protection with `accept_antibot` option
- Detect parked/expired domains to avoid false positives
- Batch checks with parallelism
- Failure day counter with warnings for potentially dead sites
- Auto-update information about tracked domains
- Git integration (PR/commit support)

## GitHub Actions Integration

### Quick Setup

See [Installation](#installation) for a minimal workflow you can copy directly.

For a full workflow with all options (custom config path, filters path, comments), see [example-external-public.yml](.github/workflows/example-external-public.yml).

### Required Setup

Create `config.yml` and `watchers.yml` files in your repository root. See detailed field descriptions in the [Configuration](#configuration) section.

## Usage

### Run Modes

| Mode            | Domain Checks | File Modifications | Git Operations | Filter Directory          |
|-----------------|---------------|--------------------|----------------|---------------------------|
| **`prod_live`** | ✅            | ✅                 | ✅ Commit/PR   | `filtersdir` (production) |
| **`prod_dry`**  | ✅            | ❌                 | 📋 Simulated   | `filtersdir` (production) |
| **`test_live`** | ✅            | ✅                 | ❌ Skipped     | `filtersdir_test` (test)  |
| **`test_dry`**  | ✅            | ❌                 | 📋 Simulated   | `filtersdir_test` (test)  |

**Mode descriptions:**

- **`prod_live`** (`npm run prod_live`) - Full production run: checks domains, updates files, creates commit/PR (based on `git.mode` in `config.yml`)
- **`prod_dry`** (`npm run prod_dry`) - Production dry run: checks domains, shows commit message preview (no actual file modifications or git operations)
- **`test_live`** (`npm run test_live`) - Test run with modifications: checks domains, updates test files only (skips git operations entirely)
- **`test_dry`** (`npm run test_dry`) - Test dry run: checks domains, shows commit message preview for test files (no modifications or git operations)

**Git operations:**

- **Commit/PR** (`prod_live`) - Executes real git commands: creates commits or pull requests based on `git.mode` setting in `config.yml`
- **Simulated** (`prod_dry`, `test_dry`) - Generates and displays commit message, but doesn't execute git commands
- **Skipped** (`test_live`) - Bypasses git code entirely for fast local testing with file modifications

> **Note:** The `git.mode` setting in `config.yml` (`"prod"` for direct commit or `"debug"` for PR) only affects `prod_live` mode. Test modes always skip git operations.

## Configuration

### config.yml

Core settings for HTTP requests, processing, and git operations.

<details>
<summary>config.yml example</summary>

```yaml
# Git operations settings
git:
  mode: "debug"           # "prod" = direct commits, "debug" = create PR
  branch: "master"
  prBranchPrefix: "domain-rotate"

# Filters directory settings
filtersdir:
  repoPath: "./"                    # Path to filters directory
  filterDirPattern: "*Filter"       # Directories ending with "Filter"
  filePattern: "*.txt"

# HTTP settings
http:
  timeout: 10000          # Request timeout (ms)
  retries: 2              # Number of retry attempts
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

# Processing settings
processing:
  parallel: 10           # Global parallelism
  resolveParallel: 20    # Concurrent resolve checks
  heuristicParallel: 50  # Concurrent heuristic checks

# Global skip_text — skip domains whose response body contains these phrases (parked/expired domains)
skip_text:
  - "This domain is parked"

# Logging
logging:
  saveToFile: true
  filePath: "logs/rotating-domains-checker.log"
```

</details>

### watchers.yml

List of sites to monitor with their verification rules.

<details>
<summary>watchers.yml example</summary>

```yaml
sites:
  example.com:
    # Required: at least one of these must be specified
    initial_domain: "example.com"       # Starting point for checks. Can be a plain domain or a redirect URL
                                        # (e.g. "https://t.me/s/channel" or "https://short.link/abc").
                                        # Recommended for new sites. If this URL has no numeric pattern,
                                        # heuristic candidate generation automatically falls back to last_known_mirror.
    last_known_mirror: "example.com"    # Last working mirror (auto-updated by script).
                                        # With force_search_ahead, always set to the naturally
                                        # smallest domain among all found working mirrors.

    # Optional verification fields
    path: "/"                           # Path to check on domain (default: "/")
    probe_text: "Example Domain"        # Key phrases for content verification (array or string)
    skip_text: "This domain is parked"  # Skip domains containing this text (array or string)
    skip_text_allow:                    # Allow specific phrases from global skip_text for this site
      - Redirecting...                # Exact match exclusion — this phrase won't trigger skip

    # Optional heuristic control
    disable_heuristic: false            # Disable heuristic search (default: false)
    force_search_ahead: false           # Continue searching all candidates after finding first working domain (default: false)

    # Optional antibot handling
    accept_antibot: false               # Accept Cloudflare/antibot responses as working (default: false)

    # Optional geo-blocking
    geoblock: ""                        # Country code for geo-blocking (e.g. "TR", "US"). Not used, just for information.

    # Auto-generated fields (updated by the script)
    last_seen: "2026-01-21"             # Last successful check (date only)
    failed_since: ""                    # Date when site first failed
    failed_days: 0                      # Days since last failure
    potentially_dead: false             # Marked as potentially dead after many failures

    # Advanced auto-generated fields (rarely needed)
    pattern_changed: false              # Flag: site changed from pattern to non-pattern
    heuristic_history: []               # History of working pattern domains (auto-updated when switching between pattern/non-pattern)
    non_pattern_mirror: ""              # Current non-pattern mirror when pattern_changed=true
```

</details>

## Integration Guide

### Integration with Filters Repository

Integrate Rotating Domains Checker into your ad blocking filters repository.

#### Step 1: Add Workflow

Copy the example workflow to your filters repository:

- **[example-external-public.yml](.github/workflows/example-external-public.yml)** - For external filters repository (uses `uses:` action syntax)
- **[example-local-testing.yml](.github/workflows/example-local-testing.yml)** - For local testing (runs in this repository)

Rename it to `.github/workflows/rotating-domains-checker.yml` and adjust as needed.

#### Step 2: Create Configuration Files

Create `config.yml` and `watchers.yml` in your repository root. See the [Configuration](#configuration) section for detailed field descriptions and examples.

**Key settings for filters repository:**

```yaml
git:
  mode: "debug"                    # "prod" = direct commits, "debug" = create PR
  branch: "master"
  prBranchPrefix: "domain-rotate"  # Prefix for PR branches

filtersdir:
  repoPath: "./"          # Path to your filters directory
  filterDirPattern: "*Filter"
  filePattern: "*.txt"
```

#### Step 3: Test Integration

1. Push workflow and config files to your repository
2. Run manually via GitHub Actions tab
3. Review created PR with domain updates
4. Merge if satisfied or adjust configuration

### Using Your Own Fork

For maximum security and control, use your own fork of the action.

#### Step 1: Fork the Repository

```bash
git clone https://github.com/%YOUR_USERNAME%/RotatingDomainsChecker.git
cd RotatingDomainsChecker
```

#### Step 2: Review and Customize

```bash
# Review the code
npm ci
npm run build

# Run tests
npm run test_dry

# Make customizations if needed
```

#### Step 3: Use Your Fork in Workflow

Update the workflow to use your fork:

```yaml
- uses: %YOUR_USERNAME%/RotatingDomainsChecker@v1
  with:
    mode: prod_live
```

#### Step 4: Keep Updated

```bash
# Sync with upstream
git remote add upstream https://github.com/%YOUR_USERNAME%/RotatingDomainsChecker.git
git fetch upstream
git merge upstream/main
git push origin main
```

### Monitoring and Troubleshooting

#### Check Workflow Results

1. **GitHub Actions tab** - View workflow runs
2. **Step Summary** - See detailed results
3. **Log files** - Check `logs/rotating-domains-checker.log` in your repository
4. **Pull Requests** - Review created PRs (in `debug` mode)

#### Common Issues

**Permission Errors**

```yaml
# Ensure proper permissions in workflow
permissions:
  contents: write
  pull-requests: write
```

**Configuration Not Found**

```yaml
# Verify config path is correct
config-path: './config.yml'  # Must exist in repository root
```

**No Changes Detected**

- Check if domains are actually rotating
- Verify `probe_text` matches current site content
- Review `watchers.yml` configuration
- Check logs for errors

**Git Operations Failed**

- Verify `GITHUB_TOKEN` has correct permissions
- Ensure workflow has `contents: write` and `pull-requests: write` permissions
- Enable "Allow GitHub Actions to create and approve pull requests" in repository `Settings` → `Actions` → `General`

### Cloudflare / Antibot Sites with Rotating Domains

For sites behind Cloudflare or other antibot protection that also rotate domains (e.g. `example39.com` → `example40.com`), use the combination of `accept_antibot` and `force_search_ahead`:

```yaml
sites:
  example16.com:
    last_known_mirror: example39.com
    accept_antibot: true          # Accept Cloudflare 403 as "working"
    force_search_ahead: true      # Collect ALL working domains with antibot protection
```

**When to use `force_search_ahead`:**

This is **recommended** when a site rotates domains frequently and multiple mirrors may be active simultaneously. Without this flag, only the first working domain is collected, potentially missing other active mirrors that users might access directly.

**How it works:**

Heuristic candidate search is always triggered regardless of whether the current `last_known_mirror` is alive or dead. All final working domains (after following redirects) are collected into filter rules.

`last_known_mirror` is always set to the **naturally smallest** domain among all collected working mirrors (e.g. `example9.live` wins over `example18.live`, `example18.live` wins over `example20.live`), ensuring deterministic selection even when parallel HTTP checks complete in arbitrary order.

If `initial_domain` is a redirect shortener or URL without a numeric pattern (e.g. `https://ksln.link/abc`), heuristic candidate generation automatically falls back to `last_known_mirror` to extract the pattern.

**Without `force_search_ahead` (default):**

```text
✅ example949.com → HTTP 403 → STOP (first working domain found)
❌ example950.com → NOT CHECKED
❌ example951.com → NOT CHECKED
Result in filter: example949.com
```

**With `force_search_ahead: true` (current domain alive):**

```text
✅ example949.com → HTTP 200 (Phase 1 success, collected)
✅ example950.com → HTTP 200 → collected
✅ example951.com → HTTP 301 → example952.com (200) → example952.com collected
❌ example953.com → DNS FAILED → skipped
...
Result in filter: example949.com,example950.com,example952.com
```

**With `force_search_ahead: true` (current domain dead / antibot):**

- `force_search_ahead` triggers heuristic search to find neighboring domains
- All found final domains (even behind antibot) are added to filter rules
- This is preferred over missing actual domains — better to have extra domains in the rule than to miss a working one

```text
❌ example948.com → DNS FAILED (Phase 1 failed)
✅ example949.com → HTTP 403 → CONTINUE searching
✅ example950.com → HTTP 403 → CONTINUE searching
✅ example951.com → HTTP 403 → CONTINUE searching
❌ example952.com → DNS FAILED → CONTINUE searching
...
Result in filter: example949.com,example950.com,example951.com
```

**Redirect patterns as indicators:**

When many domains redirect to a single domain, this **may indicate** that the final domain is a real working mirror, not just an antibot placeholder:

```text
example930.com (301) → helper.com (302) → example949.com (403)
example931.com (301) → helper.com (302) → example949.com (403)
example932.com (301) → helper.com (302) → example949.com (403)
...
example948.com (301) → helper.com (302) → example949.com (403)
example949.com → HTTP 403 (direct response)
example950.com → HTTP 403 (direct response)
```

In this case, `example949.com` and `example950.com` are likely real mirrors (direct antibot responses), while `example930-948.com` are convenience redirects for users. Only the final working domains are added to filters.

**Important:** Ensure `forceHeuristicOnCodes` in `config.yml` includes `403`:

```yaml
heuristic:
  forceHeuristicOnCodes: [403, 404, 500, 502, 503, 504]
```

### Testing Best Practices

#### 1. Start with Dry Modes

- Begin with `prod_dry` mode to test without making changes
- Use `git.mode: "debug"` in config.yml to create PRs instead of direct commits
- Review changes before merging

#### 2. Review Results

- Check workflow summaries for errors
- Review created PRs carefully
- Monitor domain success rates
- Check for antibot detections

#### 3. Maintain Configuration

- Update domain patterns regularly
- Remove dead sites from `watchers.yml`
- Adjust timeouts and thresholds as needed
- Keep `probe_text` current

#### 4. Security

- Use specific commit SHAs instead of branch names for maximum security
- Consider using your own fork
- Limit workflow permissions to minimum required
- Review code changes before merging PRs

### Integration Examples

#### Basic Production Setup

```yaml
# Fully automated with direct commits
env:
  INPUT_MODE: 'prod_live'
```

```yaml
# config.yml
git:
  mode: "prod"  # Direct commits
```

#### Safe Review Setup

```yaml
# Create PRs for manual review
env:
  INPUT_MODE: 'prod_live'
```

```yaml
# config.yml
git:
  mode: "debug"  # Create PRs
```

#### Testing Setup

```yaml
# Test without making changes
env:
  INPUT_MODE: 'prod_dry'  # Dry run mode
```

```yaml
# config.yml
git:
  mode: "debug"  # Would create PR if not dry run
```

## Safety

- Processes only domains that are in the `watchers.yml` file
- Processes only files located in the configured filter directory
- **Loop protection**: Prevents infinite redirect chains
- **Content verification**: Checks `probe_text` and `path` before accepting domains
- **Antibot handling**: Detects Cloudflare/antibot protection with option to accept or skip protected sites
- **Parallelism limits**: Configurable concurrency to avoid server overload
- **Dry run modes**: Testing without making changes

## Check Results

Rotating Domains Checker provides detailed logs showing:

- Redirect chains followed
- Heuristic attempts performed
- Content verification results
- Replacements performed
- Completed git operations

## Adding a New Site to watchers.yml

```yaml
sites:
  yoursite.com:
    initial_domain: "yoursite.com"    # Required for new sites
    last_known_mirror: "yoursite.com"
    probe_text: "Your Site Title"     # Optional: key phrases to verify
    path: "/"                         # Optional: specific path to check

    # These fields will be auto-updated by the script:
    # last_seen: "2026-01-21"
    # failed_since: ""
    # failed_days: 0
```

## Replacement Logic

1. **Redirect Resolution**: Follow HTTP 3xx redirects
2. **JS/Meta Redirect Resolution**: Parse HTML body for JavaScript (`location.replace()`, `window.location.href`, `location.href`) and `<meta http-equiv="refresh">` redirects and follow them as part of the same redirect chain
3. **Parked Domain Detection**: Check response body against `skip_text` phrases before following client-side redirects — if matched, the domain is considered parked/expired and heuristic search is triggered. Individual phrases can be excluded per-site using `skip_text_allow` in `watchers.yml` (exact match)
4. **Heuristic Search**: Try numbered domain patterns
5. **Content Verification**: Check `probe_text` and `path`
6. **Filter Updates**: Replace old domains with new ones
7. **Git Operations**: Create commits or PRs

## Logging

- **File logging**: Detailed logs saved to configured path
- **Console output**: Real-time progress information
- **GitHub Actions**: Step summaries and results

## Project Structure

```bash
RotatingDomainsChecker/
├── src/                 # TypeScript source code
├── dist/                # Compiled JavaScript
├── config.yml           # Configuration
├── watchers.yml         # Sites to monitor
├── logs/                # Log files
└── action.yml           # GitHub Action metadata
```

## Local Usage

```bash
# Clone repository
git clone https://github.com/%YOUR_USERNAME%/RotatingDomainsChecker.git
cd RotatingDomainsChecker

# Install dependencies
npm install

# Build
npm run build

# Run with test filter
npm run test_live
```

## Testing

The project includes a comprehensive test suite covering all core functionality.

### Running Tests

```bash
# Run all tests - summary only
npm test

# Run tests with detailed output - shows each test
npm test -- --verbose

# Run tests without coverage (faster)
npm run test:run

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- --testNamePattern="hooks"

# Run hooks tests only
npm test -- --testPathPattern="hooks"
```

**Note:** To make verbose mode the default, uncomment `verbose: true` in `jest.config.ts`.

### Test Structure

The test suite is organized in the `__tests__/` directory:

- **`replacer.test.ts`** - Tests domain replacement logic, pattern matching, and filter file processing
- **`batch.test.ts`** - Tests batch processing, heuristic candidate generation, and site checking logic
- **`httpResolver.test.ts`** - Tests HTTP resolution, retry logic, and antibot detection
- **`probe.test.ts`** - Tests content probe verification
- **`git.test.ts`** - Tests Git operations, commit message generation, and PR creation
- **`config.test.ts`** - Tests configuration loading and YAML handling
- **`hooks.test.ts`** - Tests pre-commit hook validation (Conventional Commits, English-only messages)

### Test Coverage

The test suite provides comprehensive coverage of:

- Domain pattern matching (`domain[N].tld`, `[N]domain.tld`, `domain[N][text].tld`)
- Heuristic candidate generation and validation
- DNS pre-check and HTTP resolution
- Content probe verification
- Git operations (commits and pull requests)
- Configuration parsing and validation
- Error handling and edge cases
- Pre-commit hook validation (Conventional Commits, English-only messages)

### Pre-commit Hooks

The project uses Husky for pre-commit hooks:

```bash
# commit-msg hook validates:
- Conventional Commits format (feat:, fix:, chore:, etc.)
- Auto-generated messages (Rotating Domains Checker: ...)
- English-only messages (rejects Cyrillic)

# pre-commit hook runs:
npm run lint          # ESLint checks
# npm run format:check  # Prettier formatting check (disabled)
npx tsc --noEmit      # TypeScript type checking
npm test              # All tests must pass
```

### ESM Support

The project uses Jest with ESM support. Tests use `jest.unstable_mockModule` for mocking Node.js core modules like `dns` and `child_process`. All test files are configured to run with `--experimental-vm-modules` flag.

## Troubleshooting

1. **Git identity errors**: Configure `git` user before running
2. **Permission denied**: Check `GITHUB_TOKEN` permissions
3. **Timeout errors**: Increase `http.timeout` in config.yml
4. **No replacements found**: Check `probe_text` and patterns

## Requirements

- Node.js 20+
- npm
- Git

## License

MIT.