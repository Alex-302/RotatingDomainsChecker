# Rotating Domains Checker

Automates redirect checking for ad blocking filter lists. Tracks frequently changing domains and automatically updates filter rules. Available as both a standalone tool and a GitHub Action.

## Table of Contents

- [Purpose](#purpose)
- [Quick Setup](#quick-setup)
- [Required Setup](#required-setup)
- [Usage](#usage)
  - [Run Modes](#run-modes)
  - [GitHub Action Modes](#github-action-modes)
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
- [Requirements](#requirements)
- [Creating Personal Access Token (PAT)](#creating-personal-access-token-pat)
- [License](#license)

## Purpose

- Track HTTP redirects to new website mirrors with loop protection
- Heuristics for sequentially numbered domains `domain[N].tld` / `domain[N][text].tld`
- Verify key phrases in HTML using `probe_text`
- Verify URLs/paths via `path` to avoid redirects to unrelated sites
- Log complete redirect chains
- Automatic replacement in filter files
- Detect antibot/Cloudflare
- Batch checks with parallelism
- Failure day counter with warnings for potentially dead sites
- Auto-update information about tracked domains
- Git integration (PR/commit support)

## GitHub Actions Integration

### Quick Setup

Add this workflow to your repository (`.github/workflows/rotating-domains-checker.yml`):

<details>
<summary>Workflow YAML example</summary>

```yaml
name: Rotating Domains Checker

on:
  # Automatic run daily at 02:00 UTC
  schedule:
    - cron: '0 2 * * *'
  # Manual run with mode selection
  workflow_dispatch:
    inputs:
      mode:
        description: 'Run mode' # Overrides config.yml setting
        required: false
        default: 'prod_live'
        type: choice
        options:
          - ''              # Use config.yml setting
          - 'prod_live'     # Production mode with changes
          - 'prod_dry'      # Production mode without changes (git operations simulation)
          - 'test_live'     # Test directory with changes
          - 'test_dry'      # Test directory without changes (git operations simulation)

      config-path:
        description: 'Path to configuration file'
        required: false
        default: './config.yml'
        type: string

      filters-path:
        description: 'Path to filters directory'
        required: false
        default: './'
        type: string

jobs:
  check-domains:
    name: Rotating Domains Checker
    runs-on: ubuntu-latest

    # Permissions for git operations
    permissions:
      contents: write          # Required for commits
      pull-requests: write     # Required for PR creation
      actions: read            # Required for reading workflow info

    steps:
      - name: 📥 Checkout repository
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 1       # Only last commit for speed

      - name: 🔧 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'

      - name: 🚀 Run Rotating Domains Checker
        id: check-domains
        run: |
          # Configure git user for commits
          git config --global user.email "github-actions[bot]@users.noreply.github.com"
          git config --global user.name "github-actions[bot]"
          
          # Clone Rotating Domains Checker repository
          # For public repository: use simple clone without token
          git clone https://github.com/%YOUR_USERNAME%/RotatingDomainsChecker.git /tmp/checker
          # For private repository: use PAT token
          # git clone https://${{ secrets.PAT_TOKEN }}@github.com/%YOUR_USERNAME%/RotatingDomainsChecker.git /tmp/checker
          
          cd /tmp/checker
          npm install
          npm run build
          
          # Return to repository and run Rotating Domains Checker
          cd $GITHUB_WORKSPACE
          node /tmp/checker/dist/index.js
        env:
          GITHUB_TOKEN: ${{ secrets.PAT_TOKEN }}
          INPUT_CONFIG_PATH: ${{ github.event.inputs.config-path || './config.yml' }}
          INPUT_MODE: ${{ github.event.inputs.mode || '' }}
          INPUT_FILTERS_PATH: ${{ github.event.inputs.filters-path || './' }}
```

</details>

### Required Setup

Create `config.yml` and `watchers.yml` files in your repository root. See detailed field descriptions in the [Configuration](#configuration) section.

> **Note:** If the Rotating Domains Checker repository is **private**, you'll need to configure a Personal Access Token. See [Creating Personal Access Token](#creating-personal-access-token-pat) section.

## Usage

### Run Modes

| Mode | Checks | Replacements | Save | File Log | Git Action | Purpose |
| ------ | -------- | -------------- | ------ | ---------- | ------------ | --------- |
| `prod_live` | ✅ | ✅ | ✅ | ✅ | Commit/PR | Production mode |
| `prod_dry` | ✅ | ❌ | ❌ | ✅ | None | Test + git simulation |
| `test_live` | ✅ | ✅ | ✅ | ✅ | Commit/PR | Test directory |
| `test_dry` | ✅ | ❌ | ❌ | ✅ | None | Test dir + git simulation |

#### Run Commands

- **`prod_live`**: `node dist/index.js` or `npm run run`
- **`prod_dry`**: `node dist/index.js --dry-run` or `npm run dry`
- **`test_live`**: `node dist/index.js --mode=test_local` or `npm run test:local`
- **`test_dry`**: `node dist/index.js --mode=test_local --dry-run` or `npm run test:local:dry`

### GitHub Action Modes

- **`prod_live`** - Production mode with changes applied (commit or PR from config.yml)
- **`prod_dry`** - Production mode without changes (git operations simulation)
- **`test_live`** - Test directory processing with changes applied (uses filtersdir_test)
- **`test_dry`** - Test directory without changes (git operations simulation)

> **Note:** Git mode (commit or PR) is configured in config.yml via `git.mode`

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
    # Required field
    last_known_mirror: "example.com"
    
    # Optional fields
    initial_domain: "example.com"     # Initial site domain
    path: "/"                         # Path to check on domain
    probe_text: "Example Domain"      # Key phrases for content verification
    disable_heuristic: false          # Disable heuristic search
    accept_antibot: false             # Accept antibot responses as working
    geoblock: ""                      # Country code for geo-blocking (e.g. "TR")
    
    # Auto-generated fields (updated by the script)
    last_seen: "2026-01-21 12:00"     # Last successful check
    last_failed: ""                   # Last failed check
    failed_days: 0                    # Days since last failure
```

</details>

## Integration Guide

### Integration with Filters Repository

Integrate Rotating Domains Checker into your ad blocking filters repository.

#### Step 1: Add Workflow

Copy one of the example workflows from `.github/workflows/` to your filters repository:

- **[example-external-public.yml](.github/workflows/example-external-public.yml)** - For public RotatingDomainsChecker repository
- **[example-external-private.yml](.github/workflows/example-external-private.yml)** - For private RotatingDomainsChecker repository  
- **[example-local-testing.yml](.github/workflows/example-local-testing.yml)** - For local testing

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
npm install
npm run build

# Run tests
npm run test:local:dry

# Make customizations if needed
```

#### Step 3: Use Your Fork in Workflow

Update the workflow to use your fork:

```yaml
# Clone your fork instead
git clone https://github.com/%YOUR_USERNAME%/RotatingDomainsChecker.git /tmp/checker
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
INPUT_CONFIG_PATH: './config.yml'  # Must exist in repository root
```

**No Changes Detected**

- Check if domains are actually rotating
- Verify `probe_text` matches current site content
- Review `watchers.yml` configuration
- Check logs for errors

**Git Operations Failed**

- Verify `PAT_TOKEN` secret is configured
- Check token has `repo` permissions
- Ensure git user is configured in workflow

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
- **Antibot detection**: Skips sites with Cloudflare/antibot protection
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
    initial_domain: "yoursite.com"
    last_known_mirror: "yoursite.com"
    last_seen: "2026-01-21"
    last_failed: ""
    failed_days: 0
    probe_text: "Your Site Title"
    path: "/"
```

## Replacement Logic

1. **Redirect Resolution**: Follow HTTP 3xx redirects
2. **Heuristic Search**: Try numbered domain patterns
3. **Content Verification**: Check `probe_text` and `path`
4. **Filter Updates**: Replace old domains with new ones
5. **Git Operations**: Create commits or PRs

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
npm run test:local
```

## Troubleshooting

### Common Issues

1. **Git identity errors**: Configure `git` user before running
2. **Permission denied**: Check `PAT_TOKEN` permissions
3. **Timeout errors**: Increase `http.timeout` in config.yml
4. **No replacements found**: Check `probe_text` and patterns

## Requirements

- Node.js 20+
- npm
- Git
- Personal Access Token (for GitHub Actions)

## Creating Personal Access Token (PAT)

**When needed:** Only required if:

- The Rotating Domains Checker repository is **private**
- You need to create Pull Requests (requires `repo` scope)

**Not needed if:**

- The Rotating Domains Checker repository is **public** (default `GITHUB_TOKEN` is sufficient)
- You only use direct commits mode

### How to Create PAT

1. **Open GitHub Settings**:
   - Click your avatar (top right) → **Settings**
   - Scroll down to **Developer settings** (left panel)

2. **Create token**:
   - Click **Personal access tokens** → **Tokens (classic)**
   - Click **Generate new token** → **Generate new token (classic)**

3. **Configure token**:
   - **Note**: `RotatingDomainsChecker` (or any descriptive name)
   - **Expiration**: Choose expiration period (recommended 90 days or No expiration)
   - **Scopes**: ✅ Check `repo` (Full control of private repositories)
   - Click **Generate token**

4. **Copy token**:
   - ⚠️ **IMPORTANT**: Copy the token immediately - it won't be shown again!
   - Save it in a secure place (password manager recommended)

### How to Add PAT to Repository

1. **Open repository settings**:
   - Go to your target repository (e.g., `YourUsername/AdguardFilters`)
   - Click **Settings** tab

2. **Add secret**:
   - Left panel → **Secrets and variables** → **Actions**
   - Click **New repository secret**

3. **Configure secret**:
   - **Name**: `PAT_TOKEN` (exactly as shown)
   - **Value**: Paste the copied token
   - Click **Add secret**

4. **Update workflow**:

   - Uncomment the line with PAT token in the workflow:

   ```yaml
   # git clone https://${{ secrets.PAT_TOKEN }}@github.com/%YOUR_USERNAME%/RotatingDomainsChecker.git /tmp/checker
   ```

✅ **Done!** The workflow will now use `PAT_TOKEN` for accessing private repository.

## License

MIT.
