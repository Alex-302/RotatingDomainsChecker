import { jest, describe, test, expect } from '@jest/globals';
import { HttpResolver } from '../src/httpResolver.js';
import type { Config } from '../src/types.js';

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    http: {
      timeout: 5000,
      resolveTimeout: 5000,
      heuristicTimeout: 3000,
      retries: 3,
      userAgent: 'TestAgent/1.0',
    },
    processing: {
      redirectDepth: 5,
    },
    antibot: {
      detectCodes: [403, 409],
      detectUrlPattern: '__cf_chl_tk',
    },
    heuristic: {
      forceHeuristicOnCodes: [404, 500],
      maxAttempts: 5,
    },
    ...overrides,
  } as unknown as Config;
}

// ============================================================================
// 6.6 Utilities
// ============================================================================

describe('6.6 HttpResolver utilities', () => {
  const config = makeConfig();
  const resolver = new HttpResolver(config);

  test('extractHostWithoutQuery("https://example.com/path?q=1") → example.com', () => {
    expect(resolver.extractHostWithoutQuery('https://example.com/path?q=1')).toBe('example.com');
  });

  test('normalizeAndExtractHost("example.com") → example.com (adds https://)', () => {
    expect(resolver.normalizeAndExtractHost('example.com')).toBe('example.com');
  });

  test('normalizeAndExtractHost("https://example.com") → example.com', () => {
    expect(resolver.normalizeAndExtractHost('https://example.com')).toBe('example.com');
  });

  test('extractPathWithoutQuery("https://example.com/path?q=1") → /path', () => {
    expect(resolver.extractPathWithoutQuery('https://example.com/path?q=1')).toBe('/path');
  });

  test('extractHostWithoutQuery with invalid URL → empty string', () => {
    expect(resolver.extractHostWithoutQuery('not-a-url')).toBe('');
  });

  test('extractPathWithoutQuery with invalid URL → empty string', () => {
    expect(resolver.extractPathWithoutQuery('not-a-url')).toBe('');
  });
});

describe('6.6 formatRedirectChain', () => {
  const config = makeConfig();
  const resolver = new HttpResolver(config);

  test('<= 3 elements → show all', () => {
    const chain = [
      { url: 'https://a.com', statusCode: 301, location: 'https://b.com' },
      { url: 'https://b.com', statusCode: 200 },
    ];
    const result = resolver.formatRedirectChain(chain);
    expect(result).toContain('https://a.com');
    expect(result).toContain('https://b.com');
    expect(result).not.toContain('redirects');
  });

  test('> 3 elements → first + "... (N redirects) ..." + last', () => {
    const chain = [
      { url: 'https://a.com', statusCode: 301 },
      { url: 'https://b.com', statusCode: 301 },
      { url: 'https://c.com', statusCode: 301 },
      { url: 'https://d.com', statusCode: 200 },
    ];
    const result = resolver.formatRedirectChain(chain);
    expect(result).toContain('https://a.com');
    expect(result).toContain('https://d.com');
    expect(result).toContain('2 redirects');
  });

  test('empty chain → empty string', () => {
    expect(resolver.formatRedirectChain([])).toBe('');
  });
});

// ============================================================================
// 6.7 abortAllRequests
// ============================================================================

describe('6.7 abortAllRequests', () => {
  test('abortAllRequests does not throw on empty set', () => {
    const config = makeConfig();
    const resolver = new HttpResolver(config);
    expect(() => resolver.abortAllRequests()).not.toThrow();
  });

  test('repeated call does not throw', () => {
    const config = makeConfig();
    const resolver = new HttpResolver(config);
    resolver.abortAllRequests();
    expect(() => resolver.abortAllRequests()).not.toThrow();
  });
});

// ============================================================================
// 6.8 containsSkipText
// ============================================================================

describe('6.8 containsSkipText', () => {
  test('returns matched phrase when body contains skip_text', () => {
    const config = makeConfig({ skip_text: ['This domain is parked', 'Domain for sale'] });
    const resolver = new HttpResolver(config);
    expect(resolver.containsSkipText('Welcome! This domain is parked by the owner.')).toBe('This domain is parked');
  });

  test('returns second phrase when first does not match', () => {
    const config = makeConfig({ skip_text: ['This domain is parked', 'Domain for sale'] });
    const resolver = new HttpResolver(config);
    expect(resolver.containsSkipText('Domain for sale - contact us')).toBe('Domain for sale');
  });

  test('returns undefined when body does not contain any skip_text', () => {
    const config = makeConfig({ skip_text: ['This domain is parked', 'Domain for sale'] });
    const resolver = new HttpResolver(config);
    expect(resolver.containsSkipText('<html>Normal website content</html>')).toBeUndefined();
  });

  test('returns undefined when body is undefined', () => {
    const config = makeConfig({ skip_text: ['This domain is parked'] });
    const resolver = new HttpResolver(config);
    expect(resolver.containsSkipText(undefined)).toBeUndefined();
  });

  test('returns undefined when body is empty string', () => {
    const config = makeConfig({ skip_text: ['This domain is parked'] });
    const resolver = new HttpResolver(config);
    expect(resolver.containsSkipText('')).toBeUndefined();
  });

  test('returns undefined when skip_text is not configured', () => {
    const config = makeConfig();
    const resolver = new HttpResolver(config);
    expect(resolver.containsSkipText('This domain is parked')).toBeUndefined();
  });

  test('returns undefined when skip_text is empty array', () => {
    const config = makeConfig({ skip_text: [] });
    const resolver = new HttpResolver(config);
    expect(resolver.containsSkipText('This domain is parked')).toBeUndefined();
  });

  test('is case-sensitive', () => {
    const config = makeConfig({ skip_text: ['This domain is parked'] });
    const resolver = new HttpResolver(config);
    expect(resolver.containsSkipText('THIS DOMAIN IS PARKED')).toBeUndefined();
    expect(resolver.containsSkipText('This domain is parked')).toBe('This domain is parked');
  });
});

// ============================================================================
// 6.9 Integration test: containsSkipText with real config.yml
// ============================================================================

describe('6.9 containsSkipText with real config.yml', () => {
  test('skip_text exists in config.yml and all phrases work', async () => {
    const { loadConfig } = await import('../src/config.js');
    const config = await loadConfig();

    expect(config.skip_text).toBeDefined();
    expect(Array.isArray(config.skip_text)).toBe(true);
    expect(config.skip_text!.length).toBeGreaterThan(0);

    const resolver = new HttpResolver(config);

    // Every phrase from real config.yml must be detected
    for (const phrase of config.skip_text!) {
      const testContent = `<html><body>Some content ${phrase} more content</body></html>`;
      const matched = resolver.containsSkipText(testContent);
      expect(matched).toBe(phrase);
    }
  });

  test('normal website content does not trigger skip_text', async () => {
    const { loadConfig } = await import('../src/config.js');
    const config = await loadConfig();
    const resolver = new HttpResolver(config);

    const normalContent = '<html><body><h1>Welcome to our streaming site</h1><p>Watch movies online</p></body></html>';
    expect(resolver.containsSkipText(normalContent)).toBeUndefined();
  });
});

// ============================================================================
// 6.10 containsSkipText with skip_text_allow
// ============================================================================

describe('6.10 containsSkipText with skip_text_allow', () => {
  test('skip_text_allow excludes exact match from check', () => {
    const config = makeConfig({ skip_text: ['Redirecting...', 'This domain is parked', 'Domain expired'] });
    const resolver = new HttpResolver(config);

    // Without skip_text_allow, "Redirecting..." is detected
    expect(resolver.containsSkipText('Redirecting... please wait')).toBe('Redirecting...');

    // With skip_text_allow, "Redirecting..." is excluded
    expect(resolver.containsSkipText('Redirecting... please wait', ['Redirecting...'])).toBeUndefined();
  });

  test('skip_text_allow allows one phrase but others still work', () => {
    const config = makeConfig({ skip_text: ['Redirecting...', 'This domain is parked', 'Domain expired'] });
    const resolver = new HttpResolver(config);

    // "Redirecting..." is allowed, but "This domain is parked" is not
    expect(resolver.containsSkipText('This domain is parked', ['Redirecting...'])).toBe('This domain is parked');
  });

  test('skip_text_allow with multiple allowed phrases', () => {
    const config = makeConfig({ skip_text: ['Redirecting...', 'This domain is parked', 'Domain expired'] });
    const resolver = new HttpResolver(config);

    // Both "Redirecting..." and "This domain is parked" are allowed
    const allowed = ['Redirecting...', 'This domain is parked'];
    expect(resolver.containsSkipText('Redirecting... please wait', allowed)).toBeUndefined();
    expect(resolver.containsSkipText('This domain is parked', allowed)).toBeUndefined();
    // But "Domain expired" is still detected
    expect(resolver.containsSkipText('Domain expired notice', allowed)).toBe('Domain expired');
  });

  test('skip_text_allow with empty array behaves like no allow', () => {
    const config = makeConfig({ skip_text: ['Redirecting...'] });
    const resolver = new HttpResolver(config);

    expect(resolver.containsSkipText('Redirecting...', [])).toBe('Redirecting...');
  });

  test('skip_text_allow requires exact phrase match', () => {
    const config = makeConfig({ skip_text: ['Redirecting...'] });
    const resolver = new HttpResolver(config);

    // Allow "Redirect..." (not exact match) — should NOT exclude "Redirecting..."
    expect(resolver.containsSkipText('Redirecting...', ['Redirect...'])).toBe('Redirecting...');
  });
});

// ============================================================================
// 6.9b Integration: JS redirect chain (shortlink.test → cdn-redirect.test → final domain)
// ============================================================================

describe('6.9b resolve() follows JS redirect chain (mocked)', () => {
  function makeFakeResponse(status: number, body: string, headers: Record<string, string> = {}): Response {
    return {
      status,
      headers: {
        get: (name: string) => headers[name.toLowerCase()] ?? null,
      },
      text: async () => body,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response;
  }

  // Fictional domains used throughout — no real network calls made
  // Simulates: shortlink.test (JS location.replace) → cdn-redirect.test (meta refresh) → target7.test (200)
  test('JS location.replace → meta refresh → final domain (200)', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 10, parallel: 1 },
      skip_text: [],
    });
    const resolver = new HttpResolver(config);

    const shortlinkBody = '<html><head><title>Redirecting...</title></head><body><script>location.replace("https://cdn-redirect.test/page.html")</script></body></html>';
    const cdnBody = '<html><head><meta http-equiv="refresh" content="0;URL=https://target7.test/"></head></html>';
    const finalBody = '<html><body><h1>Welcome</h1></body></html>';

    const fetchSpy = jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValueOnce(makeFakeResponse(200, shortlinkBody, { 'content-type': 'text/html' }))
      .mockResolvedValueOnce(makeFakeResponse(200, cdnBody, { 'content-type': 'text/html' }))
      .mockResolvedValueOnce(makeFakeResponse(200, finalBody, { 'content-type': 'text/html' }));

    const result = await resolver.resolve('https://shortlink.test/abc123');

    expect(result.success).toBe(true);
    expect(result.finalHost).toBe('target7.test');
    expect(result.redirectChain).toHaveLength(3);
    expect(result.redirectChain[0].url).toBe('https://shortlink.test/abc123');
    expect(result.redirectChain[0].location).toBe('https://cdn-redirect.test/page.html');
    expect(result.redirectChain[1].url).toBe('https://cdn-redirect.test/page.html');
    expect(result.redirectChain[1].location).toBe('https://target7.test/');
    expect(result.redirectChain[2].url).toBe('https://target7.test/');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  // Simulates: shortlink.test (JS redirect) → parked.test (200 but skip_text matches)
  test('JS redirect to parked domain → skip_text stops chain, triggers heuristic', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 10, parallel: 1 },
      skip_text: ['This domain is for sale'],
    });
    const resolver = new HttpResolver(config);

    const shortlinkBody = '<script>location.replace("https://parked.test/landing")</script>';
    const parkedBody = '<html><body>This domain is for sale - contact us</body></html>';

    jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValueOnce(makeFakeResponse(200, shortlinkBody, { 'content-type': 'text/html' }))
      .mockResolvedValueOnce(makeFakeResponse(200, parkedBody, { 'content-type': 'text/html' }));

    const result = await resolver.resolve('https://shortlink.test/abc123');

    expect(result.success).toBe(false);
    expect(result.skippedByText).toBe('This domain is for sale');
    expect(result.shouldTriggerHeuristic).toBe(true);
  });

  // Simulates infinite JS redirect loop — depth limit must stop it
  test('JS redirect loop → stopped by redirectDepth limit', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 2, parallel: 1 },
      skip_text: [],
    });
    const resolver = new HttpResolver(config);

    jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValue(makeFakeResponse(200, '<script>location.replace("https://loop.test/")</script>', { 'content-type': 'text/html' }));

    const result = await resolver.resolve('https://start.test/');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Exceeded max redirect depth');
  });
});

// ============================================================================
// 6.10 extractJsRedirect
// ============================================================================

describe('6.10 extractJsRedirect', () => {
  const config = makeConfig();
  const resolver = new HttpResolver(config);
  const base = 'https://shortlink.test/abc123';

  test('meta refresh with URL= → returns { url, isJsRedirect: false }', () => {
    const body = '<html><head><meta http-equiv="refresh" content="0;URL=https://example11.com/"></head></html>';
    const result = resolver.extractJsRedirect(body, base);
    expect(result).toEqual({ url: 'https://example11.com/', isJsRedirect: false });
  });

  test('meta refresh with url= (lowercase) → returns { url, isJsRedirect: false }', () => {
    const body = '<meta http-equiv="refresh" content="0;url=https://example.com/">';
    const result = resolver.extractJsRedirect(body, base);
    expect(result).toEqual({ url: 'https://example.com/', isJsRedirect: false });
  });

  test('location.replace("url") → returns { url, isJsRedirect: true }', () => {
    const body = '<script>location.replace("https://cdn-redirect.test/redirect.html")</script>';
    const result = resolver.extractJsRedirect(body, base);
    expect(result).toEqual({ url: 'https://cdn-redirect.test/redirect.html', isJsRedirect: true });
  });

  test("location.replace('url') single quotes → returns { url, isJsRedirect: true }", () => {
    const body = "<script>location.replace('https://example.com/page')</script>";
    const result = resolver.extractJsRedirect(body, base);
    expect(result).toEqual({ url: 'https://example.com/page', isJsRedirect: true });
  });

  test('window.location.href = "url" → returns { url, isJsRedirect: true }', () => {
    const body = '<script>window.location.href = "https://example11.com/"</script>';
    const result = resolver.extractJsRedirect(body, base);
    expect(result).toEqual({ url: 'https://example11.com/', isJsRedirect: true });
  });

  test('window.location = "url" → returns { url, isJsRedirect: true }', () => {
    const body = '<script>window.location = "https://example.com/"</script>';
    const result = resolver.extractJsRedirect(body, base);
    expect(result).toEqual({ url: 'https://example.com/', isJsRedirect: true });
  });

  test('location.href = "url" (without window.) → returns { url, isJsRedirect: true }', () => {
    const body = '<script>location.href = "https://example.com/"</script>';
    const result = resolver.extractJsRedirect(body, base);
    expect(result).toEqual({ url: 'https://example.com/', isJsRedirect: true });
  });

  test('relative URL in meta refresh → resolved against baseUrl', () => {
    const body = '<meta http-equiv="refresh" content="0;URL=/new-path">';
    const result = resolver.extractJsRedirect(body, 'https://example.com/old');
    expect(result).toEqual({ url: 'https://example.com/new-path', isJsRedirect: false });
  });

  test('no redirect in body → returns undefined', () => {
    const body = '<html><body><h1>Normal page</h1></body></html>';
    expect(resolver.extractJsRedirect(body, base)).toBeUndefined();
  });

  test('undefined body → returns undefined', () => {
    expect(resolver.extractJsRedirect(undefined, base)).toBeUndefined();
  });

  test('parked domain JS redirect (window.location) → detected before following', () => {
    // Parked domain uses JS redirect — skip_text should catch it first in resolve()
    // This test verifies extractJsRedirect still extracts the URL correctly
    const body = '<html><body>Buy this domain! <script>window.location = "https://parklogic.com/buy"</script></body></html>';
    const result = resolver.extractJsRedirect(body, base);
    expect(result).toEqual({ url: 'https://parklogic.com/buy', isJsRedirect: true });
  });

  test('minified JS with location.replace → returns URL', () => {
    // Shortener-style minified script
    const body = '<script>(function(){location.replace("https://cdn-redirect.test/assets/inattv.html")})()</script>';
    const result = resolver.extractJsRedirect(body, base);
    expect(result).toEqual({ url: 'https://cdn-redirect.test/assets/inattv.html', isJsRedirect: true });
  });
});

// ============================================================================
// 6.11 probe_text priority over skip_text (overlapping patterns)
// ============================================================================

describe('6.11 probe_text priority over skip_text (isolated mocks)', () => {
  // Test constants - completely isolated from real sites
  const TEST_SKIP_PHRASE = 'TEST_SKIP_PHRASE_12345';
  const TEST_PROBE_PHRASE = 'TEST_PROBE_PHRASE_67890';
  const TEST_PROBE_PHRASE_2 = 'TEST_PROBE_PHRASE_ABCDE';

  function makeFakeResponse(status: number, body: string, headers: Record<string, string> = {}): Response {
    return {
      status,
      headers: {
        get: (name: string) => headers[name.toLowerCase()] ?? null,
      },
      text: async () => body,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response;
  }

  test('skip_text present but probe_text matches → success (not skipped)', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 5, parallel: 1 },
      skip_text: [TEST_SKIP_PHRASE],
    });
    const resolver = new HttpResolver(config);

    // Working site body: has both skip phrase AND probe phrase
    const workingSiteBody = `<html><body>
      <script>function ${TEST_PROBE_PHRASE}() { /* video player */ }</script>
      <div id="player">Video content</div>
      <footer>Powered by ${TEST_SKIP_PHRASE}</footer>
    </body></html>`;

    jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValueOnce(makeFakeResponse(200, workingSiteBody, { 'content-type': 'text/html' }));

    const probeText = [TEST_PROBE_PHRASE];
    const result = await resolver.resolve('https://mock-working-site.test/', false, undefined, probeText);

    expect(result.success).toBe(true);
    expect(result.skippedByText).toBeUndefined();
    expect(result.finalHost).toBe('mock-working-site.test');
  });

  test('skip_text present and probe_text does NOT match → skipped', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 5, parallel: 1 },
      skip_text: [TEST_SKIP_PHRASE],
    });
    const resolver = new HttpResolver(config);

    // Landing page body: has skip phrase but NO probe phrase
    const landingPageBody = `<html><body>
      <h1>MOCK LANDING PAGE</h1>
      <div>Mock bonus content</div>
      <footer>Powered by ${TEST_SKIP_PHRASE}</footer>
    </body></html>`;

    jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValueOnce(makeFakeResponse(200, landingPageBody, { 'content-type': 'text/html' }));

    const probeText = [TEST_PROBE_PHRASE];
    const result = await resolver.resolve('https://mock-landing-page.test/', false, undefined, probeText);

    expect(result.success).toBe(false);
    expect(result.skippedByText).toBe(TEST_SKIP_PHRASE);
    expect(result.shouldTriggerHeuristic).toBe(true);
  });

  test('no skip_text present, probe_text matches → success', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 5, parallel: 1 },
      skip_text: [TEST_SKIP_PHRASE],
    });
    const resolver = new HttpResolver(config);

    // Clean working site: has probe phrase but NO skip phrase
    const cleanWorkingBody = `<html><body>
      <script>function ${TEST_PROBE_PHRASE}() { /* video player */ }</script>
      <div id="player">Video content</div>
      <footer>Normal footer</footer>
    </body></html>`;

    jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValueOnce(makeFakeResponse(200, cleanWorkingBody, { 'content-type': 'text/html' }));

    const probeText = [TEST_PROBE_PHRASE];
    const result = await resolver.resolve('https://mock-clean-site.test/', false, undefined, probeText);

    expect(result.success).toBe(true);
    expect(result.skippedByText).toBeUndefined();
    expect(result.finalHost).toBe('mock-clean-site.test');
  });

  test('no probe_text provided, skip_text present → skipped (backward compatibility)', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 5, parallel: 1 },
      skip_text: [TEST_SKIP_PHRASE],
    });
    const resolver = new HttpResolver(config);

    const bodyWithSkipText = `<html><body>Content with ${TEST_SKIP_PHRASE} link</body></html>`;

    jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValueOnce(makeFakeResponse(200, bodyWithSkipText, { 'content-type': 'text/html' }));

    // No probe_text provided - should behave as before (skip)
    const result = await resolver.resolve('https://mock-test-site.test/', false, undefined, undefined);

    expect(result.success).toBe(false);
    expect(result.skippedByText).toBe(TEST_SKIP_PHRASE);
  });

  test('probe_text provided but empty array → skip_text works normally', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 5, parallel: 1 },
      skip_text: [TEST_SKIP_PHRASE],
    });
    const resolver = new HttpResolver(config);

    const bodyWithSkipText = `<html><body>Content with ${TEST_SKIP_PHRASE} link</body></html>`;

    jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValueOnce(makeFakeResponse(200, bodyWithSkipText, { 'content-type': 'text/html' }));

    const result = await resolver.resolve('https://mock-empty-probe.test/', false, undefined, []);

    expect(result.success).toBe(false);
    expect(result.skippedByText).toBe(TEST_SKIP_PHRASE);
  });

  test('multiple probe_text phrases, all must match to override skip_text', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 5, parallel: 1 },
      skip_text: [TEST_SKIP_PHRASE],
    });
    const resolver = new HttpResolver(config);

    // Body has only one of two required probe phrases
    const bodyWithOneProbe = `<html><body>
      <script>function ${TEST_PROBE_PHRASE}() {}</script>
      <footer>${TEST_SKIP_PHRASE}</footer>
    </body></html>`;

    jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValueOnce(makeFakeResponse(200, bodyWithOneProbe, { 'content-type': 'text/html' }));

    // Two probe phrases required, but body only has one
    const probeText = [TEST_PROBE_PHRASE, TEST_PROBE_PHRASE_2];
    const result = await resolver.resolve('https://mock-partial-probe.test/', false, undefined, probeText);

    expect(result.success).toBe(false);
    expect(result.skippedByText).toBe(TEST_SKIP_PHRASE);
  });

  test('multiple probe_text phrases, all match → success (overrides skip_text)', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 5, parallel: 1 },
      skip_text: [TEST_SKIP_PHRASE],
    });
    const resolver = new HttpResolver(config);

    // Body has both required probe phrases AND skip phrase
    const bodyWithAllProbes = `<html><body>
      <script>function ${TEST_PROBE_PHRASE}() {}</script>
      <div id="${TEST_PROBE_PHRASE_2}">Content</div>
      <footer>${TEST_SKIP_PHRASE}</footer>
    </body></html>`;

    jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValueOnce(makeFakeResponse(200, bodyWithAllProbes, { 'content-type': 'text/html' }));

    const probeText = [TEST_PROBE_PHRASE, TEST_PROBE_PHRASE_2];
    const result = await resolver.resolve('https://mock-full-probe.test/', false, undefined, probeText);

    expect(result.success).toBe(true);
    expect(result.skippedByText).toBeUndefined();
    expect(result.finalHost).toBe('mock-full-probe.test');
  });
});

// ============================================================================
// 6.12 Early exit on probe_text + JS redirect
// ============================================================================

describe('6.12 Early exit on probe_text + JS redirect', () => {
  function makeFakeResponse(status: number, body: string, headers: Record<string, string> = {}): Response {
    return {
      status,
      headers: {
        get: (name: string) => headers[name.toLowerCase()] ?? null,
      },
      text: async () => body,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response;
  }

  const TEST_PROBE = 'TEST_PROBE_VIDEO_PLAYER';

  test('probe_text matched + JS redirect (location.replace) → early exit on current domain', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 10, parallel: 1 },
      skip_text: [],
    });
    const resolver = new HttpResolver(config);

    // Working domain with probe_text that JS-redirects to a decoy
    const workingDomainBody = `<html><body>
      <div id="${TEST_PROBE}">Live stream</div>
      <script>location.replace("https://decoy.test/fake")</script>
    </body></html>`;

    jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValueOnce(makeFakeResponse(200, workingDomainBody, { 'content-type': 'text/html' }));

    const result = await resolver.resolve(
      'https://example220tv.test/', false, undefined, [TEST_PROBE]
    );

    expect(result.success).toBe(true);
    expect(result.finalHost).toBe('example220tv.test');
    expect(result.probeTextMatchedBeforeJsRedirect).toBe(true);
    expect(result.shouldTriggerHeuristic).toBe(false); // No force_search_ahead
    // Verify we only made 1 request (didn't follow JS redirect)
    expect((resolver as any).fetchWithRetry).toHaveBeenCalledTimes(1);
  });

  test('probe_text matched + meta refresh → continue following (no early exit)', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 10, parallel: 1 },
      skip_text: [],
    });
    const resolver = new HttpResolver(config);

    // Domain with probe_text that meta-refreshes to another domain
    const intermediateBody = `<html><body>
      <div id="${TEST_PROBE}">Content</div>
      <meta http-equiv="refresh" content="0;URL=https://final.test/">
    </body></html>`;
    const finalBody = '<html><body>Final page</body></html>';

    jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValueOnce(makeFakeResponse(200, intermediateBody, { 'content-type': 'text/html' }))
      .mockResolvedValueOnce(makeFakeResponse(200, finalBody, { 'content-type': 'text/html' }));

    const result = await resolver.resolve(
      'https://example220tv.test/', false, undefined, [TEST_PROBE]
    );

    expect(result.success).toBe(true);
    expect(result.finalHost).toBe('final.test');
    expect(result.probeTextMatchedBeforeJsRedirect).toBeUndefined();
    // Meta refresh was followed (2 requests)
    expect((resolver as any).fetchWithRetry).toHaveBeenCalledTimes(2);
  });

  test('probe_text NOT matched + JS redirect → continue following (old behavior)', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 10, parallel: 1 },
      skip_text: [],
    });
    const resolver = new HttpResolver(config);

    // Domain without probe_text that JS-redirects
    const noProbeBody = `<html><body>
      <div>No probe here</div>
      <script>location.replace("https://redirected.test/")</script>
    </body></html>`;
    const redirectedBody = '<html><body>Redirected page</body></html>';

    jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValueOnce(makeFakeResponse(200, noProbeBody, { 'content-type': 'text/html' }))
      .mockResolvedValueOnce(makeFakeResponse(200, redirectedBody, { 'content-type': 'text/html' }));

    const result = await resolver.resolve(
      'https://example220tv.test/', false, undefined, [TEST_PROBE]
    );

    expect(result.success).toBe(true);
    expect(result.finalHost).toBe('redirected.test');
    expect(result.probeTextMatchedBeforeJsRedirect).toBeUndefined();
    // JS redirect was followed (2 requests)
    expect((resolver as any).fetchWithRetry).toHaveBeenCalledTimes(2);
  });

  test('probe_text not configured + JS redirect → continue following (old behavior)', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 10, parallel: 1 },
      skip_text: [],
    });
    const resolver = new HttpResolver(config);

    const jsRedirectBody = `<html><body>
      <script>location.replace("https://redirected.test/")</script>
    </body></html>`;
    const redirectedBody = '<html><body>Redirected page</body></html>';

    jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValueOnce(makeFakeResponse(200, jsRedirectBody, { 'content-type': 'text/html' }))
      .mockResolvedValueOnce(makeFakeResponse(200, redirectedBody, { 'content-type': 'text/html' }));

    // No probe_text provided
    const result = await resolver.resolve('https://example220tv.test/');

    expect(result.success).toBe(true);
    expect(result.finalHost).toBe('redirected.test');
    expect(result.probeTextMatchedBeforeJsRedirect).toBeUndefined();
  });

  test('probe_text matched + JS redirect + force_search_ahead → shouldTriggerHeuristic = true', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 10, parallel: 1 },
      skip_text: [],
    });
    const resolver = new HttpResolver(config);

    const workingDomainBody = `<html><body>
      <div id="${TEST_PROBE}">Live stream</div>
      <script>location.replace("https://decoy.test/fake")</script>
    </body></html>`;

    jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValueOnce(makeFakeResponse(200, workingDomainBody, { 'content-type': 'text/html' }));

    const site = { last_known_mirror: 'example220tv.test', force_search_ahead: true };
    const result = await resolver.resolve(
      'https://example220tv.test/', false, site, [TEST_PROBE]
    );

    expect(result.success).toBe(true);
    expect(result.finalHost).toBe('example220tv.test');
    expect(result.probeTextMatchedBeforeJsRedirect).toBe(true);
    expect(result.shouldTriggerHeuristic).toBe(true); // force_search_ahead triggers heuristic
  });

  test('probe_text matched + JS redirect + NO force_search_ahead → shouldTriggerHeuristic = false', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 10, parallel: 1 },
      skip_text: [],
    });
    const resolver = new HttpResolver(config);

    const workingDomainBody = `<html><body>
      <div id="${TEST_PROBE}">Live stream</div>
      <script>location.replace("https://decoy.test/fake")</script>
    </body></html>`;

    jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValueOnce(makeFakeResponse(200, workingDomainBody, { 'content-type': 'text/html' }));

    const site = { last_known_mirror: 'example220tv.test', force_search_ahead: false };
    const result = await resolver.resolve(
      'https://example220tv.test/', false, site, [TEST_PROBE]
    );

    expect(result.success).toBe(true);
    expect(result.finalHost).toBe('example220tv.test');
    expect(result.probeTextMatchedBeforeJsRedirect).toBe(true);
    expect(result.shouldTriggerHeuristic).toBe(false);
  });

  test('JS redirect chain: probe on first domain, early exit preserves chain location', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 10, parallel: 1 },
      skip_text: [],
    });
    const resolver = new HttpResolver(config);

    const workingDomainBody = `<html><body>
      <div id="${TEST_PROBE}">Live stream</div>
      <script>location.replace("https://decoy.test/fake")</script>
    </body></html>`;

    jest.spyOn(resolver as any, 'fetchWithRetry')
      .mockResolvedValueOnce(makeFakeResponse(200, workingDomainBody, { 'content-type': 'text/html' }));

    const result = await resolver.resolve(
      'https://example220tv.test/', false, { last_known_mirror: 'example220tv.test', force_search_ahead: true }, [TEST_PROBE]
    );

    expect(result.success).toBe(true);
    expect(result.redirectChain).toHaveLength(1);
    expect(result.redirectChain[0].url).toBe('https://example220tv.test/');
    // Chain entry should include the JS redirect URL for visibility
    expect(result.redirectChain[0].location).toBe('https://decoy.test/fake');
  });

  test('HTTP redirect → probe_text matched on final → JS redirect → early exit', async () => {
    const config = makeConfig({
      processing: { redirectDepth: 10, parallel: 1 },
      skip_text: [],
    });
    const resolver = new HttpResolver(config);

    // First: HTTP redirect from shortlink
    const shortlinkBody = '';
    // Second: working domain with probe_text + JS redirect to decoy
    const workingDomainBody = `<html><body>
      <div id="${TEST_PROBE}">Live stream</div>
      <script>window.location.href = "https://decoy.test/fake"</script>
    </body></html>`;

    jest.spyOn(resolver as any, 'fetchWithRetry')
      // HTTP 301 redirect
      .mockResolvedValueOnce({
        status: 301,
        headers: { get: (n: string) => n.toLowerCase() === 'location' ? 'https://example220tv.test/' : null },
        arrayBuffer: async () => new ArrayBuffer(0),
      } as unknown as Response)
      // 200 with probe_text + JS redirect
      .mockResolvedValueOnce(makeFakeResponse(200, workingDomainBody, { 'content-type': 'text/html' }));

    const result = await resolver.resolve(
      'https://shortlink.test/abc', false, { last_known_mirror: 'shortlink.test', force_search_ahead: true }, [TEST_PROBE]
    );

    expect(result.success).toBe(true);
    expect(result.finalHost).toBe('example220tv.test');
    expect(result.probeTextMatchedBeforeJsRedirect).toBe(true);
    expect(result.shouldTriggerHeuristic).toBe(true);
    expect(result.redirectChain).toHaveLength(2);
  });
});
