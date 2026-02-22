import type { Config, Watchers, CheckResult, WatcherSite } from './types.js';
import { HttpResolver } from './httpResolver.js';
import { Logger } from './logger.js';
export declare class BatchProcessor {
    private config;
    private watchers;
    private logger;
    private resolver;
    private probe;
    constructor(config: Config, watchers: Watchers, logger: Logger, resolver: HttpResolver);
    /**
     * Tokenize domain into structured parts (runtime only, not persisted)
     */
    private tokenizeDomain;
    /**
     * Check if domain matches numeric pattern (backward compatibility wrapper)
     */
    private matchesNumericPattern;
    /**
     * Group history domains by pattern (on the fly)
     */
    private groupHistoryByPattern;
    updateDomainHistory(site: WatcherSite, newDomain: string, oldLastKnownMirror?: string): void;
    private calculateDaysSince;
    /**
     * Check if a URL resolves via DNS
     * @param url - URL to check
     * @returns true if DNS resolves, false otherwise
     */
    private checkDnsResolution;
    /**
     * Run heuristic search for a site and return first working pattern domain
     * Returns null if no pattern domain found
     */
    private runHeuristicSearch;
    /**
     * Check heuristic candidates and return first working pattern domain
     * Returns null if no pattern domain found
     */
    private checkHeuristicCandidates;
    /**
     * Generate heuristic candidates for a failed site
     */
    private generateCandidates;
    /**
     * DNS pre-filter: check which candidates resolve
     */
    private batchDnsCheck;
    processAll(): Promise<CheckResult[]>;
    private processSite;
}
