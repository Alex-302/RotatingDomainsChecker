export interface Config {
    http: {
        timeout: number;
        retries: number;
        heuristicTimeout: number;
        /** Optional, overrides timeout for redirect resolve phase */
        resolveTimeout?: number;
        userAgent: string;
    };
    processing: {
        /** Legacy/global parallelism (used as fallback) */
        parallel: number;
        /** Optional, overrides parallelism for resolve phase */
        resolveParallel?: number;
        /** Optional, overrides parallelism for heuristic phase */
        heuristicParallel?: number;
        redirectDepth: number;
    };
    dnsPreCheck: {
        enabled: boolean;
        timeout: number;
        retryOnce: boolean;
    };
    contentProbe: {
        enabled: boolean;
    };
    antibot: {
        detectCodes: number[];
        detectUrlPattern: string;
    };
    thresholds: {
        failedDaysWarning: number;
    };
    heuristic: {
        enabled: boolean;
        maxAttempts: number;
        skipOnAntibot: boolean;
        attemptParallel?: number;
        dnsParallel?: number;
        forceHeuristicOnCodes: number[];
    };
    logging: {
        saveToFile: boolean;
        incremental: boolean;
        filePath: string;
    };
    skip_text?: string[];
    git: {
        mode: 'debug' | 'prod';
        branch: string;
        prBranchPrefix: string;
    };
    filtersdir: {
        repoPath: string;
        filterDirPattern: string;
        filePattern: string;
    };
    filtersdir_test?: {
        repoPath: string;
        filterDirPattern: string;
        filePattern: string;
    };
}
export interface WatcherSite {
    initial_domain?: string;
    last_known_mirror: string;
    path?: string;
    probe_text?: string[];
    /** Disable heuristic fallback for this site */
    disable_heuristic?: boolean;
    /** Accept antibot responses (403/Cloudflare) as working domains */
    accept_antibot?: boolean;
    /** Continue searching all heuristic candidates even after finding first working domain */
    force_search_ahead?: boolean;
    /** Informational field for geo-blocking (e.g., TR for Turkey) */
    geoblock?: string;
    /** Historical fallback: last 5 working domains (chronological order, oldest first) */
    heuristic_history?: string[];
    /** Pattern change detection: true when current domain is non-pattern (deleted when pattern found) */
    pattern_changed?: boolean;
    /** Current non-pattern domain when pattern_changed is true (deleted when pattern found) */
    non_pattern_mirror?: string;
    last_seen: string;
    last_failed: string;
    failed_days: number;
    potentially_dead?: boolean;
}
export interface Watchers {
    sites: Record<string, WatcherSite>;
}
export interface RedirectResult {
    success: boolean;
    finalUrl: string;
    finalHost: string;
    statusCode: number;
    redirectChain: RedirectChainEntry[];
    error?: string;
    antibotDetected?: boolean;
    contentProbeOk?: boolean;
    finalBody?: string;
    shouldTriggerHeuristic?: boolean;
    skippedByText?: string;
}
export interface RedirectChainEntry {
    url: string;
    statusCode: number;
    location?: string;
}
export interface CheckResult {
    siteName: string;
    oldHost: string;
    newHost: string;
    hostChanged: boolean;
    startedHost: string;
    result: RedirectResult;
    shouldUpdate: boolean;
    error?: string;
    checkDurationMs: number;
    actualCheckedDomain?: string;
    additionalWorkingDomains?: string[];
}
export interface ReplacementPair {
    oldHost: string;
    newHost: string;
    siteName: string;
    /** Host of the URL we started checking (initial_domain or last_known_mirror) */
    startedHost: string;
    /** Total check duration in milliseconds */
    checkDurationMs?: number;
    /** Last pattern domain from history when pattern_changed is true */
    patternChangedDomain?: string;
}
export interface Summary {
    totalSites: number;
    checked: number;
    updated: number;
    unchanged: number;
    failed: number;
    antibotAccepted: number;
    antibotBlocked: number;
    replacements: ReplacementPair[];
    errors: Array<{
        siteName: string;
        error: string;
        domain?: string;
        type?: 'antibot_blocked' | 'antibot_accepted' | 'dns' | 'http' | 'probe' | 'network' | 'skip_text';
        checkDurationMs?: number;
    }>;
    warnings: string[];
}
export interface HeuristicTask {
    siteName: string;
    siteIndex: number;
    candidateUrl: string;
    attemptIndex: number;
    oldMirror: string;
    probeText?: string[];
    site: WatcherSite;
}
/**
 * Runtime-only domain token (not persisted to watchers.yml)
 * Used for pattern detection and comparison
 */
export interface DomainToken {
    original: string;
    hostname: string;
    isPattern: boolean;
    patternType?: 'numeric';
    parts?: {
        prefix: string;
        variable: string;
        suffix: string;
    };
}
