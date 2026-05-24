import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import type { Config, Watchers, WatcherSite } from '../src/types.js';

// Mock dns module
const mockedDnsResolve = jest.fn().mockResolvedValue(['127.0.0.1'] as never);
jest.unstable_mockModule('dns', () => ({
  promises: {
    resolve: mockedDnsResolve,
  },
}));

const { BatchProcessor } = await import('../src/batch.js');
const { HttpResolver } = await import('../src/httpResolver.js');
const { Logger } = await import('../src/logger.js');

function makeConfig(): Config {
  return {
    http: {
      timeout: 5000,
      resolveTimeout: 5000,
      heuristicTimeout: 3000,
      retries: 1,
      userAgent: 'TestAgent/1.0',
    },
    processing: {
      parallel: 2,
      redirectDepth: 5,
    },
    dnsPreCheck: {
      enabled: false,
      timeout: 3000,
      retryOnce: false,
    },
    contentProbe: {
      enabled: false,
    },
    antibot: {
      detectCodes: [403, 409],
      detectUrlPattern: '__cf_chl_tk',
    },
    thresholds: {
      failedDaysWarning: 14,
    },
    heuristic: {
      enabled: true,
      maxAttempts: 10,
      skipOnAntibot: false,
      forceHeuristicOnCodes: [404, 500],
    },
    logging: {
      saveToFile: false,
      incremental: false,
      filePath: '',
    },
    git: {
      mode: 'debug',
      branch: 'master',
      prBranchPrefix: 'test',
    },
    filtersdir: {
      repoPath: '',
      filterDirPattern: '',
      filePattern: '',
    },
  } as Config;
}

describe('Domain History Management', () => {
  let config: Config;
  let logger: InstanceType<typeof Logger>;
  let resolver: InstanceType<typeof HttpResolver>;

  beforeEach(() => {
    config = makeConfig();
    logger = new Logger(config);
    resolver = new HttpResolver(config);
  });

  test('updateDomainHistory deletes history when updating to pattern domain', () => {
    const watchers: Watchers = {
      sites: {
        'test-site': {
          last_known_mirror: 'example15.com',
          heuristic_history: ['example13.com'],
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];

    // Update to new pattern domain
    (processor as any).updateDomainHistory(site, 'example16.com', 'example15.com');

    // Pattern → Pattern: history should be deleted (not needed)
    expect(site.heuristic_history).toBeUndefined();
  });

  test('updateDomainHistory deletes history when updating to newer pattern', () => {
    const watchers: Watchers = {
      sites: {
        'test-site': {
          last_known_mirror: 'example17.com',
          heuristic_history: ['example17.com'],
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];

    (processor as any).updateDomainHistory(site, 'example18.com', 'example17.com');

    // Pattern → Pattern: history should be deleted
    expect(site.heuristic_history).toBeUndefined();
  });

  test('updateDomainHistory deletes history when re-adding same pattern', () => {
    const watchers: Watchers = {
      sites: {
        'test-site': {
          last_known_mirror: 'example15.com',
          heuristic_history: ['example15.com'],
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];

    // Re-add same pattern
    (processor as any).updateDomainHistory(site, 'example15.com', 'example15.com');

    // Pattern → Pattern: history should be deleted
    expect(site.heuristic_history).toBeUndefined();
  });

  test('updateDomainHistory saves current pattern when switching to non-pattern', () => {
    const watchers: Watchers = {
      sites: {
        'test-site': {
          last_known_mirror: 'example15.com',  // Current pattern domain
          heuristic_history: ['example15.com'],
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];

    // Switch to non-pattern domain (link shortener)
    (processor as any).updateDomainHistory(site, 'example16-com.l.ink', 'example15.com');

    // Should save current pattern (example15.com) to history before switching
    expect(site.heuristic_history).toEqual(['example15.com']);
    expect(site.pattern_changed).toBe(true);
    expect(site.non_pattern_mirror).toBe('example16-com.l.ink');
  });

  test('updateDomainHistory deletes history for pattern-matching domain', () => {
    const watchers: Watchers = {
      sites: {
        'test-site': {
          last_known_mirror: 'example14.com',
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];

    // Update to new pattern domain
    (processor as any).updateDomainHistory(site, 'example15.com', 'example14.com');

    // Pattern → Pattern: history should be deleted
    expect(site.heuristic_history).toBeUndefined();
  });

  test('matchesNumericPattern detects pattern-matching domains', () => {
    const watchers: Watchers = { sites: {} };
    const processor = new BatchProcessor(config, watchers, logger, resolver);

    // Pattern-matching domains
    expect((processor as any).matchesNumericPattern('example15.com')).toBe(true);
    expect((processor as any).matchesNumericPattern('sample13.com')).toBe(true);
    expect((processor as any).matchesNumericPattern('14example.com')).toBe(true);
    expect((processor as any).matchesNumericPattern('www.example15.com')).toBe(true); // www. prefix normalized
    expect((processor as any).matchesNumericPattern('example213tv.com')).toBe(true); // domain[N][text].tld
    // Non-pattern domains
    expect((processor as any).matchesNumericPattern('example16-com.l.ink')).toBe(false);
    expect((processor as any).matchesNumericPattern('example.com')).toBe(false);
    expect((processor as any).matchesNumericPattern('short.com')).toBe(false); // Too short
  });

  test('updateDomainHistory saves pattern to history when switching to non-pattern (first time)', () => {
    const watchers: Watchers = {
      sites: {
        'testsite': {
          last_known_mirror: 'testsite55.com',  // Pattern domain
          // No heuristic_history yet
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['testsite'];

    // Switch to non-pattern domain
    (processor as any).updateDomainHistory(site, 'example.com', 'testsite55.com');

    // Should save pattern domain to history before switching
    expect(site.heuristic_history).toEqual(['testsite55.com']);
    expect(site.pattern_changed).toBe(true);
  });

  test('updateDomainHistory preserves history when switching to another non-pattern', () => {
    const watchers: Watchers = {
      sites: {
        'testsite': {
          last_known_mirror: 'example.com',  // Non-pattern domain
          pattern_changed: true,
          heuristic_history: ['testsite55.com'],  // Pattern saved from previous switch
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['testsite'];

    // Switch to another non-pattern domain
    (processor as any).updateDomainHistory(site, 'another-example.com', 'testsite55.com');

    // History should remain unchanged (no pattern to save)
    expect(site.heuristic_history).toEqual(['testsite55.com']);
    expect(site.pattern_changed).toBe(true);
  });

  test('updateDomainHistory clears flags and history when returning to pattern from non-pattern', () => {
    const watchers: Watchers = {
      sites: {
        'test-site': {
          last_known_mirror: 'testsite-new-domain.com',
          pattern_changed: true,
          non_pattern_mirror: 'nonpattern.com',
          heuristic_history: ['testsite88.com'],
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];

    // Return to pattern domain
    (processor as any).updateDomainHistory(site, 'testsite99.com', 'testsite-new-domain.com');

    // Flags, history, and non_pattern_mirror should be cleared when returning to pattern
    expect(site.heuristic_history).toBeUndefined();
    expect(site.pattern_changed).toBeUndefined();
    expect(site.non_pattern_mirror).toBeUndefined();
  });
});

describe('Scheme Change Scenario', () => {
  let config: Config;
  let logger: InstanceType<typeof Logger>;
  let resolver: InstanceType<typeof HttpResolver>;

  beforeEach(() => {
    config = makeConfig();
    logger = new Logger(config);
    resolver = new HttpResolver(config);
  });

  test('triggers history-based heuristic when site is working on non-pattern domain', () => {
    // Verifies that processAll correctly identifies sites needing history-based heuristic
    const watchers: Watchers = {
      sites: {
        'example': {
          last_known_mirror: 'example16-com.l.ink', // Non-pattern domain
          heuristic_history: ['example16.com'], // Pattern domain in history
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['example'];

    const currentHost = processor['resolver'].extractHostWithoutQuery(site.last_known_mirror || '');
    const lastHistoryDomain = site.heuristic_history![site.heuristic_history!.length - 1];

    // Non-pattern last_known_mirror + pattern in history → should trigger history heuristic
    expect((processor as any).matchesNumericPattern(currentHost)).toBe(false);
    expect((processor as any).matchesNumericPattern(lastHistoryDomain)).toBe(true);
  });

  test('updateDomainHistory does not create history for pattern→pattern rotation', () => {
    // sample2.top → sample5.top: both pattern, no history needed
    const watchers: Watchers = {
      sites: {
        'sample': {
          last_known_mirror: 'sample2.com',
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['sample'];

    (processor as any).updateDomainHistory(site, 'sample5.com', 'sample2.com');

    expect(site.heuristic_history).toBeUndefined();
    expect(site.pattern_changed).toBeUndefined();
  });

  test('updateDomainHistory deletes existing history on pattern→pattern rotation', () => {
    // If history existed from a previous non-pattern episode, it must be cleared on return to pattern
    const watchers: Watchers = {
      sites: {
        'sample': {
          last_known_mirror: 'sample5.com',
          heuristic_history: ['sample5.com'],
          pattern_changed: true,
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['sample'];

    (processor as any).updateDomainHistory(site, 'sample6.com', 'sample5.com');

    expect(site.heuristic_history).toBeUndefined();
    expect(site.pattern_changed).toBeUndefined();
  });

  test('updateDomainHistory creates history and sets flags when pattern switches to non-pattern', () => {
    // example12.com → nonpattern.com: history must record the last pattern domain
    const watchers: Watchers = {
      sites: {
        'example': {
          last_known_mirror: 'example12.com',
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['example'];

    (processor as any).updateDomainHistory(site, 'nonpattern.com', 'example12.com');

    expect(site.heuristic_history).toEqual(['example12.com']);
    expect(site.pattern_changed).toBe(true);
    expect(site.non_pattern_mirror).toBe('nonpattern.com');
  });

  test('updateDomainHistory preserves history when already on non-pattern (no new history entry)', () => {
    // Already on non-pattern, switches to another non-pattern: history stays unchanged
    const watchers: Watchers = {
      sites: {
        'testsite': {
          last_known_mirror: 'example.com',
          pattern_changed: true,
          non_pattern_mirror: 'example.com',
          heuristic_history: ['testsite55.com'],
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['testsite'];

    // oldLastKnownMirror is non-pattern → no new history entry added
    (processor as any).updateDomainHistory(site, 'another-example.com', 'example.com');

    expect(site.heuristic_history).toEqual(['testsite55.com']);
    expect(site.pattern_changed).toBe(true);
    expect(site.non_pattern_mirror).toBe('another-example.com');
  });

  test('checkSingleSite triggers immediate heuristic when pattern→non-pattern and finds new pattern domain', async () => {
    // Scenario: example12.com redirects to nonpattern.com (non-pattern),
    // but heuristic immediately finds example13.com (pattern)
    const watchers: Watchers = {
      sites: {
        'example': {
          last_known_mirror: 'example12.com',
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['example'];

    // Mock DNS resolution to succeed for all candidates
    mockedDnsResolve.mockResolvedValue(['127.0.0.1'] as never);

    // Mock HTTP resolver:
    // 1. example12.com → redirects to nonpattern.com (non-pattern)
    // 2. heuristic candidates: example13.com succeeds (pattern)
    const mockResolve = jest.spyOn(resolver, 'resolve');

    // First call: example12.com → nonpattern.com
    mockResolve.mockResolvedValueOnce({
      success: true,
      finalUrl: 'https://nonpattern.com/',
      finalHost: 'nonpattern.com',
      statusCode: 200,
      redirectChain: [
        { url: 'https://example12.com/', statusCode: 301, location: 'https://nonpattern.com/' },
        { url: 'https://nonpattern.com/', statusCode: 200 },
      ],
      finalBody: '<html><body>Working</body></html>',
      antibotDetected: false,
      shouldTriggerHeuristic: false,
    });

    // Heuristic calls: example13.com succeeds
    mockResolve.mockResolvedValueOnce({
      success: true,
      finalUrl: 'https://example13.com/',
      finalHost: 'example13.com',
      statusCode: 200,
      redirectChain: [
        { url: 'https://example13.com/', statusCode: 200 },
      ],
      finalBody: '<html><body>Working</body></html>',
      antibotDetected: false,
      shouldTriggerHeuristic: false,
    });

    const result = await (processor as any).processSite('example', site);

    // Verify result
    expect(result.oldHost).toBe('example12.com');
    expect(result.newHost).toBe('example13.com'); // Found by heuristic!
    expect(result.hostChanged).toBe(true);
    expect(result.shouldUpdate).toBe(true); // Should update filters with new pattern domain
    expect(result.historyUpdated).toBe(true);

    // Verify site state: no pattern_changed flag (back on pattern)
    expect(site.heuristic_history).toBeUndefined();
    expect(site.pattern_changed).toBeUndefined();
    expect(site.non_pattern_mirror).toBeUndefined();
  });

  test('checkSingleSite triggers immediate heuristic when pattern→non-pattern but finds no pattern domain', async () => {
    // Scenario: example22.com redirects to nonpattern.com (non-pattern),
    // heuristic runs but all candidates fail or are non-pattern
    const watchers: Watchers = {
      sites: {
        'example23.com': {
          last_known_mirror: 'example22.com',
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['example23.com'];

    // Mock DNS resolution to succeed
    mockedDnsResolve.mockResolvedValue(['127.0.0.1'] as never);

    // Mock HTTP resolver:
    // 1. example22.com → redirects to nonpattern.com (non-pattern)
    // 2. heuristic candidates: all fail
    const mockResolve = jest.spyOn(resolver, 'resolve');

    // First call: example22.com → nonpattern.com
    mockResolve.mockResolvedValueOnce({
      success: true,
      finalUrl: 'https://nonpattern.com/',
      finalHost: 'nonpattern.com',
      statusCode: 200,
      redirectChain: [
        { url: 'https://example22.com/', statusCode: 301, location: 'https://nonpattern.com/' },
        { url: 'https://nonpattern.com/', statusCode: 200 },
      ],
      finalBody: '<html><body>Working</body></html>',
      antibotDetected: false,
      shouldTriggerHeuristic: false,
    });

    // Heuristic calls: all fail
    for (let i = 0; i < 10; i++) {
      mockResolve.mockResolvedValueOnce({
        success: false,
        finalUrl: '',
        finalHost: '',
        statusCode: 0,
        redirectChain: [],
        finalBody: '',
        antibotDetected: false,
        shouldTriggerHeuristic: false,
        error: 'Connection failed',
      });
    }

    const result = await (processor as any).processSite('example23.com', site);

    // Verify result: stays on non-pattern domain
    expect(result.oldHost).toBe('example22.com');
    expect(result.newHost).toBe('nonpattern.com'); // No pattern found, stays on non-pattern
    expect(result.hostChanged).toBe(true);
    expect(result.shouldUpdate).toBe(false); // Should NOT update filters
    expect(result.historyUpdated).toBe(true);

    // Verify site state: pattern_changed flag set, history saved, non_pattern_mirror set
    // CRITICAL: last_known_mirror should NOT be updated - it stays on the last pattern domain
    expect(site.last_known_mirror).toBe('example22.com'); // unchanged!
    expect(site.heuristic_history).toEqual(['example22.com']);
    expect(site.pattern_changed).toBe(true);
    expect(site.non_pattern_mirror).toBe('nonpattern.com');
  });

  test('checkSingleSite triggers immediate heuristic when pattern→non-pattern and finds another non-pattern domain', async () => {
    // Scenario: example15.com redirects to example.com (non-pattern),
    // heuristic finds example16-com.l.ink (also non-pattern)
    const watchers: Watchers = {
      sites: {
        'example': {
          last_known_mirror: 'example15.com',
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['example'];

    // Mock DNS resolution to succeed
    mockedDnsResolve.mockResolvedValue(['127.0.0.1'] as never);

    // Mock HTTP resolver:
    // 1. example15.com → redirects to example.com (non-pattern)
    // 2. heuristic candidates: example16.com → example16-com.l.ink (non-pattern)
    const mockResolve = jest.spyOn(resolver, 'resolve');

    // First call: example15.com → example.com
    mockResolve.mockResolvedValueOnce({
      success: true,
      finalUrl: 'https://example.com/',
      finalHost: 'example.com',
      statusCode: 200,
      redirectChain: [
        { url: 'https://example15.com/', statusCode: 301, location: 'https://example.com/' },
        { url: 'https://example.com/', statusCode: 200 },
      ],
      finalBody: '<html><body>Working</body></html>',
      antibotDetected: false,
      shouldTriggerHeuristic: false,
    });

    // Heuristic calls: first candidate redirects to non-pattern
    mockResolve.mockResolvedValueOnce({
      success: true,
      finalUrl: 'https://example16-com.l.ink/',
      finalHost: 'example16-com.l.ink',
      statusCode: 200,
      redirectChain: [
        { url: 'https://example16.com/', statusCode: 301, location: 'https://example16-com.l.ink/' },
        { url: 'https://example16-com.l.ink/', statusCode: 200 },
      ],
      finalBody: '<html><body>Working</body></html>',
      antibotDetected: false,
      shouldTriggerHeuristic: false,
    });

    // Rest of heuristic calls fail
    for (let i = 0; i < 9; i++) {
      mockResolve.mockResolvedValueOnce({
        success: false,
        finalUrl: '',
        finalHost: '',
        statusCode: 0,
        redirectChain: [],
        finalBody: '',
        antibotDetected: false,
        shouldTriggerHeuristic: false,
        error: 'Connection failed',
      });
    }

    const result = await (processor as any).processSite('example', site);

    // Verify result: stays on original non-pattern domain (not the one found by heuristic)
    expect(result.oldHost).toBe('example15.com');
    expect(result.newHost).toBe('example.com'); // Original non-pattern, not heuristic result
    expect(result.hostChanged).toBe(true);
    expect(result.shouldUpdate).toBe(false); // Should NOT update filters
    expect(result.historyUpdated).toBe(true);

    // Verify site state: pattern_changed flag set, history saved, non_pattern_mirror set
    // IMPORTANT: last_known_mirror should NOT be updated - it stays on the last pattern domain
    expect(site.last_known_mirror).toBe('example15.com'); // unchanged!
    expect(site.heuristic_history).toEqual(['example15.com']);
    expect(site.pattern_changed).toBe(true);
    expect(site.non_pattern_mirror).toBe('example.com');

    mockResolve.mockRestore();
  });
});
