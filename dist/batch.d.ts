import type { Config, Watchers, CheckResult } from './types.js';
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
    private updateDomainHistory;
    private calculateDaysSince;
    /**
     * Check if a URL resolves via DNS
     * @param url - URL to check
     * @returns true if DNS resolves, false otherwise
     */
    private checkDnsResolution;
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
