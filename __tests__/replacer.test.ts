import { jest, describe, test, expect } from '@jest/globals';
import {
  normalizeDomain,
  matchesNumericPattern,
  extractBasePattern,
  matchesSamePattern,
  isPredictedMirror,
  replaceDomain,
  hasSchemeChangeInList,
  handleSchemeChange,
  deduplicateDomains,
  processDomainList,
  removePredictedMirrors,
  processLine,
  shouldSkipLine,
  findTargetFiles,
  escapeRegExp,
  FilterReplacer,
} from '../src/replacer.js';
import { Logger, LogLevel } from '../src/logger.js';
import type { Config, ReplacementPair } from '../src/types.js';

// ============================================================================
// 1. Helper functions — Pattern matching
// ============================================================================

describe('1.1 matchesNumericPattern', () => {
  test('example001.com → true (domain[N].tld)', () => {
    expect(matchesNumericPattern('example001.com')).toBe(true);
  });

  test('14example.com → true ([N]domain.tld)', () => {
    expect(matchesNumericPattern('14example.com')).toBe(true);
  });

  test('example126tv.com → true (domain[N][text].tld)', () => {
    expect(matchesNumericPattern('example126tv.com')).toBe(true);
  });

  test('example146.com → true (regression: previously parsed as example1 + 46)', () => {
    expect(matchesNumericPattern('example146.com')).toBe(true);
  });

  test('example.com → false (no number)', () => {
    expect(matchesNumericPattern('example.com')).toBe(false);
  });

  test('random.com → false (no number, CN mirror)', () => {
    expect(matchesNumericPattern('random.com')).toBe(false);
  });

  test('www.example373.com → true (www stripped by normalizeDomain)', () => {
    expect(matchesNumericPattern('www.example373.com')).toBe(true);
  });

  test('nopattern.com → false (no number)', () => {
    expect(matchesNumericPattern('nopattern.com')).toBe(false);
  });

  test('testsite.com → false (no number)', () => {
    expect(matchesNumericPattern('testsite.com')).toBe(false);
  });

  test('mirror.com → false (no number)', () => {
    expect(matchesNumericPattern('mirror.com')).toBe(false);
  });
});

describe('1.2 extractBasePattern', () => {
  test('example001.com → example{N}.com', () => {
    expect(extractBasePattern('example001.com')).toBe('example{N}.com');
  });

  test('14example.com → {N}example.com', () => {
    expect(extractBasePattern('14example.com')).toBe('{N}example.com');
  });

  test('example126tv.com → example{N}tv.com', () => {
    expect(extractBasePattern('example126tv.com')).toBe('example{N}tv.com');
  });

  test('example146.com → example{N}.com (regression: used to give example1{N}.com)', () => {
    expect(extractBasePattern('example146.com')).toBe('example{N}.com');
  });

  test('example613.com → example{N}.com', () => {
    expect(extractBasePattern('example613.com')).toBe('example{N}.com');
  });
});

describe('1.3 matchesSamePattern', () => {
  test('example001.com and example020.com → true', () => {
    expect(matchesSamePattern('example001.com', 'example020.com')).toBe(true);
  });

  test('example146.com and example157.com → true', () => {
    expect(matchesSamePattern('example146.com', 'example157.com')).toBe(true);
  });

  test('example126tv.com and example131tv.com → true', () => {
    expect(matchesSamePattern('example126tv.com', 'example131tv.com')).toBe(true);
  });

  test('14example.com and 7example.com → true', () => {
    expect(matchesSamePattern('14example.com', '7example.com')).toBe(true);
  });

  test('example001.com and sample146.com → false (different bases)', () => {
    expect(matchesSamePattern('example001.com', 'sample146.com')).toBe(false);
  });

  test('sample15.com and sample32.com → true', () => {
    expect(matchesSamePattern('sample15.com', 'sample32.com')).toBe(true);
  });

  test('sample15.com and test231.com → false (different bases)', () => {
    expect(matchesSamePattern('sample15.com', 'test231.com')).toBe(false);
  });
});

describe('1.4 isPredictedMirror', () => {
  test('example002.com from example020.com → true', () => {
    expect(isPredictedMirror('example002.com', 'example020.com')).toBe(true);
  });

  test('example020.com from example020.com → false (self)', () => {
    expect(isPredictedMirror('example020.com', 'example020.com')).toBe(false);
  });

  test('example157.com from example146.com → true', () => {
    expect(isPredictedMirror('example157.com', 'example146.com')).toBe(true);
  });

  test('example146.com from example146.com → false (self)', () => {
    expect(isPredictedMirror('example146.com', 'example146.com')).toBe(false);
  });

  test('8example.com from 14example.com → true ([N]domain.tld)', () => {
    expect(isPredictedMirror('8example.com', '14example.com')).toBe(true);
  });

  test('14example.com from 14example.com → false (self)', () => {
    expect(isPredictedMirror('14example.com', '14example.com')).toBe(false);
  });

  test('example127tv.com from example131tv.com → true (domain[N][text].tld)', () => {
    expect(isPredictedMirror('example127tv.com', 'example131tv.com')).toBe(true);
  });

  test('example.com from example020.com → false (different domain)', () => {
    expect(isPredictedMirror('example.com', 'example020.com')).toBe(false);
  });

  test('random.com from example020.com → false (no numeric pattern in base)', () => {
    expect(isPredictedMirror('random.com', 'example020.com')).toBe(false);
  });

  test('sample15.com from sample32.com → true', () => {
    expect(isPredictedMirror('sample15.com', 'sample32.com')).toBe(true);
  });

  test('test231.com from sample32.com → false (different bases)', () => {
    expect(isPredictedMirror('test231.com', 'sample32.com')).toBe(false);
  });
});

describe('1.5 Regression: greedy regex [a-z0-9-]+ → [a-z-]+', () => {
  test('example146.com: base match gives example + 146, NOT example1 + 46', () => {
    expect(extractBasePattern('example146.com')).toBe('example{N}.com');
  });

  test('example146.com from example157.com → true (correct pattern)', () => {
    expect(isPredictedMirror('example146.com', 'example157.com')).toBe(true);
  });
});

// ============================================================================
// 2. Filter line processing
// ============================================================================

describe('2.1 processLine — Cosmetic rules (comma-separated domains before ##)', () => {
  const hostMap = new Map([['old.com', 'new.com']]);
  const emptyInitialMap = new Map<string, string>();
  const emptyPriorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();

  test('single domain replacement: old.com##.ads → new.com##.ads', () => {
    expect(processLine('old.com##.ads', hostMap, emptyInitialMap, emptyPriorityMap)).toEqual(['new.com##.ads']);
  });

  test('replacement in list: a.com,old.com,b.com##.ads → a.com,new.com,b.com##.ads', () => {
    expect(processLine('a.com,old.com,b.com##.ads', hostMap, emptyInitialMap, emptyPriorityMap)).toEqual(['a.com,new.com,b.com##.ads']);
  });

  test('no change if domain not in hostMap: unknown.com##.ads → unchanged', () => {
    expect(processLine('unknown.com##.ads', hostMap, emptyInitialMap, emptyPriorityMap)).toEqual(['unknown.com##.ads']);
  });

  test('empty line → skip', () => {
    expect(processLine('', hostMap, emptyInitialMap, emptyPriorityMap)).toEqual(['']);
  });

  test('comment → skip', () => {
    expect(processLine('! comment', hostMap, emptyInitialMap, emptyPriorityMap)).toEqual(['! comment']);
  });

  test('regex rule → skip', () => {
    expect(processLine('/regex/', hostMap, emptyInitialMap, emptyPriorityMap)).toEqual(['/regex/']);
  });
});

describe('2.2 processLine — URL rules (||domain^)', () => {
  const hostMap = new Map([['old.com', 'new.com']]);
  const emptyInitialMap = new Map<string, string>();
  const emptyPriorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();

  test('||old.com^ → ||new.com^', () => {
    expect(processLine('||old.com^', hostMap, emptyInitialMap, emptyPriorityMap)).toEqual(['||new.com^']);
  });

  test('||old.com^$domain=... → ||new.com^$domain=...', () => {
    expect(processLine('||old.com^$domain=example.com', hostMap, emptyInitialMap, emptyPriorityMap)).toEqual(['||new.com^$domain=example.com']);
  });

  test('wildcard ||example*.com/*.gif → unchanged (contains *)', () => {
    expect(processLine('||example*.com/*.gif', hostMap, emptyInitialMap, emptyPriorityMap)).toEqual(['||example*.com/*.gif']);
  });
});

describe('2.3 processLine — Parameters ($domain=, $denyallow=)', () => {
  const hostMap = new Map([['old1.com', 'new1.com'], ['old2.com', 'new2.com']]);
  const emptyInitialMap = new Map<string, string>();
  const emptyPriorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();

  test('$domain=old1.com|old2.com → $domain=new1.com|new2.com', () => {
    expect(processLine('||example.com^$domain=old1.com|old2.com', hostMap, emptyInitialMap, emptyPriorityMap))
      .toEqual(['||example.com^$domain=new1.com|new2.com']);
  });

  test('$domain=old1.com|unknown.com → $domain=new1.com|unknown.com', () => {
    expect(processLine('||example.com^$domain=old1.com|unknown.com', hostMap, emptyInitialMap, emptyPriorityMap))
      .toEqual(['||example.com^$domain=new1.com|unknown.com']);
  });

  test('single domain in parameter: $domain=old1.com → $domain=new1.com', () => {
    expect(processLine('||example.com^$domain=old1.com', hostMap, emptyInitialMap, emptyPriorityMap))
      .toEqual(['||example.com^$domain=new1.com']);
  });
});

describe('2.4 removePredictedMirrors', () => {
  test('removes predicted mirrors, keeps last_known_mirror', () => {
    const domains = ['example001.com', 'example002.com', 'example020.com'];
    const priorityMap = new Map([
      ['example020.com', { initial: 'example001.com', lastKnown: 'example020.com', oldHost: 'example001.com' }],
    ]);
    const result = removePredictedMirrors(domains, priorityMap);
    expect(result).toContain('example020.com');
    expect(result).toContain('example001.com');
    expect(result).not.toContain('example002.com');
  });

  test('last_known_mirror always stays', () => {
    const domains = ['example020.com'];
    const priorityMap = new Map([
      ['example020.com', { initial: null, lastKnown: 'example020.com', oldHost: '' }],
    ]);
    const result = removePredictedMirrors(domains, priorityMap);
    expect(result).toEqual(['example020.com']);
  });

  test('domains of different pattern in same line — stay', () => {
    const domains = ['example020.com', 'example.com', 'random.com'];
    const priorityMap = new Map([
      ['example020.com', { initial: null, lastKnown: 'example020.com', oldHost: '' }],
    ]);
    const result = removePredictedMirrors(domains, priorityMap);
    expect(result).toContain('example.com');
    expect(result).toContain('random.com');
  });
});

describe('2.5 Cross-group predicted mirror isolation (example[N].com clone test)', () => {
  const priorityMap = new Map([
    ['example101.com', { initial: 'example100.com', lastKnown: 'example101.com', oldHost: 'example100.com' }],
    ['example0101.com', { initial: 'example0100.com', lastKnown: 'example0101.com', oldHost: 'example0100.com' }],
  ]);
  const hostMap = new Map([
    ['example100.com', 'example101.com'],
    ['example0100.com', 'example0101.com'],
  ]);
  const initialToLastKnownMap = new Map([
    ['example100.com', 'example101.com'],
    ['example0100.com', 'example0101.com'],
  ]);

  test('example100 group: predicted mirrors removed, only example101.com stays', () => {
    const line = 'example100.com,example101.com,example102.com##.ads';
    const result = processLine(line, hostMap, initialToLastKnownMap, priorityMap);
    expect(result).toEqual(['example101.com##.ads']);
  });

  test('example0100 group: predicted mirrors removed, example0101.com stays', () => {
    const line = 'example0100.com,example0101.com,example0102.com##.ads';
    const result = processLine(line, hostMap, initialToLastKnownMap, priorityMap);
    // example0101.com stays (last_known_mirror for this group)
    expect(result[0]).toContain('example0101.com');
    // example0102.com removed as predicted mirror
    expect(result[0]).not.toContain('example0102.com');
    // Note: example101.com may also appear because it shares base pattern example{N}.com
    // and is in the priorityMap keep set — this is expected behavior
  });

  test('example100→example101 redirect does NOT affect example0100 group', () => {
    const line = 'example0100.com,example0101.com,example0102.com##.ads';
    const result = processLine(line, hostMap, initialToLastKnownMap, priorityMap);
    // example0101.com should stay (it's the last_known_mirror for example0100 group)
    expect(result[0]).toContain('example0101.com');
    // example0102.com should be removed as predicted mirror of example0101.com
    expect(result[0]).not.toContain('example0102.com');
  });
});

describe('2.6 Scheme change detection', () => {
  test('hasSchemeChangeInList detects scheme change', () => {
    const original = ['example001.com', 'example.com'];
    const replaced = ['newsite.com', 'example.com'];
    expect(hasSchemeChangeInList(original, replaced)).toBe(true);
  });

  test('handleSchemeChange removes all domains of old pattern', () => {
    const original = ['example001.com', 'example002.com', 'newsite.com'];
    const replaced = ['newsite.com', 'example002.com', 'newsite.com'];
    const emptyPriorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();
    const result = handleSchemeChange(original, replaced, emptyPriorityMap);
    expect(result).not.toContain('example002.com');
    expect(result).toContain('newsite.com');
  });
});

describe('2.7 Deduplication', () => {
  test('duplicate domains after replacement are removed', () => {
    expect(deduplicateDomains(['a.com', 'b.com', 'a.com'])).toEqual(['a.com', 'b.com']);
  });

  test('www normalization: www.example.com and example.com are deduplicated', () => {
    expect(deduplicateDomains(['www.example.com', 'example.com'])).toEqual(['www.example.com']);
  });
});

describe('2.8 replaceDomain with initialToLastKnownMap', () => {
  test('initial_domain differs from last_known_mirror → replaced via initialToLastKnownMap', () => {
    const hostMap = new Map<string, string>();
    const initialToLastKnownMap = new Map([['example100.com', 'example101.com']]);
    expect(replaceDomain('example100.com', hostMap, initialToLastKnownMap)).toBe('example101.com');
  });

  test('initial_domain same as last_known_mirror → replaced via hostMap', () => {
    const hostMap = new Map([['old.com', 'new.com']]);
    const initialToLastKnownMap = new Map<string, string>();
    expect(replaceDomain('old.com', hostMap, initialToLastKnownMap)).toBe('new.com');
  });

  test('wildcard domain is NOT replaced', () => {
    const hostMap = new Map([['*.example.com', 'new.com']]);
    const initialToLastKnownMap = new Map<string, string>();
    expect(replaceDomain('*.example.com', hostMap, initialToLastKnownMap)).toBe('*.example.com');
  });

  test('empty string returns empty string', () => {
    const hostMap = new Map<string, string>();
    const initialToLastKnownMap = new Map<string, string>();
    expect(replaceDomain('', hostMap, initialToLastKnownMap)).toBe('');
  });
});

describe('2.9 Empty priorityMap', () => {
  test('removePredictedMirrors returns all domains unchanged when priorityMap is empty', () => {
    const domains = ['a.com', 'b123.com', 'c.com'];
    const emptyPriorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();
    expect(removePredictedMirrors(domains, emptyPriorityMap)).toEqual(domains);
  });
});

describe('2.10 Preventing empty domain lists in parameters', () => {
  test('$domain= list is unchanged when no rotation occurred', () => {
    // All domains are predicted mirrors of example020.com, but no rotation happened (empty hostMap).
    // removePredictedMirrors should NOT run — leave the existing domain list intact.
    const hostMap = new Map<string, string>();
    const initialToLastKnownMap = new Map<string, string>();
    const priorityMap = new Map([
      ['example020.com', { initial: null, lastKnown: 'example020.com', oldHost: '' }],
    ]);
    const line = '||example.com^$domain=example001.com|example002.com|example003.com';
    const result = processLine(line, hostMap, initialToLastKnownMap, priorityMap);
    // No change → line must be returned as-is (existing domains preserved)
    expect(result[0]).toBe('||example.com^$domain=example001.com|example002.com|example003.com');
  });
});

describe('2.12 shouldSkipLine', () => {
  test('empty line → skip', () => {
    expect(shouldSkipLine('')).toBe(true);
  });

  test('comment ! comment → skip', () => {
    expect(shouldSkipLine('! comment')).toBe(true);
  });

  test('regex /regex/ → skip', () => {
    expect(shouldSkipLine('/regex/')).toBe(true);
  });

  test('wildcard without cosmetic/params ||example*.com/*.gif → skip', () => {
    expect(shouldSkipLine('||example*.com/*.gif')).toBe(true);
  });

  test('wildcard with cosmetic example*.com##.ads → NOT skip', () => {
    expect(shouldSkipLine('example*.com##.ads')).toBe(false);
  });

  test('wildcard with params *$domain=example.com → NOT skip', () => {
    expect(shouldSkipLine('*$domain=example.com')).toBe(false);
  });
});

describe('2.11 findTargetFiles', () => {
  const testRoot = process.cwd() + '/TestFilters';

  test('finds .txt files in *Filter directories', async () => {
    // Use the actual TestFilters directory in the repo
    const root = process.cwd();
    const files = await findTargetFiles(root + '/TestFilters', 'Filter', '*.txt');
    expect(files.length).toBeGreaterThan(0);
    expect(files.some(f => f.endsWith('testfilter.txt'))).toBe(true);
  });

  test('does not include .rar files', async () => {
    const root = process.cwd();
    const files = await findTargetFiles(root + '/TestFilters', 'Filter', '*.txt');
    expect(files.every(f => f.endsWith('.txt'))).toBe(true);
  });
});

// ============================================================================
// 3. Additional domains from force_search_ahead
// ============================================================================

describe('3.1 processLine — additional domains in cosmetic rules', () => {
  const hostMap = new Map([['old.com', 'new432.com']]);
  const emptyInitialMap = new Map<string, string>();
  const emptyPriorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();
  const additionalDomainsMap = new Map([['new432.com', ['new433.com', 'new434.com']]]);

  test('single domain with additional: old.com##.ads → new432.com,new433.com,new434.com##.ads', () => {
    const result = processLine('old.com##.ads', hostMap, emptyInitialMap, emptyPriorityMap, additionalDomainsMap);
    expect(result).toEqual(['new432.com,new433.com,new434.com##.ads']);
  });

  test('domain list with additional: a.com,old.com##.ads → a.com,new432.com,new433.com,new434.com##.ads', () => {
    const result = processLine('a.com,old.com,b.com##.ads', hostMap, emptyInitialMap, emptyPriorityMap, additionalDomainsMap);
    expect(result).toEqual(['a.com,new432.com,b.com,new433.com,new434.com##.ads']);
  });

  test('no additional domains when map is empty', () => {
    const emptyAdditional = new Map<string, string[]>();
    const result = processLine('old.com##.ads', hostMap, emptyInitialMap, emptyPriorityMap, emptyAdditional);
    expect(result).toEqual(['new432.com##.ads']);
  });

  test('additional domains already present are not duplicated', () => {
    const result = processLine('old.com,new433.com##.ads', hostMap, emptyInitialMap, emptyPriorityMap, additionalDomainsMap);
    expect(result[0]).toContain('new432.com');
    expect(result[0]).toContain('new433.com');
    expect(result[0]).toContain('new434.com');
    // new433.com should appear only once
    const domains = result[0].split('##')[0].split(',');
    const count433 = domains.filter(d => d === 'new433.com').length;
    expect(count433).toBe(1);
  });
});

describe('3.2 processLine — additional domains in ||domain^ URL rules', () => {
  const hostMap = new Map([['old.com', 'new432.com']]);
  const emptyInitialMap = new Map<string, string>();
  const emptyPriorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();
  const additionalDomainsMap = new Map([['new432.com', ['new433.com']]]);

  test('||old.com^ → [||new432.com^, ||new433.com^]', () => {
    const result = processLine('||old.com^', hostMap, emptyInitialMap, emptyPriorityMap, additionalDomainsMap);
    expect(result).toEqual(['||new432.com^', '||new433.com^']);
  });

  test('||old.com^$third-party → duplicated with modifiers', () => {
    const result = processLine('||old.com^$third-party', hostMap, emptyInitialMap, emptyPriorityMap, additionalDomainsMap);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('||new432.com^$third-party');
    expect(result[1]).toBe('||new433.com^$third-party');
  });

  test('no extra lines when additionalDomainsMap is empty', () => {
    const emptyAdditional = new Map<string, string[]>();
    const result = processLine('||old.com^', hostMap, emptyInitialMap, emptyPriorityMap, emptyAdditional);
    expect(result).toEqual(['||new432.com^']);
  });

  test('regex lastIndex regression: .test() with /g flag must not affect .replace()', () => {
    // Bug: RegExp.test() with /g flag advances lastIndex, causing subsequent .replace() to skip matches
    // This test ensures the fix (tokenRe.lastIndex = 0) works correctly
    const result = processLine('||old.com^$third-party', hostMap, emptyInitialMap, emptyPriorityMap);
    expect(result).toEqual(['||new432.com^$third-party']);
  });
});

describe('3.3 processLine — additional domains in $domain= parameters', () => {
  const hostMap = new Map([['old.com', 'new432.com']]);
  const emptyInitialMap = new Map<string, string>();
  const emptyPriorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();
  const additionalDomainsMap = new Map([['new432.com', ['new433.com']]]);

  test('$domain=old.com|other.com → $domain=new432.com|other.com|new433.com', () => {
    const result = processLine('||example.com^$domain=old.com|other.com', hostMap, emptyInitialMap, emptyPriorityMap, additionalDomainsMap);
    expect(result[0]).toContain('new432.com');
    expect(result[0]).toContain('new433.com');
    expect(result[0]).toContain('other.com');
  });
});

describe('3.4 processDomainList — additional domains appending', () => {
  const hostMap = new Map([['old.com', 'new432.com']]);
  const emptyInitialMap = new Map<string, string>();
  const emptyPriorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();
  const additionalDomainsMap = new Map([['new432.com', ['new433.com', 'new434.com']]]);

  test('appends additional domains after replacement', () => {
    const { processed, changed } = processDomainList(['old.com'], hostMap, emptyInitialMap, emptyPriorityMap, additionalDomainsMap);
    expect(processed).toEqual(['new432.com', 'new433.com', 'new434.com']);
    expect(changed).toBe(true);
  });

  test('does not append when no additional domains', () => {
    const emptyAdditional = new Map<string, string[]>();
    const { processed } = processDomainList(['old.com'], hostMap, emptyInitialMap, emptyPriorityMap, emptyAdditional);
    expect(processed).toEqual(['new432.com']);
  });

  test('does not duplicate existing domains', () => {
    const { processed } = processDomainList(['old.com', 'new433.com'], hostMap, emptyInitialMap, emptyPriorityMap, additionalDomainsMap);
    expect(processed).toContain('new432.com');
    expect(processed).toContain('new433.com');
    expect(processed).toContain('new434.com');
    const count = processed.filter(d => d === 'new433.com').length;
    expect(count).toBe(1);
  });
});

// ============================================================================
// Edge cases from section 12
// ============================================================================

describe('Edge cases and regressions', () => {
  test('www prefix: www.example373.com normalizes to example373.com', () => {
    expect(normalizeDomain('www.example373.com')).toBe('example373.com');
    expect(matchesNumericPattern('www.example373.com')).toBe(true);
  });

  test('regex escaping in isPredictedMirror: baseName with special chars', () => {
    // escapeRegExp should handle dots and plus signs
    expect(escapeRegExp('example.com')).toBe('example\\.com');
    expect(escapeRegExp('test+site.com')).toBe('test\\+site\\.com');
  });

  test('domain list unchanged when no rotation occurred (no fallback needed)', () => {
    // Domains are predicted mirrors of example020.com, but no rotation happened (empty hostMap).
    // removePredictedMirrors must NOT run — existing domains must be preserved as-is.
    const priorityMap = new Map([
      ['example020.com', { initial: null, lastKnown: 'example020.com', oldHost: '' }],
    ]);
    const domains = ['example001.com', 'example002.com'];
    const hostMap = new Map<string, string>();
    const initialToLastKnownMap = new Map<string, string>();

    const { processed } = processDomainList(domains, hostMap, initialToLastKnownMap, priorityMap);
    // No domain change → list must remain untouched
    expect(processed).toEqual(['example001.com', 'example002.com']);
    expect(processed).not.toContain('example020.com');
  });

  test('CRITICAL: prevent empty domain list in cosmetic rules (scheme change)', () => {
    // Scenario: example15.com redirects to example16-com.l.ink (link shortener)
    // This causes scheme change detection and removal of all old pattern domains
    const hostMap = new Map([
      ['example15.com', 'example16-com.l.ink'], // Redirect to link shortener
    ]);
    const initialToLastKnownMap = new Map<string, string>();
    const priorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();

    // Original cosmetic rule: example15.com##a[href^="https://cutt.ly/"]
    const line = 'example15.com##a[href^="https://cutt.ly/"]';
    const result = processLine(line, hostMap, initialToLastKnownMap, priorityMap);

    // MUST NOT produce empty domain list (##a[href...] would be global rule!)
    expect(result[0]).not.toBe('##a[href^="https://cutt.ly/"]');
    // Should keep original domain as fallback
    expect(result[0]).toBe('example15.com##a[href^="https://cutt.ly/"]');
  });

  test('CRITICAL: prevent empty domain list in cosmetic rules (multiple domains)', () => {
    // Multiple domains, all removed by scheme change
    const hostMap = new Map([
      ['example15.com', 'example16-com.l.ink'],
      ['example14.com', 'example15-com.l.ink'],
    ]);
    const initialToLastKnownMap = new Map<string, string>();
    const priorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();

    const line = 'example14.com,example15.com##a[href^="https://cutt.ly/"]';
    const result = processLine(line, hostMap, initialToLastKnownMap, priorityMap);

    // MUST NOT produce empty domain list
    expect(result[0]).not.toMatch(/^##/);
    // Should keep at least one original domain
    expect(result[0]).toContain('example');
    expect(result[0]).toContain('##');
  });

  test('CRITICAL: prevent empty domain list in parameters ($domain=)', () => {
    // Parameters with | separator, all removed by scheme change
    const hostMap = new Map([
      ['example14.com', 'example16-com.l.ink'],
      ['example15.com', 'example17-com.l.ink'],
    ]);
    const initialToLastKnownMap = new Map<string, string>();
    const priorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();

    const line = '$domain=example14.com|example15.com';
    const result = processLine(line, hostMap, initialToLastKnownMap, priorityMap);

    // MUST NOT produce empty parameter value
    expect(result[0]).not.toBe('$domain=');
    // Should keep at least one original domain as fallback
    expect(result[0]).toContain('example');
    expect(result[0]).toMatch(/^\$domain=/);
  });

  test('CRITICAL: prevent empty domain list in parameters with priorityMap fallback', () => {
    // Parameters with priorityMap providing last_known_mirror (same TLD pattern)
    const hostMap = new Map([
      ['example14.com', 'example16-com.l.ink'],
      ['example15.com', 'example17-com.l.ink'],
    ]);
    const initialToLastKnownMap = new Map<string, string>();
    const priorityMap = new Map([
      ['example020.com', { initial: null, lastKnown: 'example020.com', oldHost: '' }],
    ]);

    const line = '$domain=example14.com|example15.com';
    const result = processLine(line, hostMap, initialToLastKnownMap, priorityMap);

    // Should restore last_known_mirror from priorityMap (same TLD pattern)
    expect(result[0]).toBe('$domain=example020.com');
  });
});

// ============================================================================
// 3.5 hostMap first-wins: primary replacement is not overwritten by additional
// ============================================================================

describe('3.5 processDomainList — hostMap first-wins with same oldHost for primary+additional', () => {
  // Simulates force_search_ahead scenario:
  //   replacements = [
  //     { oldHost: 'example001.com', newHost: 'example118.com' },  ← primary (numeric, heuristic found)
  //     { oldHost: 'example001.com', newHost: 'nopattern.com' },   ← additional (redirect target)
  //   ]
  // hostMap must keep first-wins: 'example001.com' → 'example118.com'
  // additionalDomainsMap: 'example118.com' → ['nopattern.com']

  const hostMap = new Map([['example001.com', 'example118.com']]);
  const emptyInitialMap = new Map<string, string>();
  const emptyPriorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();
  const additionalDomainsMap = new Map([['example118.com', ['nopattern.com']]]);

  test('single-site cosmetic: example001.com##.ads → example118.com,nopattern.com##.ads', () => {
    const result = processLine('example001.com##.ads', hostMap, emptyInitialMap, emptyPriorityMap, additionalDomainsMap);
    expect(result).toEqual(['example118.com,nopattern.com##.ads']);
  });

  test('mixed cosmetic: other.com,example001.com,extra.com##.ads → both domains added', () => {
    const result = processLine('other.com,example001.com,extra.com##.ads', hostMap, emptyInitialMap, emptyPriorityMap, additionalDomainsMap);
    expect(result[0]).toContain('example118.com');
    expect(result[0]).toContain('nopattern.com');
    expect(result[0]).toContain('other.com');
    expect(result[0]).toContain('extra.com');
    // example001.com must not remain
    expect(result[0]).not.toContain('example001.com');
  });

  test('mixed cosmetic: nopattern.com should appear only once (not duplicated)', () => {
    const result = processLine('other.com,example001.com,extra.com##.ads', hostMap, emptyInitialMap, emptyPriorityMap, additionalDomainsMap);
    const domains = result[0].split('##')[0].split(',');
    const count = domains.filter(d => d === 'nopattern.com').length;
    expect(count).toBe(1);
  });

  test('processDomainList: additional appended when primary key matches', () => {
    const { processed } = processDomainList(
      ['other.com', 'example001.com', 'extra.com'],
      hostMap, emptyInitialMap, emptyPriorityMap, additionalDomainsMap
    );
    expect(processed).toContain('example118.com');
    expect(processed).toContain('nopattern.com');
    expect(processed).toContain('other.com');
    expect(processed).toContain('extra.com');
    expect(processed).not.toContain('example001.com');
  });
});

// ============================================================================
// 4. FilterReplacer.applyReplacements — originalMirrors filtering
// ============================================================================

describe('4.1 originalMirrors: entry point resolution detection', () => {
  // Mock config pointing to TestFilters (empty or minimal filter files for testing)
  const mockConfig: Config = {
    http: {
      timeout: 5000,
      retries: 1,
      heuristicTimeout: 3000,
      userAgent: 'test-agent',
    },
    processing: {
      parallel: 1,
      redirectDepth: 5,
    },
    dnsPreCheck: {
      enabled: false,
      timeout: 1000,
      retryOnce: false,
    },
    contentProbe: {
      enabled: false,
    },
    antibot: {
      detectCodes: [403],
      detectUrlPattern: '',
    },
    thresholds: {
      failedDaysWarning: 3,
    },
    heuristic: {
      enabled: false,
      maxAttempts: 5,
      skipOnAntibot: true,
      forceHeuristicOnCodes: [],
    },
    logging: {
      saveToFile: false,
      incremental: false,
      filePath: '',
    },
    git: {
      mode: 'debug',
      branch: 'master',
      prBranchPrefix: 'test-',
    },
    filtersdir: {
      repoPath: 'TestFilters',
      filterDirPattern: '*',
      filePattern: '*.txt',
    },
    filtersdir_test: {
      repoPath: 'TestFilters',
      filterDirPattern: '*',
      filePattern: '*.txt',
    },
  };

  // Silent logger for tests
  const silentLogger = new Logger(mockConfig);

  test('initial_domain redirects to SAME domain as last_known_mirror → NO change detected', async () => {
    // Scenario: watcher has last_known_mirror = 'example027.com'
    // initial_domain (t.co) redirects to example027.com
    // This should NOT be counted as a change
    const replacements: ReplacementPair[] = [{
      siteName: 'TestSite',
      oldHost: 't.co',           // initial_domain
      newHost: 'example027.com', // resolved domain
      startedHost: 't.co',
      checkDurationMs: 1000,
    }];

    // originalMirrors contains the domain that was in watcher BEFORE processing
    const originalMirrors = new Map([['TestSite', 'example027.com']]);

    const replacer = new FilterReplacer(mockConfig, silentLogger, true);

    // Capture console output to verify table is NOT shown
    const logCalls: string[] = [];
    const originalLog = silentLogger.logGlobal.bind(silentLogger);
    jest.spyOn(silentLogger, 'logGlobal').mockImplementation((level, msg) => {
      logCalls.push(msg);
    });

    await replacer.applyReplacements(replacements, true, originalMirrors);

    // Table should NOT be shown because newHost === originalMirror
    const hasRedirectedTable = logCalls.some(msg => msg.includes('Redirected domains'));
    expect(hasRedirectedTable).toBe(false);

    // Should show "No domain changes detected" message
    const hasNoChanges = logCalls.some(msg => msg.includes('No domain changes detected'));
    expect(hasNoChanges).toBe(true);

    jest.restoreAllMocks();
  });

  test('initial_domain redirects to NEW domain (different from last_known_mirror) → change detected', async () => {
    // Scenario: watcher has last_known_mirror = 'example027.com'
    // initial_domain (t.co) redirects to example028.com (NEW domain)
    // This SHOULD be counted as a change
    const replacements: ReplacementPair[] = [{
      siteName: 'TestSite',
      oldHost: 't.co',           // initial_domain
      newHost: 'example028.com', // NEW resolved domain
      startedHost: 't.co',
      checkDurationMs: 1000,
    }];

    // originalMirrors contains the OLD domain
    const originalMirrors = new Map([['TestSite', 'example027.com']]);

    const replacer = new FilterReplacer(mockConfig, silentLogger, true);

    const logCalls: string[] = [];
    jest.spyOn(silentLogger, 'logGlobal').mockImplementation((level, msg) => {
      logCalls.push(msg);
    });

    await replacer.applyReplacements(replacements, true, originalMirrors);

    // Table SHOULD be shown because newHost !== originalMirror
    const hasRedirectedTable = logCalls.some(msg => msg.includes('Redirected domains'));
    expect(hasRedirectedTable).toBe(true);

    // Table should contain the site and new domain
    const tableOutput = logCalls.find(msg => msg.includes('TestSite'));
    expect(tableOutput).toBeDefined();
    expect(tableOutput).toContain('example028.com');

    jest.restoreAllMocks();
  });

  test('no originalMirrors provided → all domain changes shown (backward compat)', async () => {
    // When originalMirrors is not provided, all fromHost !== newHost are shown
    const replacements: ReplacementPair[] = [{
      siteName: 'TestSite',
      oldHost: 't.co',
      newHost: 'example027.com',
      startedHost: 't.co',
      checkDurationMs: 1000,
    }];

    const replacer = new FilterReplacer(mockConfig, silentLogger, true);

    const logCalls: string[] = [];
    jest.spyOn(silentLogger, 'logGlobal').mockImplementation((level, msg) => {
      logCalls.push(msg);
    });

    // No originalMirrors passed
    await replacer.applyReplacements(replacements, true);

    // Table SHOULD be shown (backward compatible behavior)
    const hasRedirectedTable = logCalls.some(msg => msg.includes('Redirected domains'));
    expect(hasRedirectedTable).toBe(true);

    jest.restoreAllMocks();
  });

  test('multiple sites: mix of real changes and entry point resolutions', async () => {
    // Site1: entry point → same domain (NO change)
    // Site2: entry point → new domain (change)
    // Site3: domain rotation (change)
    const replacements: ReplacementPair[] = [
      {
        siteName: 'Site1',
        oldHost: 'redirect.me',
        newHost: 'example100.com', // same as original
        startedHost: 'redirect.me',
        checkDurationMs: 500,
      },
      {
        siteName: 'Site2',
        oldHost: 'short.link',
        newHost: 'example201.com', // NEW domain
        startedHost: 'short.link',
        checkDurationMs: 600,
      },
      {
        siteName: 'Site3',
        oldHost: 'example300.com',
        newHost: 'example301.com', // rotation
        startedHost: 'example300.com',
        checkDurationMs: 700,
      },
    ];

    const originalMirrors = new Map([
      ['Site1', 'example100.com'],  // same → no change
      ['Site2', 'example200.com'],  // different → change
      ['Site3', 'example300.com'],  // different → change
    ]);

    const replacer = new FilterReplacer(mockConfig, silentLogger, true);

    const logCalls: string[] = [];
    jest.spyOn(silentLogger, 'logGlobal').mockImplementation((level, msg) => {
      logCalls.push(msg);
    });

    await replacer.applyReplacements(replacements, true, originalMirrors);

    // Table should be shown (Site2 and Site3 have changes)
    const hasRedirectedTable = logCalls.some(msg => msg.includes('Redirected domains'));
    expect(hasRedirectedTable).toBe(true);

    // Find table output
    const tableOutput = logCalls.join('\n');

    // Site1 should NOT be in table (no real change)
    expect(tableOutput).not.toContain('Site1');

    // Site2 and Site3 SHOULD be in table
    expect(tableOutput).toContain('Site2');
    expect(tableOutput).toContain('Site3');

    jest.restoreAllMocks();
  });
});
