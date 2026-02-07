import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import type { Config, Watchers, WatcherSite, RedirectResult, HeuristicTask } from '../src/types.js';

// Mock dns module BEFORE importing BatchProcessor (which imports dns)
const mockedDnsResolve = jest.fn().mockResolvedValue(['127.0.0.1'] as never);
jest.unstable_mockModule('dns', () => ({
  promises: {
    resolve: mockedDnsResolve,
  },
}));

// Dynamic imports after mock setup
const { BatchProcessor } = await import('../src/batch.js');
const { HttpResolver } = await import('../src/httpResolver.js');
const { Logger } = await import('../src/logger.js');

function makeConfig(overrides: Record<string, unknown> = {}): Config {
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
      enabled: true,
      timeout: 3000,
      retryOnce: false,
    },
    contentProbe: {
      enabled: true,
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
      maxAttempts: 5,
      skipOnAntibot: true,
      forceHeuristicOnCodes: [404, 500],
    },
    logging: {
      saveToFile: false,
      incremental: false,
      filePath: '',
    },
    git: {
      mode: 'prod',
      branch: 'master',
      prBranchPrefix: 'auto-update',
    },
    filtersdir: {
      repoPath: '',
      filterDirPattern: '*Filter',
      filePattern: '*.txt',
    },
    ...overrides,
  } as unknown as Config;
}

function makeLogger(): InstanceType<typeof Logger> {
  return new Logger(makeConfig({ logging: { saveToFile: false, incremental: false, filePath: '' } }) as Config);
}

beforeEach(() => {
  mockedDnsResolve.mockReset();
  mockedDnsResolve.mockResolvedValue(['127.0.0.1'] as never);
});

function makeSite(overrides: Partial<WatcherSite> = {}): WatcherSite {
  return {
    last_known_mirror: 'turkifsaclub001.sbs',
    last_seen: '',
    last_failed: '',
    failed_days: 0,
    ...overrides,
  };
}

function makeWatchers(sites: Record<string, WatcherSite>): Watchers {
  return { sites };
}

function makeSuccessResult(finalHost: string, overrides: Partial<RedirectResult> = {}): RedirectResult {
  return {
    success: true,
    finalUrl: `https://${finalHost}/`,
    finalHost,
    statusCode: 200,
    redirectChain: [],
    antibotDetected: false,
    finalBody: '<html>test content</html>',
    ...overrides,
  };
}

function makeFailResult(error: string, overrides: Partial<RedirectResult> = {}): RedirectResult {
  return {
    success: false,
    finalUrl: '',
    finalHost: '',
    statusCode: 0,
    redirectChain: [],
    error,
    ...overrides,
  };
}

// ============================================================================
// 3. generateCandidates (tested via processAll with heuristic)
// ============================================================================

describe('3. Heuristic candidate generation', () => {
  test('3.1 domain[N].tld: turkifsaclub001.sbs → generates turkifsaclub002..006', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'turkifsaclub001.sbs' });
    const watchers = makeWatchers({ 'turkifsaclub': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    // Mock resolve: first call fails (initial check), subsequent calls succeed for candidate #2
    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      // parseInt('001') = 1, startNum = 2, candidates: turkifsaclub2.sbs, turkifsaclub3.sbs...
      if (url.includes('turkifsaclub2.sbs')) return makeSuccessResult('turkifsaclub2.sbs');
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results.length).toBe(1);
    expect(results[0].newHost).toBe('turkifsaclub2.sbs');
    expect(results[0].shouldUpdate).toBe(true);
  });

  test('3.2 [N]domain.tld: 14dizipal.com → generates 15dizipal.com, 16dizipal.com...', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: '14dizipal.com' });
    const watchers = makeWatchers({ 'dizipal': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      // parseInt('14') = 14, startNum = 15, candidates: 15dizipal.com, 16dizipal.com...
      if (url.includes('16dizipal')) return makeSuccessResult('16dizipal.com');
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results.length).toBe(1);
    expect(results[0].newHost).toBe('16dizipal.com');
  });

  test('3.3 domain[N][text].tld: betist126tv.live → generates betist127tv.live...', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'betist126tv.live' });
    const watchers = makeWatchers({ 'betist': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      // parseInt('126') = 126, startNum = 127, candidates: betist127tv.live, betist128tv.live...
      if (url.includes('betist128tv')) return makeSuccessResult('betist128tv.live');
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results.length).toBe(1);
    expect(results[0].newHost).toBe('betist128tv.live');
  });

  test('3.4 no numeric pattern → empty candidates, no heuristic', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'example.com' });
    const watchers = makeWatchers({ 'example': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    jest.spyOn(resolver, 'resolve').mockResolvedValue(makeFailResult('DNS failed', { shouldTriggerHeuristic: true }) as never);

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results.length).toBe(1);
    expect(results[0].shouldUpdate).toBe(false);
  });

  test('3.5 heuristic.enabled: false → no heuristic even on failure', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: false, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'turkifsaclub001.sbs' });
    const watchers = makeWatchers({ 'turkifsaclub': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    jest.spyOn(resolver, 'resolve').mockResolvedValue(makeFailResult('DNS failed', { shouldTriggerHeuristic: true }) as never);

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results.length).toBe(1);
    expect(results[0].shouldUpdate).toBe(false);
  });

  test('3.6 disable_heuristic on site → no heuristic for that site', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'turkifsaclub001.sbs', disable_heuristic: true });
    const watchers = makeWatchers({ 'turkifsaclub': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    jest.spyOn(resolver, 'resolve').mockResolvedValue(makeFailResult('DNS failed', { shouldTriggerHeuristic: true }) as never);

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results.length).toBe(1);
    expect(results[0].shouldUpdate).toBe(false);
  });
});

// ============================================================================
// 4. shouldUpdate logic
// ============================================================================

describe('4. shouldUpdate logic', () => {
  test('4.1 hostChanged: true → shouldUpdate: true', async () => {
    const config = makeConfig({ dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false } });
    const site = makeSite({ last_known_mirror: 'old.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    jest.spyOn(resolver, 'resolve').mockResolvedValue(makeSuccessResult('new.com') as never);

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].hostChanged).toBe(true);
    expect(results[0].shouldUpdate).toBe(true);
  });

  test('4.2 hostChanged: false + numeric pattern → shouldUpdate: true (predicted mirror cleanup)', async () => {
    const config = makeConfig({ dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false } });
    const site = makeSite({ last_known_mirror: 'turkifsaclub020.sbs' });
    const watchers = makeWatchers({ 'turkifsaclub': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    // Returns same host — no change but numeric pattern
    jest.spyOn(resolver, 'resolve').mockResolvedValue(makeSuccessResult('turkifsaclub020.sbs') as never);

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].hostChanged).toBe(false);
    expect(results[0].shouldUpdate).toBe(true);
  });

  test('4.3 hostChanged: false + no numeric pattern → shouldUpdate: false', async () => {
    const config = makeConfig({ dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false } });
    const site = makeSite({ last_known_mirror: 'example.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    jest.spyOn(resolver, 'resolve').mockResolvedValue(makeSuccessResult('example.com') as never);

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].hostChanged).toBe(false);
    expect(results[0].shouldUpdate).toBe(false);
  });

  test('4.4 wildcard in siteName → shouldUpdate: true even without host change', async () => {
    const config = makeConfig({ dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false } });
    const site = makeSite({ last_known_mirror: 'example.com' });
    const watchers = makeWatchers({ 'test*site': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    jest.spyOn(resolver, 'resolve').mockResolvedValue(makeSuccessResult('example.com') as never);

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].hostChanged).toBe(false);
    expect(results[0].shouldUpdate).toBe(true);
  });

  test('4.5 failed check → shouldUpdate: false', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: false, maxAttempts: 0, skipOnAntibot: true, forceHeuristicOnCodes: [] },
    });
    const site = makeSite({ last_known_mirror: 'dead.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    jest.spyOn(resolver, 'resolve').mockResolvedValue(makeFailResult('Connection refused') as never);

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].shouldUpdate).toBe(false);
  });
});

// ============================================================================
// 4.7 calculateDaysSince (tested indirectly via processSite optimization)
// ============================================================================

describe('4.7 calculateDaysSince (via recent last_seen optimization)', () => {
  test('last_seen recent (< 2 days) → tries last_known_mirror first', async () => {
    const config = makeConfig({ dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false } });
    const now = new Date();
    const recentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const site = makeSite({
      initial_domain: 'initial.com',
      last_known_mirror: 'mirror.com',
      last_seen: recentDate,
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    const resolveSpy = jest.spyOn(resolver, 'resolve').mockResolvedValue(makeSuccessResult('mirror.com') as never);

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    await processor.processAll();

    // Should have been called with last_known_mirror (mirror.com), not initial_domain
    const firstCallUrl = (resolveSpy.mock.calls[0] as unknown[])[0] as string;
    expect(firstCallUrl).toBe('mirror.com');
  });

  test('last_seen old (> 2 days) → uses initial_domain', async () => {
    const config = makeConfig({ dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false } });
    const site = makeSite({
      initial_domain: 'initial.com',
      last_known_mirror: 'mirror.com',
      last_seen: '2020-01-01 00:00',
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    const resolveSpy = jest.spyOn(resolver, 'resolve').mockResolvedValue(makeSuccessResult('initial.com') as never);

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    await processor.processAll();

    const firstCallUrl = (resolveSpy.mock.calls[0] as unknown[])[0] as string;
    expect(firstCallUrl).toBe('initial.com');
  });

  test('empty last_seen → uses initial_domain', async () => {
    const config = makeConfig({ dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false } });
    const site = makeSite({
      initial_domain: 'initial.com',
      last_known_mirror: 'mirror.com',
      last_seen: '',
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    const resolveSpy = jest.spyOn(resolver, 'resolve').mockResolvedValue(makeSuccessResult('initial.com') as never);

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    await processor.processAll();

    const firstCallUrl = (resolveSpy.mock.calls[0] as unknown[])[0] as string;
    expect(firstCallUrl).toBe('initial.com');
  });
});

// ============================================================================
// 5. Heuristic triggering conditions
// ============================================================================

describe('5. Heuristic triggering conditions', () => {
  test('5.1 antibot + skipOnAntibot: true + accept_antibot: false → foundSites.add, search stops', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 3, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'turkifsaclub001.sbs', accept_antibot: false });
    const watchers = makeWatchers({ 'turkifsaclub': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    const resolveSpy = jest.spyOn(resolver, 'resolve').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      // All heuristic candidates return antibot
      return makeFailResult('Antibot', { antibotDetected: true, finalHost: 'turkifsaclub2.sbs', statusCode: 403 });
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // skipOnAntibot should stop further heuristic checks
    expect(results[0].shouldUpdate).toBe(false);
  });

  test('5.2 antibot + accept_antibot: true → candidate accepted as success', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 3, skipOnAntibot: false, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'turkifsaclub001.sbs', accept_antibot: true });
    const watchers = makeWatchers({ 'turkifsaclub': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      return {
        ...makeSuccessResult('turkifsaclub2.sbs'),
        antibotDetected: true,
        success: false,
      };
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].shouldUpdate).toBe(true);
    expect(results[0].newHost).toBe('turkifsaclub2.sbs');
  });

  test('5.3 forceHeuristicOnCodes contains response code → heuristic triggered', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 3, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'turkifsaclub001.sbs' });
    const watchers = makeWatchers({ 'turkifsaclub': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) return makeFailResult('Not found', { statusCode: 404, shouldTriggerHeuristic: true });
      if (url.includes('turkifsaclub2.sbs')) return makeSuccessResult('turkifsaclub2.sbs');
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].newHost).toBe('turkifsaclub2.sbs');
    expect(results[0].shouldUpdate).toBe(true);
  });

  test('5.4 DNS failed → shouldTriggerHeuristic: true → heuristic runs', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: true, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 3, skipOnAntibot: true, forceHeuristicOnCodes: [] },
    });
    const site = makeSite({ last_known_mirror: 'turkifsaclub001.sbs' });
    const watchers = makeWatchers({ 'turkifsaclub': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    // DNS fails for initial check, then resolves for all subsequent
    mockedDnsResolve.mockRejectedValueOnce(new Error('ENOTFOUND') as never);
    // All subsequent DNS checks succeed
    mockedDnsResolve.mockResolvedValue(['127.0.0.1'] as never);

    // resolver.resolve is only called for heuristic candidates (initial check fails at DNS)
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      if (url.includes('turkifsaclub2.sbs')) return makeSuccessResult('turkifsaclub2.sbs');
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // DNS failure triggers heuristic, which finds turkifsaclub2
    expect(results[0].shouldUpdate).toBe(true);
    expect(results[0].newHost).toBe('turkifsaclub2.sbs');
  });
});

// ============================================================================
// 5.5 Content probe in heuristic
// ============================================================================

describe('5.5 Content probe in heuristic', () => {
  test('probe_text present + body matches → candidate accepted', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 3, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'turkifsaclub001.sbs', probe_text: ['keyword'] });
    const watchers = makeWatchers({ 'turkifsaclub': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return makeFailResult('Failed', { shouldTriggerHeuristic: true });
      return makeSuccessResult('turkifsaclub2.sbs', { finalBody: 'page has keyword in it' });
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].shouldUpdate).toBe(true);
  });

  test('probe_text present + body does NOT match → candidate rejected, search continues', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 3, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'turkifsaclub001.sbs', probe_text: ['keyword'] });
    const watchers = makeWatchers({ 'turkifsaclub': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return makeFailResult('Failed', { shouldTriggerHeuristic: true });
      // All candidates succeed HTTP but fail probe
      return makeSuccessResult('turkifsaclub2.sbs', { finalBody: 'no matching content here' });
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // None of the candidates pass probe, so no update
    expect(results[0].shouldUpdate).toBe(false);
  });
});

// ============================================================================
// 6.3 DNS pre-check
// ============================================================================

describe('6.3 DNS pre-check', () => {
  test('dnsPreCheck.enabled: false → DNS check skipped, HTTP proceeds', async () => {
    const config = makeConfig({ dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false } });
    const site = makeSite({ last_known_mirror: 'example.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    jest.spyOn(resolver, 'resolve').mockResolvedValue(makeSuccessResult('example.com') as never);

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].result.success).toBe(true);
  });

  test('DNS ENOTFOUND → result.shouldTriggerHeuristic: true', async () => {
    const config = makeConfig({ heuristic: { enabled: false, maxAttempts: 0, skipOnAntibot: true, forceHeuristicOnCodes: [] } });
    const site = makeSite({ last_known_mirror: 'dead-domain.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    mockedDnsResolve.mockRejectedValueOnce(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }) as never);

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].result.shouldTriggerHeuristic).toBe(true);
    expect(results[0].shouldUpdate).toBe(false);
  });
});

// ============================================================================
// Path mismatch
// ============================================================================

describe('Path mismatch handling', () => {
  test('site.path set + final path differs → shouldUpdate: false, error message', async () => {
    const config = makeConfig({ dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false } });
    const site = makeSite({ last_known_mirror: 'example.com', path: '/expected-path' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    jest.spyOn(resolver, 'resolve').mockResolvedValue(
      makeSuccessResult('example.com', { finalUrl: 'https://example.com/wrong-path' }) as never,
    );

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].shouldUpdate).toBe(false);
    expect(results[0].error).toContain('Path changed');
  });
});

// ============================================================================
// No URL configured
// ============================================================================

describe('No URL configured', () => {
  test('missing initial_domain and last_known_mirror → error result', async () => {
    const config = makeConfig({ dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false } });
    const site = makeSite({ last_known_mirror: '' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].error).toBe('No URL configured');
    expect(results[0].shouldUpdate).toBe(false);
  });
});
