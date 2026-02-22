import type { Config, RedirectResult, RedirectChainEntry, WatcherSite } from "./types.js";
export declare class HttpResolver {
    private config;
    private activeAbortControllers;
    constructor(config: Config);
    /**
     * Force abort all active requests
     */
    abortAllRequests(): void;
    /**
     * Normalize URL by adding https:// if no protocol specified
     */
    private normalizeUrl;
    resolve(url: string, useHeuristicTimeout?: boolean, site?: WatcherSite, probeText?: string[]): Promise<RedirectResult>;
    private fetchWithRetry;
    /**
     * Extract redirect URL from JS redirects and meta refresh tags in HTML body.
     * Handles: location.replace(), window.location.href=, location.href=, meta http-equiv="refresh"
     * @returns Absolute redirect URL, or undefined if none found
     */
    extractJsRedirect(body: string | undefined, baseUrl: string): string | undefined;
    /**
     * Check if response body contains any global skip_text phrase (parked/expired domains)
     * @returns The matched phrase, or undefined if no match
     */
    containsSkipText(body?: string): string | undefined;
    private isAntibotResponse;
    extractHostWithoutQuery(url: string): string;
    /**
     * Normalize URL (add https:// if missing) and extract hostname
     * This is a convenience method that combines normalizeUrl + extractHostWithoutQuery
     */
    normalizeAndExtractHost(url: string): string;
    extractPathWithoutQuery(url: string): string;
    /**
     * Format redirect chain compactly:
     * - If chain <= 3: show all
     * - If chain > 3: show first, "... (N redirects) ...", last
     */
    formatRedirectChain(chain: RedirectChainEntry[]): string;
}
//# sourceMappingURL=httpResolver.d.ts.map