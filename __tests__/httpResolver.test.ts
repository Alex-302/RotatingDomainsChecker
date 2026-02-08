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
