// Domains replacement logic
// Supports cosmetic rules, URL rules, and parameter lists

import { promises as fs } from "fs";
import path from "path";
import type { Config, ReplacementPair } from "./types.js";
import { Logger, LogLevel } from "./logger.js";
import { table as renderTable, getBorderCharacters } from "table";

// Helper function for consistent domain normalization (www-aware)
function normalizeDomain(domain: string): string {
  return domain.replace(/^www\./, '').toLowerCase();
}

// Helper functions for domain pattern detection
function matchesNumericPattern(domain: string): boolean {
  const norm = normalizeDomain(domain);
  // Supports both domain[N].tld and domain[N][text].tld patterns
  return /^[\w-]+(\d+)[a-z]*\.[a-z]{2,}$/.test(norm);
}

function extractBasePattern(domain: string): string {
  const norm = normalizeDomain(domain);
  // Replace numeric part with {N}, preserving text after number
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
  replacedDomains: string[]
): string[] {
  // Find any numeric pattern domain to extract pattern
  const numericDomain = originalDomains.find(d => matchesNumericPattern(d));
  if (!numericDomain) return replacedDomains;
  
  const oldPattern = extractBasePattern(numericDomain);
  return replacedDomains.filter(d => !matchesPattern(d, oldPattern));
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
  priorityMap: Map<string, { initial: string | null; lastKnown: string; oldHost: string }>
): { processed: string[]; changed: boolean; schemeChangeDetected: boolean } {
  // 1. Replace domains
  const replaced = domains.map(d => replaceDomain(d, hostMap, initialToLastKnownMap));
  const changed = domains.some((d, i) => replaced[i] !== d);
  
  // 2. Check for scheme change
  const schemeChangeDetected = hasSchemeChangeInList(domains, replaced);
  
  let processed = replaced;
  
  // 3. Handle scheme change (remove ALL domains of old pattern)
  if (schemeChangeDetected) {
    processed = handleSchemeChange(domains, replaced);
  }
  
  // 4. Remove predicted mirrors and deduplicate
  // Clean up predicted mirrors if domains changed OR if numeric patterns exist
  const hasNumericPatterns = domains.some(d => matchesNumericPattern(d));
  if ((changed || hasNumericPatterns) && priorityMap.size > 0) {
    // Always remove predicted mirrors if we have numeric patterns and active domains
    if (hasNumericPatterns && priorityMap.size > 0) {
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
  }
  
  return { processed, changed, schemeChangeDetected };
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
  ): Promise<{filesScanned: number, filesModified: number, totalLineEdits: number, replacerSeconds: string}> {
    const replacerStart = Date.now();
    
    if (replacements.length === 0) {
      this._logger.logGlobal(LogLevel.INFO, "No replacements to process.");
      return { filesScanned: 0, filesModified: 0, totalLineEdits: 0, replacerSeconds: '0.000' };
    }

    // Build ASCII table: Site | From (startedHost) | To | Time
    // Show only actual domain changes in the table
    const actualChanges = replacements.filter(r => {
      // Check if there's a real change between from and to
      const fromHost = r.startedHost || r.oldHost;
      return fromHost !== r.newHost;
    });
    
    // Remove duplicates by siteName (keep the first occurrence)
    const uniqueChanges = actualChanges.filter((change, index, self) => 
      index === self.findIndex(c => c.siteName === change.siteName)
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
      return { filesScanned: 0, filesModified: 0, totalLineEdits: 0, replacerSeconds: '0.000' };
    }

    const filterDirPattern = filtersConfig.filterDirPattern || "*Filter";
    const filePattern = filtersConfig.filePattern || "*.txt";

    const files = await findTargetFiles(repoPath, filterDirPattern, filePattern);
    if (files.length === 0) {
      this._logger.logGlobal(LogLevel.INFO, "No target filter files found. Nothing to replace.");
      return { filesScanned: 0, filesModified: 0, totalLineEdits: 0, replacerSeconds: '0.000' };
    }

    // Log replacement phase start (moved to end)
    this._logger.logGlobal(LogLevel.DEBUG, "=== Domains replacement started ===");
    this._logger.logGlobal(LogLevel.DEBUG, `Files to scan: ${files.length}`);
    this._logger.logGlobal(LogLevel.DEBUG, `Files found: ${files.map(f => path.relative(repoPath, f)).join(", ")}`);

    // Build lookup maps from all replacements (not just actualChanges)
    // This ensures we process filters even when domain didn't change but has initial_domain
    const hostMap = new Map<string, string>();
    for (const r of replacements) {
      hostMap.set(r.oldHost, r.newHost);
      // Also map initial_domain (startedHost) to newHost
      if (r.startedHost && r.startedHost !== r.oldHost) {
        hostMap.set(r.startedHost, r.newHost);
      }
    }

    // Build priorityMap: key = last_known_mirror (newHost)
    // This map is used by removePredictedMirrors to determine which domains to keep
    const priorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();
    for (const r of replacements) {
      // Only add to priorityMap if domain matches numeric pattern
      // This ensures we only clean up predicted mirrors for sites that use this pattern
      if (matchesNumericPattern(r.newHost)) {
        priorityMap.set(r.newHost, {
          initial: r.startedHost || null,
          lastKnown: r.newHost,
          oldHost: r.oldHost,
        });
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

    for (const file of files) {
      let content: string;
      try {
        content = await fs.readFile(file, "utf-8");
      } catch (e) {
        this._logger.info("replacer", `Skip unreadable file: ${file}`);
        continue;
      }

      const lines = content.split(/\r?\n/);
      let changed = false;
      const lineChanges: Array<{ line: number; before: string; after: string }> = [];

      for (let i = 0; i < lines.length; i++) {
        const original = lines[i];
        const updated = processLine(original, hostMap, initialToLastKnownMap, priorityMap);
        if (updated !== original) {
          lines[i] = updated;
          changed = true;
          totalLineEdits++;
          lineChanges.push({ line: i + 1, before: original, after: updated });
        }
      }

      if (changed) {
        modifiedFiles++;
        if (!dryRun) {
          await fs.writeFile(file, lines.join("\n"), "utf-8");
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
    
    return { 
      filesScanned: files.length, 
      filesModified: modifiedFiles, 
      totalLineEdits: totalLineEdits, 
      replacerSeconds: replacerSeconds 
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
        if (wantDirSuffix && e.name.endsWith(wantDirSuffix)) {
          await collectTxtRecursive(full);
        }
        await walk(full);
      }
    }
  }

  await walk(root);
  return results;
}

function shouldSkipLine(line: string): boolean {
  const t = line.trim();
  if (t.length === 0) return true;
  if (t.startsWith("!")) return true; // comments
  if (t.startsWith("/") && t.endsWith("/")) return true; // regex
  // Skip wildcard in URL patterns, but allow:
  // - cosmetic rules (##, #$#, #?#, #$?#, #%#)
  // - URL rules with parameters ($domain=, $denyallow=, etc.)
  if (t.includes("*")) {
    const hasCosmetic = t.includes("##") || t.includes("#$#") || t.includes("#?#") || t.includes("#$?#") || t.includes("#%#");
    const hasParams = t.includes("$");
    if (!hasCosmetic && !hasParams) {
      return true;
    }
  }
  return false;
}


/**
 * Check if domain matches predicted mirror pattern relative to baseDomain
 * Example: yavasgir31.com is predicted mirror of yavasgir34.com
 * Example: betist126tv.live is predicted mirror of betist131tv.live
 * Pattern: baseNameN.tld or baseNameN[text].tld where N is any number
 */
function isPredictedMirror(domain: string, baseDomain: string): boolean {
  const d = normalizeDomain(domain);
  const base = normalizeDomain(baseDomain);
  
  // Extract base name (letters before digits) - supports domain[N].tld and domain[N][text].tld
  const match = base.match(/^([a-z]+)\d+[a-z]*\./);
  if (!match) return false;
  
  const baseName = match[1];
  // Check if domain matches pattern: baseNameN.tld or baseNameN[text].tld
  return new RegExp(`^${baseName}\\d+[a-z]*\\.[a-z]+$`).test(d) && d !== base;
}

/**
 * Remove predicted mirrors, keep only:
 * - last_known_mirror (always)
 * - initial_domain (if not null)
 * - non-predicted domains (wildcards, etc.)
 */
function removePredictedMirrors(
  domains: string[],
  priorityMap: Map<string, { initial: string | null; lastKnown: string; oldHost: string }>
): string[] {
  // If priorityMap is empty, cannot determine what to keep - return all domains
  if (priorityMap.size === 0) {
    return domains;
  }
  
  // Collect domains to keep and base domains for pattern matching
  const keep = new Set<string>();
  const bases: string[] = [];
  
  for (const { initial, lastKnown } of priorityMap.values()) {
    keep.add(normalizeDomain(lastKnown));
    if (initial) keep.add(normalizeDomain(initial));
    bases.push(lastKnown);
  }
  
  // Filter logic:
  // 1. If domain is in keep set (last_known_mirror or initial_domain), always keep it
  // 2. If domain is NOT in keep set but matches predicted mirror pattern, remove it
  // 3. Otherwise keep it (wildcards, non-pattern domains, etc.)
  return domains.filter(domain => {
    const norm = normalizeDomain(domain);
    // Always keep last_known_mirror and initial_domain
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
  priorityMap: Map<string, { initial: string | null; lastKnown: string; oldHost: string }>
): string {
  if (shouldSkipLine(line)) return line;

  // Cosmetic rules: find marker (##, #$#, #?#, #$?#, #%#)
  let idx = -1;
  for (const sep of ["#$?#", "#$#", "#?#", "#%#", "##"]) {
    const pos = line.indexOf(sep);
    if (pos > 0 && (idx === -1 || pos < idx)) {
      idx = pos;
    }
  }

  if (idx > 0) {
    const left = line.slice(0, idx);
    const right = line.slice(idx);
    const parts = left.split(",").map(s => s.trim());

    // Process domain list with unified logic
    const { processed, changed } = processDomainList(parts, hostMap, initialToLastKnownMap, priorityMap);
    
    // Return updated line if domains changed OR if predicted mirrors were removed
    if (changed || processed.length !== parts.length) {
      return `${processed.join(",")}${right}`;
    }
  }

  // URL rules and parameters
  let out = line;

  // Replace ||oldHost^ patterns
  for (const [oldHost, newHost] of hostMap.entries()) {
    if (oldHost === newHost) continue;
    const tokenRe = new RegExp(`\\|\\|${escapeRegExp(oldHost)}\\^`, "g");
    out = out.replace(tokenRe, `||${newHost}^`);
  }

  // Replace domains in URL parameters ($param=domain1|domain2)
  const paramMatch = out.match(/\$([^$]+)$/);
  if (paramMatch) {
    const params = paramMatch[1];
    let updatedParams = params;

    // Find all param=value pairs
    const paramPairs = params.split(",");
    const newPairs: string[] = [];

    for (const pair of paramPairs) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) {
        newPairs.push(pair);
        continue;
      }

      const paramName = pair.slice(0, eqIdx);
      const paramValue = pair.slice(eqIdx + 1);

      // Check if value contains domain list (separated by |)
      if (paramValue.includes("|")) {
        const domains = paramValue.split("|").map(d => d.trim());
        
        // Process domain list with unified logic
        const { processed, changed } = processDomainList(domains, hostMap, initialToLastKnownMap, priorityMap);
        
        // Update if domains changed OR if predicted mirrors were removed OR if list was empty
        if (changed || processed.length !== domains.length || processed.length === 0) {
          // Prevent empty domain lists - add last_known_mirror if available and matches pattern
          if (processed.length === 0 && priorityMap.size > 0 && domains.length > 0) {
            const currentPattern = extractBasePattern(domains[0]);
            for (const { lastKnown } of priorityMap.values()) {
              if (matchesNumericPattern(lastKnown) && extractBasePattern(lastKnown) === currentPattern) {
                processed.push(lastKnown);
                break;
              }
            }
          }
          newPairs.push(`${paramName}=${processed.join("|")}`);
        } else {
          newPairs.push(pair);
        }
      } else {
        // Handle single domain in parameter
        const replacedDomain = replaceDomain(paramValue, hostMap, initialToLastKnownMap);
        if (replacedDomain !== paramValue) {
          newPairs.push(`${paramName}=${replacedDomain}`);
        } else {
          newPairs.push(pair);
        }
      }
    }

    updatedParams = newPairs.join(",");
    if (updatedParams !== params) {
      out = out.replace(`$${params}`, `$${updatedParams}`);
    }
  }

  return out;
}
