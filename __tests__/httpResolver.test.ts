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
    const config = loadConfig();

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
    const config = loadConfig();
    const resolver = new HttpResolver(config);

    const normalContent = '<html><body><h1>Welcome to our streaming site</h1><p>Watch movies online</p></body></html>';
    expect(resolver.containsSkipText(normalContent)).toBeUndefined();
  });
});

// ============================================================================
// 6.9b Integration: JS redirect chain (t.co → githack → final domain)
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
  const base = 'https://t.co/sRxEaOU2pj';

  test('meta refresh with URL= → returns absolute URL', () => {
    const body = '<html><head><meta http-equiv="refresh" content="0;URL=https://hepbetspor11.cfd/"></head></html>';
    expect(resolver.extractJsRedirect(body, base)).toBe('https://hepbetspor11.cfd/');
  });

  test('meta refresh with url= (lowercase) → returns absolute URL', () => {
    const body = '<meta http-equiv="refresh" content="0;url=https://example.com/">';
    expect(resolver.extractJsRedirect(body, base)).toBe('https://example.com/');
  });

  test('location.replace("url") → returns absolute URL', () => {
    const body = '<script>location.replace("https://raw.githack.com/redirect.html")</script>';
    expect(resolver.extractJsRedirect(body, base)).toBe('https://raw.githack.com/redirect.html');
  });

  test("location.replace('url') single quotes → returns absolute URL", () => {
    const body = "<script>location.replace('https://example.com/page')</script>";
    expect(resolver.extractJsRedirect(body, base)).toBe('https://example.com/page');
  });

  test('window.location.href = "url" → returns absolute URL', () => {
    const body = '<script>window.location.href = "https://hepbetspor11.cfd/"</script>';
    expect(resolver.extractJsRedirect(body, base)).toBe('https://hepbetspor11.cfd/');
  });

  test('window.location = "url" → returns absolute URL', () => {
    const body = '<script>window.location = "https://example.com/"</script>';
    expect(resolver.extractJsRedirect(body, base)).toBe('https://example.com/');
  });

  test('location.href = "url" (without window.) → returns absolute URL', () => {
    const body = '<script>location.href = "https://example.com/"</script>';
    expect(resolver.extractJsRedirect(body, base)).toBe('https://example.com/');
  });

  test('relative URL in meta refresh → resolved against baseUrl', () => {
    const body = '<meta http-equiv="refresh" content="0;URL=/new-path">';
    expect(resolver.extractJsRedirect(body, 'https://example.com/old')).toBe('https://example.com/new-path');
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
    expect(resolver.extractJsRedirect(body, base)).toBe('https://parklogic.com/buy');
  });

  test('minified JS with location.replace → returns URL', () => {
    // Real-world t.co style: minified script
    const body = '<script>(function(){location.replace("https://raw.githack.com/eniyiyayinci/redirect-cdn/main/inattv.html")})()</script>';
    expect(resolver.extractJsRedirect(body, base)).toBe('https://raw.githack.com/eniyiyayinci/redirect-cdn/main/inattv.html');
  });
});
