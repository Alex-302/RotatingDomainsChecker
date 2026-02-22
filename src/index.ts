#!/usr/bin/env node

import { loadConfig, loadWatchers, saveWatchers } from "./config.js";
import { BatchProcessor } from "./batch.js";
import { HttpResolver } from "./httpResolver.js";
import { FilterReplacer } from "./replacer.js";
import { GitManager } from "./git.js";
import { Logger, LogLevel } from "./logger.js";
import { connectionDiagnostics } from "./diagnostics.js";
import type { Summary } from "./types.js";
import { appendFileSync } from "fs";

// Version
const VERSION = "1.1.7";

function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`; // Date only to reduce git diff noise for last_seen
}

function calculateDaysSince(dateStr: string): number {
  if (!dateStr) return 0;
  try {
    const past = new Date(dateStr.replace(" ", "T"));
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - past.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return 0;
  }
}


async function main() {
  // Capture start time as early as possible
  const startTime = new Date();

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
  const config = loadConfig(configPath);
  const watchers = loadWatchers();
  const logger = new Logger(config);

  // Use filtersPath for target directory
  const targetPath = isTestMode && config.filtersdir_test
    ? config.filtersdir_test.repoPath
    : (filtersPath || config.filtersdir.repoPath);

  logger.logGlobal(LogLevel.RAW, `Rotating Domains Checker v${VERSION} - ${dryRun ? "DRY RUN" : "WRITE"} mode`);
  logger.logGlobal(LogLevel.RAW, `Test filters dir: ${isTestMode ? "YES" : "NO"}`);
  logger.logGlobal(LogLevel.RAW, `Target repo path: ${targetPath}`);
  logger.logGlobal(LogLevel.RAW, `Sites to check: ${Object.keys(watchers.sites).length}\n`);
  logger.logGlobal(LogLevel.INFO, "=== Domain checks started ===");

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
  const nowDateOnly = formatDate(now);

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
        // Subsequent failure - calculate days since first failure
        site.failed_days = calculateDaysSince(site.failed_since);
      }

      // Mark as potentially dead if no working domain found
      site.potentially_dead = true;

      if ((site.failed_days || 0) >= config.thresholds.failedDaysWarning) {
        summary.warnings.push(
          `${result.siteName}: Failed for ${site.failed_days} days - consider removing from filters`
        );
      }
    } else if (isHeuristicNonPattern) {
      // Heuristic found a non-pattern domain (e.g. hepbetspor12.cfd → patronspor.is).
      // History and flags already set in batch.ts. Update last_known_mirror and counters,
      // but do NOT touch filter files — the old pattern domain stays until a new pattern is found.
      summary.updated++;
      site.last_known_mirror = result.newHost;
      site.last_seen = nowDateOnly;
      delete site.failed_days;
      delete site.failed_since;
      delete site.potentially_dead;
      summary.warnings.push(
        `${result.siteName}: Pattern domain redirected to non-pattern (${result.oldHost} → ${result.newHost}) - filter not updated, waiting for new pattern domain`
      );
    } else if (isAntibotAccepted && result.shouldUpdate) {
      // Antibot accepted and domain changed - treat as successful update
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
      if (result.hostChanged && fromHost !== result.newHost) {
        summary.warnings.push(
          `${result.siteName}: Domain redirected (${fromHost} → ${result.newHost}) but protected by antibot - old domain may remain in filter rules`
        );
      }

      // Count as updated only if domain actually changed
      if (result.hostChanged) {
        summary.updated++;
      } else {
        summary.unchanged++;
      }

      // Get last pattern domain from history if pattern_changed is true
      const patternChangedDomain = site.pattern_changed && site.heuristic_history && site.heuristic_history.length > 0
        ? site.heuristic_history[site.heuristic_history.length - 1]
        : undefined;

      summary.replacements.push({
        oldHost: result.oldHost,
        newHost: result.newHost,
        siteName: result.siteName,
        startedHost: result.startedHost || "",
        checkDurationMs: result.checkDurationMs,
        patternChangedDomain,
      });

      // Add replacements for additional working domains (force_search_ahead)
      if (result.additionalWorkingDomains && result.additionalWorkingDomains.length > 0) {
        for (const additionalDomain of result.additionalWorkingDomains) {
          summary.replacements.push({
            oldHost: result.oldHost,
            newHost: additionalDomain,
            siteName: result.siteName,
            startedHost: result.startedHost || "",
            checkDurationMs: result.checkDurationMs,
            patternChangedDomain,
          });
        }
      }

      // Update watcher on successful change
      // Save old last_known_mirror before updating (for history comparison)
      const oldLastKnownMirror = site.last_known_mirror;
      
      // Extract only domain if initial_domain doesn't contain URL
      const shouldExtractDomain = !site.initial_domain || !site.initial_domain.includes("/");
      site.last_known_mirror = shouldExtractDomain
        ? result.newHost
        : result.result.finalUrl;
      site.last_seen = nowDateOnly;
      delete site.failed_days; // Reset on success
      delete site.failed_since;
      delete site.potentially_dead; // Remove flag on success
      
      // Update domain history after last_known_mirror is updated
      // Skip if already updated in batch.ts (heuristic path sets historyUpdated=true)
      if (result.hostChanged && !result.historyUpdated) {
        processor.updateDomainHistory(site, result.newHost, oldLastKnownMirror);
      }
    } else if (result.shouldUpdate) {
      // Only update filters if check was successful
      if (result.result.success) {
        // Count as updated only if domain actually changed
        if (result.hostChanged) {
          summary.updated++;
        } else {
          summary.unchanged++;
        }

        // Get last pattern domain from history if pattern_changed is true
        const patternChangedDomain = site.pattern_changed && site.heuristic_history && site.heuristic_history.length > 0
          ? site.heuristic_history[site.heuristic_history.length - 1]
          : undefined;

        summary.replacements.push({
          oldHost: result.oldHost,
          newHost: result.newHost,
          siteName: result.siteName,
          startedHost: result.startedHost || "",
          checkDurationMs: result.checkDurationMs,
          patternChangedDomain,
        });

        // Add replacements for additional working domains (force_search_ahead)
        if (result.additionalWorkingDomains && result.additionalWorkingDomains.length > 0) {
          for (const additionalDomain of result.additionalWorkingDomains) {
            summary.replacements.push({
              oldHost: result.oldHost,
              newHost: additionalDomain,
              siteName: result.siteName,
              startedHost: result.startedHost || "",
              checkDurationMs: result.checkDurationMs,
              patternChangedDomain,
            });
          }
        }

        // Update watcher on successful change
        // Extract only domain if initial_domain doesn't contain URL
        const shouldExtractDomain = !site.initial_domain || !site.initial_domain.includes("/");
        site.last_known_mirror = shouldExtractDomain
          ? result.newHost
          : result.result.finalUrl;
        site.last_seen = nowDateOnly;
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
        
        // Update watcher with failed status
        site.failed_since = nowFormatted;
        site.failed_days = calculateDaysSince(site.failed_since);
        site.potentially_dead = true;
      }
    } else {
      // Success but no change - update last_seen, reset failed_days
      summary.unchanged++;
      site.last_seen = nowDateOnly;
      delete site.failed_days;
      delete site.failed_since;
      delete site.potentially_dead; // Remove flag on success
    }
  }

  // Add replacements for initial_domain -> last_known_mirror if they differ
  // This ensures filters always use the current working mirror, even when no change occurred
  for (const result of results) {
    const site = watchers.sites[result.siteName];
    if (!site) continue;

    // Skip if failed or no last_known_mirror
    if (!site.last_known_mirror || site.potentially_dead) continue;

    // Extract domain from initial_domain for comparison
    let initialDomain = site.initial_domain;
    if (initialDomain) {
      // Extract hostname from URL if initial_domain contains path
      if (initialDomain.includes('/')) {
        try {
          const url = initialDomain.startsWith('http') ? initialDomain : `https://${initialDomain}`;
          initialDomain = new URL(url).hostname;
        } catch {
          // If URL parsing fails, try to extract domain manually
          initialDomain = initialDomain.split('/')[0];
        }
      }

      // Extract hostname from last_known_mirror
      let lastKnownDomain = site.last_known_mirror;
      if (lastKnownDomain.includes('/')) {
        try {
          const url = lastKnownDomain.startsWith('http') ? lastKnownDomain : `https://${lastKnownDomain}`;
          lastKnownDomain = new URL(url).hostname;
        } catch {
          lastKnownDomain = lastKnownDomain.split('/')[0];
        }
      }

      // Add replacement if domains differ and not already in replacements
      if (initialDomain !== lastKnownDomain) {
        const alreadyExists = summary.replacements.some(
          r => r.siteName === result.siteName && r.oldHost === initialDomain
        );

        if (!alreadyExists) {
          summary.replacements.push({
            oldHost: initialDomain,
            newHost: lastKnownDomain,
            siteName: result.siteName,
            startedHost: result.startedHost || initialDomain,
            checkDurationMs: result.checkDurationMs,
          });
        }
      }
    }
  }

  // Apply replacements first (to show table before summary)
  const replacer = new FilterReplacer(config, logger, isTestMode);
  const replacerStats = await replacer.applyReplacements(summary.replacements, dryRun);

  // Print summary with detailed breakdown
  logger.logGlobal(LogLevel.RAW, "⬇️ ⬇️ ⬇️  ---=== Domains rotating summary ===---  ⬇️ ⬇️ ⬇️");
  logger.logGlobal(LogLevel.RAW, `  Total sites: ${summary.totalSites}`);
  logger.logGlobal(LogLevel.RAW, `  ├─ Checked sites: ${summary.checked}`);
  logger.logGlobal(LogLevel.RAW, `  ├─ Updated sites: ${summary.updated}`);
  if (summary.antibotAccepted > 0) {
    logger.logGlobal(LogLevel.RAW, `  ├─ Antibot accepted: ${summary.antibotAccepted} (not in failed count)`);
  }
  // When no domain changes detected, unchanged includes failed sites
  const actualUnchangedDisplay = summary.updated === 0 ? summary.checked - summary.updated : summary.unchanged;
  logger.logGlobal(LogLevel.RAW, `  └─ Unchanged sites: ${actualUnchangedDisplay}`);
  logger.logGlobal(LogLevel.RAW, ` 🚨  Failed: ${summary.failed}`);
  if (summary.antibotBlocked > 0) {
    logger.logGlobal(LogLevel.RAW, `  ├─ including antibot blocked: ${summary.antibotBlocked}`);
  }
  const networkErrors = summary.failed - summary.antibotBlocked;
  if (networkErrors > 0) {
    logger.logGlobal(LogLevel.RAW, `  └─ Network problems or dead: ${networkErrors}`);
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

  // Separate pattern changes from other warnings
  const patternChanges = summary.warnings.filter(w => w.includes('→'));
  const otherWarnings = summary.warnings.filter(w => !w.includes('→'));
  
  if (patternChanges.length > 0) {
    logger.logGlobal(LogLevel.WARN, " ⚠️  Pattern changes requiring manual review:");
    for (const warning of patternChanges) {
      logger.logGlobal(LogLevel.WARN, `     ${warning}`);
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
  // When no domain changes detected, unchanged includes failed sites
  const actualUnchanged = actualUnchangedDisplay;
  logger.logGlobal(LogLevel.DEBUG, `Checks number verification: ${summary.updated} + ${actualUnchanged} = ${summary.checked}`);

  const expectedTotal = summary.updated + summary.unchanged + summary.failed;
  if (expectedTotal !== summary.checked) {
    const missing = summary.checked - expectedTotal;
    logger.logGlobal(LogLevel.WARN, `⚠️ Summary count mismatch: checked=${summary.checked}, but updated+unchanged+failed=${expectedTotal}`);
    logger.logGlobal(LogLevel.DEBUG, `DEBUG: updated=${summary.updated}, unchanged=${summary.unchanged}, failed=${summary.failed}, antibotAccepted=${summary.antibotAccepted} (included), missing=${missing}`);
  }

  // List unchanged sites
  if (summary.unchanged > 0 || summary.updated === 0) {
    const unchangedHosts: string[] = [];
    for (const result of results) {
      const site = watchers.sites[result.siteName];
      if (!site) continue;

      // Include all sites that didn't change domain (regardless of success/failure)
      if (!result.hostChanged) {
        unchangedHosts.push(result.newHost);
      }
    }
    const filteredHosts = unchangedHosts.filter(host => host && host.trim() !== '');
    logger.logGlobal(LogLevel.RAW, ``);
    logger.logGlobal(LogLevel.RAW, `Unchanged sites:\n                        ${filteredHosts.join(', ')}`);
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
    saveWatchers(watchers);
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

  // Display PR/Commit mode information at the end
  const prModeInfo = gitManager.getPRModeInfo(summary, dryRun);
  if (prModeInfo.length > 0) {
    logger.logRaw("");
    prModeInfo.forEach(line => {
      logger.logRaw(line);
    });
  }

  // Save logs to file BEFORE git operations to include in commit
  logger.saveToFile();

  // Git operations (will include the log file in commit)
  // Skip git operations only in test_live mode (test_dry shows simulation)
  let gitResult: { commitSha?: string; prNumber?: number; prUrl?: string } = {};
  if (isTestMode && !dryRun) {
    // test_live: skip git operations entirely
    logger.logGlobal(LogLevel.INFO, "⚠️  Test mode: Skipping git operations (files were modified)");
  } else {
    // prod_live, prod_dry, test_dry: all go through git manager
    gitResult = await gitManager.commitOrCreatePR(summary, dryRun);
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
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
