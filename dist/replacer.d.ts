import type { Config, ReplacementPair } from "./types.js";
import { Logger } from "./logger.js";
declare function normalizeDomain(domain: string): string;
declare function matchesNumericPattern(domain: string): boolean;
declare function extractBasePattern(domain: string): string;
declare function matchesSamePattern(domain1: string, domain2: string): boolean;
declare function matchesPattern(domain: string, pattern: string): boolean;
declare function replaceDomain(domain: string, hostMap: Map<string, string>, initialToLastKnownMap: Map<string, string>): string;
declare function hasSchemeChangeInList(originalDomains: string[], replacedDomains: string[]): boolean;
declare function handleSchemeChange(originalDomains: string[], replacedDomains: string[], priorityMap: Map<string, {
    initial: string | null;
    lastKnown: string;
    oldHost: string;
}>): string[];
declare function deduplicateDomains(domains: string[]): string[];
declare function processDomainList(domains: string[], hostMap: Map<string, string>, initialToLastKnownMap: Map<string, string>, priorityMap: Map<string, {
    initial: string | null;
    lastKnown: string;
    oldHost: string;
}>, additionalDomainsMap?: Map<string, string[]>): {
    processed: string[];
    changed: boolean;
    schemeChangeDetected: boolean;
};
export declare class FilterReplacer {
    private _config;
    private _logger;
    private _isTestMode;
    constructor(_config: Config, _logger: Logger, _isTestMode?: boolean);
    applyReplacements(replacements: ReplacementPair[], dryRun?: boolean): Promise<{
        filesScanned: number;
        filesModified: number;
        totalLineEdits: number;
        replacerSeconds: string;
    }>;
}
declare function escapeRegExp(s: string): string;
declare function findTargetFiles(root: string, dirPattern: string, filePattern: string): Promise<string[]>;
declare function shouldSkipLine(line: string): boolean;
/**
 * Check if domain matches predicted mirror pattern relative to baseDomain
 * Example: yavasgir31.com is predicted mirror of yavasgir34.com
 * Example: betist126tv.live is predicted mirror of betist131tv.live
 * Example: 7dizipal.com is predicted mirror of 8dizipal.com
 * Pattern: baseNameN.tld, baseNameN[text].tld, or N[baseName].tld where N is any number
 */
declare function isPredictedMirror(domain: string, baseDomain: string): boolean;
/**
 * Remove predicted mirrors, keep only:
 * - last_known_mirror (always)
 * - initial_domain (if not null)
 * - working domains from force_search_ahead (protection for working predicted domains)
 * - non-predicted domains (wildcards, etc.)
 */
declare function removePredictedMirrors(domains: string[], priorityMap: Map<string, {
    initial: string | null;
    lastKnown: string;
    oldHost: string;
    workingDomains?: Set<string>;
}>): string[];
declare function processLine(line: string, hostMap: Map<string, string>, initialToLastKnownMap: Map<string, string>, priorityMap: Map<string, {
    initial: string | null;
    lastKnown: string;
    oldHost: string;
}>, additionalDomainsMap?: Map<string, string[]>): string[];
export { normalizeDomain, matchesNumericPattern, extractBasePattern, matchesSamePattern, matchesPattern, replaceDomain, hasSchemeChangeInList, handleSchemeChange, deduplicateDomains, processDomainList, isPredictedMirror, removePredictedMirrors, processLine, shouldSkipLine, findTargetFiles, escapeRegExp, };
//# sourceMappingURL=replacer.d.ts.map