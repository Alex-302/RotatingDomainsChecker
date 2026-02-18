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

  test('updateDomainHistory maintains chronological order', () => {
    const watchers: Watchers = {
      sites: {
        'test-site': {
          last_known_mirror: 'kodtimetv15.com',
          heuristic_history: ['kodtimetv13.com', 'kodtimetv14.com'],
          last_seen: '2026-02-15 10:00',
          last_failed: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];
    
    // Access private method via any cast for testing
    (processor as any).updateDomainHistory(site, 'kodtimetv15.com');
    
    expect(site.heuristic_history).toEqual(['kodtimetv13.com', 'kodtimetv14.com', 'kodtimetv15.com']);
  });

  test('updateDomainHistory rotates old domains when exceeding limit', () => {
    const watchers: Watchers = {
      sites: {
        'test-site': {
          last_known_mirror: 'kodtimetv17.com',
          heuristic_history: ['kodtimetv13.com', 'kodtimetv14.com', 'kodtimetv15.com', 'kodtimetv16.com', 'kodtimetv17.com'],
          last_seen: '2026-02-15 10:00',
          last_failed: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];
    
    (processor as any).updateDomainHistory(site, 'kodtimetv18.com');
    
    // Should remove oldest (kodtimetv13.com) and add newest
    expect(site.heuristic_history).toEqual(['kodtimetv14.com', 'kodtimetv15.com', 'kodtimetv16.com', 'kodtimetv17.com', 'kodtimetv18.com']);
    expect(site.heuristic_history?.length).toBe(5);
  });

  test('updateDomainHistory removes duplicates before adding', () => {
    const watchers: Watchers = {
      sites: {
        'test-site': {
          last_known_mirror: 'kodtimetv15.com',
          heuristic_history: ['kodtimetv13.com', 'kodtimetv14.com', 'kodtimetv15.com'],
          last_seen: '2026-02-15 10:00',
          last_failed: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];
    
    // Re-add existing domain
    (processor as any).updateDomainHistory(site, 'kodtimetv14.com');
    
    // Should move kodtimetv14.com to end
    expect(site.heuristic_history).toEqual(['kodtimetv13.com', 'kodtimetv15.com', 'kodtimetv14.com']);
  });

  test('updateDomainHistory only stores pattern-matching domains', () => {
    const watchers: Watchers = {
      sites: {
        'test-site': {
          last_known_mirror: 'kodtimetv15.com',
          heuristic_history: ['kodtimetv13.com', 'kodtimetv14.com'],
          last_seen: '2026-02-15 10:00',
          last_failed: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];
    
    // Try to add non-pattern domain (link shortener)
    (processor as any).updateDomainHistory(site, 'kodtimetv16-com.l.ink');
    
    // History should NOT be updated
    expect(site.heuristic_history).toEqual(['kodtimetv13.com', 'kodtimetv14.com']);
  });

  test('updateDomainHistory stores pattern-matching domain', () => {
    const watchers: Watchers = {
      sites: {
        'test-site': {
          last_known_mirror: 'kodtimetv15.com',
          heuristic_history: ['kodtimetv13.com', 'kodtimetv14.com'],
          last_seen: '2026-02-15 10:00',
          last_failed: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['test-site'];
    
    // Add pattern-matching domain
    (processor as any).updateDomainHistory(site, 'kodtimetv15.com');
    
    // History should be updated
    expect(site.heuristic_history).toEqual(['kodtimetv13.com', 'kodtimetv14.com', 'kodtimetv15.com']);
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

  test('saves pattern domain when redirect goes to non-pattern domain', () => {
    const watchers: Watchers = {
      sites: {
        'kodtimetv': {
          last_known_mirror: 'kodtimetv12.com',
          heuristic_history: ['kodtimetv12.com'], // Start with existing history
          pattern_changed: true, // Simulate we were on non-pattern before
          last_seen: '2026-02-15 10:00',
          last_failed: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['kodtimetv'];
    
    // Simulate: kodtimetv16.com (pattern) redirects to kodtimetv16-com.l.ink (non-pattern)
    // In real scenario, heuristic finds kodtimetv16.com which redirects to kodtimetv16-com.l.ink
    // The code should save kodtimetv16.com (pattern) to history, not kodtimetv16-com.l.ink
    
    // Manually test the logic:
    const candidateHost = 'kodtimetv16.com';
    const finalHost = 'kodtimetv16-com.l.ink';
    
    // Check pattern matching
    expect((processor as any).matchesNumericPattern(candidateHost)).toBe(true);
    expect((processor as any).matchesNumericPattern(finalHost)).toBe(false);
    
    // Simulate what the code does: if final is non-pattern and candidate is pattern, save candidate
    if (!(processor as any).matchesNumericPattern(finalHost) && (processor as any).matchesNumericPattern(candidateHost)) {
      (processor as any).updateDomainHistory(site, candidateHost);
    } else {
      (processor as any).updateDomainHistory(site, finalHost);
    }
    
    // History should contain the pattern domain (kodtimetv16.com), not the non-pattern one
    expect(site.heuristic_history).toEqual(['kodtimetv12.com', 'kodtimetv16.com']);
  });

  test('saves final domain when both candidate and final are pattern domains', () => {
    const watchers: Watchers = {
      sites: {
        'sahatv': {
          last_known_mirror: 'sahatv3.top',
          heuristic_history: ['sahatv3.top'], // Need existing history to add new pattern domains
          pattern_changed: true, // Simulate we were on non-pattern before
          last_seen: '2026-02-15 10:00',
          last_failed: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['sahatv'];
    
    // Simulate: sahatv4.top (pattern) redirects to sahatv5.top (also pattern)
    const candidateHost = 'sahatv4.top';
    const finalHost = 'sahatv5.top';
    
    // Both are patterns
    expect((processor as any).matchesNumericPattern(candidateHost)).toBe(true);
    expect((processor as any).matchesNumericPattern(finalHost)).toBe(true);
    
    // Should save final domain
    if (!(processor as any).matchesNumericPattern(finalHost) && (processor as any).matchesNumericPattern(candidateHost)) {
      (processor as any).updateDomainHistory(site, candidateHost);
    } else {
      (processor as any).updateDomainHistory(site, finalHost);
    }
    
    // History should contain the final domain
    expect(site.heuristic_history).toEqual(['sahatv3.top', 'sahatv5.top']);
  });

  test('triggers history-based heuristic when site is working on non-pattern domain', () => {
    const watchers: Watchers = {
      sites: {
        'kodtimetv': {
          last_known_mirror: 'kodtimetv16-com.l.ink', // Non-pattern domain
          heuristic_history: ['kodtimetv16.com'], // Pattern domain in history
          last_seen: '2026-02-15 10:00',
          last_failed: '',
          failed_days: 0,
        },
      },
    };

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const site = watchers.sites['kodtimetv'];
    
    // Check pattern matching
    expect((processor as any).matchesNumericPattern('kodtimetv16-com.l.ink')).toBe(false);
    expect((processor as any).matchesNumericPattern('kodtimetv16.com')).toBe(true);
    
    // This simulates the logic in processAll for history-based fallback
    const currentHost = processor['resolver'].extractHostWithoutQuery(site.last_known_mirror || '');
    const lastHistoryDomain = site.heuristic_history![site.heuristic_history!.length - 1];
    
    // Should trigger history-based heuristic
    const shouldTriggerHistoryHeuristic = !(processor as any).matchesNumericPattern(currentHost) && 
                                         (processor as any).matchesNumericPattern(lastHistoryDomain);
    
    expect(shouldTriggerHistoryHeuristic).toBe(true);
  });
});
