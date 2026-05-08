import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import type { Config, Watchers, WatcherSite, RedirectResult, HeuristicTask } from '../src/types.js';

// Mock dns module BEFORE importing BatchProcessor (which imports dns)
const mockedDnsResolve = jest.fn().mockResolvedValue(['127.0.0.1'] as never);
const mockedDnsLookup = jest.fn().mockResolvedValue({ address: '127.0.0.1', family: 4 } as never);
jest.unstable_mockModule('dns', () => ({
  promises: {
    resolve: mockedDnsResolve,
    lookup: mockedDnsLookup,
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
  mockedDnsLookup.mockReset();
  mockedDnsResolve.mockResolvedValue(['127.0.0.1'] as never);
  mockedDnsLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 } as never);
});

function makeSite(overrides: Partial<WatcherSite> = {}): WatcherSite {
  return {
    last_known_mirror: 'example001.com',
    last_seen: '',
    failed_since: '',
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
  test('3.1 domain[N].tld: example001.com → generates example002..006', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'example001.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    // Mock resolve: first call fails (initial check), subsequent calls succeed for candidate #2
    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      // parseInt('001') = 1, startNum = 2, candidates: example2.com, example3.com...
      if (url.includes('example2.com')) return makeSuccessResult('example2.com');
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results.length).toBe(1);
    expect(results[0].newHost).toBe('example2.com');
    expect(results[0].shouldUpdate).toBe(true);
  });

  test('3.2 [N]domain.tld: 14example.com → generates 15example.com, 16example.com...', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: '14example.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      // parseInt('14') = 14, startNum = 15, candidates: 15example.com, 16example.com...
      if (url.includes('16example')) return makeSuccessResult('16example.com');
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results.length).toBe(1);
    expect(results[0].newHost).toBe('16example.com');
  });

  test('3.3 domain[N][text].tld: example126tv.com → generates example127tv.com...', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'example126tv.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      // parseInt('126') = 126, startNum = 127, candidates: example127tv.com, example128tv.com...
      if (url.includes('example128tv')) return makeSuccessResult('example128tv.com');
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results.length).toBe(1);
    expect(results[0].newHost).toBe('example128tv.com');
  });

  test('3.4 www. prefix with domain[N].tld: www.example375.com → generates www.example376.com...', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'www.example375.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      // parseInt('375') = 375, startNum = 376, candidates: www.example376.com, www.example377.com...
      if (url.includes('www.example377')) return makeSuccessResult('www.example377.com');
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results.length).toBe(1);
    expect(results[0].shouldUpdate).toBe(true);
    expect(results[0].newHost).toBe('www.example377.com');
  });

  test('3.5 www. prefix with [N]domain.tld: www.91example.com → generates www.92example.com...', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'www.91example.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      // parseInt('91') = 91, startNum = 92, candidates: www.92example.com, www.93example.com...
      if (url.includes('www.93example')) return makeSuccessResult('www.93example.com');
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results.length).toBe(1);
    expect(results[0].shouldUpdate).toBe(true);
    expect(results[0].newHost).toBe('www.93example.com');
  });

  test('3.6 no numeric pattern → empty candidates, no heuristic', async () => {
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

  test('3.7 heuristic.enabled: false → no heuristic even on failure', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: false, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'example001.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    jest.spyOn(resolver, 'resolve').mockResolvedValue(makeFailResult('DNS failed', { shouldTriggerHeuristic: true }) as never);

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results.length).toBe(1);
    expect(results[0].shouldUpdate).toBe(false);
  });

  test('3.8 disable_heuristic on site → no heuristic for that site', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'example001.com', disable_heuristic: true });
    const watchers = makeWatchers({ 'testsite': site });
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
    const site = makeSite({ last_known_mirror: 'example020.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    // Returns same host — no change but numeric pattern
    jest.spyOn(resolver, 'resolve').mockResolvedValue(makeSuccessResult('example020.com') as never);

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
    const site = makeSite({ last_known_mirror: 'example001.com', accept_antibot: false });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    const resolveSpy = jest.spyOn(resolver, 'resolve').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      // All heuristic candidates return antibot
      return makeFailResult('Antibot', { antibotDetected: true, finalHost: 'testsite2.com', statusCode: 403 });
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
    const site = makeSite({ last_known_mirror: 'example001.com', accept_antibot: true });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      return {
        ...makeSuccessResult('testsite2.com'),
        antibotDetected: true,
        success: false,
      };
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].shouldUpdate).toBe(true);
    expect(results[0].newHost).toBe('testsite2.com');
  });

  test('5.3 forceHeuristicOnCodes contains response code → heuristic triggered', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 3, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({ last_known_mirror: 'example001.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) return makeFailResult('Not found', { statusCode: 404, shouldTriggerHeuristic: true });
      if (url.includes('example2.com')) return makeSuccessResult('example2.com');
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].newHost).toBe('example2.com');
    expect(results[0].shouldUpdate).toBe(true);
  });

  test('5.4 DNS failed → shouldTriggerHeuristic: true → heuristic runs', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: true, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 3, skipOnAntibot: true, forceHeuristicOnCodes: [] },
    });
    const site = makeSite({ last_known_mirror: 'example001.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    // DNS fails for initial check, then resolves for all subsequent
    mockedDnsLookup.mockRejectedValueOnce({ address: '', family: 0 } as never);
    // All subsequent DNS checks succeed
    mockedDnsLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 } as never);

    // resolver.resolve is only called for heuristic candidates (initial check fails at DNS)
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      if (url.includes('example2.com')) return makeSuccessResult('example2.com');
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // DNS failure triggers heuristic, which finds example2.com
    expect(results[0].shouldUpdate).toBe(true);
    expect(results[0].newHost).toBe('example2.com');
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
    const site = makeSite({ last_known_mirror: 'example001.com', probe_text: ['keyword'] });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return makeFailResult('Failed', { shouldTriggerHeuristic: true });
      return makeSuccessResult('testsite2.com', { finalBody: 'page has keyword in it' });
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
    const site = makeSite({ last_known_mirror: 'example001.com', probe_text: ['keyword'] });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return makeFailResult('Failed', { shouldTriggerHeuristic: true });
      // All candidates succeed HTTP but fail probe
      return makeSuccessResult('testsite2.com', { finalBody: 'no matching content here' });
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

    mockedDnsLookup.mockRejectedValueOnce(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }) as never);

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

// ============================================================================
// 7. skip_text scenarios
// ============================================================================
describe('7. skip_text scenarios', () => {
  test('7.1 Scenario 1: main domain skipped, heuristic candidate OK → uses candidate', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
      skip_text: ['This domain is parked'],
    });
    const site = makeSite({ last_known_mirror: 'example001.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) {
        // Main domain returns 200 but with parked content → skippedByText
        return {
          ...makeFailResult('Skipped by skip_text: "This domain is parked"'),
          statusCode: 200,
          finalHost: 'example001.com',
          skippedByText: 'This domain is parked',
          shouldTriggerHeuristic: true,
        };
      }
      // Heuristic candidate 2 succeeds
      if (url.includes('example2.com')) return makeSuccessResult('example2.com');
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].newHost).toBe('example2.com');
    expect(results[0].shouldUpdate).toBe(true);
  });

  test('7.2 Scenario 2: main domain skipped, no heuristic candidates → error, potentially_dead', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
      skip_text: ['This domain is parked'],
    });
    // No numeric pattern → no heuristic candidates
    const site = makeSite({ last_known_mirror: 'example.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    jest.spyOn(resolver, 'resolve').mockResolvedValue({
      ...makeFailResult('Skipped by skip_text: "This domain is parked"'),
      statusCode: 200,
      finalHost: 'example.com',
      skippedByText: 'This domain is parked',
      shouldTriggerHeuristic: true,
    } as never);

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].shouldUpdate).toBe(false);
    expect(results[0].result.skippedByText).toBe('This domain is parked');
  });

  test('7.3 Scenario 3: all heuristic candidates skipped → no update', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 3, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
      skip_text: ['This domain is parked'],
    });
    const site = makeSite({ last_known_mirror: 'example001.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // Main domain fails
        return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      }
      // All heuristic candidates return parked content
      return {
        ...makeFailResult('Skipped by skip_text: "This domain is parked"'),
        statusCode: 200,
        finalHost: `testsite${callCount}.com`,
        skippedByText: 'This domain is parked',
        shouldTriggerHeuristic: true,
      };
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // All candidates skipped, no update
    expect(results[0].shouldUpdate).toBe(false);
  });

  test('7.4 skip_text candidate skipped, next candidate OK → uses next candidate', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404] },
      skip_text: ['This domain is parked'],
    });
    const site = makeSite({ last_known_mirror: 'example001.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) {
        return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      }
      // First candidate is parked
      if (url.includes('example2.com')) {
        return {
          ...makeFailResult('Skipped by skip_text: "This domain is parked"'),
          statusCode: 200,
          finalHost: 'example2.com',
          skippedByText: 'This domain is parked',
          shouldTriggerHeuristic: true,
        };
      }
      // Second candidate is OK
      if (url.includes('example3.com')) return makeSuccessResult('example3.com');
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Should skip parked candidate and use the next one
    expect(results[0].newHost).toBe('example3.com');
    expect(results[0].shouldUpdate).toBe(true);
  });

  test('7.5 no skip_text configured → normal behavior', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: false, maxAttempts: 0, skipOnAntibot: true, forceHeuristicOnCodes: [] },
      // No skip_text configured
    });
    const site = makeSite({ last_known_mirror: 'example.com' });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    // Returns success with parked content — but no skip_text configured, so it passes
    jest.spyOn(resolver, 'resolve').mockResolvedValue(
      makeSuccessResult('example.com', { finalBody: 'This domain is parked' }) as never,
    );

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Without skip_text, parked content is treated as success
    expect(results[0].result.success).toBe(true);
  });
});

describe('8. force_search_ahead scenarios', () => {
  test('8.1 force_search_ahead disabled → stop after first success', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [] },
    });
    const site = makeSite({
      last_known_mirror: 'testsite1.com',
      force_search_ahead: false,
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation((url: string) => {
      callCount++;
      const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      if (host === 'testsite1.com') {
        return Promise.resolve(makeFailResult('DNS failed', { shouldTriggerHeuristic: true }));
      }
      // First candidate succeeds
      if (host === 'testsite2.com') return Promise.resolve(makeSuccessResult('testsite2.com'));
      // Second candidate (should not be checked due to early stop)
      if (host === 'testsite3.com') return Promise.resolve(makeSuccessResult('testsite3.com'));
      return Promise.resolve(makeFailResult('Not found'));
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Should stop after finding first candidate
    expect(results[0].newHost).toBe('testsite2.com');
    expect(results[0].shouldUpdate).toBe(true);
    // Should only call resolve twice: initial + first candidate
    expect(callCount).toBeLessThanOrEqual(3);
  });

  test('8.2 force_search_ahead enabled → check all candidates', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [] },
    });
    const site = makeSite({
      last_known_mirror: 'testsite1.com',
      force_search_ahead: true,
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    const successfulCandidates: string[] = [];

    jest.spyOn(resolver, 'resolve').mockImplementation((url: string) => {
      callCount++;
      const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      if (host === 'testsite1.com') {
        return Promise.resolve(makeFailResult('DNS failed', { shouldTriggerHeuristic: true }));
      }
      // Multiple candidates succeed
      if (host === 'testsite2.com') {
        successfulCandidates.push('testsite2.com');
        return Promise.resolve(makeSuccessResult('testsite2.com'));
      }
      if (host === 'testsite3.com') {
        successfulCandidates.push('testsite3.com');
        return Promise.resolve(makeSuccessResult('testsite3.com'));
      }
      if (host === 'testsite4.com') {
        successfulCandidates.push('testsite4.com');
        return Promise.resolve(makeSuccessResult('testsite4.com'));
      }
      return Promise.resolve(makeFailResult('Not found'));
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Should return first successful candidate
    expect(results[0].newHost).toBe('testsite2.com');
    expect(results[0].shouldUpdate).toBe(true);
    // Should check multiple candidates (more than just stopping at first)
    expect(callCount).toBeGreaterThan(3);
    expect(successfulCandidates.length).toBeGreaterThan(1);
  });

  test('8.3 force_search_ahead with probe_text → only working domains collected', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [] },
    });
    const site = makeSite({
      last_known_mirror: 'testsite1.com',
      force_search_ahead: true,
      probe_text: ['Expected Content'],
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;

    jest.spyOn(resolver, 'resolve').mockImplementation((url: string) => {
      callCount++;
      const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      if (host === 'testsite1.com') {
        return Promise.resolve(makeFailResult('DNS failed', { shouldTriggerHeuristic: true }));
      }
      // Candidate 2: success with correct content
      if (host === 'testsite2.com') {
        return Promise.resolve(makeSuccessResult('testsite2.com', { finalBody: 'Expected Content here' }));
      }
      // Candidate 3: success but wrong content (probe fails)
      if (host === 'testsite3.com') {
        return Promise.resolve(makeSuccessResult('testsite3.com', { finalBody: 'Wrong Content' }));
      }
      // Candidate 4: success with correct content
      if (host === 'testsite4.com') {
        return Promise.resolve(makeSuccessResult('testsite4.com', { finalBody: 'Expected Content again' }));
      }
      return Promise.resolve(makeFailResult('Not found'));
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Should use first candidate that passes probe
    expect(results[0].newHost).toBe('testsite2.com');
    expect(results[0].shouldUpdate).toBe(true);
    // Should check multiple candidates
    expect(callCount).toBeGreaterThan(2);
  });

  test('8.4 force_search_ahead: Phase 1 success → still generates candidates and collects additional domains', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [] },
    });
    const site = makeSite({
      last_known_mirror: 'testsite1.com',
      force_search_ahead: true,
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;

    jest.spyOn(resolver, 'resolve').mockImplementation((url: string) => {
      callCount++;
      const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      // Phase 1: testsite1.com redirects to testsite2.com
      if (host === 'testsite1.com') {
        return Promise.resolve(makeSuccessResult('testsite2.com'));
      }
      // Phase 2: Heuristic candidates — multiple succeed
      if (host === 'testsite2.com') return Promise.resolve(makeSuccessResult('testsite2.com'));
      if (host === 'testsite3.com') return Promise.resolve(makeSuccessResult('testsite3.com'));
      if (host === 'testsite4.com') return Promise.resolve(makeSuccessResult('testsite4.com'));
      if (host === 'testsite5.com') return Promise.resolve(makeSuccessResult('testsite5.com'));
      return Promise.resolve(makeFailResult('Not found'));
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Phase 1 found testsite2.com (redirect from testsite1.com)
    expect(results[0].newHost).toBe('testsite2.com');
    expect(results[0].hostChanged).toBe(true);
    // Heuristic should have run and collected additional working domains
    expect(results[0].additionalWorkingDomains).toEqual(
      expect.arrayContaining(['testsite3.com', 'testsite4.com', 'testsite5.com'])
    );
    // Should have made initial call + heuristic candidates
    expect(callCount).toBeGreaterThan(3);
  });

  test('8.5 force_search_ahead: Phase 1 success but host unchanged → still generates candidates', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 3, skipOnAntibot: true, forceHeuristicOnCodes: [] },
    });
    const site = makeSite({
      last_known_mirror: 'testsite1.com',
      force_search_ahead: true,
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;

    jest.spyOn(resolver, 'resolve').mockImplementation((url: string) => {
      callCount++;
      const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      // Phase 1: succeeds but host unchanged
      if (host === 'testsite1.com') {
        return Promise.resolve(makeSuccessResult('testsite1.com'));
      }
      // Phase 2: Heuristic finds new working domains
      if (host === 'testsite2.com') return Promise.resolve(makeSuccessResult('testsite2.com'));
      if (host === 'testsite3.com') return Promise.resolve(makeSuccessResult('testsite3.com'));
      return Promise.resolve(makeFailResult('Not found'));
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Phase 1 returned testsite1.com (no host change)
    // Heuristic should still run due to force_search_ahead and collect additional domains
    expect(results[0].newHost).toBe('testsite1.com');
    expect(results[0].additionalWorkingDomains).toEqual(
      expect.arrayContaining(['testsite2.com', 'testsite3.com'])
    );
  });

  test('8.6 force_search_ahead: collects final working domains from all redirects', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 3, skipOnAntibot: true, forceHeuristicOnCodes: [] },
    });
    const site = makeSite({
      last_known_mirror: 'testsite1.com',
      force_search_ahead: true,
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;

    jest.spyOn(resolver, 'resolve').mockImplementation((url: string) => {
      callCount++;
      // Phase 1: testsite1.com is alive (no redirect)
      if (callCount === 1) {
        return Promise.resolve(makeSuccessResult('testsite1.com'));
      }
      // Phase 2 candidates:
      // testsite2.com → alive (responds as itself)
      if (url.includes('testsite2.com')) {
        return Promise.resolve(makeSuccessResult('testsite2.com'));
      }
      // testsite3.com → REDIRECTS to different.com (200)
      if (url.includes('testsite3.com')) {
        return Promise.resolve(makeSuccessResult('different.com'));
      }
      return Promise.resolve(makeFailResult('Not found'));
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Primary domain is testsite1.com (alive, Phase 1)
    expect(results[0].newHost).toBe('testsite1.com');

    // Collect ALL final working domains, including through redirects
    const additional = results[0].additionalWorkingDomains || [];

    // testsite2.com → alive → collected
    expect(additional).toContain('testsite2.com');
    // testsite3.com → redirects to different.com (200) → different.com is collected
    expect(additional).toContain('different.com');
  });
});

// ============================================================================
// 9. Antibot + force_search_ahead: heuristic should run even when accept_antibot succeeds
// ============================================================================
describe('9. Antibot + force_search_ahead + forceHeuristicOnCodes', () => {
  test('9.1 accept_antibot + force_search_ahead: heuristic runs despite successful antibot check', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [403] },
    });
    const site = makeSite({
      last_known_mirror: 'example39.com',
      accept_antibot: true,
      force_search_ahead: true,
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    const collectedDomains: string[] = [];

    jest.spyOn(resolver, 'resolve').mockImplementation((url: string) => {
      callCount++;
      // Initial check: example39.com → antibot accepted (success: true, shouldTriggerHeuristic: true)
      if (callCount === 1) {
        return Promise.resolve(makeSuccessResult('example39.com', {
          antibotDetected: true,
          statusCode: 403,
          shouldTriggerHeuristic: true,
        }));
      }
      // Heuristic candidates: example40, example41 also behind antibot
      if (url.includes('example40.com')) {
        collectedDomains.push('example40.com');
        return Promise.resolve(makeSuccessResult('example40.com', {
          antibotDetected: true,
          statusCode: 403,
        }));
      }
      if (url.includes('example41.com')) {
        collectedDomains.push('example41.com');
        return Promise.resolve(makeSuccessResult('example41.com', {
          antibotDetected: true,
          statusCode: 403,
        }));
      }
      return Promise.resolve(makeFailResult('Not found'));
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Heuristic should have run (callCount > 1 means candidates were checked)
    expect(callCount).toBeGreaterThan(1);
    // Should have collected additional domains via force_search_ahead
    expect(collectedDomains.length).toBeGreaterThan(0);
    expect(results[0].shouldUpdate).toBe(true);
  });

  test('9.2 accept_antibot WITHOUT force_search_ahead but 403 in forceHeuristicOnCodes: heuristic runs but stops after first', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [403] },
    });
    const site = makeSite({
      last_known_mirror: 'example39.com',
      accept_antibot: true,
      // force_search_ahead NOT set — heuristic will stop after first found
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;

    jest.spyOn(resolver, 'resolve').mockImplementation((url: string) => {
      callCount++;
      // Initial check: antibot accepted, shouldTriggerHeuristic: true (403 in forceHeuristicOnCodes)
      if (callCount === 1) {
        return Promise.resolve(makeSuccessResult('example39.com', {
          antibotDetected: true,
          statusCode: 403,
          shouldTriggerHeuristic: true, // Real httpResolver sets this because 403 is in forceHeuristicOnCodes
        }));
      }
      // Heuristic candidate: example40 also behind antibot
      if (url.includes('example40.com')) {
        return Promise.resolve(makeSuccessResult('example40.com', {
          antibotDetected: true,
          statusCode: 403,
        }));
      }
      // example41 should NOT be checked (no force_search_ahead → stops after first)
      if (url.includes('example41.com')) {
        return Promise.resolve(makeSuccessResult('example41.com', {
          antibotDetected: true,
          statusCode: 403,
        }));
      }
      return Promise.resolve(makeFailResult('Not found'));
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Heuristic should have run (because 403 in forceHeuristicOnCodes triggers it)
    expect(callCount).toBeGreaterThan(1);
    // But without force_search_ahead, should NOT collect additional domains
    expect(results[0].additionalWorkingDomains?.length ?? 0).toBe(0);
  });

  test('9.2b accept_antibot WITHOUT force_search_ahead and 403 NOT in forceHeuristicOnCodes: heuristic does NOT run', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404, 500] }, // 403 NOT included
    });
    const site = makeSite({
      last_known_mirror: 'example39.com',
      accept_antibot: true,
      // force_search_ahead NOT set
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;

    jest.spyOn(resolver, 'resolve').mockImplementation(() => {
      callCount++;
      // Initial check: antibot accepted, shouldTriggerHeuristic: false (403 NOT in forceHeuristicOnCodes)
      return Promise.resolve(makeSuccessResult('example39.com', {
        antibotDetected: true,
        statusCode: 403,
        shouldTriggerHeuristic: false, // Real httpResolver: force_search_ahead=false, 403 not in forceHeuristicOnCodes
      }));
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Only initial check, no heuristic (neither force_search_ahead nor forceHeuristicOnCodes triggered)
    expect(callCount).toBe(1);
    expect(results[0].newHost).toBe('example39.com');
  });

  test('9.3 forceHeuristicOnCodes overrides skipOnAntibot when shouldTriggerHeuristic is true', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [403] },
    });
    const site = makeSite({
      last_known_mirror: 'testsite1.com',
      // accept_antibot NOT set — antibot means failure
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;

    jest.spyOn(resolver, 'resolve').mockImplementation((url: string) => {
      callCount++;
      if (callCount === 1) {
        // Initial check: antibot detected, NOT accepted → success: false
        // But 403 is in forceHeuristicOnCodes → shouldTriggerHeuristic: true
        return Promise.resolve(makeFailResult('Antibot detected: 403', {
          antibotDetected: true,
          statusCode: 403,
          shouldTriggerHeuristic: true,
          finalHost: 'testsite1.com',
        }));
      }
      // Heuristic candidate succeeds
      if (url.includes('testsite2.com')) {
        return Promise.resolve(makeSuccessResult('testsite2.com'));
      }
      return Promise.resolve(makeFailResult('Not found'));
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Heuristic should have run despite antibot + skipOnAntibot, because forceHeuristicOnCodes overrides
    expect(callCount).toBeGreaterThan(1);
    expect(results[0].newHost).toBe('testsite2.com');
    expect(results[0].shouldUpdate).toBe(true);
  });

  test('9.4 antibot without forceHeuristicOnCodes match: heuristic is skipped (skipOnAntibot=true)', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [404, 500] }, // 403 NOT included
    });
    const site = makeSite({
      last_known_mirror: 'testsite1.com',
      // accept_antibot NOT set
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;

    jest.spyOn(resolver, 'resolve').mockImplementation(() => {
      callCount++;
      // Antibot detected, 403 NOT in forceHeuristicOnCodes → shouldTriggerHeuristic: false
      return Promise.resolve(makeFailResult('Antibot detected: 403', {
        antibotDetected: true,
        statusCode: 403,
        shouldTriggerHeuristic: false,
        finalHost: 'testsite1.com',
      }));
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Only initial check, heuristic skipped due to skipOnAntibot + no forceHeuristic override
    expect(callCount).toBe(1);
    expect(results[0].shouldUpdate).toBe(false);
  });

  test('9.5 accept_antibot + probe_text: probe skipped for antibot response in Phase 1', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [403] },
    });
    const site = makeSite({
      last_known_mirror: 'example39.com',
      accept_antibot: true,
      probe_text: ['some unique text on the real site'],
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    jest.spyOn(resolver, 'resolve').mockImplementation(() => {
      // Cloudflare 403 — body does NOT contain probe_text
      return Promise.resolve(makeSuccessResult('example39.com', {
        antibotDetected: true,
        statusCode: 403,
        shouldTriggerHeuristic: true,
        finalBody: '<html><title>Just a moment...</title></html>',
      }));
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Phase 1: probe should be SKIPPED for antibot response (accept_antibot=true)
    // Site should still be accepted as working
    expect(results[0].shouldUpdate).toBe(true);
    expect(results[0].error).toBeUndefined();
  });

  test('9.6 accept_antibot + probe_text: probe checked normally for 200 response (no antibot)', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: false },
    });
    const site = makeSite({
      last_known_mirror: 'example39.com',
      accept_antibot: true,
      probe_text: ['some unique text on the real site'],
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    jest.spyOn(resolver, 'resolve').mockImplementation(() => {
      // Normal 200 response — body does NOT contain probe_text
      return Promise.resolve(makeSuccessResult('example39.com', {
        antibotDetected: false,
        statusCode: 200,
        finalBody: '<html><title>Wrong site</title></html>',
      }));
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Phase 1: probe should be CHECKED for non-antibot response, even with accept_antibot=true
    // Probe fails → shouldUpdate: false
    expect(results[0].shouldUpdate).toBe(false);
    expect(results[0].error).toBe('Content probe failed');
  });

  test('9.7 accept_antibot + probe_text + force_search_ahead: antibot candidates skip probe, 200 candidates check probe', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [403] },
    });
    const site = makeSite({
      last_known_mirror: 'example39.com',
      accept_antibot: true,
      force_search_ahead: true,
      probe_text: ['real site content'],
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    const checkedUrls: string[] = [];

    jest.spyOn(resolver, 'resolve').mockImplementation((url: string) => {
      callCount++;
      checkedUrls.push(url);
      // Initial: example39 behind antibot
      if (callCount === 1) {
        return Promise.resolve(makeSuccessResult('example39.com', {
          antibotDetected: true,
          statusCode: 403,
          shouldTriggerHeuristic: true,
          finalBody: '<html><title>Just a moment...</title></html>',
        }));
      }
      // Heuristic: example40 behind antibot (probe should be skipped)
      if (url.includes('example40.com')) {
        return Promise.resolve(makeSuccessResult('example40.com', {
          antibotDetected: true,
          statusCode: 403,
          finalBody: '<html><title>Just a moment...</title></html>',
        }));
      }
      // Heuristic: example41 responds 200 with correct content (probe should pass)
      if (url.includes('example41.com')) {
        return Promise.resolve(makeSuccessResult('example41.com', {
          antibotDetected: false,
          statusCode: 200,
          finalBody: '<html>real site content here</html>',
        }));
      }
      // Heuristic: example42 responds 200 with WRONG content (probe should fail → not collected)
      if (url.includes('example42.com')) {
        return Promise.resolve(makeSuccessResult('example42.com', {
          antibotDetected: false,
          statusCode: 200,
          finalBody: '<html>parked domain page</html>',
        }));
      }
      return Promise.resolve(makeFailResult('Not found'));
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Heuristic should have run
    expect(callCount).toBeGreaterThan(1);
    expect(results[0].shouldUpdate).toBe(true);
    // example40 (antibot, probe skipped) and example41 (200, probe passed) should be collected
    // example42 (200, probe failed) should NOT be collected
    const additional = results[0].additionalWorkingDomains ?? [];
    expect(additional).toContain('example41.com');
    expect(additional).not.toContain('example42.com');
  });
});

// ============================================================================
// 10. probe_text filtering in heuristic search
// ============================================================================
describe('10. probe_text filtering in heuristic search', () => {
  test('10.1 probe_text matches → heuristic succeeds', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: false, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({
      last_known_mirror: 'example12.com',
      probe_text: ['banner-container'],
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      if (url.includes('example13.com')) {
        return makeSuccessResult('example13.com', {
          finalBody: '<html><div class="banner-container">content</div></html>',
        });
      }
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].shouldUpdate).toBe(true);
    expect(results[0].newHost).toBe('example13.com');
  });

  test('10.2 probe_text does NOT match → heuristic skips candidate, continues search', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: false, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({
      last_known_mirror: 'example12.com',
      probe_text: ['banner-container'],
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      // example13 responds 200 but does NOT contain probe_text → should be skipped
      if (url.includes('example13.com')) {
        return makeSuccessResult('example13.com', {
          finalBody: '<html><div class="other-content">parked page</div></html>',
        });
      }
      // example14 responds 200 and DOES contain probe_text → should be accepted
      if (url.includes('example14.com')) {
        return makeSuccessResult('example14.com', {
          finalBody: '<html><div class="banner-container">real site</div></html>',
        });
      }
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].shouldUpdate).toBe(true);
    expect(results[0].newHost).toBe('example14.com');
  });

  test('10.3 probe_text does NOT match on any candidate → heuristic fails (no update)', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: false, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({
      last_known_mirror: 'example12.com',
      probe_text: ['aaaaaa-container'],
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      // All candidates respond 200 but none contain the probe_text
      if (url.includes('example') && url.includes('.com')) {
        return makeSuccessResult(new URL(url).hostname, {
          finalBody: '<html><div class="other-content">page without probe text</div></html>',
        });
      }
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].shouldUpdate).toBe(false);
    expect(results[0].newHost).toBe('');
  });

  test('10.4 probe_text with accept_antibot=true → probe skipped for antibot, domain accepted', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: false, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({
      last_known_mirror: 'www.example109.com',
      accept_antibot: true,
      probe_text: ['aaaaaa-container'],
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      // Antibot response (403) — body not available, but accept_antibot=true → probe skipped, domain accepted
      if (url.includes('example110')) {
        return makeSuccessResult(new URL(url).hostname, {
          statusCode: 403,
          antibotDetected: true,
          finalBody: undefined,
        });
      }
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // accept_antibot=true + antibot response → probe skipped, domain accepted
    expect(results[0].shouldUpdate).toBe(true);
    expect(results[0].newHost).toBe('www.example110.com');
  });

  test('10.5 no probe_text → all 200 candidates accepted (existing behavior unchanged)', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: false, forceHeuristicOnCodes: [404] },
    });
    const site = makeSite({
      last_known_mirror: 'example12.com',
      // no probe_text
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      if (url.includes('example13.com')) {
        return makeSuccessResult('example13.com', {
          finalBody: '<html>any content without special text</html>',
        });
      }
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].shouldUpdate).toBe(true);
    expect(results[0].newHost).toBe('example13.com');
  });

  test('10.6 probe_text bypasses skip_text: domain has skip_text but also probe_text → accepted', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 5, skipOnAntibot: false, forceHeuristicOnCodes: [404] },
      skip_text: ['parked-domain-marker'],
    });
    const site = makeSite({
      last_known_mirror: 'example12.com',
      probe_text: ['banner-container'],
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      if (callCount === 1) return makeFailResult('DNS failed', { shouldTriggerHeuristic: true });
      if (url.includes('example13.com')) {
        // Contains both skip_text and probe_text → httpResolver should pass it through (probe_text wins)
        return makeSuccessResult('example13.com', {
          finalBody: '<html><div class="banner-container">real site</div><span class="parked-domain-marker"></span></html>',
        });
      }
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    expect(results[0].shouldUpdate).toBe(true);
    expect(results[0].newHost).toBe('example13.com');
  });

  test('9.8 probe_text failure sets result.success=false and triggers heuristic', async () => {
    const config = makeConfig({
      dnsPreCheck: { enabled: false, timeout: 3000, retryOnce: false },
      heuristic: { enabled: true, maxAttempts: 3, skipOnAntibot: false, forceHeuristicOnCodes: [] },
    });
    const site = makeSite({
      last_known_mirror: 'example219tv.com',
      probe_text: ['const BASE_URL  = "https://example'],
    });
    const watchers = makeWatchers({ 'testsite': site });
    const logger = makeLogger();
    const resolver = new HttpResolver(config);

    mockedDnsLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 } as never);

    let callCount = 0;
    jest.spyOn(resolver, 'resolve').mockImplementation(async (url: string) => {
      callCount++;
      // Phase 1: Main domain returns 200 but probe_text NOT found
      if (callCount === 1) {
        return makeSuccessResult('example219tv.com', {
          antibotDetected: false,
          statusCode: 200,
          finalBody: '<html><title>Wrong site - no probe text here</title></html>',
        });
      }
      // Phase 2: Heuristic candidate example220tv.com has probe_text
      if (url.includes('example220tv.com')) {
        return makeSuccessResult('example220tv.com', {
          antibotDetected: false,
          statusCode: 200,
          finalBody: '<html><script>const BASE_URL  = "https://example";</script></html>',
        });
      }
      return makeFailResult('Not found');
    });

    const processor = new BatchProcessor(config, watchers, logger, resolver);
    const results = await processor.processAll();

    // Verify heuristic was triggered and found working domain
    expect(callCount).toBeGreaterThan(1); // Main + heuristic candidates
    expect(results[0].shouldUpdate).toBe(true);
    expect(results[0].newHost).toBe('example220tv.com');
  });
});
