// Domains replacement logic
// Supports cosmetic rules, URL rules, and parameter lists

import { promises as fs, createReadStream } from "fs";
import path from "path";
import { createInterface } from "readline/promises";
import type { Config, PatternDiffEntry, ReplacementPair } from "./types.js";
import { isRealDomainChange } from "./utils.js";
import { Logger, LogLevel } from "./logger.js";
import { table as renderTable, getBorderCharacters } from "table";

// Helper function for consistent domain normalization (www-aware)
function normalizeDomain(domain: string): string {
  return domain.replace(/^www\./, '').toLowerCase();
}

// Helper functions for domain pattern detection
function matchesNumericPattern(domain: string): boolean {
  const norm = normalizeDomain(domain);
  // Supports domain[N].tld, domain[N][text].tld, and [N]domain.tld patterns
  return /^[\w-]*\d+[\w-]*\.[a-z]{2,}$/.test(norm);
}

function extractBasePattern(domain: string): string {
  const norm = normalizeDomain(domain);
  // Replace numeric part with {N}, preserving text before and after number
  return norm.replace(/\d+/, '{N}');
}

function matchesSamePattern(domain1: string, domain2: string): boolean {
  return extractBasePattern(domain1) === extractBasePattern(domain2);
}

function matchesPattern(domain: string, pattern: string): boolean {
  const norm = normalizeDomain(domain);
  const regex = new RegExp(pattern.replace('{N}', '\\d+'));
  return regex.test(norm);
}


function replaceDomain(
  domain: string,
  hostMap: Map<string, string>,
  initialToLastKnownMap: Map<string, string>
): string {
  // Skip empty strings and invalid domains
  if (!domain || domain.trim() === '') {
    return domain;
  }

  // Wildcard domains should NOT be replaced - keep them as is
  if (domain.includes('*')) {
    return domain;
  }

  // Try exact match first, then initial_domain lookup (both O(1))
  const exactMatch = hostMap.get(domain) || initialToLastKnownMap.get(domain);
  if (exactMatch) {
    return exactMatch;
  }

  return domain;
}

function hasSchemeChangeInList(
  originalDomains: string[],
  replacedDomains: string[]
): boolean {
  for (let i = 0; i < originalDomains.length; i++) {
    const oldDomain = originalDomains[i];
    const newDomain = replacedDomains[i];

    if (newDomain && newDomain !== oldDomain &&
        matchesNumericPattern(oldDomain) &&
        !matchesSamePattern(oldDomain, newDomain)) {
      return true; // Found at least one scheme change
    }
  }
  return false;
}

function handleSchemeChange(
  originalDomains: string[],
  replacedDomains: string[],
  priorityMap: Map<string, { initial: string | null; lastKnown: string; oldHost: string }>
): string[] {
  // Find any numeric pattern domain to extract pattern
  const numericDomain = originalDomains.find(d => matchesNumericPattern(d));
  if (!numericDomain) return replacedDomains;

  const oldPattern = extractBasePattern(numericDomain);
  const filtered = replacedDomains.filter(d => !matchesPattern(d, oldPattern));

  // CRITICAL: Prevent empty domain list - restore fallback if all domains were removed
  if (filtered.length === 0) {
    // Priority 1: last_known_mirror matching the same pattern
    if (priorityMap.size > 0) {
      for (const { lastKnown } of priorityMap.values()) {
        if (matchesNumericPattern(lastKnown) && extractBasePattern(lastKnown) === oldPattern) {
          return [lastKnown];
        }
      }
    }

    // Priority 2: first valid original domain as fallback
    const validOriginal = originalDomains.find(d => d && d.trim() !== '');
    if (validOriginal) {
      return [validOriginal];
    }

    // Priority 3: first replaced domain (safety net if logic failed)
    if (replacedDomains.length > 0) {
      return [replacedDomains[0]];
    }
  }

  return filtered;
}

function deduplicateDomains(domains: string[]): string[] {
  const seen = new Set<string>();
  return domains.filter(d => {
    const norm = normalizeDomain(d);
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });
}

function processDomainList(
  domains: string[],
  hostMap: Map<string, string>,
  initialToLastKnownMap: Map<string, string>,
  priorityMap: Map<string, { initial: string | null; lastKnown: string; oldHost: string }>,
  additionalDomainsMap: Map<string, string[]> = new Map(),
  usedAdditionalKeys?: Set<string>,
): { processed: string[]; changed: boolean; schemeChangeDetected: boolean } {
  // 1. Replace domains
  const replaced = domains.map(d => replaceDomain(d, hostMap, initialToLastKnownMap));
  const changed = domains.some((d, i) => replaced[i] !== d);

  // 2. Check for scheme change
  const schemeChangeDetected = hasSchemeChangeInList(domains, replaced);

  let processed = replaced;

  // 3. Handle scheme change (remove ALL domains of old pattern)
  if (schemeChangeDetected) {
    processed = handleSchemeChange(domains, replaced, priorityMap);
  }

  // 4. Remove predicted mirrors and deduplicate
  // Clean up predicted mirrors on real rotation, and also when force_search_ahead supplied
  // a fresh set of additional domains for the current primary host. This allows filter lines
  // to prune stale predicted mirrors even when the primary domain itself stayed unchanged.
  // Use per-line check instead of global additionalDomainsMap.size > 0
  const hasNumericPatterns = domains.some(d => matchesNumericPattern(d));
  const hasLineInAdditionalMap =
    domains.some(d => additionalDomainsMap.has(normalizeDomain(d))) ||
    replaced.some(d => additionalDomainsMap.has(normalizeDomain(d)));
  if ((changed || hasLineInAdditionalMap) && hasNumericPatterns && priorityMap.size > 0) {
    // Find matching last_known_mirror for current pattern
    const currentPattern = extractBasePattern(domains[0]);
    let matchingLastKnown = null;

    for (const { lastKnown } of priorityMap.values()) {
      if (matchesNumericPattern(lastKnown) && extractBasePattern(lastKnown) === currentPattern) {
        matchingLastKnown = lastKnown;
        break;
      }
    }

    // If we have matching last_known_mirror, remove predicted mirrors
    if (matchingLastKnown) {
      processed = removePredictedMirrors(processed, priorityMap);
      processed = deduplicateDomains(processed);

      // Ensure last_known_mirror is present
      if (!processed.some(d => normalizeDomain(d) === normalizeDomain(matchingLastKnown))) {
        processed.push(matchingLastKnown);
        processed = deduplicateDomains(processed);
      }
    }
  }

  // 4b. Deduplicate any changed line (non-pattern lines also need dedup)
  // For numeric-pattern lines, deduplicateDomains was already called in 4a above.
  if (changed) {
    processed = deduplicateDomains(processed);
  }

  // 5. Append additional domains from force_search_ahead
  // If an additional domain normalizes to one already in the list, replace it
  // (use the form from redirect chain, e.g. www.webspor124.xyz instead of webspor124.xyz)
  // spec_drift 022: use per-line check instead of global additionalDomainsMap.size > 0
  if (hasLineInAdditionalMap) {
    const existingNormalized = new Map<string, number>(); // normalized → index in processed
    for (let i = 0; i < processed.length; i++) {
      existingNormalized.set(normalizeDomain(processed[i]), i);
    }
    for (const d of [...processed]) {
      const key = normalizeDomain(d);
      const extras = additionalDomainsMap.get(key);
      if (extras) {
        let changedByExtras = false;
        for (const extra of extras) {
          if (matchesNumericPattern(d) && !matchesNumericPattern(extra)) {
            continue;
          }
          const extraNorm = normalizeDomain(extra);
          const existingIdx = existingNormalized.get(extraNorm);
          if (existingIdx !== undefined) {
            // Replace existing domain with the form from redirect chain
            if (processed[existingIdx] !== extra) {
              processed[existingIdx] = extra;
              changedByExtras = true;
            }
          } else {
            processed.push(extra);
            existingNormalized.set(extraNorm, processed.length - 1);
            changedByExtras = true;
          }
        }
        if (changedByExtras) {
          usedAdditionalKeys?.add(key);
        }
      }
    }
    // Final deduplication after additional-domain appending
    processed = deduplicateDomains(processed);
  }

  const finalChanged = changed || processed.length !== domains.length || domains.some((d, i) => processed[i] !== d);
  return { processed, changed: finalChanged, schemeChangeDetected };
}

export class FilterReplacer {
  constructor(
    private _config: Config,
    private _logger: Logger,
    private _isTestMode: boolean = false
  ) {}

  async applyReplacements(
    replacements: ReplacementPair[],
    dryRun: boolean = false,
    originalMirrors?: Map<string, string>,
  ): Promise<{filesScanned: number, filesModified: number, totalLineEdits: number, replacerSeconds: string, patternDiffs: PatternDiffEntry[]}> {
    const replacerStart = Date.now();

    if (replacements.length === 0) {
      this._logger.logGlobal(LogLevel.INFO, "No replacements to process.");
      return { filesScanned: 0, filesModified: 0, totalLineEdits: 0, replacerSeconds: '0.000', patternDiffs: [] };
    }

    // Build ASCII table: Site | From (startedHost) | To | Time
    // Show only actual domain changes in the table.
    // Deduplicate by siteName FIRST (keeping primary/effectiveNewHost entry),
    // then filter to only show entries where the domain actually changed
    // AND where newHost differs from the original last_known_mirror.
    const primaryBySite = new Map<string, typeof replacements[number]>();
    for (const r of replacements) {
      if (!primaryBySite.has(r.siteName)) {
        primaryBySite.set(r.siteName, r);
      }
    }
    const uniqueChanges = [...primaryBySite.values()].filter(r =>
      isRealDomainChange(r, originalMirrors)
    );

    if (uniqueChanges.length > 0) {
      const rows: string[][] = [["Site", "From", "To", "Time"]];
      for (const { siteName, newHost, startedHost, oldHost, checkDurationMs } of uniqueChanges) {
        const fromHost = startedHost || oldHost;
        const timeStr = checkDurationMs ? `${(checkDurationMs / 1000).toFixed(2)}s` : "N/A";
        rows.push([siteName, fromHost, newHost, timeStr]);
      }

      const output = renderTable(rows, {
        border: getBorderCharacters("honeywell"),
        drawHorizontalLine: (lineIndex: number, rowCount: number) =>
          lineIndex === 0 || lineIndex === 1 || lineIndex === rowCount,
      });

      const header = `\n                      Redirected domains ${dryRun ? "(DRY RUN)" : ""}`;
      this._logger.logGlobal(LogLevel.RAW, `${header}\n${output}`);
    } else {
      this._logger.logGlobal(LogLevel.INFO, "No domain changes detected, but processing filters for predicted mirror cleanup.");
    }

    // Choose config based on mode
    const filtersConfig = this._isTestMode && this._config.filtersdir_test
      ? this._config.filtersdir_test
      : this._config.filtersdir;

    // Safety checks
    const repoPath = filtersConfig.repoPath;
    if (!repoPath) {
      this._logger.logGlobal(LogLevel.INFO, `${this._isTestMode && this._config.filtersdir_test ? 'filtersdir_test' : 'filtersdir'}.repoPath is empty. Skipping file replacements.`);
      return { filesScanned: 0, filesModified: 0, totalLineEdits: 0, replacerSeconds: '0.000', patternDiffs: [] };
    }

    const filterDirPattern = filtersConfig.filterDirPattern || "*Filter";
    const filePattern = filtersConfig.filePattern || "*.txt";

    const files = await findTargetFiles(repoPath, filterDirPattern, filePattern);
    if (files.length === 0) {
      this._logger.logGlobal(LogLevel.INFO, "No target filter files found. Nothing to replace.");
      return { filesScanned: 0, filesModified: 0, totalLineEdits: 0, replacerSeconds: '0.000', patternDiffs: [] };
    }

    // Log replacement phase start (moved to end)
    this._logger.logGlobal(LogLevel.DEBUG, "=== Domains replacement started ===");
    this._logger.logGlobal(LogLevel.DEBUG, `Files to scan: ${files.length}`);
    this._logger.logGlobal(LogLevel.DEBUG, `Files found: ${files.map(f => path.relative(repoPath, f)).join(", ")}`);

    // Build lookup maps from all replacements (not just actualChanges)
    // This ensures we process filters even when domain didn't change but has initial_domain
    // IMPORTANT: first write wins — the primary replacement (first occurrence) takes precedence
    // over additional domain replacements (force_search_ahead extras) that share the same oldHost.
    // This keeps hostMap in sync with seenPrimary/additionalDomainsMap which also use first-wins.
    const hostMap = new Map<string, string>();
    for (const r of replacements) {
      if (!hostMap.has(r.oldHost)) {
        hostMap.set(r.oldHost, r.newHost);
      }
    }

    // Build additionalDomainsMap: primary domain → additional domains from force_search_ahead + patternChangedDomain
    // Key is normalized primary domain, value is array of additional domains to add to filter lines
    const additionalDomainsMap = new Map<string, string[]>();
    const seenPrimary = new Map<string, string>(); // siteName → primary newHost
    for (const r of replacements) {
      if (!seenPrimary.has(r.siteName)) {
        // First replacement for this site is the primary domain
        seenPrimary.set(r.siteName, r.newHost);

        // Add patternChangedDomain if present (pattern_changed: true case)
        if (r.patternChangedDomain) {
          const key = normalizeDomain(r.newHost);
          if (!additionalDomainsMap.has(key)) {
            additionalDomainsMap.set(key, []);
          }
          if (!additionalDomainsMap.get(key)!.includes(r.patternChangedDomain)) {
            additionalDomainsMap.get(key)!.push(r.patternChangedDomain);
          }
        }
      } else {
        // Subsequent replacements are additional domains from force_search_ahead
        const primary = seenPrimary.get(r.siteName)!;
        if (matchesNumericPattern(primary) && !matchesNumericPattern(r.newHost)) {
          continue;
        }
        const key = normalizeDomain(primary);
        if (!additionalDomainsMap.has(key)) {
          additionalDomainsMap.set(key, []);
        }
        if (!additionalDomainsMap.get(key)!.includes(r.newHost)) {
          additionalDomainsMap.get(key)!.push(r.newHost);
        }
      }
    }

    // Build priorityMap: key = last_known_mirror (newHost)
    // This map is used by removePredictedMirrors to determine which domains to keep
    // Collect all working domains per site (including force_search_ahead results)
    const siteWorkingDomains = new Map<string, Set<string>>();
    for (const r of replacements) {
      if (!siteWorkingDomains.has(r.siteName)) {
        siteWorkingDomains.set(r.siteName, new Set());
      }
      const primary = seenPrimary.get(r.siteName);
      if (primary && matchesNumericPattern(primary) && !matchesNumericPattern(r.newHost)) {
        continue;
      }
      siteWorkingDomains.get(r.siteName)!.add(r.newHost);
    }

    const priorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string; workingDomains: Set<string> }>();
    for (const r of replacements) {
      // Only add to priorityMap if domain matches numeric pattern
      // This ensures we only clean up predicted mirrors for sites that use this pattern
      if (matchesNumericPattern(r.newHost)) {
        // Only set once per site (use first occurrence)
        if (!priorityMap.has(r.newHost)) {
          priorityMap.set(r.newHost, {
            initial: null,
            lastKnown: r.newHost,
            oldHost: r.oldHost,
            workingDomains: siteWorkingDomains.get(r.siteName) || new Set(),
          });
        }
      }
    }

    // Build O(1) lookup map: initial_domain -> last_known_mirror
    const initialToLastKnownMap = new Map<string, string>();
    for (const { initial, lastKnown } of priorityMap.values()) {
      if (initial) {
        initialToLastKnownMap.set(initial, lastKnown);
      }
    }

    let modifiedFiles = 0;
    let totalLineEdits = 0;
    const fileChanges: Array<{
      file: string;
      changes: Array<{ line: number; before: string; after: string }>;
    }> = [];
    const replacedOldHosts = new Set<string>();
    const usedAdditionalKeys = new Set<string>();

    for (const file of files) {
      let changed = false;
      const lineChanges: Array<{ line: number; before: string; after: string }> = [];
      const outputLines: string[] = [];
      let lineNum = 0;
      let lineEnding: '\n' | '\r\n' = '\n';

      try {
        // Detect line ending from first chunk (preserve original format)
        const detectFd = await fs.open(file, 'r');
        const detectBuf = Buffer.alloc(4096);
        const { bytesRead } = await detectFd.read(detectBuf, 0, 4096, 0);
        await detectFd.close();
        if (detectBuf.subarray(0, bytesRead).includes('\r\n')) {
          lineEnding = '\r\n';
        }

        const rl = createInterface({
          input: createReadStream(file, 'utf-8'),
          crlfDelay: Infinity,
        });

        for await (const line of rl) {
          lineNum++;
          const updatedLines = processLine(line, hostMap, initialToLastKnownMap, priorityMap, additionalDomainsMap, replacedOldHosts, usedAdditionalKeys);
          // Check if line changed (first element differs) or extra lines were added
          if (updatedLines.length > 1 || updatedLines[0] !== line) {
            changed = true;
            totalLineEdits++;
            lineChanges.push({ line: lineNum, before: line, after: updatedLines.join(lineEnding) });
            outputLines.push(...updatedLines);
          } else {
            outputLines.push(line);
          }
        }
      } catch (e) {
        this._logger.info("replacer", `Skip unreadable file: ${file}`);
        continue;
      }

      if (changed) {
        modifiedFiles++;
        if (!dryRun) {
          await fs.writeFile(file, outputLines.join(lineEnding), 'utf-8');
        }
        fileChanges.push({ file, changes: lineChanges });
      }
    }

    // Log summary at the end
    const replacerDuration = Date.now() - replacerStart;
    const replacerSeconds = (replacerDuration / 1000).toFixed(3);

    if (fileChanges.length > 0) {
      const header = `    Changes by file${dryRun ? " (DRY RUN)" : ""}`;
      this._logger.logGlobal(LogLevel.DEBUG, header);
      for (const { file, changes } of fileChanges) {
        const relPath = path.relative(repoPath, file);
        for (const c of changes) {
          this._logger.logGlobal(LogLevel.DEBUG, `    ${relPath}:${c.line}`);
          this._logger.logGlobal(LogLevel.DEBUG, `[OLD] ${c.before}`);
          this._logger.logGlobal(LogLevel.DEBUG, `[UPD] ${c.after}`);
        }
      }
    }

    this._logger.logGlobal(LogLevel.DEBUG, `=== Domains replacement finished ===\n`);

    // Compute per-watcher pattern diffs from replacement data
    const patternDiffs: PatternDiffEntry[] = [];

    // Collect oldHosts per site
    const oldHostsBySite = new Map<string, Set<string>>();
    for (const r of replacements) {
      if (!oldHostsBySite.has(r.siteName)) {
        oldHostsBySite.set(r.siteName, new Set());
      }
      oldHostsBySite.get(r.siteName)!.add(r.oldHost);
    }

    // Compute diff per site — only for pattern-domain watchers
    for (const [siteName, primaryNewHost] of seenPrimary) {
      if (!matchesNumericPattern(primaryNewHost)) {
        continue;
      }
      const normalizedPrimary = normalizeDomain(primaryNewHost);

      // Only show diff if the filter content was actually modified for this site.
      // Check: (a) was the primary oldHost actually found & replaced in a filter line?
      //        (b) were extra lines (additional domains) actually generated?
      const wasPrimaryReplaced = [...oldHostsBySite.get(siteName) || []].some(oldHost =>
        replacedOldHosts.has(normalizeDomain(oldHost))
      );
      const hadExtraLines = usedAdditionalKeys.has(normalizedPrimary);
      if (!wasPrimaryReplaced && !hadExtraLines) {
        continue;
      }

      const additional = additionalDomainsMap.get(normalizedPrimary) || [];
      const allNewHosts = new Set([primaryNewHost, ...additional]);
      const oldHosts = [...(oldHostsBySite.get(siteName) || new Set())];

      const added = [...allNewHosts].filter(h => !oldHosts.includes(h));
      const removed = oldHosts.filter(h => !allNewHosts.has(h));

      if (added.length > 0 || removed.length > 0) {
        patternDiffs.push({
          siteName,
          added,
          removed,
          active: primaryNewHost,
          additionalCount: additional.length,
        });
      }
    }

    return {
      filesScanned: files.length,
      filesModified: modifiedFiles,
      totalLineEdits: totalLineEdits,
      replacerSeconds: replacerSeconds,
      patternDiffs,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findTargetFiles(root: string, dirPattern: string, filePattern: string): Promise<string[]> {
  const wantDirSuffix = dirPattern.replace(/\*/g, "");
  const wantExt = filePattern.startsWith("*.") ? filePattern.slice(1) : ".txt";
  const results: string[] = [];

  async function collectTxtRecursive(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await collectTxtRecursive(full);
      } else if (e.isFile() && e.name.endsWith(wantExt)) {
        results.push(full);
      }
    }
  }

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
                // Glob-like matching for filterDirPattern:
        //   "Filter*" → startsWith, "*Filter" → endsWith
        //   "*Filter*" → includes, "Filter" → exact match
        //   "*" → all dirs
        const hasStarSuffix = dirPattern.endsWith("*");
        const hasStarPrefix = dirPattern.startsWith("*");
        const needle = wantDirSuffix.replace(/\*/g, "");
        let dirMatch = false;
        if (!needle) {
          dirMatch = true; // "*" → all dirs
        } else if (hasStarPrefix && hasStarSuffix) {
          dirMatch = e.name.includes(needle);
        } else if (hasStarSuffix) {
          dirMatch = e.name.startsWith(needle); // "Filter*" = starts with Filter
        } else if (hasStarPrefix) {
          dirMatch = e.name.endsWith(needle);   // "*Filter" = ends with Filter
        } else {
          dirMatch = e.name === needle;
        }
        if (dirMatch) {
          await collectTxtRecursive(full);
        }
        await walk(full);
      }
    }
  }

  await walk(root);
  return results;
}


// ============================================================================
// Shared marker constants for ad blocker syntax detection
// ============================================================================

/**
 * Base cosmetic markers (order matters: longer markers first)
 *
 * These are the separators that split domain-list from selector body.
 * Domain replacement happens ONLY in the left part (before the marker).
 */
const COSMETIC_MARKERS = [
  "#@$?#", "#@$#", "#@?#", "#@%#", "#@#",
  "#$?#", "#$#", "#?#", "#%#", "##",
] as const;

const DOLLAR_MARKERS = ["$@$", "$$"] as const;

/**
 * uBO body forms
 *
 * In AdGuard and uBO syntax, after a base marker like `##` or `#@#`, there can be
 * special body forms that modify rule behavior:
 *
 * - `^` prefix → HTML filtering shorthand (e.g., `##^script:has-text(...)`, `#@#^script:has-text(...)`)
 * - `+js(` prefix → scriptlet shorthand (e.g., `##+js(acs, ...)`, `#@#+js(acs, ...)`)
 *
 * These are NOT separate markers in {@link COSMETIC_MARKERS}. The replacement logic
 * only processes the domain list (left part), so the body form after the marker
 * (`^...` or `+js(...)`) remains unchanged.
 *
 * Example:
 *   Input:  `old.com##^script:has-text(ads)`
 *   Marker: `##` (found at position 7)
 *   Left:   `old.com` → replaced with `new.com`
 *   Right:  `^script:has-text(ads)` → unchanged
 *   Output: `new.com##^script:has-text(ads)`
 *
 */
function shouldSkipLine(line: string): boolean {
  const t = line.trim();
  if (t.length === 0) return true;
  if (t.startsWith("!")) return true;
  if (t.startsWith("/") && t.endsWith("/")) return true;
  if (t.includes("*")) {
    const hasCosmetic = [...COSMETIC_MARKERS, ...DOLLAR_MARKERS].some(m => t.includes(m));
    const hasWrapper = t.startsWith("[");
    const hasParams = t.includes("$");
    if (!hasCosmetic && !hasWrapper && !hasParams) return true;
  }
  return false;
}
/**
 * Check if domain matches predicted mirror pattern relative to baseDomain
 * Example: yavasgir31.com is predicted mirror of yavasgir34.com
 * Example: betist126tv.live is predicted mirror of betist131tv.live
 * Example: 7dizipal.com is predicted mirror of 8dizipal.com
 * Pattern: baseNameN.tld, baseNameN[text].tld, or N[baseName].tld where N is any number
 */
function isPredictedMirror(domain: string, baseDomain: string): boolean {
  const d = normalizeDomain(domain);
  const base = normalizeDomain(baseDomain);

  // Try pattern 1: domain[N].tld or domain[N][text].tld (letters/hyphens before digits)
  let match = base.match(/^([a-z-]+)\d+[a-z-]*\./);
  if (match) {
    const baseName = escapeRegExp(match[1]);
    // Check if domain matches pattern: baseNameN.tld or baseNameN[text].tld
    return new RegExp(`^${baseName}\\d+[a-z-]*\\.[a-z]+$`).test(d) && d !== base;
  }

  // Try pattern 2: [N]domain.tld (digits before letters/hyphens)
  match = base.match(/^\d+([a-z-]+)\./);
  if (match) {
    const baseName = escapeRegExp(match[1]);
    // Check if domain matches pattern: N[baseName].tld
    return new RegExp(`^\\d+${baseName}\\.[a-z]+$`).test(d) && d !== base;
  }

  return false;
}

/**
 * Remove predicted mirrors, keep only:
 * - last_known_mirror (always)
 * - initial_domain (if not null)
 * - working domains from force_search_ahead (protection for working predicted domains)
 * - non-predicted domains (wildcards, etc.)
 */
function removePredictedMirrors(
  domains: string[],
  priorityMap: Map<string, { initial: string | null; lastKnown: string; oldHost: string; workingDomains?: Set<string> }>
): string[] {
  // If priorityMap is empty, cannot determine what to keep - return all domains
  if (priorityMap.size === 0) {
    return domains;
  }

  // Collect domains to keep and base domains for pattern matching
  const keep = new Set<string>();
  const bases: string[] = [];

  for (const { initial, lastKnown, workingDomains } of priorityMap.values()) {
    keep.add(normalizeDomain(lastKnown));
    if (initial) keep.add(normalizeDomain(initial));
    // Add all working domains from force_search_ahead to protected set
    if (workingDomains) {
      for (const workingDomain of workingDomains) {
        keep.add(normalizeDomain(workingDomain));
      }
    }
    bases.push(lastKnown);
  }

  // Filter logic:
  // 1. If domain is in keep set (last_known_mirror, initial_domain, or working domain), always keep it
  // 2. If domain is NOT in keep set but matches predicted mirror pattern, remove it
  // 3. Otherwise keep it (wildcards, non-pattern domains, etc.)
  return domains.filter(domain => {
    const norm = normalizeDomain(domain);
    // Always keep last_known_mirror, initial_domain, and working domains
    if (keep.has(norm)) return true;
    // Remove predicted mirrors (domains matching pattern but not in keep set)
    const isPredicted = bases.some(base => isPredictedMirror(domain, base));
    return !isPredicted;
  });
}

function processLine(
  line: string,
  hostMap: Map<string, string>,
  initialToLastKnownMap: Map<string, string>,
  priorityMap: Map<string, { initial: string | null; lastKnown: string; oldHost: string }>,
  additionalDomainsMap: Map<string, string[]> = new Map(),
  replacedOldHosts?: Set<string>,
  usedAdditionalKeys?: Set<string>,
): string[] {
  if (shouldSkipLine(line)) return [line];

  // 1. Wrapper syntax: [$domain=...]
  const wm = line.match(/^\[([^\]]+)\](.*)/);
  if (wm) {
    const wc = wm[1], rest = wm[2];
    const eq = wc.indexOf("=");
    if (eq > 0) {
      const pn = wc.slice(0, eq), pv = wc.slice(eq + 1);
      if (pv.startsWith("/")) return [line];
      if (pv.includes("|")) {
        const d = pv.split("|").map(s => s.trim());
        const r = processDomainList(d, hostMap, initialToLastKnownMap, priorityMap, additionalDomainsMap, usedAdditionalKeys);
        if (r.changed || r.processed.length !== d.length)
          return ["[" + pn + "=" + r.processed.join("|") + "]" + rest];
      } else {
        const r = processDomainList([pv], hostMap, initialToLastKnownMap, priorityMap, additionalDomainsMap, usedAdditionalKeys);
        if (r.changed || r.processed.length !== 1) {
          return ["[" + pn + "=" + r.processed.join("|") + "]" + rest];
        }
      }
    }
    return [line];
  }

  // 2. Hash-based cosmetic markers using shared constant
  let idx = -1;
  for (const sep of COSMETIC_MARKERS) {
    const pos = line.indexOf(sep);
    if (pos > 0 && (idx === -1 || pos < idx)) idx = pos;
  }
  if (idx > 0) {
    const left = line.slice(0, idx), right = line.slice(idx);
    const parts = left.split(",").map(s => s.trim());
    const r = processDomainList(parts, hostMap, initialToLastKnownMap, priorityMap, additionalDomainsMap, usedAdditionalKeys);
    if (r.changed || r.processed.length !== parts.length) return [r.processed.join(",") + right];
    return [line];
  }

  // 3. Dollar-based cosmetic markers ($$ / $@$)
  for (const sep of DOLLAR_MARKERS) {
    const pos = line.indexOf(sep);
    if (pos > 0) {
      if (!line.slice(0, pos).match(/\$\w+=/)) {
        const left = line.slice(0, pos), right = line.slice(pos);
        const parts = left.split(",").map(s => s.trim());
        const r = processDomainList(parts, hostMap, initialToLastKnownMap, priorityMap, additionalDomainsMap, usedAdditionalKeys);
        if (r.changed || r.processed.length !== parts.length) return [r.processed.join(",") + right];
        return [line];
      }
    }
  }

  // 4. URL rules and $param= parsing
  let out = line;
  const extraLines: string[] = [];
  for (const [oh, nh] of hostMap.entries()) {
    if (oh === nh) continue;
    const re = new RegExp("\\|\\|" + escapeRegExp(oh) + "\\^", "g");
    if (re.test(out)) {
      re.lastIndex = 0;
      out = out.replace(re, "||" + nh + "^");
      replacedOldHosts?.add(normalizeDomain(oh));
      const ex = additionalDomainsMap.get(normalizeDomain(nh));
      if (ex) {
        usedAdditionalKeys?.add(normalizeDomain(nh));
        for (const e of ex)
          extraLines.push(out.replace(new RegExp("\\|\\|" + escapeRegExp(nh) + "\\^", "g"), "||" + e + "^"));
      }
    }
  }
  const pm = out.match(/\$([^$]+)$/);
  if (pm) {
    const params = pm[1];
    const pairs = params.split(",");
    const np: string[] = [];
    for (const pair of pairs) {
      const eq = pair.indexOf("=");
      if (eq === -1) { np.push(pair); continue; }
      const pn = pair.slice(0, eq), pv = pair.slice(eq + 1);
      if (pv.includes("|")) {
        const d = pv.split("|").map(s => s.trim());
        const r = processDomainList(d, hostMap, initialToLastKnownMap, priorityMap, additionalDomainsMap, usedAdditionalKeys);
        np.push(r.changed || r.processed.length !== d.length
          ? pn + "=" + r.processed.join("|") : pair);
      } else {
        const r = replaceDomain(pv, hostMap, initialToLastKnownMap);
        np.push(r !== pv ? pn + "=" + r : pair);
      }
    }
    const upd = np.join(",");
    if (upd !== params) out = out.replace("$" + params, "$" + upd);
  }
  return [out, ...extraLines];
}
// Exports for testing
export {
  normalizeDomain,
  matchesNumericPattern,
  extractBasePattern,
  matchesSamePattern,
  matchesPattern,
  replaceDomain,
  hasSchemeChangeInList,
  handleSchemeChange,
  deduplicateDomains,
  processDomainList,
  isPredictedMirror,
  removePredictedMirrors,
  processLine,
  shouldSkipLine,
  findTargetFiles,
  escapeRegExp,
};
