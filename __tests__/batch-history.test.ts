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
          last_known_mirror: 'kodtimetv15.com',
          heuristic_history: ['kodtimetv13.com'],
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];
    
    // Update to new pattern domain
    (processor as any).updateDomainHistory(site, 'kodtimetv16.com', 'kodtimetv15.com');
    
    // Pattern → Pattern: history should be deleted (not needed)
    expect(site.heuristic_history).toBeUndefined();
  });

  test('updateDomainHistory deletes history when updating to newer pattern', () => {
    const watchers: Watchers = {
      sites: {
        'test-site': {
          last_known_mirror: 'kodtimetv17.com',
          heuristic_history: ['kodtimetv17.com'],
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];
    
    (processor as any).updateDomainHistory(site, 'kodtimetv18.com', 'kodtimetv17.com');
    
    // Pattern → Pattern: history should be deleted
    expect(site.heuristic_history).toBeUndefined();
  });

  test('updateDomainHistory deletes history when re-adding same pattern', () => {
    const watchers: Watchers = {
      sites: {
        'test-site': {
          last_known_mirror: 'kodtimetv15.com',
          heuristic_history: ['kodtimetv15.com'],
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];
    
    // Re-add same pattern
    (processor as any).updateDomainHistory(site, 'kodtimetv15.com', 'kodtimetv15.com');
    
    // Pattern → Pattern: history should be deleted
    expect(site.heuristic_history).toBeUndefined();
  });

  test('updateDomainHistory saves current pattern when switching to non-pattern', () => {
    const watchers: Watchers = {
      sites: {
        'test-site': {
          last_known_mirror: 'kodtimetv15.com',  // Current pattern domain
          heuristic_history: ['kodtimetv15.com'],
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];
    
    // Switch to non-pattern domain (link shortener)
    (processor as any).updateDomainHistory(site, 'kodtimetv16-com.l.ink', 'kodtimetv15.com');
    
    // Should save current pattern (kodtimetv15.com) to history before switching
    expect(site.heuristic_history).toEqual(['kodtimetv15.com']);
    expect(site.pattern_changed).toBe(true);
  });

  test('updateDomainHistory deletes history for pattern-matching domain', () => {
    const watchers: Watchers = {
      sites: {
        'test-site': {
          last_known_mirror: 'kodtimetv14.com',
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];
    
    // Update to new pattern domain
    (processor as any).updateDomainHistory(site, 'kodtimetv15.com', 'kodtimetv14.com');
    
    // Pattern → Pattern: history should be deleted
    expect(site.heuristic_history).toBeUndefined();
  });

  test('matchesNumericPattern detects pattern-matching domains', () => {
    const watchers: Watchers = { sites: {} };
    const processor = new BatchProcessor(config, watchers, logger, resolver);
    
    // Pattern-matching domains
    expect((processor as any).matchesNumericPattern('kodtimetv15.com')).toBe(true);
    expect((processor as any).matchesNumericPattern('sahatv13.top')).toBe(true);
    expect((processor as any).matchesNumericPattern('14dizipal.com')).toBe(true);
    expect((processor as any).matchesNumericPattern('www.kodtimetv15.com')).toBe(true); // www. prefix normalized
    expect((processor as any).matchesNumericPattern('betist213tv.live')).toBe(true); // domain[N][text].tld
    // Non-pattern domains
    expect((processor as any).matchesNumericPattern('kodtimetv16-com.l.ink')).toBe(false);
    expect((processor as any).matchesNumericPattern('example.com')).toBe(false);
    expect((processor as any).matchesNumericPattern('short.com')).toBe(false); // Too short
  });

  test('updateDomainHistory saves pattern to history when switching to non-pattern (first time)', () => {
    const watchers: Watchers = {
      sites: {
        'yavasgir': {
          last_known_mirror: 'yavasgir55.com',  // Pattern domain
          // No heuristic_history yet
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['yavasgir'];
    
    // Switch to non-pattern domain
    (processor as any).updateDomainHistory(site, 'example.com', 'yavasgir55.com');
    
    // Should save pattern domain to history before switching
    expect(site.heuristic_history).toEqual(['yavasgir55.com']);
    expect(site.pattern_changed).toBe(true);
  });

  test('updateDomainHistory preserves history when switching to another non-pattern', () => {
    const watchers: Watchers = {
      sites: {
        'yavasgir': {
          last_known_mirror: 'example.com',  // Non-pattern domain
          pattern_changed: true,
          heuristic_history: ['yavasgir55.com'],  // Pattern saved from previous switch
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['yavasgir'];
    
    // Switch to another non-pattern domain
    (processor as any).updateDomainHistory(site, 'another-example.com', 'yavasgir55.com');
    
    // History should remain unchanged (no pattern to save)
    expect(site.heuristic_history).toEqual(['yavasgir55.com']);
    expect(site.pattern_changed).toBe(true);
  });

  test('updateDomainHistory clears flags and history when returning to pattern from non-pattern', () => {
    const watchers: Watchers = {
      sites: {
        'test-site': {
          last_known_mirror: 'yavasgir-new-domain.com',
          pattern_changed: true,
          heuristic_history: ['yavasgir88.com'],
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];
    
    // Return to pattern domain
    (processor as any).updateDomainHistory(site, 'yavasgir99.com', 'yavasgir-new-domain.com');
    
    // Flags and history should be cleared when returning to pattern
    expect(site.heuristic_history).toBeUndefined();
    expect(site.pattern_changed).toBeUndefined();
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
        'kodtimetv': {
          last_known_mirror: 'kodtimetv16-com.l.ink', // Non-pattern domain
          heuristic_history: ['kodtimetv16.com'], // Pattern domain in history
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['kodtimetv'];

    const currentHost = processor['resolver'].extractHostWithoutQuery(site.last_known_mirror || '');
    const lastHistoryDomain = site.heuristic_history![site.heuristic_history!.length - 1];

    // Non-pattern last_known_mirror + pattern in history → should trigger history heuristic
    expect((processor as any).matchesNumericPattern(currentHost)).toBe(false);
    expect((processor as any).matchesNumericPattern(lastHistoryDomain)).toBe(true);
  });

  test('updateDomainHistory does not create history for pattern→pattern rotation', () => {
    // sahatv2.top → sahatv5.top: both pattern, no history needed
    const watchers: Watchers = {
      sites: {
        'sahatv': {
          last_known_mirror: 'sahatv2.top',
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['sahatv'];

    (processor as any).updateDomainHistory(site, 'sahatv5.top', 'sahatv2.top');

    expect(site.heuristic_history).toBeUndefined();
    expect(site.pattern_changed).toBeUndefined();
  });

  test('updateDomainHistory deletes existing history on pattern→pattern rotation', () => {
    // If history existed from a previous non-pattern episode, it must be cleared on return to pattern
    const watchers: Watchers = {
      sites: {
        'sahatv': {
          last_known_mirror: 'sahatv5.top',
          heuristic_history: ['sahatv5.top'],
          pattern_changed: true,
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['sahatv'];

    (processor as any).updateDomainHistory(site, 'sahatv6.top', 'sahatv5.top');

    expect(site.heuristic_history).toBeUndefined();
    expect(site.pattern_changed).toBeUndefined();
  });

  test('updateDomainHistory creates history and sets flags when pattern switches to non-pattern', () => {
    // hepbetspor12.cfd → patronspor.is: history must record the last pattern domain
    const watchers: Watchers = {
      sites: {
        'hepbetspor': {
          last_known_mirror: 'hepbetspor12.cfd',
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['hepbetspor'];

    (processor as any).updateDomainHistory(site, 'patronspor.is', 'hepbetspor12.cfd');

    expect(site.heuristic_history).toEqual(['hepbetspor12.cfd']);
    expect(site.pattern_changed).toBe(true);
  });

  test('updateDomainHistory preserves history when already on non-pattern (no new history entry)', () => {
    // Already on non-pattern, switches to another non-pattern: history stays unchanged
    const watchers: Watchers = {
      sites: {
        'yavasgir': {
          last_known_mirror: 'example.com',
          pattern_changed: true,
          heuristic_history: ['yavasgir55.com'],
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['yavasgir'];

    // oldLastKnownMirror is non-pattern → no new history entry added
    (processor as any).updateDomainHistory(site, 'another-example.com', 'example.com');

    expect(site.heuristic_history).toEqual(['yavasgir55.com']);
    expect(site.pattern_changed).toBe(true);
  });

  test('checkSingleSite triggers immediate heuristic when pattern→non-pattern and finds new pattern domain', async () => {
    // Scenario: hepbetspor12.cfd redirects to patronspor.is (non-pattern),
    // but heuristic immediately finds hepbetspor13.cfd (pattern)
    const watchers: Watchers = {
      sites: {
        'hepbetspor': {
          last_known_mirror: 'hepbetspor12.cfd',
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['hepbetspor'];

    // Mock DNS resolution to succeed for all candidates
    mockedDnsResolve.mockResolvedValue(['127.0.0.1'] as never);

    // Mock HTTP resolver:
    // 1. hepbetspor12.cfd → redirects to patronspor.is (non-pattern)
    // 2. heuristic candidates: hepbetspor13.cfd succeeds (pattern)
    const mockResolve = jest.spyOn(resolver, 'resolve');
    
    // First call: hepbetspor12.cfd → patronspor.is
    mockResolve.mockResolvedValueOnce({
      success: true,
      finalUrl: 'https://patronspor.is/',
      finalHost: 'patronspor.is',
      statusCode: 200,
      redirectChain: [
        { url: 'https://hepbetspor12.cfd/', statusCode: 301, location: 'https://patronspor.is/' },
        { url: 'https://patronspor.is/', statusCode: 200 },
      ],
      finalBody: '<html><body>Working</body></html>',
      antibotDetected: false,
      shouldTriggerHeuristic: false,
    });

    // Heuristic calls: hepbetspor13.cfd succeeds
    mockResolve.mockResolvedValueOnce({
      success: true,
      finalUrl: 'https://hepbetspor13.cfd/',
      finalHost: 'hepbetspor13.cfd',
      statusCode: 200,
      redirectChain: [
        { url: 'https://hepbetspor13.cfd/', statusCode: 200 },
      ],
      finalBody: '<html><body>Working</body></html>',
      antibotDetected: false,
      shouldTriggerHeuristic: false,
    });

    const result = await (processor as any).processSite('hepbetspor', site);

    // Verify result
    expect(result.oldHost).toBe('hepbetspor12.cfd');
    expect(result.newHost).toBe('hepbetspor13.cfd'); // Found by heuristic!
    expect(result.hostChanged).toBe(true);
    expect(result.shouldUpdate).toBe(true); // Should update filters with new pattern domain
    expect(result.historyUpdated).toBe(true);

    // Verify site state: no pattern_changed flag (back on pattern)
    expect(site.heuristic_history).toBeUndefined();
    expect(site.pattern_changed).toBeUndefined();

    mockResolve.mockRestore();
  });

  test('checkSingleSite triggers immediate heuristic when pattern→non-pattern but finds no pattern domain', async () => {
    // Scenario: restmacizle22.cfd redirects to patronspor.is (non-pattern),
    // heuristic runs but all candidates fail or are non-pattern
    const watchers: Watchers = {
      sites: {
        'restmacizle23.cfd': {
          last_known_mirror: 'restmacizle22.cfd',
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['restmacizle23.cfd'];

    // Mock DNS resolution to succeed
    mockedDnsResolve.mockResolvedValue(['127.0.0.1'] as never);

    // Mock HTTP resolver:
    // 1. restmacizle22.cfd → redirects to patronspor.is (non-pattern)
    // 2. heuristic candidates: all fail
    const mockResolve = jest.spyOn(resolver, 'resolve');
    
    // First call: restmacizle22.cfd → patronspor.is
    mockResolve.mockResolvedValueOnce({
      success: true,
      finalUrl: 'https://patronspor.is/',
      finalHost: 'patronspor.is',
      statusCode: 200,
      redirectChain: [
        { url: 'https://restmacizle22.cfd/', statusCode: 301, location: 'https://patronspor.is/' },
        { url: 'https://patronspor.is/', statusCode: 200 },
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

    const result = await (processor as any).processSite('restmacizle23.cfd', site);

    // Verify result: stays on non-pattern domain
    expect(result.oldHost).toBe('restmacizle22.cfd');
    expect(result.newHost).toBe('patronspor.is'); // No pattern found, stays on non-pattern
    expect(result.hostChanged).toBe(true);
    expect(result.shouldUpdate).toBe(false); // Should NOT update filters
    expect(result.historyUpdated).toBe(true);

    // Verify site state: pattern_changed flag set, history saved
    expect(site.heuristic_history).toEqual(['restmacizle22.cfd']);
    expect(site.pattern_changed).toBe(true);

    mockResolve.mockRestore();
  });

  test('checkSingleSite triggers immediate heuristic when pattern→non-pattern and finds another non-pattern domain', async () => {
    // Scenario: kodtimetv15.com redirects to example.com (non-pattern),
    // heuristic finds kodtimetv16-com.l.ink (also non-pattern)
    const watchers: Watchers = {
      sites: {
        'kodtimetv': {
          last_known_mirror: 'kodtimetv15.com',
          last_seen: '2026-02-15 10:00',
          failed_since: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['kodtimetv'];

    // Mock DNS resolution to succeed
    mockedDnsResolve.mockResolvedValue(['127.0.0.1'] as never);

    // Mock HTTP resolver:
    // 1. kodtimetv15.com → redirects to example.com (non-pattern)
    // 2. heuristic candidates: kodtimetv16.com → kodtimetv16-com.l.ink (non-pattern)
    const mockResolve = jest.spyOn(resolver, 'resolve');
    
    // First call: kodtimetv15.com → example.com
    mockResolve.mockResolvedValueOnce({
      success: true,
      finalUrl: 'https://example.com/',
      finalHost: 'example.com',
      statusCode: 200,
      redirectChain: [
        { url: 'https://kodtimetv15.com/', statusCode: 301, location: 'https://example.com/' },
        { url: 'https://example.com/', statusCode: 200 },
      ],
      finalBody: '<html><body>Working</body></html>',
      antibotDetected: false,
      shouldTriggerHeuristic: false,
    });

    // Heuristic calls: first candidate redirects to non-pattern
    mockResolve.mockResolvedValueOnce({
      success: true,
      finalUrl: 'https://kodtimetv16-com.l.ink/',
      finalHost: 'kodtimetv16-com.l.ink',
      statusCode: 200,
      redirectChain: [
        { url: 'https://kodtimetv16.com/', statusCode: 301, location: 'https://kodtimetv16-com.l.ink/' },
        { url: 'https://kodtimetv16-com.l.ink/', statusCode: 200 },
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

    const result = await (processor as any).processSite('kodtimetv', site);

    // Verify result: stays on original non-pattern domain (not the one found by heuristic)
    expect(result.oldHost).toBe('kodtimetv15.com');
    expect(result.newHost).toBe('example.com'); // Original non-pattern, not heuristic result
    expect(result.hostChanged).toBe(true);
    expect(result.shouldUpdate).toBe(false); // Should NOT update filters
    expect(result.historyUpdated).toBe(true);

    // Verify site state: pattern_changed flag set, history saved
    expect(site.heuristic_history).toEqual(['kodtimetv15.com']);
    expect(site.pattern_changed).toBe(true);

    mockResolve.mockRestore();
  });
});
