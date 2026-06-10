#!/usr/bin/env node

import { loadConfig, loadWatchers, saveWatchers } from "./config.js";
import { BatchProcessor } from "./batch.js";
import { HttpResolver } from "./httpResolver.js";
import { FilterReplacer } from "./replacer.js";
import { GitManager } from "./git.js";
import { Logger, LogLevel } from "./logger.js";
import { connectionDiagnostics } from "./diagnostics.js";
import { resolveHostname } from "./dnsResolver.js";
import type { Summary, UnchangedWatcherEntry } from "./types.js";
import { appendFileSync } from "fs";
import { naturalCompare, calculateDaysSince, formatWatcherSummaryEntry, isRealDomainChange } from "./utils.js";

// Re-export for backward compatibility (tests import from index.ts)
export { naturalCompare, calculateDaysSince, formatWatcherSummaryEntry, isRealDomainChange };

/**
 * Determines whether git operations should be skipped and why.
 * Exported for testability.
 */
export function gitSkipReason(
  isTestMode: boolean,
  dryRun: boolean,
  hasRealChanges: boolean,
): string | null {
  if (isTestMode && !dryRun) return "test mode (files were modified locally)";
  if (!hasRealChanges) return "no filter changes (all domains already up to date)";
  return null;
}

// Version
const VERSION = "1.4.5";

/**
 * From newHost + additionalWorkingDomains, pick the first domain after natural sorting.
 * This ensures consistent, deterministic selection (lowest-numbered pattern domain first).
 */
export function selectFirstByOrder(newHost: string, additionalDomains?: string[]): string {
  if (!additionalDomains || additionalDomains.length === 0) return newHost;
  const all = [newHost, ...additionalDomains];
  all.sort(naturalCompare);
  return all[0];
}

function normalizeDomainForPatternCheck(domain: string): string {
  return domain.replace(/^www\./, '').toLowerCase();
}

function matchesNumericPattern(domain: string): boolean {
  return /^[\w-]*\d+[\w-]*\.[a-z]{2,}$/.test(normalizeDomainForPatternCheck(domain));
}

export function selectPatternAwareWorkingSet(newHost: string, additionalDomains?: string[]): {
  canonicalHost: string;
  additionalPatternDomains: string[];
  ignoredNonPatternDomains: string[];
} {
  const allUniqueDomains = [...new Set([newHost, ...(additionalDomains || [])])];

  // Strip www prefix before naturalCompare so numeric order drives canonical
  // selection. Without this, "www.papazsports1015.pro" sorts after
  // "papazsports1016.pro" ('w' > 'p') even though 1015 < 1016.
  const stripWww = (s: string) => s.replace(/^www\./, '');
  const patternDomains = allUniqueDomains
    .filter(matchesNumericPattern)
    .sort((a, b) => naturalCompare(stripWww(a), stripWww(b)));

  if (patternDomains.length === 0) {
    const canonicalHost = selectFirstByOrder(newHost, additionalDomains);
    const ignoredNonPatternDomains = allUniqueDomains
      .filter(domain => domain !== canonicalHost)
      .sort((a, b) => naturalCompare(stripWww(a), stripWww(b)));

    return {
      canonicalHost,
      additionalPatternDomains: [],
      ignoredNonPatternDomains,
    };
  }

  return {
    canonicalHost: patternDomains[0],
    additionalPatternDomains: patternDomains.slice(1),
    ignoredNonPatternDomains: allUniqueDomains
      .filter(domain => !matchesNumericPattern(domain))
      .sort((a, b) => naturalCompare(stripWww(a), stripWww(b))),
  };
}

function extractHostname(value?: string): string | null {
  if (!value) return null;
  try {
    const url = value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;
    return new URL(url).hostname.toLowerCase();
  } catch {
    const hostname = value.split('/')[0]?.trim().toLowerCase();
    return hostname || null;
  }
}

function hasNonRootPath(value?: string): boolean {
  if (!value) return false;
  try {
    const url = value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;
    return new URL(url).pathname !== '/';
  } catch {
    return value.includes('/');
  }
}

function isDiscoveryOnlyInitialDomain(site: { initial_domain?: string; replace_initial_domain?: boolean }): boolean {
  if (!site.initial_domain) return false;
  if (hasNonRootPath(site.initial_domain)) return true;
  return site.replace_initial_domain === false;
}

function getReplacementSources(
  site: { initial_domain?: string; replace_initial_domain?: boolean },
  previousLastKnownMirror?: string
): string[] {
  const sources: string[] = [];
  const previousMirrorHost = extractHostname(previousLastKnownMirror);
  if (previousMirrorHost) {
    sources.push(previousMirrorHost);
  }

  if (!site.initial_domain || isDiscoveryOnlyInitialDomain(site)) {
    return [...new Set(sources)];
  }

  const initialHost = extractHostname(site.initial_domain);
  if (initialHost) {
    sources.unshift(initialHost);
  }

  return [...new Set(sources)];
}

function addReplacementEntries(
  summary: Summary,
  siteName: string,
  replacementSources: string[],
  primaryNewHost: string,
  startedHost: string,
  checkDurationMs?: number,
  patternChangedDomain?: string,
  additionalDomains?: string[]
): void {
  for (const oldHost of replacementSources) {
    summary.replacements.push({
      oldHost,
      newHost: primaryNewHost,
      siteName,
      startedHost,
      checkDurationMs,
      patternChangedDomain,
    });

    for (const additionalDomain of additionalDomains || []) {
      if (additionalDomain === primaryNewHost) continue;
      summary.replacements.push({
        oldHost,
        newHost: additionalDomain,
        siteName,
        startedHost,
        checkDurationMs,
        patternChangedDomain,
      });
    }
  }
}

function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Updates site.success_since only when the value would actually change.
 * Suppresses watcher-state churn: repeated identical success runs no longer rewrite
 * the timestamp and therefore no longer produce spurious diffs in watchers.yml.
 */
function updateSuccessSince(site: { success_since?: string }, newValue: string): void {
  if (site.success_since !== newValue) {
    site.success_since = newValue;
  }
}

/**
 * Pre-flight DNS availability check.
 * Resolves google.com, cloudflare.com and adguard.com in parallel.
 * All three preflight hosts must resolve — if any one fails the run is fatal.
 */
export async function dnsPreflightCheck(logger?: { logGlobal: (level: number, msg: string) => void }): Promise<void> {
  const preflightHosts = ["google.com", "cloudflare.com", "adguard.com"];
  const preflightResults = await Promise.all(
    preflightHosts.map(host =>
      resolveHostname(host).then(() => true, () => false)
    )
  );
  const resolvedCount = preflightResults.filter(ok => ok).length;
  if (resolvedCount < preflightHosts.length) {
    logger?.logGlobal(0, `FATAL: DNS pre-flight check failed — only ${resolvedCount}/${preflightHosts.length} hosts resolved: ${preflightHosts.join(", ")}. Check network/DNS availability.`);
    process.exit(1);
  }
}

export async function main() {
  // Capture start time as early as possible
  const startTime = new Date();

  // Pre-flight DNS check — fail fast before any expensive operations
  await dnsPreflightCheck({ logGlobal: (_level, msg) => console.log(msg) });

  // GitHub Actions inputs
  const configPath = process.env.INPUT_CONFIG_PATH || './config.yml';
  const inputMode = process.env.INPUT_MODE || '';
  const filtersPath = process.env.INPUT_FILTERS_PATH || './';

  // Parse mode from command line arguments or GitHub Actions
  const cliMode = process.argv.find(arg => arg.startsWith('--mode='))?.split('=')[1];
  const mode = inputMode || cliMode || 'prod_live';

  // Determine flags based on mode
  const dryRun = mode === 'prod_dry' || mode === 'test_dry';
  const isTestMode = mode === 'test_live' || mode === 'test_dry';

  // Load configuration using configPath
  const config = await loadConfig(configPath);
  const watchers = await loadWatchers();
  const logger = new Logger(config);

  // Save original last_known_mirror values BEFORE processing
  // Used later to detect if newHost was already known (not a real change)
  const originalLastKnownMirrors = new Map<string, string>();
  const originalNonPatternMirrors = new Map<string, string | undefined>();
  for (const [siteName, site] of Object.entries(watchers.sites)) {
    if (site.last_known_mirror) {
      originalLastKnownMirrors.set(siteName, site.last_known_mirror);
    }
    originalNonPatternMirrors.set(siteName, site.non_pattern_mirror);
  }

  // Use filtersPath for target directory
  const targetPath = isTestMode && config.filtersdir_test
    ? config.filtersdir_test.repoPath
    : (filtersPath || config.filtersdir.repoPath);

  logger.logGlobal(LogLevel.RAW, `Rotating Domains Checker v${VERSION} - ${dryRun ? "DRY RUN" : "WRITE"} mode`);
  logger.logGlobal(LogLevel.RAW, `Test filters dir: ${isTestMode ? "YES" : "NO"}`);
  logger.logGlobal(LogLevel.RAW, `Target repo path: ${targetPath}`);
  logger.logGlobal(LogLevel.RAW, `Sites to check: ${Object.keys(watchers.sites).length}\n`);

  // Start connection diagnostics
  connectionDiagnostics.setLogger(logger);
  connectionDiagnostics.start();

  // Process all sites in batches
  const resolver = new HttpResolver(config);
  const processor = new BatchProcessor(config, watchers, logger, resolver);
  const batchStartTime = Date.now();
  const results = await processor.processAll();
  const batchDuration = Date.now() - batchStartTime;
  const batchSeconds = (batchDuration / 1000).toFixed(3);

  // Build summary
  const summary: Summary = {
    totalSites: Object.keys(watchers.sites).length,
    checked: results.length,
    updated: 0,
    unchanged: 0,
    failed: 0,
    antibotAccepted: 0,
    antibotBlocked: 0,
    replacements: [],
    errors: [],
    warnings: [],
  };

  const now = new Date();
  const nowFormatted = formatDateTime(now);

  // Snapshot per-site failure state BEFORE processing so we can detect exit-from-failure
  // transitions and suppress success_since churn on identical repeated runs.
  const hadFailureBeforeThisRun = new Map<string, boolean>();
  for (const [siteName, site] of Object.entries(watchers.sites)) {
    hadFailureBeforeThisRun.set(siteName, Boolean(site.failed_since));
  }

  for (const result of results) {
    const site = watchers.sites[result.siteName];
    if (!site) continue;

    // Determine error type and category
    const isAntibotDetected = result.result.antibotDetected;
    const isAntibotAccepted = isAntibotDetected && site.accept_antibot;

    // Heuristic found a non-pattern domain: history/flags already updated in batch.ts,
    // last_known_mirror should be updated but filters must NOT be touched.
    const isHeuristicNonPattern = result.historyUpdated && !result.shouldUpdate && result.result.success;

    // Check if failed: HTTP error OR content probe failed, but NOT accepted antibot
    const isFailed = (!result.result.success || (result.error && !result.shouldUpdate)) && !isAntibotAccepted && !isHeuristicNonPattern;

    if (isFailed) {
      // Determine error type
      let errorType: 'antibot_blocked' | 'antibot_accepted' | 'dns' | 'http' | 'probe' | 'network' | 'skip_text' | undefined;
      const errorMsg = result.error || result.result.error || "Unknown error";
      const checkedDomain = result.actualCheckedDomain || result.startedHost || result.oldHost;

      if (result.result.skippedByText) {
        errorType = 'skip_text';
      } else if (isAntibotDetected) {
        errorType = 'antibot_blocked';
      } else if (errorMsg.includes('DNS') || errorMsg.includes('ENOTFOUND') || errorMsg.includes('EAI_AGAIN')) {
        errorType = 'dns';
      } else if (errorMsg.includes('probe failed')) {
        errorType = 'probe';
      } else if (errorMsg.includes('status:') || errorMsg.match(/\d{3}/)) {
        errorType = 'http';
      } else {
        errorType = 'network';
      }

      // Real failure
      summary.failed++;
      summary.errors.push({
        siteName: result.siteName,
        error: errorMsg,
        domain: checkedDomain,
        type: errorType,
        checkDurationMs: result.checkDurationMs,
      });

      if (isAntibotDetected) {
        summary.antibotBlocked++;
      }

      // Update failed_since and calculate failed_days
      if (!site.failed_since) {
        // First failure - set failed_since to now
        site.failed_since = nowFormatted;
        site.failed_days = 0;
      } else {
        // Subsequent failure - calculate days since first failure.
        // Day-bucket suppression: only rewrite failed_days if the integer day count
        // actually changed. Within the same day bucket, repeated failures must not
        // produce a diff in watchers.yml.
        const newDays = calculateDaysSince(site.failed_since ?? '');
        if (site.failed_days !== newDays) {
          site.failed_days = newDays;
        }
      }

      // Mark as potentially dead if no working domain found
      site.potentially_dead = true;
      // State transition: success → failed. Remove success_since to keep failed state clean.
      // When site recovers, success_since will be set again in success branches.
      delete site.success_since;

      if ((site.failed_days || 0) >= config.thresholds.failedDaysWarning) {
        summary.warnings.push(
          `${result.siteName}: Failed for ${site.failed_days} days - consider removing from filters`
        );
      }
    } else if (isHeuristicNonPattern) {
      // Heuristic found a non-pattern domain (e.g. hepbetspor12.cfd → patronspor.is).
      // History and flags already set in batch.ts. Store the non-pattern domain separately
      // but do NOT overwrite last_known_mirror - filter files continue to use the last pattern domain.
      // NOT counted in summary.updated — no filter replacements are generated (shouldUpdate === false).
      // Displayed via 🚩 Pattern→non-pattern counter (from warnings) instead.
      const nonPatternCanonical = selectFirstByOrder(result.newHost, result.additionalWorkingDomains);
      const oldNonPatternMirror = originalNonPatternMirrors.get(result.siteName);

      // updateDomainHistory already called in batch.ts, so non_pattern_mirror is already set
      // Just verify it matches what we computed
      if (site.non_pattern_mirror !== nonPatternCanonical) {
        site.non_pattern_mirror = nonPatternCanonical;
      }

      // Update success_since on real state transition: entry into non-pattern phase,
      // change of the active non-pattern mirror, failure → success recovery,
      // or first-time initialization (no prior state).
      if (oldNonPatternMirror !== nonPatternCanonical || hadFailureBeforeThisRun.get(result.siteName) || !site.success_since) {
        updateSuccessSince(site, nowFormatted);
      }
      delete site.failed_days;
      delete site.failed_since;
      delete site.potentially_dead;
      summary.warnings.push(
        `${result.siteName}: Pattern domain redirected to non-pattern (${result.oldHost} → ${nonPatternCanonical}) - filter not updated, waiting for new pattern domain`
      );
      // NOTE: last_known_mirror is NOT updated - it stays on the last pattern domain
    } else if (isAntibotAccepted && result.shouldUpdate) {
      // Antibot accepted: compute effective new host first to check if anything actually changed
      const workingSetAntibot = selectPatternAwareWorkingSet(result.newHost, result.additionalWorkingDomains);
      const effectiveNewHostAntibot = workingSetAntibot.canonicalHost;
      const antibotActuallyChanged = effectiveNewHostAntibot !== site.last_known_mirror;

      if (antibotActuallyChanged) {
        summary.antibotAccepted++;

        // Add to errors list for reporting (but not counted as failed)
        const errorMsg = result.error || result.result.error || "Antibot detected, but accepted by config";
        const checkedDomain = result.actualCheckedDomain || result.startedHost || result.oldHost;
        summary.errors.push({
          siteName: result.siteName,
          error: errorMsg,
          domain: checkedDomain,
          type: 'antibot_accepted',
          checkDurationMs: result.checkDurationMs,
        });

        // Add warning for filter maintainers about antibot protection
        const fromHost = result.startedHost || result.oldHost;
        summary.warnings.push(
          `${result.siteName}: Domain redirected (${fromHost} → ${effectiveNewHostAntibot}) but protected by antibot - old domain may remain in filter rules`
        );

        summary.updated++;

        // Get last pattern domain from history if pattern_changed is true
        const patternChangedDomain = site.pattern_changed && site.heuristic_history && site.heuristic_history.length > 0
          ? site.heuristic_history[site.heuristic_history.length - 1]
          : undefined;

        const oldLastKnownMirrorAntibot = site.last_known_mirror;
        const replacementSources = getReplacementSources(site, oldLastKnownMirrorAntibot);
        addReplacementEntries(
          summary,
          result.siteName,
          replacementSources,
          effectiveNewHostAntibot,
          result.startedHost || "",
          result.checkDurationMs,
          patternChangedDomain,
          workingSetAntibot.additionalPatternDomains,
        );

        // Update watcher on successful change
        site.last_known_mirror = effectiveNewHostAntibot;
      } else {
        summary.unchanged++;
      }

      // Single cleanup block — runs for both antibotActuallyChanged and unchanged.
      // updateSuccessSince on host change, failure→success transition, or
      // first-time initialization (no prior state).
      if (antibotActuallyChanged || hadFailureBeforeThisRun.get(result.siteName) || !site.success_since) {
        updateSuccessSince(site, nowFormatted);
      }
      delete site.failed_days;
      delete site.failed_since;
      delete site.potentially_dead;
    } else if (result.shouldUpdate) {
      // Only update filters if check was successful
      if (result.result.success) {
        const workingSet = selectPatternAwareWorkingSet(result.newHost, result.additionalWorkingDomains);
        const hasAdditionalWorkingDomains = workingSet.additionalPatternDomains.length > 0;
        // Count as updated only if domain actually changed
        if (result.hostChanged || hasAdditionalWorkingDomains) {
          summary.updated++;
        } else {
          summary.unchanged++;
        }

        // Get last pattern domain from history if pattern_changed is true
        const patternChangedDomain = site.pattern_changed && site.heuristic_history && site.heuristic_history.length > 0
          ? site.heuristic_history[site.heuristic_history.length - 1]
          : undefined;

        // Compute effective newHost with pattern-aware selection BEFORE building replacements
        const effectiveNewHost = workingSet.canonicalHost;

        const oldLastKnownMirror = site.last_known_mirror;
        const replacementSources = getReplacementSources(site, oldLastKnownMirror);
        addReplacementEntries(
          summary,
          result.siteName,
          replacementSources,
          effectiveNewHost,
          result.startedHost || "",
          result.checkDurationMs,
          patternChangedDomain,
          workingSet.additionalPatternDomains,
        );

        // Update watcher on successful change
        // Always save only the hostname (domain), regardless of initial_domain format
        site.last_known_mirror = effectiveNewHost;
        // State transition: update success_since ONLY when the effective new host is
        // genuinely different from the previously stored mirror, or when the site is
        // recovering from a failure state, or on first-time initialization (no prior
        // success_since). This suppresses churn in force_search_ahead scenarios where
        // hostChanged=true comes from a redirect alias (Phase 1) but
        // selectFirstByOrder picks back the same last_known_mirror — e.g.,
        // last_known=example001.com (alias→003), collected [001, 002, 003],
        // effectiveNewHost = min = 001 (unchanged). Without this guard, repeated
        // identical runs would rewrite the timestamp and produce spurious diffs in
        // watchers.yml on every invocation.
        if (effectiveNewHost !== oldLastKnownMirror || hadFailureBeforeThisRun.get(result.siteName) || !site.success_since) {
          updateSuccessSince(site, nowFormatted);
        }
        delete site.failed_days; // Reset on success
        delete site.failed_since;
        delete site.potentially_dead; // Remove flag on success
      } else {
        // Pattern change detected but check failed - requires manual review
        summary.failed++;

        // Log structured warning
        logger.warn(result.siteName, `⚠️ PATTERN CHANGE ALERT`);
        logger.warn(result.siteName, `   From: ${result.oldHost}`);
        logger.warn(result.siteName, `   To: ${result.newHost}`);
        logger.warn(result.siteName, `   Status: FAILED`);
        logger.warn(result.siteName, `   Action: Manual review required`);

        // Add to manual review list
        summary.warnings.push(`${result.siteName}: ${result.oldHost} → ${result.newHost}`);

        // Update watcher with failed status.
        // Pattern change requiring manual review does NOT reset the failure timeline:
        // if the site was already failing, preserve the original failed_since so
        // failed_days reflects the continuous failure series, not the latest alert.
        if (!site.failed_since) {
          site.failed_since = nowFormatted;
          site.failed_days = 0;
        } else {
          const newDays = calculateDaysSince(site.failed_since ?? '');
          if (site.failed_days !== newDays) {
            site.failed_days = newDays;
          }
        }
        site.potentially_dead = true;
        // State transition: success → failed. Remove success_since to keep failed state clean.
        delete site.success_since;

      }
    } else {
      // Success but no change - reset failure flags; update success_since on
      // failure→success transition or first-time initialization (no prior state).
      // Suppress churn so repeated identical runs do not rewrite watchers.yml
      // with a new timestamp.
      summary.unchanged++;
      if (hadFailureBeforeThisRun.get(result.siteName) || !site.success_since) {
        updateSuccessSince(site, nowFormatted);
      }
      delete site.failed_days;
      delete site.failed_since;
      delete site.potentially_dead; // Remove flag on success
    }
  }

  // Apply replacements first (to show table before summary)
  const replacer = new FilterReplacer(config, logger, isTestMode);
  const replacerStats = await replacer.applyReplacements(summary.replacements, dryRun, originalLastKnownMirrors);

  // Compute mirror update info — used for both the console summary and the commit decision.
  // A real change means the domain actually changed from what was in watcher BEFORE processing.
  const mirrorUpdateEntries = (() => {
    const primaryBySite = new Map<string, typeof summary.replacements[number]>();
    for (const r of summary.replacements) {
      if (!primaryBySite.has(r.siteName)) {
        primaryBySite.set(r.siteName, r);
      }
    }
    return [...primaryBySite.values()].filter(r =>
      isRealDomainChange(r, originalLastKnownMirrors)
    );
  })();
  const hasUniqueDomainChanges = mirrorUpdateEntries.length > 0;
  const nMirrorUpdates = mirrorUpdateEntries.length;
  const hasRealChanges = hasUniqueDomainChanges || replacerStats.totalLineEdits > 0;

  // Count pattern→non-pattern transitions from warnings
  const nPatternToNonPattern = summary.warnings.filter(
    w => w.includes('Pattern domain redirected to non-pattern')
  ).length;

  // Print summary with detailed breakdown
  logger.logGlobal(LogLevel.RAW, "⬇️ ⬇️ ⬇️  ---=== Domains rotating summary ===---  ⬇️ ⬇️ ⬇️");
  logger.logGlobal(LogLevel.RAW, `  Total sites: ${summary.totalSites}`);
  logger.logGlobal(LogLevel.RAW, `  ├─ Checked sites: ${summary.checked}`);
  logger.logGlobal(LogLevel.RAW, `  ├─ 🔄 Watchers with active mirror changed: ${nMirrorUpdates}`);
  logger.logGlobal(LogLevel.RAW, `  ├─ 📋 Watchers with filter mirror list changed: ${replacerStats.patternDiffs?.length ?? 0}`);
  logger.logGlobal(LogLevel.RAW, `  ├─ 🚩 Pattern→non-pattern: ${nPatternToNonPattern}`);
  if (summary.antibotAccepted > 0) {
    logger.logGlobal(LogLevel.RAW, `  ├─ Antibot accepted: ${summary.antibotAccepted} (not in failed count)`);
  }
  const actualUnchangedDisplay = summary.unchanged;
  logger.logGlobal(LogLevel.RAW, `  └─ Unchanged watchers: ${actualUnchangedDisplay}`);
  logger.logGlobal(LogLevel.RAW, ` 🚨  Failed: ${summary.failed}`);
  if (summary.antibotBlocked > 0) {
    logger.logGlobal(LogLevel.RAW, `  ├─ including antibot blocked: ${summary.antibotBlocked}`);
  }
  const networkErrors = summary.failed - summary.antibotBlocked;
  if (networkErrors > 0) {
    logger.logGlobal(LogLevel.RAW, `  └─ Network problems or dead: ${networkErrors}`);
  }

  // Pattern domains list updates section (populated by replacer in task 03)
  if (replacerStats.patternDiffs && replacerStats.patternDiffs.length > 0) {
    logger.logGlobal(LogLevel.RAW, "");
    logger.logGlobal(LogLevel.RAW, " 📋  Watchers with filter mirror list changed:");
    for (const diff of replacerStats.patternDiffs) {
      const addedStr = diff.added.length > 0 ? ` added: ${diff.added.join(', ')}` : '';
      const removedStr = diff.removed.length > 0 ? ` removed: ${diff.removed.join(', ')}` : '';
      logger.logGlobal(LogLevel.RAW, `     [${diff.siteName}]${addedStr}${removedStr}`);
      logger.logGlobal(LogLevel.RAW, `       active mirror: ${diff.active} (+ ${diff.additionalCount} additional)`);
    }
  }

  // Display detailed errors and warnings
  logger.logGlobal(LogLevel.RAW, "");
  logger.logGlobal(LogLevel.RAW, "Problems:");
  const realErrors = summary.errors.filter(e => e.type !== 'antibot_accepted');
  if (realErrors.length > 0) {
    logger.logGlobal(LogLevel.RAW, " 🚨 Errors (no replacements made):");
    for (const { siteName, error, domain, checkDurationMs } of realErrors) {
      const domainInfo = domain ? ` [${domain}]` : '';
      const timeInfo = checkDurationMs ? ` (${(checkDurationMs / 1000).toFixed(2)}s)` : '';
      logger.logGlobal(LogLevel.RAW, `     - ${siteName}${domainInfo}: ${error}${timeInfo}`);
    }
  }

  // Separate pattern→non-pattern transitions from other warnings
  const patternToNonPatternWarnings = summary.warnings.filter(
    w => w.includes('Pattern domain redirected to non-pattern')
  );
  const otherWarnings = summary.warnings.filter(
    w => !w.includes('Pattern domain redirected to non-pattern')
  );

  if (patternToNonPatternWarnings.length > 0) {
    logger.logGlobal(LogLevel.RAW, " 🚩  Changed pattern → non-pattern domains:");
    for (const warning of patternToNonPatternWarnings) {
      logger.logGlobal(LogLevel.RAW, `     ${warning}`);
    }
  }

  if (otherWarnings.length > 0) {
    logger.logGlobal(LogLevel.RAW, " ⚠️  Warnings:");
    for (const warning of otherWarnings) {
      logger.logGlobal(LogLevel.RAW, `     - ${warning}`);
    }
  }

  logger.logGlobal(LogLevel.RAW, "");
  logger.logGlobal(LogLevel.RAW, `Total phase time: ${batchSeconds}s`);

  // Verification: display formula and check counts
  const actualUnchanged = actualUnchangedDisplay;
  logger.logGlobal(LogLevel.DEBUG, `Checks number verification: ${summary.updated} + ${actualUnchanged} = ${summary.checked}`);

  const expectedTotal = summary.updated + summary.unchanged + summary.failed + nPatternToNonPattern;
  if (expectedTotal !== summary.checked) {
    const missing = summary.checked - expectedTotal;
    logger.logGlobal(LogLevel.WARN, `⚠️ Summary count mismatch: checked=${summary.checked}, but updated+unchanged+failed+pattern→non-pattern=${expectedTotal}`);
    logger.logGlobal(LogLevel.DEBUG, `DEBUG: updated=${summary.updated}, unchanged=${summary.unchanged}, failed=${summary.failed}, pattern→non-pattern=${nPatternToNonPattern}, antibotAccepted=${summary.antibotAccepted} (included), missing=${missing}`);
  }

  // List unchanged watchers.
  // Show unchanged list only when there are actually unchanged sites, or when there are no
  // updates and no pattern→non-pattern transitions (everything is stable).
  const unchangedWatcherEntries: UnchangedWatcherEntry[] = [];
  if (summary.unchanged > 0 || (summary.updated === 0 && nPatternToNonPattern === 0)) {
    for (const result of results) {
      const site = watchers.sites[result.siteName];
      if (!site) continue;
      if (!result.result.success) continue;

      const originalMirror = originalLastKnownMirrors.get(result.siteName);

      const hasAdditionalWorkingDomains = Boolean(result.additionalWorkingDomains && result.additionalWorkingDomains.length > 0);
      if (hasAdditionalWorkingDomains) {
        continue;
      }

      if (originalMirror) {
        if (result.newHost === originalMirror) {
          const activeHost = result.newHost || originalMirror;
          if (activeHost && activeHost.trim() !== '') {
            unchangedWatcherEntries.push({ siteName: result.siteName, activeHost });
          }
        }
      } else if (!result.hostChanged) {
        if (result.newHost && result.newHost.trim() !== '') {
          unchangedWatcherEntries.push({ siteName: result.siteName, activeHost: result.newHost });
        }
      }
    }
    logger.logGlobal(LogLevel.RAW, ``);
    logger.logGlobal(
      LogLevel.RAW,
      `Unchanged watchers:\n                        ${unchangedWatcherEntries.map(entry => formatWatcherSummaryEntry(entry.siteName, entry.activeHost)).join(', ')}`,
    );
  }
  logger.logRaw("");

  // Display replacer summary
  logger.logGlobal(LogLevel.RAW, "=== Domains replacement summary ===");
  if (dryRun) {
    logger.logGlobal(LogLevel.INFO, "💡  DRY RUN MODE - No files were modified  💡");
  }
  logger.logGlobal(LogLevel.RAW, `Files scanned: ${replacerStats.filesScanned}`);
  logger.logGlobal(LogLevel.RAW, `Files modified: ${replacerStats.filesModified}${dryRun ? " (DRY RUN)" : ""}`);
  logger.logGlobal(LogLevel.RAW, `Total line edits: ${replacerStats.totalLineEdits}${dryRun ? " (DRY RUN)" : ""}`);
  logger.logGlobal(LogLevel.RAW, `Total phase time: ${replacerStats.replacerSeconds}s`);
  logger.logGlobal(LogLevel.RAW, "⬆️ ⬆️ ⬆️  ---=== Domains rotating summary ===---  ⬆️ ⬆️ ⬆️");
  logger.logRaw("");

  // Save updated watchers
  if (!dryRun) {
    await saveWatchers(watchers);
    logger.logGlobal(LogLevel.INFO, "Watchers updated.\n");
  }

  // Force abort any remaining HTTP requests to prevent timeout logs
  resolver.abortAllRequests();

  // Stop diagnostics BEFORE final timing to avoid race conditions
  connectionDiagnostics.stop();

  // Wait a moment for any pending connection error logs to flush
  await new Promise(resolve => setTimeout(resolve, 100));

  // Calculate and display total execution time
  const totalDuration = Date.now() - startTime.getTime();
  const totalSeconds = (totalDuration / 1000).toFixed(3);
  logger.logRaw("");
  logger.logGlobal(LogLevel.RAW, `⌛ Total execution time: ${totalSeconds}s`);

  // Create git manager
  const gitManager = new GitManager(config, logger);

  // Detect watcher state-only changes (failure flags cleared/added) that modify
  // watchers.yml without a domain change — e.g., recovery from potentially_dead
  // when last_known_mirror is unchanged. These must also trigger git operations.
  let watcherStateChanges = 0;
  for (const [siteName, site] of Object.entries(watchers.sites)) {
    const hadFailure = hadFailureBeforeThisRun.get(siteName);
    const hasFailure = Boolean(site.failed_since);
    if (hadFailure !== hasFailure) {
      watcherStateChanges++;
    }
  }

  // Determine skip reason BEFORE displaying PR info
  const skipReason = gitSkipReason(isTestMode, dryRun, hasRealChanges || watcherStateChanges > 0);

  // Display PR/Commit mode information only when git ops are not skipped.
  // Per spec §11.4: test_live must completely skip git logic — no preview either.
  if (!skipReason) {
    const prModeInfo = gitManager.getPRModeInfo(summary, dryRun, originalLastKnownMirrors, {
      patternDiffs: replacerStats.patternDiffs,
      unchangedWatchers: unchangedWatcherEntries,
    });
    if (prModeInfo.length > 0) {
      logger.logRaw("");
      prModeInfo.forEach(line => {
        logger.logRaw(line);
      });
    }
  } else {
    logger.logGlobal(LogLevel.INFO, `Skipping PR/commit — ${skipReason}`);
  }

  // Always save logs to file if configured
  logger.saveToFile();

  // Execute git operations only when there is no skip reason
  let gitResult: { commitSha?: string; prNumber?: number; prUrl?: string } = {};
  if (!skipReason) {
    // prod_live, prod_dry, test_dry: execute git
    gitResult = await gitManager.commitOrCreatePR(summary, dryRun, originalLastKnownMirrors, {
      patternDiffs: replacerStats.patternDiffs,
      unchangedWatchers: unchangedWatcherEntries,
    });
  }

  // Set GitHub Actions outputs
  if (process.env.GITHUB_ACTIONS && process.env.GITHUB_OUTPUT) {
    // Write to GITHUB_OUTPUT file (replaces deprecated set-output)
    appendFileSync(process.env.GITHUB_OUTPUT, `updated-count=${summary.replacements.length}\n`);

    if (gitResult.commitSha) {
      appendFileSync(process.env.GITHUB_OUTPUT, `commit-sha=${gitResult.commitSha}\n`);
    }

    if (gitResult.prNumber) {
      appendFileSync(process.env.GITHUB_OUTPUT, `pr-number=${gitResult.prNumber}\n`);
    }
  }

  logger.logGlobal(LogLevel.INFO, "✅ Done.");

  // Force exit to prevent hanging from undici keepalive connections,
  // diagnostic channels, or other ref'd handles in GitHub Actions
  process.exit(0);

}

// Only run main() when executed directly, not when imported for testing
if (!process.env.JEST_WORKER_ID) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
