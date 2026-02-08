import type { Config, Watchers, CheckResult, HeuristicTask, RedirectResult, WatcherSite } from './types.js';
import { HttpResolver } from './httpResolver.js';
import { ContentProbe } from './probe.js';
import { Logger, LogLevel } from './logger.js';
import { promises as dns } from 'dns';

export class BatchProcessor {
  private probe: ContentProbe;

  constructor(
    private config: Config,
    private watchers: Watchers,
    private logger: Logger,
    private resolver: HttpResolver,
  ) {
    this.probe = new ContentProbe(config);
  }

  private calculateDaysSince(dateStr: string): number {
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

  /**
   * Check if a URL resolves via DNS
   * @param url - URL to check
   * @returns true if DNS resolves, false otherwise
   */
  private async checkDnsResolution(url: string): Promise<boolean> {
    const dnsConfig = this.config.dnsPreCheck;
    if (!dnsConfig.enabled) {
      return true;
    }
    const timeout = dnsConfig.timeout;
    const retryOnce = dnsConfig.retryOnce;
    try {
      const hostname = new URL(url).hostname;
      await Promise.race([
        dns.resolve(hostname),
        new Promise((_, rej) => setTimeout(() => rej(new Error("DNS timeout")), timeout))
      ]);
      return true;
    } catch (err: any) {
      if (retryOnce && (err.code === "EAI_AGAIN" || err.message === "DNS timeout")) {
        try {
          const hostname = new URL(url).hostname;
          await Promise.race([
            dns.resolve(hostname),
            new Promise((_, rej) => setTimeout(() => rej(new Error("DNS timeout")), 2500))
          ]);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Generate heuristic candidates for a failed site
   */
  private generateCandidates(
    siteName: string,
    siteIndex: number,
    site: WatcherSite,
    failedUrl: string
  ): HeuristicTask[] {
    // Try pattern 1: domain[N].tld or domain[N][text].tld (number after letters)
    let match = failedUrl.match(/^(https?:\/\/)?([a-z-]+)(\d+)([a-z-]*)(\.[a-z.]+)(\/.*)?/i);
    let isNumberFirst = false;
    
    // Try pattern 2: [N]domain.tld (number at the beginning)
    if (!match) {
      match = failedUrl.match(/^(https?:\/\/)?(\d+)([a-z-]+)(\.[a-z.]+)(\/.*)?/i);
      isNumberFirst = true;
    }
    
    if (!match) {
      this.logger.warn(siteName, "Heuristic: URL doesn't match domain[N].tld, domain[N][text].tld, or [N]domain.tld pattern, skipping");
      return [];
    }

    let protocol: string, prefix: string, numStr: string, middleText: string, suffix: string, path: string;
    
    if (isNumberFirst) {
      // Pattern: [N]domain.tld -> (protocol)(number)(letters)(suffix)(path)
      [, protocol = 'https://', numStr, prefix, suffix, path = ''] = match;
      middleText = '';
    } else {
      // Pattern: domain[N].tld or domain[N][text].tld -> (protocol)(letters)(number)(middle)(suffix)(path)
      [, protocol = 'https://', prefix, numStr, middleText = '', suffix, path = ''] = match;
    }
    
    const currentNum = parseInt(numStr, 10);
    const startNum = currentNum + 1;

    const tasks: HeuristicTask[] = [];
    for (let i = 0; i < this.config.heuristic.maxAttempts; i++) {
      const num = startNum + i;
      const candidateUrl = isNumberFirst
        ? `${protocol}${num}${prefix}${suffix}${path}`
        : `${protocol}${prefix}${num}${middleText}${suffix}${path}`;
      tasks.push({
        siteName,
        siteIndex,
        candidateUrl,
        attemptIndex: i,
        oldMirror: site.last_known_mirror,
        probeText: site.probe_text,
        site,
      });
    }

    return tasks;
  }

  /**
   * DNS pre-filter: check which candidates resolve
   */
  private async batchDnsCheck(tasks: HeuristicTask[]): Promise<Array<HeuristicTask & { dnsOk: boolean }>> {
    const dnsConfig = this.config.dnsPreCheck;
    if (!dnsConfig.enabled) {
      // DNS pre-filter disabled, mark all as OK
      return tasks.map(t => ({ ...t, dnsOk: true }));
    }

    const dnsParallel = this.config.heuristic.dnsParallel ?? 20;
    const results: Array<HeuristicTask & { dnsOk: boolean }> = new Array(tasks.length);
    const activePromises = new Map<number, Promise<{ index: number; ok: boolean }>>();
    let nextIndex = 0;
    let completedCount = 0;

    try {
      // Rolling window with strict limit
      for (let i = 0; i < Math.min(dnsParallel, tasks.length); i++) {
        const idx = i;
        const promise = this.checkDnsResolution(tasks[idx].candidateUrl)
          .then(ok => ({ index: idx, ok }))
          .catch(err => {
            // Catch unexpected errors to prevent unhandled rejections
            this.logger.debug(tasks[idx].siteName, `DNS check failed with unexpected error: ${err.message}`);
            return { index: idx, ok: false };
          });
        activePromises.set(idx, promise);
        nextIndex++;
      }

      while (completedCount < tasks.length) {
        try {
          const completed = await Promise.race(activePromises.values());
          activePromises.delete(completed.index);
          results[completed.index] = { ...tasks[completed.index], dnsOk: completed.ok };
          completedCount++;

          // Log DNS result
          const task = tasks[completed.index];
          const dnsStatus = completed.ok ? 'OK' : 'FAILED';
          this.logger.debug(task.siteName, `Heuristic DNS check: ${task.candidateUrl} - ${dnsStatus}`);

          // Start next task if available
          if (nextIndex < tasks.length) {
            const idx = nextIndex;
            const promise = this.checkDnsResolution(tasks[idx].candidateUrl)
              .then(ok => ({ index: idx, ok }))
              .catch(err => {
                // Catch unexpected errors to prevent unhandled rejections
                this.logger.debug(tasks[idx].siteName, `DNS check failed with unexpected error: ${err.message}`);
                return { index: idx, ok: false };
              });
            activePromises.set(idx, promise);
            nextIndex++;
          }
        } catch (err) {
          // Error in Promise.race - should not happen with proper error handling above
          // but handle defensively to prevent loop hanging
          this.logger.debug("", `Unexpected error in DNS check loop: ${err}`);
          break;
        }
      }
    } finally {
      // Ensure activePromises is cleared even if an exception occurs
      activePromises.clear();
    }

    return results;
  }

  async processAll(): Promise<CheckResult[]> {
    const siteEntries = Object.entries(this.watchers.sites);
    const results: CheckResult[] = new Array(siteEntries.length);

    // =============================
    // Phase 1: Resolve redirects only
    // =============================
    const resolveParallel = this.config.processing.resolveParallel ?? this.config.processing.parallel;
    const batchStart = Date.now();
    const enqueuedAt: number[] = new Array(siteEntries.length).fill(batchStart);
    const siteStartTimes: number[] = new Array(siteEntries.length).fill(0);
    const queuedDurations: number[] = [];
    const activePromises = new Map<number, Promise<{ index: number, result: CheckResult }>>();
    let nextIndex = 0;

    const startResolveTask = (idx: number) => {
      const [name, site] = siteEntries[idx];
      siteStartTimes[idx] = Date.now();
      const queueMs = Date.now() - enqueuedAt[idx];
      queuedDurations.push(queueMs);
      const promise = this.processSite(name, site, queueMs)
        .then(result => ({ index: idx, result }));
      activePromises.set(idx, promise);
    };

    for (let i = 0; i < resolveParallel && i < siteEntries.length; i++) {
      startResolveTask(i);
      nextIndex = i + 1;
    }

    while (activePromises.size > 0) {
      const completed = await Promise.race(activePromises.values());
      activePromises.delete(completed.index);
      results[completed.index] = completed.result;
      if (nextIndex < siteEntries.length) {
        startResolveTask(nextIndex);
        nextIndex++;
      }
    }

    // =============================
    // Phase 2: Unified heuristic queue with DNS pre-filter
    // =============================
    if (this.config.heuristic.enabled) {
      // Step 1: Generate all candidates for failed sites
      const allTasks: HeuristicTask[] = [];
      for (let i = 0; i < siteEntries.length; i++) {
        const [name, site] = siteEntries[i];
        const r = results[i];
        if (!r) continue;
        const failed = !r.result.success;
        const antibot = r.result.antibotDetected;
        const forceHeuristic = r.result.shouldTriggerHeuristic;
        const skipHeuristic = Boolean(site.disable_heuristic) || (antibot && this.config.heuristic.skipOnAntibot);

        if ((failed || forceHeuristic) && !skipHeuristic) {
          const failedUrl = site.initial_domain || site.last_known_mirror;
          const candidates = this.generateCandidates(name, i, site, failedUrl);
          allTasks.push(...candidates);
        }
      }

      if (allTasks.length > 0) {
        // Step 2: DNS pre-filter
        const dnsChecked = await this.batchDnsCheck(allTasks);
        const dnsOkTasks = dnsChecked.filter(t => t.dnsOk);

        // Step 3: HTTP checks with unified queue
        const heuristicParallel = this.config.processing.heuristicParallel ?? this.config.processing.parallel;
        const foundSites = new Set<number>();
        const activePromises = new Map<number, Promise<{ taskIndex: number; task: HeuristicTask & { dnsOk: boolean }; result: RedirectResult }>>();
        let nextTaskIndex = 0;

        const checkCandidate = async (task: HeuristicTask & { dnsOk: boolean }) => {
          this.logger.debug(task.siteName, `Heuristic checking candidate: ${task.candidateUrl}`);
          const httpResult = await this.resolver.resolve(task.candidateUrl, true, task.site);
          return httpResult;
        };

        // Start initial window with early site-found check
        while (activePromises.size < heuristicParallel && nextTaskIndex < dnsOkTasks.length) {
          // Skip tasks for sites that are already found
          while (nextTaskIndex < dnsOkTasks.length && foundSites.has(dnsOkTasks[nextTaskIndex].siteIndex)) {
            nextTaskIndex++;
          }
          if (nextTaskIndex >= dnsOkTasks.length) break;

          const task = dnsOkTasks[nextTaskIndex];
          const idx = nextTaskIndex; // capture immutable index for this promise
          const promise = checkCandidate(task).then(result => ({ taskIndex: idx, task, result }));
          activePromises.set(idx, promise);
          nextTaskIndex++;
        }

        // Process results
        let checksCompleted = 0;
        while (activePromises.size > 0) {
          const completed = await Promise.race(activePromises.values());
          activePromises.delete(completed.taskIndex);
          checksCompleted++;

          const { task, result } = completed;

          // Atomic check-and-process: only first completion for a site gets processed
          if (foundSites.has(task.siteIndex)) {
            // Site already found by another task, skip processing
            this.logger.debug(task.siteName, `Heuristic: skipping ${task.candidateUrl} (site already found)`);
          } else if (result.success) {
            this.logger.debug(task.siteName, `Heuristic candidate ${task.candidateUrl}: HTTP ${result.statusCode}${result.antibotDetected ? ' (antibot)' : ''}`);

            // Content probe if needed (skip for antibot sites when accept_antibot is true)
            let probeOk = true;
            if (task.probeText && task.probeText.length > 0) {
              // Skip probe for antibot sites that accept antibot
              if (result.antibotDetected && task.site.accept_antibot) {
                this.logger.info(task.siteName, `Skipping content probe for antibot site (accept_antibot=true)`);
              } else {
                probeOk = await this.probe.verify(task.probeText, result.finalBody);
                if (!probeOk) {
                  this.logger.debug(task.siteName, `Heuristic: content probe failed on ${task.candidateUrl} (likely parked domain or wrong site), continuing search`);
                }
              }
            }

            if (probeOk) {
              // Success! Mark site as found immediately to prevent race conditions
              foundSites.add(task.siteIndex);
              const oldHost = this.resolver.extractHostWithoutQuery(task.oldMirror);
              const newHost = result.finalHost.toLowerCase();
              const chainFormatted = this.resolver.formatRedirectChain(result.redirectChain);
              this.logger.info(task.siteName, `Heuristic SUCCESS: ${task.candidateUrl}`);
              this.logger.info(task.siteName, `Heuristic redirect chain: ${chainFormatted}`);

              // Normalize URL before extracting host for heuristic success
              const heuristicStartUrl = task.site.initial_domain || task.site.last_known_mirror;
              const heuristicNormalized = heuristicStartUrl.startsWith("http://") || heuristicStartUrl.startsWith("https://")
                ? heuristicStartUrl
                : `https://${heuristicStartUrl}`;
              const siteDuration = Date.now() - siteStartTimes[task.siteIndex];
              results[task.siteIndex] = {
                siteName: task.siteName,
                oldHost,
                newHost,
                hostChanged: true,
                startedHost: this.resolver.extractHostWithoutQuery(heuristicNormalized),
                result,
                shouldUpdate: true,
                checkDurationMs: siteDuration,
                actualCheckedDomain: task.candidateUrl,
              };
            }
          } else if (result.skippedByText) {
            // Domain matched skip_text (parked/expired) — skip candidate, continue search
            this.logger.debug(task.siteName, `Heuristic: ${task.candidateUrl} skipped by skip_text: "${result.skippedByText}"`);
          } else {
            // HTTP request failed - log the failure
            const statusInfo = result.statusCode ? `HTTP ${result.statusCode}` : 'connection failed';
            this.logger.debug(task.siteName, `Heuristic candidate ${task.candidateUrl}: ${statusInfo} - ${result.error || 'unknown error'}`);
          }

          if (result.antibotDetected && this.config.heuristic.skipOnAntibot && !task.site.accept_antibot) {
            // Antibot detected and site doesn't accept antibot, mark as found to stop further checks
            foundSites.add(task.siteIndex);
            this.logger.warn(task.siteName, `Heuristic: antibot detected on ${task.candidateUrl}, stopping search for this site`);

            // Create a result entry with the actual domain that had antibot
            const oldHost = task.site.last_known_mirror ? this.resolver.normalizeAndExtractHost(task.site.last_known_mirror) : "";
            const siteDuration = Date.now() - siteStartTimes[task.siteIndex];
            results[task.siteIndex] = {
              siteName: task.siteName,
              oldHost,
              newHost: result.finalHost,
              hostChanged: false,
              startedHost: task.site.last_known_mirror ? this.resolver.extractHostWithoutQuery(task.site.last_known_mirror) : "",
              result,
              shouldUpdate: false,
              error: result.error,
              checkDurationMs: siteDuration,
              actualCheckedDomain: task.candidateUrl,
            };
          } else if (result.antibotDetected && task.site.accept_antibot) {
            // Antibot detected but site accepts antibot, treat as success
            foundSites.add(task.siteIndex);
            const oldHost = this.resolver.extractHostWithoutQuery(task.oldMirror);
            const newHost = result.finalHost.toLowerCase();
            const chainFormatted = this.resolver.formatRedirectChain(result.redirectChain);
            this.logger.info(task.siteName, `Heuristic SUCCESS (antibot accepted): ${task.candidateUrl}`);
            this.logger.info(task.siteName, `Heuristic redirect chain: ${chainFormatted}`);

            // Normalize URL before extracting host for heuristic success
            const heuristicStartUrl = task.site.initial_domain || task.site.last_known_mirror;
            const heuristicNormalized = heuristicStartUrl.startsWith("http://") || heuristicStartUrl.startsWith("https://")
              ? heuristicStartUrl
              : `https://${heuristicStartUrl}`;
            const siteDuration = Date.now() - siteStartTimes[task.siteIndex];
            results[task.siteIndex] = {
              siteName: task.siteName,
              oldHost,
              newHost,
              hostChanged: true,
              startedHost: this.resolver.extractHostWithoutQuery(heuristicNormalized),
              result,
              shouldUpdate: true,
              checkDurationMs: siteDuration,
              actualCheckedDomain: task.candidateUrl,
            };
          }

          // Start next task if available and below parallel limit
          while (nextTaskIndex < dnsOkTasks.length && activePromises.size < heuristicParallel) {
            // Skip tasks for sites that are already found
            while (nextTaskIndex < dnsOkTasks.length && foundSites.has(dnsOkTasks[nextTaskIndex].siteIndex)) {
              nextTaskIndex++;
            }
            if (nextTaskIndex >= dnsOkTasks.length) break;

            const nextTask = dnsOkTasks[nextTaskIndex];
            const idx = nextTaskIndex; // capture immutable index
            const promise = checkCandidate(nextTask).then(result => ({ taskIndex: idx, task: nextTask, result }));
            activePromises.set(idx, promise);
            nextTaskIndex++;
          }
        }

      }
    }

    // Log completion of batch phase
    this.logger.logGlobal(LogLevel.INFO, "=== Domain checks finished ===\n");

    return results.filter(Boolean);
  }

  private async processSite(siteName: string, site: any, queuedMs = 0): Promise<CheckResult> {
    const siteStartTime = Date.now();
    if (queuedMs > 0) {
      this.logger.debug(siteName, `Queued for ${queuedMs}ms before start`);
    }

    // Log geoblock if present
    if (site.geoblock) {
      this.logger.warn(siteName, `Geo-blocking: ${site.geoblock}`);
    }

    this.logger.info(siteName, "Starting check...");

    // Optimization: if last_seen is recent (< 2 days), try last_known_mirror first
    let urlToCheck: string | undefined;

    if (site.last_seen) {
      const daysSinceLastSeen = this.calculateDaysSince(site.last_seen);
      if (daysSinceLastSeen < 2 && site.last_known_mirror) {
        // Recent success - try last_known_mirror first
        urlToCheck = site.last_known_mirror;
        this.logger.debug(siteName, `Recent success (${daysSinceLastSeen} days ago), trying last_known_mirror first`);
      }
    }

    if (!urlToCheck) {
      // Standard path: initial_domain -> last_known_mirror
      urlToCheck = site.initial_domain || site.last_known_mirror;
    }
    if (!urlToCheck) {
      this.logger.error(siteName, "No URL to check (missing initial_domain and last_known_mirror)");
      const siteDuration = Date.now() - siteStartTime;
      this.logger.debug(siteName, `Check completed in ${siteDuration}ms - NO URL CONFIGURED`);
      return {
        siteName,
        oldHost: "",
        newHost: "",
        hostChanged: false,
        startedHost: "",
        result: {
          success: false,
          finalUrl: "",
          finalHost: "",
          statusCode: 0,
          redirectChain: [],
          error: "No URL configured",
        },
        shouldUpdate: false,
        error: "No URL configured",
        checkDurationMs: siteDuration,
        actualCheckedDomain: "",
      };
    }

    this.logger.debug(siteName, `Checking: ${urlToCheck}`);
    // Normalize URL before extracting host (add https:// if missing)
    const normalizedUrl = urlToCheck.startsWith("http://") || urlToCheck.startsWith("https://")
      ? urlToCheck
      : `https://${urlToCheck}`;
    const startedHost = this.resolver.extractHostWithoutQuery(normalizedUrl);

    // DNS pre-check: skip HTTP request if domain doesn't resolve
    const dnsCheckStart = Date.now();
    const dnsResolves = await this.checkDnsResolution(normalizedUrl);
    const dnsCheckDuration = Date.now() - dnsCheckStart;

    if (!dnsResolves) {
      this.logger.warn(siteName, `DNS resolution failed (${dnsCheckDuration}ms) - skipping HTTP request`);
      const siteDuration = Date.now() - siteStartTime;
      this.logger.debug(siteName, `Check completed in ${siteDuration}ms (dns: ${dnsCheckDuration}ms) - DNS FAILED`);

      return {
        siteName,
        oldHost: site.last_known_mirror ? this.resolver.normalizeAndExtractHost(site.last_known_mirror) : "",
        newHost: "",
        hostChanged: false,
        startedHost: this.resolver.extractHostWithoutQuery(normalizedUrl),
        result: {
          success: false,
          finalUrl: normalizedUrl,
          finalHost: "",
          statusCode: 0,
          redirectChain: [],
          error: "DNS resolution failed",
          shouldTriggerHeuristic: true, // Trigger heuristic for DNS failures
        },
        shouldUpdate: false,
        error: "DNS resolution failed",
        checkDurationMs: siteDuration,
        actualCheckedDomain: normalizedUrl,
      };
    }
    this.logger.debug(siteName, `DNS OK (${dnsCheckDuration}ms)`);

    // Resolve redirects
    const resolveStartTime = Date.now();
    const result = await this.resolver.resolve(urlToCheck, false, site);
    const resolveDuration = Date.now() - resolveStartTime;

    const chainFormatted = this.resolver.formatRedirectChain(result.redirectChain);
    this.logger.debug(siteName, `Redirect chain: ${chainFormatted}`);

    if (!result.success) {
      if (result.antibotDetected) {
        this.logger.warn(siteName, result.error || "Antibot/Cloudflare detected");
      } else {
        this.logger.error(siteName, result.error || "Check failed");
      }

      // Heuristic is now handled in Phase 2 (unified queue)
      const siteDuration = Date.now() - siteStartTime;
      this.logger.debug(siteName, `Check completed in ${siteDuration}ms (resolve: ${resolveDuration}ms) - FAILED`);

      return {
        siteName,
        oldHost: site.last_known_mirror ? this.resolver.normalizeAndExtractHost(site.last_known_mirror) : "",
        newHost: result.finalHost,
        hostChanged: false,
        startedHost,
        result,
        shouldUpdate: false,
        error: result.error,
        checkDurationMs: siteDuration,
        // Store the actual domain that was checked for accurate error reporting
        actualCheckedDomain: result.finalUrl || urlToCheck,
      };
    }

    // Special handling for accept_antibot sites
    if (result.antibotDetected && site.accept_antibot) {
      this.logger.warn(siteName, "Antibot accepted (accept_antibot=true)");
    }

    // Content probe (if configured)
    if (site.probe_text && site.probe_text.length > 0) {
      const probeOk = await this.probe.verify(site.probe_text, result.finalBody);
      result.contentProbeOk = probeOk;

      this.logger.debug(siteName, `Probe text found: ${probeOk}`);

      if (!probeOk) {
        this.logger.error(siteName, "Content probe failed (key phrases not found)");
        const siteDuration = Date.now() - siteStartTime;
        this.logger.debug(siteName, `Check completed in ${siteDuration}ms (resolve: ${resolveDuration}ms) - PROBE FAILED`);

        return {
          siteName,
          oldHost: site.last_known_mirror ? this.resolver.normalizeAndExtractHost(site.last_known_mirror) : "",
          newHost: result.finalHost,
          hostChanged: false,
          startedHost,
          result,
          shouldUpdate: false,
          error: "Content probe failed",
          checkDurationMs: siteDuration,
          actualCheckedDomain: result.finalUrl || urlToCheck,
        };
      }
    }

    // Check if host changed
    const oldHost = site.last_known_mirror ? this.resolver.normalizeAndExtractHost(site.last_known_mirror) : "";
    const newHost = result.finalHost.toLowerCase();

    // hostChanged: compare where we started (startedHost) with where we ended up (newHost)
    // This correctly detects changes even when last_known_mirror already matches the result
    const hostChanged = startedHost !== newHost;

    // Check path if specified
    if (site.path) {
      const finalPath = this.resolver.extractPathWithoutQuery(result.finalUrl);
      if (finalPath !== site.path) {
        this.logger.warn(
          siteName,
          `Path mismatch: expected ${site.path}, got ${finalPath} - manual review needed`
        );
        const siteDuration = Date.now() - siteStartTime;
        this.logger.debug(siteName, `Check completed in ${siteDuration}ms (resolve: ${resolveDuration}ms) - PATH MISMATCH`);
        return {
          siteName,
          oldHost,
          newHost,
          hostChanged: false,
          startedHost,
          result,
          shouldUpdate: false,
          error: "Path changed - manual review required",
          checkDurationMs: siteDuration,
          actualCheckedDomain: result.finalUrl || urlToCheck,
        };
      }
    }

    // Log the change using startedHost for clarity
    if (hostChanged) {
      this.logger.info(siteName, `Host changed: ${startedHost} => ${newHost}`);
    } else {
      this.logger.info(siteName, `Host unchanged: ${newHost}`);
    }

    const siteDuration = Date.now() - siteStartTime;
    this.logger.debug(siteName, `Check completed in ${siteDuration}ms (resolve: ${resolveDuration}ms)`);

    // shouldUpdate: process filters if domain changed OR if we need to clean up predicted mirrors
    // (to clean up predicted mirrors even when last_known_mirror didn't change)
    const hasNumericPatterns = /\d+/.test(newHost);
    const hasWildcardInSiteName = siteName.includes('*');
    const shouldUpdate = hostChanged || (!!startedHost && hasNumericPatterns) || hasWildcardInSiteName;

    return {
      siteName,
      oldHost,
      newHost,
      hostChanged,
      startedHost,
      result,
      shouldUpdate,
      checkDurationMs: siteDuration,
      actualCheckedDomain: result.finalUrl || urlToCheck,
    };
  }

}
