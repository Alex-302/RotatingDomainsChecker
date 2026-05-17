// Core type definitions

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
  /** Allow specific phrases from global skip_text for this site (exact match exclusion) */
  skip_text_allow?: string[];
  /** Historical fallback: last 5 working domains (chronological order, oldest first) */
  heuristic_history?: string[];
  /** Pattern change detection: true when current domain is non-pattern (deleted when pattern found) */
  pattern_changed?: boolean;
  // Auto-updated fields
  last_seen: string;        // Format: YYYY-MM-DD HH:MM
  failed_since?: string;    // Format: YYYY-MM-DD HH:MM (only when failed)
  failed_days?: number;     // Days since failed_since (only when failed)
  potentially_dead?: boolean; // true if last_known_mirror and heuristic failed to find working domain
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
  finalBody?: string; // Response body from final successful request (for content probing)
  shouldTriggerHeuristic?: boolean; // Force heuristic search even for certain error statuses
  skippedByText?: string; // Set when skip_text phrase was found in response body
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
  actualCheckedDomain?: string; // The actual domain that was checked for accurate error reporting
  additionalWorkingDomains?: string[]; // Additional working domains found with force_search_ahead
  historyUpdated?: boolean; // True when updateDomainHistory was already called in batch.ts (heuristic path)
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
  unchanged: number;  // Sites that succeeded but didn't change
  failed: number;  // Total failed (excluding accepted antibot)
  antibotAccepted: number;  // Antibot detected, but accepted by config
  antibotBlocked: number;  // Antibot detected and NOT accepted (counted in failed)
  replacements: ReplacementPair[];
  errors: Array<{ siteName: string; error: string; domain?: string; type?: 'antibot_blocked' | 'antibot_accepted' | 'dns' | 'http' | 'probe' | 'network' | 'skip_text'; checkDurationMs?: number }>;
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
  original: string;                 // Original domain string
  hostname: string;                 // Normalized hostname (no www., no protocol)
  isPattern: boolean;               // Whether domain matches a pattern
  patternType?: 'numeric';          // Type of pattern detected (currently only numeric)
  parts?: {
    prefix: string;                 // Domain prefix (e.g., "kodtimetv")
    variable: string;               // Variable part (e.g., "16")
    suffix: string;                 // Domain suffix (e.g., ".com")
  };
}
