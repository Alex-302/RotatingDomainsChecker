import type { Config, Watchers, CheckResult, HeuristicTask, RedirectResult, WatcherSite, DomainToken } from './types.js';
import { HttpResolver } from './httpResolver.js';
import { ContentProbe } from './probe.js';
import { Logger, LogLevel } from './logger.js';
import { resolveHostname } from './dnsResolver.js';
import { naturalCompare, calculateDaysSince } from './utils.js';

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

  /**
   * Tokenize domain into structured parts (runtime only, not persisted)
   */
  private tokenizeDomain(domain: string): DomainToken {
    const normalized = domain.startsWith('http://') || domain.startsWith('https://')
      ? domain
      : `https://${domain}`;
    let hostname = this.resolver.extractHostWithoutQuery(normalized);
    hostname = hostname.replace(/^www\./, '');

    // Pattern 1: domain[N].tld or domain[N][text].tld (kodtimetv16.com, sahatv5.top, betist213tv.live)
    let match = hostname.match(/^([a-z-]+?)(\d+)([a-z-]*)(\.[a-z]+)$/i);
    if (match) {
      return {
        original: domain,
        hostname,
        isPattern: true,
        patternType: 'numeric',
        parts: { prefix: match[1], variable: match[2], suffix: match[4] }
      };
    }

    // Pattern 2: [N]domain.tld (14dizipal.com)
    match = hostname.match(/^(\d+)([a-z-]+)(\.[a-z]+)$/i);
    if (match) {
      return {
        original: domain,
        hostname,
        isPattern: true,
        patternType: 'numeric',
        parts: { prefix: match[2], variable: match[1], suffix: match[3] }
      };
    }

    return { original: domain, hostname, isPattern: false };
  }

  /**
   * Check if domain matches numeric pattern (backward compatibility wrapper)
   */
  private matchesNumericPattern(domain: string): boolean {
    const token = this.tokenizeDomain(domain);
    return token.isPattern;
  }


  /**
   * Group history domains by pattern (on the fly)
   */
  private groupHistoryByPattern(history: string[]): Map<string, string[]> {
    const grouped = new Map<string, string[]>();

    for (const domain of history) {
      const token = this.tokenizeDomain(domain);
      if (!token.isPattern) continue;

      const key = `${token.parts!.prefix}[N]${token.parts!.suffix}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(domain);
    }

    return grouped;
  }

  public updateDomainHistory(site: WatcherSite, newDomain: string, oldLastKnownMirror?: string): void {
    const token = this.tokenizeDomain(newDomain);

    if (token.isPattern) {
      // Pattern domain - reset flags and non_pattern_mirror
      delete site.pattern_changed;
      delete site.non_pattern_mirror;

      // Pattern → Pattern: DO NOT create history (just rotation)
      delete site.heuristic_history;
    } else {
      // Non-pattern domain - set flag and store non-pattern mirror
      // IMPORTANT: Save OLD last_known_mirror (pattern domain) to history BEFORE overwriting
      if (oldLastKnownMirror && this.matchesNumericPattern(oldLastKnownMirror)) {
        site.heuristic_history = [oldLastKnownMirror];
      }

      site.pattern_changed = true;
      site.non_pattern_mirror = newDomain;
    }
  }

  /**
   * Append site.path to a URL if the URL has no meaningful path (only "/").
   * Ensures candidates and check URLs include the expected path when site.path is configured.
   */
  private appendSitePath(url: string, sitePath?: string): string {
    if (!sitePath) return url;
    try {
      const normalized = url.startsWith('http') ? url : `https://${url}`;
      const parsed = new URL(normalized);
      if (parsed.pathname === '/') {
        const cleanPath = sitePath.startsWith('/') ? sitePath : `/${sitePath}`;
        return `${normalized.replace(/\/$/, '')}${cleanPath}`;
      }
    } catch { /* ignore */ }
    return url;
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
    const hostname = new URL(url).hostname;
    try {
      await resolveHostname(hostname, timeout);
      return true;
    } catch (err: unknown) {
      const errorCode = (err as NodeJS.ErrnoException)?.code;
      if (retryOnce && errorCode === "EAI_AGAIN") {
        try {
          await resolveHostname(hostname, 2500);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Run heuristic search for a site and return first working pattern domain
   * Returns null if no pattern domain found
   */
  private async runHeuristicSearch(
    siteName: string,
    siteIndex: number,
    site: WatcherSite,
    failedUrl: string
  ): Promise<{ newHost: string; result: RedirectResult; candidateUrl: string } | null> {
    const heuristicTasks = this.generateCandidates(siteName, siteIndex, site, failedUrl);

    if (heuristicTasks.length === 0) {
      this.logger.debug(siteName, `No heuristic candidates generated`);
      return null;
    }

    const dnsCheckedTasks = await this.batchDnsCheck(heuristicTasks);
    const dnsOkTasks = dnsCheckedTasks.filter(t => t.dnsOk);

    if (dnsOkTasks.length === 0) {
      this.logger.debug(siteName, `No heuristic candidates passed DNS check`);
      return null;
    }

    return this.checkHeuristicCandidates(siteName, site, dnsOkTasks);
  }

  /**
   * Check heuristic candidates and return first working pattern domain
   * Returns null if no pattern domain found
   */
  private async checkHeuristicCandidates(
    siteName: string,
    site: WatcherSite,
    tasks: Array<HeuristicTask & { dnsOk: boolean }>
  ): Promise<{ newHost: string; result: RedirectResult; candidateUrl: string } | null> {
    // Check candidates sequentially until we find a working pattern domain
    for (const task of tasks) {
      this.logger.debug(siteName, `Heuristic checking candidate: ${task.candidateUrl}`);
      if (task.probeText && task.probeText.length > 0) {
        this.logger.debug(siteName, `Heuristic probe_text for ${task.candidateUrl}: ${JSON.stringify(task.probeText)}`);
      } else {
        this.logger.debug(siteName, `Heuristic: content probe is not configured for ${task.candidateUrl}`);
      }
      const httpResult = await this.resolver.resolve(task.candidateUrl, true, site, task.probeText);

      if (httpResult.success) {
        this.logger.debug(siteName, `Heuristic candidate ${task.candidateUrl}: HTTP ${httpResult.statusCode}${httpResult.antibotDetected ? ' (antibot)' : ''}`);

        // Content probe if needed
        let probeOk = true;
        if (task.probeText && task.probeText.length > 0) {
          if (httpResult.antibotDetected && site.accept_antibot) {
            this.logger.info(siteName, `Heuristic: content probe SKIPPED for antibot site (accept_antibot=true)`);
            probeOk = true;
          } else {
            probeOk = await this.probe.verify(task.probeText, httpResult.finalBody);
            if (probeOk) {
              this.logger.info(siteName, `Heuristic: content probe PASSED on ${task.candidateUrl}`);
            } else {
              this.logger.info(siteName, `Heuristic: content probe FAILED on ${task.candidateUrl}, continuing search`);
            }
          }
        }

        if (probeOk === true) {
          const heuristicNewHost = httpResult.finalHost.toLowerCase();
          const heuristicIsPattern = this.matchesNumericPattern(heuristicNewHost);

          if (heuristicIsPattern) {
            // Found a pattern domain!
            const chainFormatted = this.resolver.formatRedirectChain(httpResult.redirectChain);
            this.logger.info(siteName, `Heuristic SUCCESS: ${task.candidateUrl}`);
            this.logger.info(siteName, `Heuristic redirect chain: ${chainFormatted}`);

            return {
              newHost: heuristicNewHost,
              result: httpResult,
              candidateUrl: task.candidateUrl,
            };
          } else {
            // Heuristic found non-pattern domain, continue searching
            this.logger.debug(siteName, `Heuristic found non-pattern domain: ${heuristicNewHost}, continuing search`);
          }
        }
      }
    }

    return null; // No pattern domain found
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
    // Support optional www. prefix
    let match = failedUrl.match(/^(https?:\/\/)?(www\.)?([a-z-]+)(\d+)([a-z-]*)(\.[a-z.]+)(\/.*)?/i);
    let isNumberFirst = false;
    let wwwPrefix = '';

    // Try pattern 2: [N]domain.tld (number at the beginning)
    if (!match) {
      match = failedUrl.match(/^(https?:\/\/)?(www\.)?(\d+)([a-z-]+)(\.[a-z.]+)(\/.*)?/i);
      isNumberFirst = true;
    }

    if (!match) {
      this.logger.warn(siteName, "Heuristic: URL doesn't match domain[N].tld, domain[N][text].tld, or [N]domain.tld pattern, skipping");
      return [];
    }

    let protocol: string, prefix: string, numStr: string, middleText: string, suffix: string, path: string;

    if (isNumberFirst) {
      // Pattern: [N]domain.tld -> (protocol)(www.)(number)(letters)(suffix)(path)
      [, protocol = 'https://', wwwPrefix = '', numStr, prefix, suffix, path = ''] = match;
      middleText = '';
    } else {
      // Pattern: domain[N].tld or domain[N][text].tld -> (protocol)(www.)(letters)(number)(middle)(suffix)(path)
      [, protocol = 'https://', wwwPrefix = '', prefix, numStr, middleText = '', suffix, path = ''] = match;
    }

    const currentNum = parseInt(numStr, 10);
    const startNum = currentNum + 1;

    const tasks: HeuristicTask[] = [];
    for (let i = 0; i < this.config.heuristic.maxAttempts; i++) {
      const num = startNum + i;
      const candidateUrl = isNumberFirst
        ? `${protocol}${wwwPrefix}${num}${prefix}${suffix}${path}`
        : `${protocol}${wwwPrefix}${prefix}${num}${middleText}${suffix}${path}`;
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
        const skipHeuristic = Boolean(site.disable_heuristic) || (antibot && this.config.heuristic.skipOnAntibot && !forceHeuristic);

        if ((failed || forceHeuristic || site.force_search_ahead) && !skipHeuristic) {
          const failedUrl = site.initial_domain || site.last_known_mirror;
          let candidates = this.generateCandidates(name, i, site, failedUrl);
          // If initial_domain exists but doesn't match a numeric pattern (e.g. redirect shortener),
          // fall back to last_known_mirror for candidate generation
          if (candidates.length === 0 && site.initial_domain && site.last_known_mirror) {
            this.logger.debug(name, `Heuristic: initial_domain "${site.initial_domain}" has no numeric pattern, falling back to last_known_mirror`);
            candidates = this.generateCandidates(name, i, site, site.last_known_mirror);
          }
          allTasks.push(...candidates);
        }

        // Fallback: if site is working but on non-pattern domain, try history-based heuristic
        if (!failed && !skipHeuristic && site.heuristic_history && site.heuristic_history.length > 0) {
          const currentToken = this.tokenizeDomain(site.last_known_mirror || '');

          if (!currentToken.isPattern) {
            // Group history by pattern for smarter fallback
            const patternGroups = this.groupHistoryByPattern(site.heuristic_history);

            if (patternGroups.size > 0) {
              this.logger.info(name, `Current domain ${currentToken.hostname} is non-pattern, trying history-based heuristic`);

              for (const [patternKey, domains] of patternGroups) {
                this.logger.info(name, `Trying pattern ${patternKey} with ${domains.length} domains`);

                // Check ALL domains in this pattern group from first to last
                for (const historyDomain of domains) {
                  // First, check the history domain itself
                  const historyTask: HeuristicTask = {
                    siteName: name,
                    siteIndex: i,
                    candidateUrl: this.appendSitePath(
                      historyDomain.startsWith('http') ? historyDomain : `https://${historyDomain}`,
                      site.path
                    ),
                    attemptIndex: -1, // Special marker for history domain
                    oldMirror: site.last_known_mirror,
                    probeText: site.probe_text,
                    site,
                  };
                  allTasks.push(historyTask);

                  // Then generate new candidates from the history domain
                  const candidates = this.generateCandidates(name, i, site, historyDomain);
                  allTasks.push(...candidates);
                }
              }
            }
          }
        }
      }

      if (allTasks.length > 0) {
        // Step 2: DNS pre-filter
        const dnsChecked = await this.batchDnsCheck(allTasks);
        const dnsOkTasks = dnsChecked.filter(t => t.dnsOk);

        // Step 3: HTTP checks with unified queue
        const heuristicParallel = this.config.processing.heuristicParallel ?? this.config.processing.parallel;
        const foundSites = new Set<number>();
        const foundDomainsPerSite = new Map<number, Array<{ domain: string; result: RedirectResult; candidateUrl: string }>>();

        // Pre-populate foundSites and foundDomainsPerSite with successful Phase 1 results for force_search_ahead sites
        // This ensures Phase 2 doesn't overwrite Phase 1 results, only collects additional domains
        for (let i = 0; i < siteEntries.length; i++) {
          const [name, site] = siteEntries[i];
          const r = results[i];
          if (r && r.result.success && site.force_search_ahead) {
            foundSites.add(i);
            const domains = [{
              domain: r.newHost,  // final working domain after redirects
              result: r.result,
              candidateUrl: r.startedHost,
            }];

            // Always include the starting alias in the working set when force_search_ahead is enabled.
            // This ensures the current last_known_mirror is not lost from canonical selection even
            // when Phase 1 didn't detect a host change (e.g., antibot served at the starting URL
            // without a redirect). If the alias differs from newHost, it's a valid entry point and
            // belongs in the collected set for stable canonical selection across runs.
            if (r.startedHost) {
              const startedHostNormalized = r.startedHost.toLowerCase().replace(/^www\./, '');
              const newHostNormalized = r.newHost.toLowerCase();
              if (startedHostNormalized !== newHostNormalized) {
                domains.unshift({
                  domain: r.startedHost,  // the starting alias (e.g., last_known_mirror)
                  result: r.result,
                  candidateUrl: r.startedHost,
                });
                this.logger.info(name, `force_search_ahead: Phase 1 alias ${r.startedHost} collected (redirects to ${r.newHost})`);
              }
            }

            foundDomainsPerSite.set(i, domains);
            this.logger.info(name, `force_search_ahead: Phase 1 working domain(s) collected: ${domains.map(d => d.domain).join(', ')}`);
          }
        }

        const activePromises = new Map<number, Promise<{ taskIndex: number; task: HeuristicTask & { dnsOk: boolean }; result: RedirectResult }>>();
        let nextTaskIndex = 0;

        const checkCandidate = async (task: HeuristicTask & { dnsOk: boolean }) => {
          this.logger.debug(task.siteName, `Heuristic checking candidate: ${task.candidateUrl}`);
          if (task.probeText && task.probeText.length > 0) {
            this.logger.debug(task.siteName, `Heuristic probe_text for ${task.candidateUrl}: ${JSON.stringify(task.probeText)}`);
          } else {
            this.logger.debug(task.siteName, `Heuristic: content probe not configured for ${task.candidateUrl}`);
          }
          const httpResult = await this.resolver.resolve(task.candidateUrl, true, task.site, task.probeText);
          return httpResult;
        };

        // Start initial window with early site-found check
        while (activePromises.size < heuristicParallel && nextTaskIndex < dnsOkTasks.length) {
          // Skip tasks for sites that are already found (unless force_search_ahead is enabled)
          while (nextTaskIndex < dnsOkTasks.length) {
            const currentTask = dnsOkTasks[nextTaskIndex];
            if (foundSites.has(currentTask.siteIndex) && !currentTask.site.force_search_ahead) {
              nextTaskIndex++;
            } else {
              break;
            }
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

          // Atomic check-and-process: handle force_search_ahead differently
          const alreadyFound = foundSites.has(task.siteIndex);
          const continueSearch = task.site.force_search_ahead;

          if (alreadyFound && !continueSearch) {
            // Site already found and not force_search_ahead, skip processing
            this.logger.debug(task.siteName, `Heuristic: skipping ${task.candidateUrl} (site already found)`);
          } else if (result.success) {
            this.logger.debug(task.siteName, `Heuristic candidate ${task.candidateUrl}: HTTP ${result.statusCode}${result.antibotDetected ? ' (antibot)' : ''}`);

            // Content probe if needed (skip for antibot sites when accept_antibot is true)
            let probeOk = true;
            if (task.probeText && task.probeText.length > 0) {
              // Skip probe for antibot sites that accept antibot
              if (result.antibotDetected && task.site.accept_antibot) {
                this.logger.info(task.siteName, `Heuristic: content probe SKIPPED for antibot site (accept_antibot=true)`);
                probeOk = true;
              } else {
                probeOk = await this.probe.verify(task.probeText, result.finalBody);
                if (probeOk) {
                  this.logger.info(task.siteName, `Heuristic: content probe PASSED on ${task.candidateUrl}`);
                } else {
                  this.logger.info(task.siteName, `Heuristic: content probe FAILED on ${task.candidateUrl}, continuing search`);
                }
              }
            }

            if (probeOk) {
              const oldHost = this.resolver.normalizeAndExtractHost(task.oldMirror);              const newHost = result.finalHost.toLowerCase();
              const candidateHost = this.resolver.extractHostWithoutQuery(task.candidateUrl).toLowerCase();
              const chainFormatted = this.resolver.formatRedirectChain(result.redirectChain);
              this.logger.info(task.siteName, `Heuristic SUCCESS: ${task.candidateUrl}`);
              this.logger.info(task.siteName, `Heuristic redirect chain: ${chainFormatted}`);

              // If force_search_ahead, collect a unique working domain token for filter updates.
              // When a candidate redirects to an already-known primary/final domain, keep the
              // candidate host itself so filter domain lists can retain reachable aliases.
              // When the final domain is new, keep the final host as before.
              if (task.site.force_search_ahead) {
                if (!foundDomainsPerSite.has(task.siteIndex)) {
                  foundDomainsPerSite.set(task.siteIndex, []);
                }
                const currentDomains = foundDomainsPerSite.get(task.siteIndex)!;
                const candidateIsPattern = this.matchesNumericPattern(candidateHost);
                const finalIsPattern = this.matchesNumericPattern(newHost);
                const collectedDomains = candidateHost !== newHost && candidateIsPattern && finalIsPattern
                  ? [newHost, candidateHost]
                  : [newHost];

                for (const collectedDomain of collectedDomains) {
                  if (!currentDomains.some(entry => entry.domain === collectedDomain)) {
                    currentDomains.push({
                      domain: collectedDomain,
                      result,
                      candidateUrl: task.candidateUrl,
                    });
                    this.logger.info(task.siteName, `force_search_ahead: collected working domain ${collectedDomain} from ${task.candidateUrl} (final: ${newHost})`);
                  }
                }
              }

              // Mark site as found (first success or non-force_search_ahead)
              if (!foundSites.has(task.siteIndex)) {
                foundSites.add(task.siteIndex);
                // Normalize URL before extracting host for heuristic success
                const heuristicStartUrl = task.site.initial_domain || task.site.last_known_mirror;
                const heuristicNormalized = heuristicStartUrl.startsWith("http://") || heuristicStartUrl.startsWith("https://")
                  ? heuristicStartUrl
                  : `https://${heuristicStartUrl}`;
                const siteDuration = Date.now() - siteStartTimes[task.siteIndex];

                // Save old last_known_mirror BEFORE any mutation for history comparison
                const oldLastKnownMirror = task.site.last_known_mirror;

                // Update domain history now (we have the correct old value)
                this.updateDomainHistory(task.site, newHost, oldLastKnownMirror);

                // If new domain is non-pattern, do NOT update filters:
                // the old pattern domain stays in the filter until we find a new pattern domain.
                // We only record history and flags so next run can use heuristic_history.
                const newHostIsPattern = this.matchesNumericPattern(newHost);

                results[task.siteIndex] = {
                  siteName: task.siteName,
                  oldHost,
                  newHost,
                  hostChanged: newHostIsPattern, // only treat as changed when new domain is pattern
                  startedHost: this.resolver.extractHostWithoutQuery(heuristicNormalized),
                  result,
                  shouldUpdate: newHostIsPattern,
                  checkDurationMs: siteDuration,
                  actualCheckedDomain: task.candidateUrl,
                  additionalWorkingDomains: [], // Will be populated later if force_search_ahead
                  historyUpdated: true, // already called updateDomainHistory above
                };
              }
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
            const oldHost = this.resolver.normalizeAndExtractHost(task.oldMirror);            const newHost = result.finalHost.toLowerCase();
            const chainFormatted = this.resolver.formatRedirectChain(result.redirectChain);
            this.logger.info(task.siteName, `Heuristic SUCCESS (antibot accepted): ${task.candidateUrl}`);
            this.logger.info(task.siteName, `Heuristic redirect chain: ${chainFormatted}`);

            // Normalize URL before extracting host for heuristic success
            const heuristicStartUrl = task.site.initial_domain || task.site.last_known_mirror;
            const heuristicNormalized = heuristicStartUrl.startsWith("http://") || heuristicStartUrl.startsWith("https://")
              ? heuristicStartUrl
              : `https://${heuristicStartUrl}`;
            const siteDuration = Date.now() - siteStartTimes[task.siteIndex];

            // Save old last_known_mirror BEFORE any mutation for history comparison
            const oldLastKnownMirrorAntibot = task.site.last_known_mirror;

            // Update domain history now (we have the correct old value)
            this.updateDomainHistory(task.site, newHost, oldLastKnownMirrorAntibot);

            // If new domain is non-pattern, do NOT update filters
            const newHostIsPatternAntibot = this.matchesNumericPattern(newHost);

            results[task.siteIndex] = {
              siteName: task.siteName,
              oldHost,
              newHost,
              hostChanged: newHostIsPatternAntibot,
              startedHost: this.resolver.extractHostWithoutQuery(heuristicNormalized),
              result,
              shouldUpdate: newHostIsPatternAntibot,
              checkDurationMs: siteDuration,
              actualCheckedDomain: task.candidateUrl,
              historyUpdated: true, // already called updateDomainHistory above
            };
          }

          // Start next task if available and below parallel limit
          while (nextTaskIndex < dnsOkTasks.length && activePromises.size < heuristicParallel) {
            // Skip tasks for sites that are already found (unless force_search_ahead is enabled)
            while (nextTaskIndex < dnsOkTasks.length) {
              const currentTask = dnsOkTasks[nextTaskIndex];
              if (foundSites.has(currentTask.siteIndex) && !currentTask.site.force_search_ahead) {
                nextTaskIndex++;
              } else {
                break;
              }
            }
            if (nextTaskIndex >= dnsOkTasks.length) break;

            const nextTask = dnsOkTasks[nextTaskIndex];
            const idx = nextTaskIndex; // capture immutable index
            const promise = checkCandidate(nextTask).then(result => ({ taskIndex: idx, task: nextTask, result }));
            activePromises.set(idx, promise);
            nextTaskIndex++;
          }
        }

        // Populate additionalWorkingDomains for force_search_ahead sites
        if (foundDomainsPerSite.size > 0) {
          for (const [siteIndex, domains] of foundDomainsPerSite.entries()) {
            const siteName = siteEntries[siteIndex][0];
            if (results[siteIndex] && domains.length > 1) {
              const uniqueSortedDomains = [...new Set(domains
                .map((d: { domain: string }) => d.domain))]
                .sort(naturalCompare);

              // Extract domain names excluding the first one (which is already in newHost)
              const firstDomain = results[siteIndex].newHost;
              results[siteIndex].additionalWorkingDomains = uniqueSortedDomains
                .filter(domain => domain !== firstDomain);

              this.logger.info(siteName, `force_search_ahead: collected ${uniqueSortedDomains.length} working domains: ${uniqueSortedDomains.join(', ')}`);
            }
          }
        }

      }
    }

    // Log completion of batch phase
    this.logger.logGlobal(LogLevel.INFO, "=== Domain checks finished ===\n");

    return results.filter(Boolean);
  }

  private async processSite(siteName: string, site: WatcherSite, queuedMs = 0, skipRecentMirror = false): Promise<CheckResult> {
    const siteStartTime = Date.now();
    if (queuedMs > 0) {
      this.logger.debug(siteName, `Queued for ${queuedMs}ms before start`);
    }

    // Log geoblock if present
    if (site.geoblock) {
      this.logger.warn(siteName, `Geo-blocking: ${site.geoblock}`);
    }

    this.logger.info(siteName, "Starting check...");

    let urlToCheck: string | undefined;
    let triedRecentLastKnownMirror = false;
    const fallbackInitialUrl = site.initial_domain ? this.appendSitePath(site.initial_domain, site.path) : undefined;
    const normalizeCheckUrl = (value?: string): string => {
      if (!value) return '';
      try {
        const normalized = value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;
        const parsed = new URL(normalized);
        return `${parsed.hostname.toLowerCase()}${parsed.pathname}`;
      } catch {
        return value.toLowerCase();
      }
    };
    const maybeFallbackToInitialDomain = async (reason: string): Promise<CheckResult | null> => {
      if (skipRecentMirror || !triedRecentLastKnownMirror || !fallbackInitialUrl) {
        return null;
      }
      if (normalizeCheckUrl(fallbackInitialUrl) === normalizeCheckUrl(urlToCheck)) {
        return null;
      }
      this.logger.info(siteName, `Recent last_known_mirror failed (${reason}), retrying via initial_domain`);
      return this.processSite(siteName, site, 0, true);
    };

    // Optimization: if success_since is recent (< 2 days), try last_known_mirror first
    if (!skipRecentMirror && site.success_since) {
      const daysSinceLastSeen = calculateDaysSince(site.success_since);
      if (daysSinceLastSeen < 2 && site.last_known_mirror) {
        // Recent success - try last_known_mirror first
        urlToCheck = this.appendSitePath(site.last_known_mirror, site.path);
        triedRecentLastKnownMirror = true;
        this.logger.debug(siteName, `Recent success (${daysSinceLastSeen} days ago), trying last_known_mirror first`);
      }
    }

    if (!urlToCheck) {
      // Standard path: initial_domain -> last_known_mirror
      // If falling back to last_known_mirror, append site.path if configured
      const baseUrl = site.initial_domain || site.last_known_mirror;
      urlToCheck = baseUrl ? this.appendSitePath(baseUrl, site.path) : baseUrl;
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
    if (typeof urlToCheck !== 'string') {
      this.logger.error(siteName, `Invalid URL type: ${typeof urlToCheck}, value: ${urlToCheck}`);
      const siteDuration = Date.now() - siteStartTime;
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
          error: `Invalid URL type: ${typeof urlToCheck}`,
        },
        shouldUpdate: false,
        checkDurationMs: siteDuration,
        actualCheckedDomain: "",
      };
    }
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

      const fallbackResult = await maybeFallbackToInitialDomain('dns failure');
      if (fallbackResult) {
        return fallbackResult;
      }

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
    const result = await this.resolver.resolve(urlToCheck, false, site, site.probe_text);
    const resolveDuration = Date.now() - resolveStartTime;

    const chainFormatted = this.resolver.formatRedirectChain(result.redirectChain);
    this.logger.debug(siteName, `Redirect chain: ${chainFormatted}`);

    // Log early exit on JS redirect when probe_text matched
    if (result.probeTextMatchedBeforeJsRedirect) {
      const jsRedirectUrl = result.redirectChain[result.redirectChain.length - 1]?.location;
      this.logger.info(
        siteName,
        `Early exit: probe_text confirmed on ${result.finalHost}, skipping JS redirect` +
        (jsRedirectUrl ? ` (would redirect to: ${jsRedirectUrl})` : '')
      );
    }

    if (!result.success) {
      if (result.antibotDetected) {
        this.logger.warn(siteName, result.error || "Antibot/Cloudflare detected");
      } else {
        this.logger.error(siteName, result.error || "Check failed");
      }

      // Heuristic is now handled in Phase 2 (unified queue)
      const siteDuration = Date.now() - siteStartTime;
      this.logger.debug(siteName, `Check completed in ${siteDuration}ms (resolve: ${resolveDuration}ms) - FAILED`);

      const fallbackResult = await maybeFallbackToInitialDomain(result.error || 'resolve failure');
      if (fallbackResult) {
        return fallbackResult;
      }

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
      // Skip probe for antibot responses when accept_antibot is true
      // (Cloudflare challenge page won't contain probe_text, but the site is still considered working)
      if (result.antibotDetected && site.accept_antibot) {
        this.logger.info(siteName, `Content probe SKIPPED for antibot site (accept_antibot=true)`);
      } else {
        const probeOk = await this.probe.verify(site.probe_text, result.finalBody);
        result.contentProbeOk = probeOk;

        if (probeOk) {
          this.logger.info(siteName, `Content probe PASSED on ${result.finalUrl || urlToCheck}`);
        } else {
          this.logger.info(siteName, `Content probe FAILED on ${result.finalUrl || urlToCheck}`);
        }

        if (!probeOk) {
          const siteDuration = Date.now() - siteStartTime;
          this.logger.debug(siteName, `Check completed in ${siteDuration}ms (resolve: ${resolveDuration}ms) - PROBE FAILED`);

          // Mark result as failed to trigger heuristic search
          result.success = false;
          result.error = "Content probe failed";

          const fallbackResult = await maybeFallbackToInitialDomain('content probe failed');
          if (fallbackResult) {
            return fallbackResult;
          }

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
      // Normalize: site.path may lack leading slash while URL.pathname always has it
      const sitePathNormalized = site.path.startsWith('/') ? site.path : `/${site.path}`;
      if (finalPath !== sitePathNormalized) {
        this.logger.warn(
          siteName,
          `Path mismatch: expected ${sitePathNormalized}, got ${finalPath} - manual review needed`
        );
        const siteDuration = Date.now() - siteStartTime;
        this.logger.debug(siteName, `Check completed in ${siteDuration}ms (resolve: ${resolveDuration}ms) - PATH MISMATCH`);

        const fallbackResult = await maybeFallbackToInitialDomain('path mismatch');
        if (fallbackResult) {
          return fallbackResult;
        }

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

    // If old domain was pattern and new domain is non-pattern: do NOT update filters.
    // Record history/flags and let index.ts update last_known_mirror only.
    const oldHostIsPattern = this.matchesNumericPattern(oldHost);
    const newHostIsPattern = this.matchesNumericPattern(newHost);
    const isPatternToNonPattern = hostChanged && oldHostIsPattern && !newHostIsPattern;

    let shouldUpdate = hostChanged || (!!startedHost && hasNumericPatterns) || hasWildcardInSiteName;
    let historyUpdated = false;

    if (isPatternToNonPattern) {
      // Pattern → Non-pattern detected: save history and try heuristic immediately
      this.logger.warn(siteName, `Pattern domain redirected to non-pattern (${oldHost} → ${newHost})`);
      this.updateDomainHistory(site, newHost, site.last_known_mirror);
      historyUpdated = true;
      shouldUpdate = false; // do not touch filter files yet

      // Try heuristic search immediately to find a new pattern domain
      this.logger.info(siteName, `Triggering heuristic search to find new pattern domain...`);
      const heuristicResult = await this.runHeuristicSearch(siteName, 0, site, oldHost);

      if (heuristicResult) {
        // Found a pattern domain via heuristic!
        this.logger.info(siteName, `Heuristic found new pattern domain: ${heuristicResult.newHost}`);

        // Update history: clear flags since we're back on pattern
        this.updateDomainHistory(site, heuristicResult.newHost, oldHost);

        // Return heuristic result instead
        return {
          siteName,
          oldHost,
          newHost: heuristicResult.newHost,
          hostChanged: true,
          startedHost,
          result: heuristicResult.result,
          shouldUpdate: true, // Update filters with new pattern domain
          checkDurationMs: Date.now() - siteStartTime,
          actualCheckedDomain: heuristicResult.result.finalUrl || heuristicResult.candidateUrl,
          historyUpdated: true,
        };
      } else {
        this.logger.info(siteName, `Heuristic search found no working pattern domains`);
      }
    }

    // LKM verification: if Phase 1 checked via initial_domain (not LKM), and LKM is a
    // numeric pattern with a lower number than the new host, verify LKM too. If LKM is
    // alive, prefer it as canonical (spec §5.1a). This prevents losing a working LKM
    // when initial_domain takes priority and redirects to a higher-numbered domain.
    if (result.success && !triedRecentLastKnownMirror && hostChanged && site.initial_domain &&
        site.last_known_mirror && this.matchesNumericPattern(site.last_known_mirror) &&
        this.matchesNumericPattern(newHost) && !site.initial_domain.match(/\d+/)) {
      const lkmNum = parseInt(site.last_known_mirror.match(/\d+/)?.[0] || '0', 10);
      const newNum = parseInt(newHost.match(/\d+/)?.[0] || '0', 10);
      if (lkmNum < newNum) {
        this.logger.info(siteName, `LKM ${site.last_known_mirror} has lower number than new host ${newHost}, verifying LKM liveliness...`);
        const lkmUrl = site.last_known_mirror.startsWith('http://') || site.last_known_mirror.startsWith('https://')
          ? site.last_known_mirror
          : `https://${site.last_known_mirror}`;
        const lkmCheckUrl = this.appendSitePath(lkmUrl, site.path);
        const lkmResult = await this.resolver.resolve(lkmCheckUrl, false, site, site.probe_text);
        if (lkmResult.success) {
          // LKM is alive — prefer it
          this.logger.info(siteName, `LKM ${site.last_known_mirror} is alive, reverting from ${newHost}`);
          return {
            siteName,
            oldHost,
            newHost: site.last_known_mirror,
            hostChanged: false,
            startedHost,
            result: lkmResult,
            shouldUpdate: false,
            checkDurationMs: Date.now() - siteStartTime,
            actualCheckedDomain: lkmCheckUrl,
          };
        }
        this.logger.info(siteName, `LKM ${site.last_known_mirror} is dead, keeping ${newHost}`);
      }
    }

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
      historyUpdated,
    };
  }

}
