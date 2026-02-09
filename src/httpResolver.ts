import type { Config, RedirectResult, RedirectChainEntry, WatcherSite } from "./types.js";

export class HttpResolver {
  private activeAbortControllers: Set<AbortController> = new Set();

  constructor(private config: Config) {}

  /**
   * Force abort all active requests
   */
  abortAllRequests() {
    for (const controller of this.activeAbortControllers) {
      try {
        controller.abort();
      } catch (e) {
        // Ignore errors during abort
      }
    }
    this.activeAbortControllers.clear();
  }

  /**
   * Normalize URL by adding https:// if no protocol specified
   */
  private normalizeUrl(url: string): string {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return `https://${url}`;
    }
    return url;
  }

  async resolve(url: string, useHeuristicTimeout = false, site?: WatcherSite): Promise<RedirectResult> {
    const chain: RedirectChainEntry[] = [];
    let currentUrl = this.normalizeUrl(url);
    let depth = 0;

    try {
      while (depth <= this.config.processing.redirectDepth) {
        let response;
        try {
          response = await this.fetchWithRetry(currentUrl, useHeuristicTimeout);
          
          // Add successful request to chain
          chain.push({
            url: currentUrl,
            statusCode: response.status,
            location: response.headers.get("location") || undefined,
          });
        } catch (err) {
          // Add failed request to chain before throwing
          chain.push({
            url: currentUrl,
            statusCode: 0,
            location: undefined,
          });
          throw err;
        }

        // Check for antibot
        if (this.isAntibotResponse(response, currentUrl)) {
          // If site accepts antibot responses, treat as success
          if (site?.accept_antibot) {
            // Capture body for content probing even with antibot
            let finalBody: string | undefined;
            try {
              const contentType = response.headers.get("content-type") || "";
              if (contentType.includes("text/html") || contentType.includes("text/plain")) {
                finalBody = await response.text();
              } else {
                await response.arrayBuffer();
              }
            } catch {}
            // When force_search_ahead is enabled, signal heuristic to collect more domains
            const shouldTriggerHeuristic = Boolean(site.force_search_ahead) || this.config.heuristic.forceHeuristicOnCodes.includes(response.status);
            return {
              success: true,
              finalUrl: currentUrl,
              finalHost: new URL(currentUrl).hostname,
              statusCode: response.status,
              redirectChain: chain,
              antibotDetected: true, // Keep flag for logging
              finalBody,
              shouldTriggerHeuristic,
            };
          }
          
          // Consume body to release connection - must not throw
          try { await response.arrayBuffer(); } catch {}
          return {
            success: false,
            finalUrl: currentUrl,
            finalHost: new URL(currentUrl).hostname,
            statusCode: response.status,
            redirectChain: chain,
            antibotDetected: true,
            error: `Antibot detected: ${response.status} or __cf_chl_tk in URL`,
          };
        }

        // Success case
        if (response.status >= 200 && response.status < 300) {
          // Capture body for content probing (text/html only)
          let finalBody: string | undefined;
          try {
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("text/html") || contentType.includes("text/plain")) {
              finalBody = await response.text();
            } else {
              // Non-text content, just consume to release connection
              await response.arrayBuffer();
            }
          } catch {
            // If body read fails, continue without it
          }

          // Check global skip_text — detect parked/expired domains
          const skipPhrase = this.containsSkipText(finalBody);
          if (skipPhrase) {
            return {
              success: false,
              finalUrl: currentUrl,
              finalHost: new URL(currentUrl).hostname,
              statusCode: response.status,
              redirectChain: chain,
              antibotDetected: false,
              finalBody,
              skippedByText: skipPhrase,
              error: `Skipped by skip_text: "${skipPhrase}"`,
              shouldTriggerHeuristic: true,
            };
          }

          return {
            success: true,
            finalUrl: currentUrl,
            finalHost: new URL(currentUrl).hostname,
            statusCode: response.status,
            redirectChain: chain,
            antibotDetected: false,
            finalBody,
          };
        }

        // Redirect case
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          // Consume body to release connection (redirects typically have empty/small body) - must not throw
          try { await response.arrayBuffer(); } catch {}
          if (!location) {
            return {
              success: false,
              finalUrl: currentUrl,
              finalHost: new URL(currentUrl).hostname,
              statusCode: response.status,
              redirectChain: chain,
              error: `Redirect ${response.status} without Location header`,
            };
          }

          // Resolve relative URLs
          currentUrl = new URL(location, currentUrl).href;
          depth++;

          if (depth > this.config.processing.redirectDepth) {
            return {
              success: false,
              finalUrl: currentUrl,
              finalHost: new URL(currentUrl).hostname,
              statusCode: response.status,
              redirectChain: chain,
              error: `Exceeded max redirect depth (${this.config.processing.redirectDepth})`,
            };
          }
          continue;
        }

        // Other error status
        // Consume body to release connection - must not throw
        try { await response.arrayBuffer(); } catch {}
        
        // Check if this status code should trigger heuristic
        const shouldTriggerHeuristic = this.config.heuristic.forceHeuristicOnCodes.includes(response.status);
        
        return {
          success: false,
          finalUrl: currentUrl,
          finalHost: new URL(currentUrl).hostname,
          statusCode: response.status,
          redirectChain: chain,
          error: `Non-success status: ${response.status}`,
          shouldTriggerHeuristic,
        };
      }

      return {
        success: false,
        finalUrl: currentUrl,
        finalHost: new URL(currentUrl).hostname,
        statusCode: 0,
        redirectChain: chain,
        error: "Unexpected loop exit",
      };
    } catch (err) {
      // Check if this error should trigger heuristic (timeouts, connection issues)
      const errorMessage = err instanceof Error ? err.message.toLowerCase() : "";
      const shouldTriggerHeuristic = errorMessage.includes("timeout") || 
                                     errorMessage.includes("aborted") ||
                                     errorMessage.includes("connection") ||
                                     errorMessage.includes("network");
      
      return {
        success: false,
        finalUrl: currentUrl,
        finalHost: "",
        statusCode: 0,
        redirectChain: chain,
        error: err instanceof Error ? err.message : String(err),
        shouldTriggerHeuristic,
      };
    }
  }

  private async fetchWithRetry(url: string, useHeuristicTimeout = false): Promise<Response> {
    let lastError: Error | null = null;
    const timeout = useHeuristicTimeout
      ? this.config.http.heuristicTimeout
      : (this.config.http.resolveTimeout ?? this.config.http.timeout);

    for (let attempt = 0; attempt < this.config.http.retries; attempt++) {
      const abortController = new AbortController();
      const timeoutSignal = AbortSignal.timeout(timeout);
      
      // Combine manual abort and timeout signals
      const combinedSignal = AbortSignal.any([abortController.signal, timeoutSignal]);
      this.activeAbortControllers.add(abortController);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": this.config.http.userAgent,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Connection": "keep-alive",
            "Accept-Encoding": "gzip, deflate, br",
          },
          redirect: "manual",
          signal: combinedSignal,
        });

        // Remove from active set when successful
        this.activeAbortControllers.delete(abortController);
        return response;
      } catch (err) {
        // Remove from active set even on error
        this.activeAbortControllers.delete(abortController);
        lastError = err instanceof Error ? err : new Error(String(err));

        // Extract deeper details (undici often throws Error('fetch failed') with cause)
        const rawErr: any = err;
        const cause: any = rawErr && typeof rawErr === 'object' ? (rawErr.cause ?? undefined) : undefined;
        const rawCode = rawErr?.code ?? cause?.code;
        const code: string | undefined = typeof rawCode === 'string' ? rawCode : (typeof rawCode === 'number' ? String(rawCode) : undefined);
        const syscall: string | undefined = (rawErr?.syscall as string | undefined) ?? (cause?.syscall as string | undefined);
        const address: string | undefined = (rawErr?.address as string | undefined) ?? (cause?.address as string | undefined);
        const port: number | undefined = (rawErr?.port as number | undefined) ?? (cause?.port as number | undefined);

        // Classify error type
        const errorMessage = (lastError.message || "").toLowerCase();
        let errorType = "Network error";
        let shouldRetry = true;

        // Prefer code-based classification when available
        switch ((code || '').toUpperCase()) {
          case 'ETIMEDOUT':
            errorType = "Connection timeout";
            shouldRetry = true;
            break;
          case 'ECONNRESET':
            errorType = "Connection reset";
            shouldRetry = true;
            break;
          case 'ECONNREFUSED':
            errorType = "Connection refused";
            shouldRetry = false;
            break;
          case 'ENOTFOUND':
          case 'EAI_AGAIN':
          case 'EAI_FAIL':
            errorType = "DNS resolution failed";
            shouldRetry = false;
            break;
          case 'EPROTO':
          case 'ERR_SSL_PROTOCOL_ERROR':
            errorType = "TLS/SSL protocol error";
            shouldRetry = false;
            break;
          default: {
            // Fallback to message-based
            if (errorMessage.includes("aborted") || errorMessage.includes("abort")) {
              errorType = `Timeout (${timeout}ms)`;
              shouldRetry = true; // Retry timeouts (pool contention may cause the first to fail)
            } else if (errorMessage.includes("enotfound") || errorMessage.includes("getaddrinfo")) {
              errorType = "DNS resolution failed";
              shouldRetry = false;
            } else if (errorMessage.includes("econnrefused")) {
              errorType = "Connection refused";
              shouldRetry = false;
            } else if (errorMessage.includes("econnreset")) {
              errorType = "Connection reset";
              shouldRetry = true;
            } else if (errorMessage.includes("etimedout")) {
              errorType = "Connection timeout";
              shouldRetry = true;
            }
          }
        }

        // Append low-level details if available
        const details: string[] = [];
        if (code) details.push(`code=${code}`);
        if (syscall) details.push(`syscall=${syscall}`);
        if (address) details.push(`addr=${address}${port ? ':' + port : ''}`);
        const suffix = details.length ? ` [${details.join(', ')}]` : '';

        // Update error message with type and details
        lastError = new Error(`${errorType}${suffix}: ${lastError.message}`);

        // Only retry if it makes sense
        if (!shouldRetry) {
          throw lastError;
        }

        if (attempt < this.config.http.retries - 1) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error("Fetch failed after retries");
  }

  /**
   * Check if response body contains any global skip_text phrase (parked/expired domains)
   * @returns The matched phrase, or undefined if no match
   */
  containsSkipText(body?: string): string | undefined {
    if (!body || !this.config.skip_text || this.config.skip_text.length === 0) {
      return undefined;
    }
    for (const phrase of this.config.skip_text) {
      if (body.includes(phrase)) {
        return phrase;
      }
    }
    return undefined;
  }

  private isAntibotResponse(response: Response, url: string): boolean {
    // Check status codes
    if (this.config.antibot.detectCodes.includes(response.status)) {
      return true;
    }

    // Check URL pattern
    if (url.includes(this.config.antibot.detectUrlPattern)) {
      return true;
    }

    return false;
  }

  extractHostWithoutQuery(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  /**
   * Normalize URL (add https:// if missing) and extract hostname
   * This is a convenience method that combines normalizeUrl + extractHostWithoutQuery
   */
  normalizeAndExtractHost(url: string): string {
    const normalized = this.normalizeUrl(url);
    return this.extractHostWithoutQuery(normalized);
  }

  extractPathWithoutQuery(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.pathname;
    } catch {
      return "";
    }
  }

  /**
   * Format redirect chain compactly:
   * - If chain <= 3: show all
   * - If chain > 3: show first, "... (N redirects) ...", last
   */
  formatRedirectChain(chain: RedirectChainEntry[]): string {
    if (chain.length === 0) return "";
    if (chain.length <= 3) {
      return chain.map((e) => `${e.url} (${e.statusCode})`).join(" -> ");
    }

    const first = chain[0];
    const last = chain[chain.length - 1];
    const middleCount = chain.length - 2;

    return `${first.url} (${first.statusCode}) -> ... (${middleCount} redirects) ... -> ${last.url} (${last.statusCode})`;
  }
}
