import { jest, describe, test, expect, afterEach } from '@jest/globals';
import * as os from 'os';
import * as fsp from 'fs/promises';
import * as path from 'path';
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
    const files = await findTargetFiles(root + '/TestFilters', '*Filter', '*.txt');
    expect(files.length).toBeGreaterThan(0);
    expect(files.some(f => f.endsWith('testfilter.txt'))).toBe(true);
  });

  test('does not include .rar files', async () => {
    const root = process.cwd();
    const files = await findTargetFiles(root + '/TestFilters', '*Filter', '*.txt');
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
    const count433 = domains.filter((d: string) => d === 'new433.com').length;
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

  test('single-site cosmetic: non-pattern extra is ignored for pattern watcher', () => {
    const result = processLine('example001.com##.ads', hostMap, emptyInitialMap, emptyPriorityMap, additionalDomainsMap);
    expect(result).toEqual(['example118.com##.ads']);
  });

  test('mixed cosmetic: keeps unrelated domains but does not append non-pattern extra', () => {
    const result = processLine('other.com,example001.com,extra.com##.ads', hostMap, emptyInitialMap, emptyPriorityMap, additionalDomainsMap);
    expect(result[0]).toContain('example118.com');
    expect(result[0]).not.toContain('nopattern.com');
    expect(result[0]).toContain('other.com');
    expect(result[0]).toContain('extra.com');
    // example001.com must not remain
    expect(result[0]).not.toContain('example001.com');
  });

  test('mixed cosmetic: non-pattern extra is excluded entirely', () => {
    const result = processLine('other.com,example001.com,extra.com##.ads', hostMap, emptyInitialMap, emptyPriorityMap, additionalDomainsMap);
    const domains = result[0].split('##')[0].split(',');
    const count = domains.filter((d: string) => d === 'nopattern.com').length;
    expect(count).toBe(0);
  });

  test('processDomainList: additional appended when primary key matches', () => {
    const { processed } = processDomainList(
      ['other.com', 'example001.com', 'extra.com'],
      hostMap, emptyInitialMap, emptyPriorityMap, additionalDomainsMap
    );
    expect(processed).toContain('example118.com');
    expect(processed).not.toContain('nopattern.com');
    expect(processed).toContain('other.com');
    expect(processed).toContain('extra.com');
    expect(processed).not.toContain('example001.com');
  });

  test('processDomainList: unchanged primary + fresh additional domains prunes stale predicted mirrors', () => {
    const unchangedHostMap = new Map([['example1013.pro', 'www.example1013.pro']]);
    const emptyInitialMap = new Map<string, string>();
    const priorityMap = new Map([
      ['www.example1013.pro', {
        initial: null,
        lastKnown: 'www.example1013.pro',
        oldHost: 'example1013.pro',
        workingDomains: new Set(['www.example1013.pro', 'example1014.pro', 'example1015.pro']),
      }],
    ]) as Map<string, { initial: string | null; lastKnown: string; oldHost: string; workingDomains?: Set<string> }>;
    const additionalDomainsMap = new Map([
      ['example1013.pro', ['example1014.pro', 'example1015.pro']],
    ]);

    const { processed } = processDomainList(
      ['example1013.pro', 'example1014.pro', 'example1016.pro'],
      unchangedHostMap,
      emptyInitialMap,
      priorityMap as Map<string, { initial: string | null; lastKnown: string; oldHost: string }>,
      additionalDomainsMap,
    );

    expect(processed).toContain('www.example1013.pro');
    expect(processed).toContain('example1014.pro');
    expect(processed).toContain('example1015.pro');
    expect(processed).not.toContain('example1016.pro');
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
    // initial_domain (shortlink.test) redirects to example027.com
    // This should NOT be counted as a change
    const replacements: ReplacementPair[] = [{
      siteName: 'TestSite',
      oldHost: 'shortlink.test', // initial_domain
      newHost: 'example027.com', // resolved domain
      startedHost: 'shortlink.test',
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
    // initial_domain (shortlink.test) redirects to example028.com (NEW domain)
    // This SHOULD be counted as a change
    const replacements: ReplacementPair[] = [{
      siteName: 'TestSite',
      oldHost: 'shortlink.test', // initial_domain
      newHost: 'example028.com', // NEW resolved domain
      startedHost: 'shortlink.test',
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
      oldHost: 'shortlink.test',
      newHost: 'example027.com',
      startedHost: 'shortlink.test',
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

  test('shortener hostname as oldHost would corrupt filter — guard in index.ts must prevent this', async () => {
    // REGRESSION TEST for critical bug (fixed in index.ts):
    // If initial_domain = "https://shortlink.test/somepath", code previously extracted "shortlink.test" as the
    // hostname and added it to replacements as oldHost. This caused ALL ||shortlink.test^ rules in
    // filter files to be replaced with the watcher's current mirror domain — corrupting filters.
    //
    // The fix in index.ts: skip adding initial_domain replacement when initial_domain has a
    // path component (i.e. it's a redirect shortener URL, not a plain domain like "example.com").
    //
    // This test verifies that IF such a replacement were passed to FilterReplacer (which should
    // never happen after the fix), it WOULD replace ||shortlink.test^ in the filter — proving the upstream
    // guard is essential.
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'rdc-shortener-test-'));
    const filterSubDir = path.join(tmpDir, 'TestFilter');
    await fsp.mkdir(filterSubDir, { recursive: true });

    // Filter file that has legitimate shortlink.test blocking rules
    const filterContent = [
      '||shortlink.test^$important',
      '||example029.com^',
      '@@||shortlink.test^$domain=social.example',
    ].join('\n');
    await fsp.writeFile(path.join(filterSubDir, 'filter.txt'), filterContent, 'utf8');

    const cfg: Config = {
      ...mockConfig,
      filtersdir: { repoPath: tmpDir, filterDirPattern: '*', filePattern: '*.txt' },
      filtersdir_test: { repoPath: tmpDir, filterDirPattern: '*', filePattern: '*.txt' },
    };

    // Simulate the WRONG behavior: shortener hostname as oldHost
    const badReplacements: ReplacementPair[] = [{
      siteName: 'SomeWatcher',
      oldHost: 'shortlink.test',  // extracted from "https://shortlink.test/somepath" — WRONG!
      newHost: 'example029.com',  // last_known_mirror of the watcher
      startedHost: 'shortlink.test',
      checkDurationMs: 100,
    }];

    const replacer = new FilterReplacer(cfg, silentLogger, false);
    await replacer.applyReplacements(badReplacements, false, new Map([['SomeWatcher', 'example028.com']]));

    const result = await fsp.readFile(path.join(filterSubDir, 'filter.txt'), 'utf8');

    // This confirms what the bug WOULD cause: shortlink.test rules get corrupted
    // (The fix in index.ts ensures this replacement is never created in the first place)
    expect(result).toContain('||example029.com^');
    expect(result).not.toContain('||shortlink.test^$important');

    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  test('discovery-only startedHost does not replace shortener rules when oldHost is previous mirror', async () => {
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'rdc-discovery-only-test-'));
    const filterSubDir = path.join(tmpDir, 'TestFilter');
    await fsp.mkdir(filterSubDir, { recursive: true });

    const filterContent = [
      '||short.link^$important',
      '||example200.com^',
      '@@||short.link^$domain=testsite.com',
    ].join('\n');
    await fsp.writeFile(path.join(filterSubDir, 'filter.txt'), filterContent, 'utf8');

    const cfg: Config = {
      ...mockConfig,
      filtersdir: { repoPath: tmpDir, filterDirPattern: '*', filePattern: '*.txt' },
      filtersdir_test: { repoPath: tmpDir, filterDirPattern: '*', filePattern: '*.txt' },
    };

    const replacements: ReplacementPair[] = [{
      siteName: 'DiscoveryWatcher',
      oldHost: 'example200.com',
      newHost: 'example201.com',
      startedHost: 'short.link',
      checkDurationMs: 100,
    }];

    const replacer = new FilterReplacer(cfg, silentLogger, false);
    await replacer.applyReplacements(replacements, false, new Map([['DiscoveryWatcher', 'example200.com']]));

    const result = await fsp.readFile(path.join(filterSubDir, 'filter.txt'), 'utf8');

    expect(result).toContain('||example201.com^');
    expect(result).not.toContain('||example200.com^');
    expect(result).toContain('||short.link^$important');
    expect(result).toContain('@@||short.link^$domain=testsite.com');

    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  test('discovery-only startedHost does not replace bare gateway rules when oldHost is previous mirror', async () => {
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'rdc-gateway-discovery-test-'));
    const filterSubDir = path.join(tmpDir, 'TestFilter');
    await fsp.mkdir(filterSubDir, { recursive: true });

    const filterContent = [
      '||gateway.example^',
      '||mirror085.example^',
      '@@||gateway.example^$domain=testsite.com',
    ].join('\n');
    await fsp.writeFile(path.join(filterSubDir, 'filter.txt'), filterContent, 'utf8');

    const cfg: Config = {
      ...mockConfig,
      filtersdir: { repoPath: tmpDir, filterDirPattern: '*', filePattern: '*.txt' },
      filtersdir_test: { repoPath: tmpDir, filterDirPattern: '*', filePattern: '*.txt' },
    };

    const replacements: ReplacementPair[] = [{
      siteName: 'GatewayWatcher',
      oldHost: 'mirror085.example',
      newHost: 'mirror086.example',
      startedHost: 'gateway.example',
      checkDurationMs: 100,
    }];

    const replacer = new FilterReplacer(cfg, silentLogger, false);
    await replacer.applyReplacements(replacements, false, new Map([['GatewayWatcher', 'mirror085.example']]));

    const result = await fsp.readFile(path.join(filterSubDir, 'filter.txt'), 'utf8');

    expect(result).toContain('||mirror086.example^');
    expect(result).not.toContain('||mirror085.example^');
    expect(result).toContain('||gateway.example^');
    expect(result).toContain('@@||gateway.example^$domain=testsite.com');

    await fsp.rm(tmpDir, { recursive: true, force: true });
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

// ============================================================================
// 5. Line-ending preservation
// ============================================================================
describe('5.1 applyReplacements preserves original line endings', () => {
  let tmpDir: string;

  // Helper: build a minimal Config pointing to an arbitrary repoPath
  function makeConfig(repoPath: string): Config {
    return {
      http: { timeout: 5000, retries: 1, heuristicTimeout: 3000, userAgent: 'test' },
      processing: { parallel: 1, redirectDepth: 5 },
      dnsPreCheck: { enabled: false, timeout: 1000, retryOnce: false },
      contentProbe: { enabled: false },
      antibot: { detectCodes: [], detectUrlPattern: '' },
      thresholds: { failedDaysWarning: 3 },
      heuristic: { enabled: false, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [] },
      logging: { saveToFile: false, incremental: false, filePath: '' },
      git: { mode: 'debug', branch: 'master', prBranchPrefix: 'test-' },
      filtersdir: {
        repoPath,
        filterDirPattern: '*Filter',
        filePattern: '*.txt',
      },
      filtersdir_test: {
        repoPath,
        filterDirPattern: '*Filter',
        filePattern: '*.txt',
      },
    };
  }

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'rdc-test-'));
    // Create a filter dir that matches '*Filter' pattern
    await fsp.mkdir(path.join(tmpDir, 'SomeFilter'));
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  test('CRLF file → written back with CRLF (no conversion to LF)', async () => {
    const filterFile = path.join(tmpDir, 'SomeFilter', 'filter.txt');
    // Write file with CRLF line endings
    const crlfContent = '||example501.com^\r\n||nopattern.com^\r\n';
    await fsp.writeFile(filterFile, crlfContent, 'utf-8');

    const cfg = makeConfig(tmpDir);
    const logger = new Logger(cfg);
    const replacer = new FilterReplacer(cfg, logger, false);

    const replacements: ReplacementPair[] = [{
      siteName: 'TestSite',
      oldHost: 'example501.com',
      newHost: 'example502.com',
      startedHost: 'example501.com',
      checkDurationMs: 100,
    }];

    await replacer.applyReplacements(replacements, false);

    const written = await fsp.readFile(filterFile, 'utf-8');
    // Must contain CRLF
    expect(written).toContain('\r\n');
    // Must NOT have bare LF where CRLF was expected (every \n must be preceded by \r)
    const bareNewlines = written.split('\n').slice(0, -1).filter(line => !line.endsWith('\r'));
    expect(bareNewlines).toHaveLength(0);
    // Domain must be replaced
    expect(written).toContain('example502.com');
    expect(written).not.toContain('example501.com');
  });

  test('LF file → written back with LF (no conversion to CRLF)', async () => {
    const filterFile = path.join(tmpDir, 'SomeFilter', 'filter.txt');
    // Write file with LF line endings only
    const lfContent = '||example501.com^\n||nopattern.com^\n';
    await fsp.writeFile(filterFile, lfContent, 'utf-8');

    const cfg = makeConfig(tmpDir);
    const logger = new Logger(cfg);
    const replacer = new FilterReplacer(cfg, logger, false);

    const replacements: ReplacementPair[] = [{
      siteName: 'TestSite',
      oldHost: 'example501.com',
      newHost: 'example502.com',
      startedHost: 'example501.com',
      checkDurationMs: 100,
    }];

    await replacer.applyReplacements(replacements, false);

    const written = await fsp.readFile(filterFile, 'utf-8');
    // Must NOT contain CRLF
    expect(written).not.toContain('\r\n');
    // Domain must be replaced
    expect(written).toContain('example502.com');
    expect(written).not.toContain('example501.com');
  });
});

// ============================================================================
// 2.13 processLine — Exception markers (#@# family)
// ============================================================================
describe('2.13 processLine — Exception markers (#@# family)', () => {
  const hostMap = new Map([['old.com', 'new.com']]);
  const emptyMap = new Map<string, string>();
  const emptyPriority = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();

  test('#@# exception: domain replacement works', () => {
    expect(processLine('old.com#@#.selector', hostMap, emptyMap, emptyPriority))
      .toEqual(['new.com#@#.selector']);
  });

  test('#@## exception (regression): hostMap replacement works', () => {
    const hMap = new Map([['example001.com', 'example002.com']]);
    expect(processLine('example001.com#@##smartbanner.ios', hMap, emptyMap, emptyPriority))
      .toEqual(['example002.com#@##smartbanner.ios']);
  });

  test('#@$# exception: domain replacement works', () => {
    expect(processLine('old.com#@$#body { background: #fff !important; }', hostMap, emptyMap, emptyPriority))
      .toEqual(['new.com#@$#body { background: #fff !important; }']);
  });

  test('#@?# exception: domain replacement works', () => {
    expect(processLine('old.com#@?#.mb-6:contains(gesponsord)', hostMap, emptyMap, emptyPriority))
      .toEqual(['new.com#@?#.mb-6:contains(gesponsord)']);
  });

  test('#@$?# exception: domain replacement works', () => {
    expect(processLine('old.com#@$?#.selector { remove: true; }', hostMap, emptyMap, emptyPriority))
      .toEqual(['new.com#@$?#.selector { remove: true; }']);
  });

  test('#@%# exception: domain replacement works', () => {
    expect(processLine('old.com#@%#//scriptlet(\'remove-class\', \'no_scroll\')', hostMap, emptyMap, emptyPriority))
      .toEqual(['new.com#@%#//scriptlet(\'remove-class\', \'no_scroll\')']);
  });

  test('exception marker with list: a.com,old.com,b.com#@#.selector → replaced', () => {
    expect(processLine('a.com,old.com,b.com#@#.selector', hostMap, emptyMap, emptyPriority))
      .toEqual(['a.com,new.com,b.com#@#.selector']);
  });

  test('no replacement when domain not in hostMap', () => {
    expect(processLine('nopattern.com#@#.selector', hostMap, emptyMap, emptyPriority))
      .toEqual(['nopattern.com#@#.selector']);
  });
});

// ============================================================================
// 2.14 processLine — Dollar-based cosmetic markers ($$ / $@$)
// ============================================================================
describe('2.14 processLine — Dollar-based cosmetic markers ($$ / $@$)', () => {
  const emptyMap = new Map<string, string>();
  const emptyPriority = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();

  test('$$ marker: domain replacement works', () => {
    const hostMap = new Map([['example126tv.com', 'example127tv.com']]);
    expect(processLine('example126tv.com$$script:contains(duyuruModal)', hostMap, emptyMap, emptyPriority))
      .toEqual(['example127tv.com$$script:contains(duyuruModal)']);
  });

  test('$@$ marker: domain replacement works', () => {
    const hostMap = new Map([['example126tv.com', 'example127tv.com']]);
    expect(processLine('example126tv.com$@$script:contains(ad)', hostMap, emptyMap, emptyPriority))
      .toEqual(['example127tv.com$@$script:contains(ad)']);
  });

  test('$$ marker: no change when domain not in hostMap', () => {
    const hostMap = new Map([['other.com', 'new.com']]);
    expect(processLine('nopattern.com$$script:contains(ad)', hostMap, emptyMap, emptyPriority))
      .toEqual(['nopattern.com$$script:contains(ad)']);
  });

  test('$$ with list: a.com,example126tv.com$$script → replaced', () => {
    const hostMap = new Map([['example126tv.com', 'example127tv.com']]);
    expect(processLine('a.com,example126tv.com$$script:contains(duyuruModal)', hostMap, emptyMap, emptyPriority))
      .toEqual(['a.com,example127tv.com$$script:contains(duyuruModal)']);
  });

  test('$$ does NOT interfere with $domain= parameters', () => {
    const hostMap = new Map([['old.com', 'new.com']]);
    // $$ inside param value prevents the $param= parser from reaching $domain=
    // (known limitation: regex /\\$([^$]+)$/ captures only after the LAST $)
    expect(processLine('||example.com^$domain=old.com,from=test$$value', hostMap, emptyMap, emptyPriority))
      .toEqual(['||example.com^$domain=old.com,from=test$$value']);
  });
});

// ============================================================================
// 2.15 processLine — uBO forms (##^, #@#^, ##+js, #@#+js)
// ============================================================================
describe('2.15 processLine — uBO forms (##^, #@#^, ##+js, #@#+js)', () => {
  const emptyMap = new Map<string, string>();
  const emptyPriority = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();

  test('##^ uBO form: domain replacement works', () => {
    const hostMap = new Map([['www.91example.com', 'www.92example.com']]);
    expect(processLine('www.91example.com##^script:has-text(runCount)', hostMap, emptyMap, emptyPriority))
      .toEqual(['www.92example.com##^script:has-text(runCount)']);
  });

  test('#@#^ uBO form: domain replacement works', () => {
    const hostMap = new Map([['www.91example.com', 'www.92example.com']]);
    expect(processLine('www.91example.com#@#^script:has-text(runCount)', hostMap, emptyMap, emptyPriority))
      .toEqual(['www.92example.com#@#^script:has-text(runCount)']);
  });

  test('##+js uBO form: domain replacement works', () => {
    const hostMap = new Map([['example001.com', 'example002.com']]);
    expect(processLine('example001.com##+js(acs, jQuery, cookie)', hostMap, emptyMap, emptyPriority))
      .toEqual(['example002.com##+js(acs, jQuery, cookie)']);
  });

  test('#@#+js uBO form: domain replacement works', () => {
    const hostMap = new Map([['example001.com', 'example002.com']]);
    expect(processLine('example001.com#@#+js(acs, jQuery, cookie)', hostMap, emptyMap, emptyPriority))
      .toEqual(['example002.com#@#+js(acs, jQuery, cookie)']);
  });

  test('uBO forms: no change when domain not in hostMap', () => {
    const hostMap = new Map([['other.com', 'new.com']]);
    expect(processLine('nopattern.com##^script:has-text(test)', hostMap, emptyMap, emptyPriority))
      .toEqual(['nopattern.com##^script:has-text(test)']);
    expect(processLine('nopattern.com#@#^script:has-text(test)', hostMap, emptyMap, emptyPriority))
      .toEqual(['nopattern.com#@#^script:has-text(test)']);
  });
});

// ============================================================================
// 2.16 processLine — List-valued modifiers ($from=, $denyallow=, $to=)
// ============================================================================
describe('2.16 processLine — List-valued modifiers ($from=, $denyallow=, $to=)', () => {
  const emptyMap = new Map<string, string>();
  const emptyPriority = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();

  test('$from= with domain list: list-valued replacement works', () => {
    const hostMap = new Map([['old1.com', 'new1.com']]);
    expect(processLine('||example.com^$from=old1.com|nopattern.com', hostMap, emptyMap, emptyPriority))
      .toEqual(['||example.com^$from=new1.com|nopattern.com']);
  });

  test('$denyallow= with domain list: list-valued replacement works', () => {
    const hostMap = new Map([['old1.com', 'new1.com']]);
    expect(processLine('||example.com^$denyallow=old1.com|nopattern.com', hostMap, emptyMap, emptyPriority))
      .toEqual(['||example.com^$denyallow=new1.com|nopattern.com']);
  });

  test('$to= with domain list: list-valued replacement works', () => {
    const hostMap = new Map([['old1.com', 'new1.com']]);
    expect(processLine('||example.com^$to=old1.com|nopattern.com', hostMap, emptyMap, emptyPriority))
      .toEqual(['||example.com^$to=new1.com|nopattern.com']);
  });

  test('single domain in $from=: simple replacement', () => {
    const hostMap = new Map([['old1.com', 'new1.com']]);
    expect(processLine('||example.com^$from=old1.com', hostMap, emptyMap, emptyPriority))
      .toEqual(['||example.com^$from=new1.com']);
  });

  test('modifiers: regexp values are NOT replaced', () => {
    const hostMap = new Map([['old1.com', 'new1.com']]);
    expect(processLine('||example.com^$from=/regexp/', hostMap, emptyMap, emptyPriority))
      .toEqual(['||example.com^$from=/regexp/']);
  });

  test('modifiers: no change when domain not in hostMap', () => {
    const hostMap = new Map([['other.com', 'new.com']]);
    expect(processLine('||example.com^$from=nopattern.com', hostMap, emptyMap, emptyPriority))
      .toEqual(['||example.com^$from=nopattern.com']);
  });
});

// ============================================================================
// 2.17 processLine — Wrapper syntax [$domain=...]
// ============================================================================
describe('2.17 processLine — Wrapper syntax [$domain=...]', () => {
  const emptyMap = new Map<string, string>();
  const emptyPriority = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();

  test('[$domain=...]#%# wrapper: domain replacement works', () => {
    const hostMap = new Map([['example001.com', 'example002.com']]);
    expect(processLine('[$domain=example001.com|nopattern.com]#%#//scriptlet(\'set-constant\', \'ads\', \'false\')', hostMap, emptyMap, emptyPriority))
      .toEqual(['[$domain=example002.com|nopattern.com]#%#//scriptlet(\'set-constant\', \'ads\', \'false\')']);
  });

  test('[$domain=...]#@# wrapper: exception marker in wrapper', () => {
    const hostMap = new Map([['testsite.com', 'newtestsite.com']]);
    expect(processLine('[$domain=testsite.com]#@#.selector', hostMap, emptyMap, emptyPriority))
      .toEqual(['[$domain=newtestsite.com]#@#.selector']);
  });

  test('[$domain=...]### wrapper: cosmetic rule', () => {
    const hostMap = new Map([['example001.com', 'example002.com']]);
    expect(processLine('[$domain=example001.com|nopattern.com]###banner', hostMap, emptyMap, emptyPriority))
      .toEqual(['[$domain=example002.com|nopattern.com]###banner']);
  });

  test('[$domain=...] wrapper: single domain replacement', () => {
    const hostMap = new Map([['old.com', 'new.com']]);
    expect(processLine('[$domain=old.com]##.ads', hostMap, emptyMap, emptyPriority))
      .toEqual(['[$domain=new.com]##.ads']);
  });

  test('[$domain=...] wrapper: single predicted mirror is processed like ordinary $domain=', () => {
    const hostMap = new Map([['example2050.com', 'example2062.com']]);
    const priorityMap = new Map([
      ['example2062.com', {
        initial: null,
        lastKnown: 'example2062.com',
        oldHost: 'example2050.com',
        workingDomains: new Set([
          'example2062.com',
          'example2063.com',
          'example2064.com',
          'example2065.com',
          'example2066.com',
          'example2067.com',
          'example2069.com',
          'example2070.com',
          'example2071.com',
          'example2072.com',
          'example2073.com',
        ]),
      }],
    ]) as Map<string, { initial: string | null; lastKnown: string; oldHost: string; workingDomains?: Set<string> }>;
    const additionalDomainsMap = new Map([
      ['example2062.com', [
        'example2063.com',
        'example2064.com',
        'example2065.com',
        'example2066.com',
        'example2067.com',
        'example2069.com',
        'example2070.com',
        'example2071.com',
        'example2072.com',
        'example2073.com',
      ]],
    ]);

    expect(processLine(
      '[$domain=example2045.com]##.header-banner',
      hostMap,
      emptyMap,
      priorityMap as Map<string, { initial: string | null; lastKnown: string; oldHost: string }>,
      additionalDomainsMap,
    )).toEqual([
      '[$domain=example2062.com|example2063.com|example2064.com|example2065.com|example2066.com|example2067.com|example2069.com|example2070.com|example2071.com|example2072.com|example2073.com]##.header-banner',
    ]);
  });

  test('[$domain=...] wrapper: no change when domain not in hostMap', () => {
    const hostMap = new Map([['other.com', 'new.com']]);
    expect(processLine('[$domain=nopattern.com]#%#//scriptlet(\'x\')', hostMap, emptyMap, emptyPriority))
      .toEqual(['[$domain=nopattern.com]#%#//scriptlet(\'x\')']);
  });

  test('[$domain=/regexp/] wrapper: regexp is NOT replaced', () => {
    const hostMap = new Map([['other.com', 'new.com']]);
    expect(processLine('[$domain=/example\\d+\\.com/]#%#//scriptlet(\'x\')', hostMap, emptyMap, emptyPriority))
      .toEqual(['[$domain=/example\\d+\\.com/]#%#//scriptlet(\'x\')']);
  });
});

// ============================================================================
// 2.18 shouldSkipLine — Wildcard with exception/uBO markers
// ============================================================================
describe('2.18 shouldSkipLine — Wildcard with exception/uBO markers', () => {
  test('wildcard with #@# exception marker → NOT skipped', () => {
    expect(shouldSkipLine('nopattern.com,example.*#@#.tracker')).toBe(false);
  });

  test('wildcard with #@$# exception marker → NOT skipped', () => {
    expect(shouldSkipLine('example.*#@$#body')).toBe(false);
  });

  test('wildcard with $$ dollar marker → NOT skipped', () => {
    expect(shouldSkipLine('example.*$$script:contains(ad)')).toBe(false);
  });

  test('wildcard with $@$ dollar marker → NOT skipped', () => {
    expect(shouldSkipLine('example.*$@$script:contains(ad)')).toBe(false);
  });

  test('wildcard with ##^ uBO form → NOT skipped', () => {
    expect(shouldSkipLine('example.*##^script:has-text(test)')).toBe(false);
  });

  test('wildcard with #@#^ uBO form → NOT skipped', () => {
    expect(shouldSkipLine('example.*#@#^script:has-text(test)')).toBe(false);
  });

  test('wildcard with ##+js uBO form → NOT skipped', () => {
    expect(shouldSkipLine('example.*##+js(acs)')).toBe(false);
  });

  test('wildcard with [$domain=...] wrapper → NOT skipped', () => {
    expect(shouldSkipLine('[$domain=example.*]#%#//scriptlet(\'x\')')).toBe(false);
  });

  test('wildcard without cosmetic/params → still skipped (no regression)', () => {
    expect(shouldSkipLine('||example*.com/*.gif')).toBe(true);
  });
});

// ============================================================================
// 2.19 processLine — Wildcard domains preserved in mix
// ============================================================================
describe('2.19 processLine — Wildcard domains preserved in mix', () => {
  const emptyMap = new Map<string, string>();
  const emptyPriority = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();

  test('single wildcard domain: example.*##.ad → unchanged', () => {
    const hostMap = new Map([['example.*', 'new.com']]);
    expect(processLine('example.*##.ad', hostMap, emptyMap, emptyPriority))
      .toEqual(['example.*##.ad']);
  });

  test('mixed list with wildcard: full domains replaced, wildcard stays', () => {
    const hostMap = new Map([['nopattern.com', 'newpattern.com'], ['testsite.com', 'newtestsite.com']]);
    expect(processLine('nopattern.com,example.*,testsite.com##.banner', hostMap, emptyMap, emptyPriority))
      .toEqual(['newpattern.com,example.*,newtestsite.com##.banner']);
  });

  test('mixed list with wildcard and exception marker', () => {
    const hostMap = new Map([['nopattern.com', 'newpattern.com']]);
    expect(processLine('nopattern.com,example.*#@#.tracker', hostMap, emptyMap, emptyPriority))
      .toEqual(['newpattern.com,example.*#@#.tracker']);
  });

  test('full domain in wildcard form stays unchanged (domain has *)', () => {
    const hostMap = new Map([['example.*', 'new.com']]);
    expect(processLine('example.*##.ad', hostMap, emptyMap, emptyPriority))
      .toEqual(['example.*##.ad']);
  });

  test('wildcard domain in single cosmetic rule → unchanged even in hostMap', () => {
    const hostMap = new Map([['example.*', 'example001.com']]);
    expect(processLine('example.*##.ad', hostMap, emptyMap, emptyPriority))
      .toEqual(['example.*##.ad']);
  });
});

// ============================================================================
// 6. Integration test — Mixed marker families (full applyReplacements flow)
// ============================================================================
describe('6. applyReplacements — Mixed marker families integration', () => {
  let tmpDir: string;

  function makeConfig(repoPath: string): Config {
    return {
      http: { timeout: 5000, retries: 1, heuristicTimeout: 3000, userAgent: 'test' },
      processing: { parallel: 1, redirectDepth: 5 },
      dnsPreCheck: { enabled: false, timeout: 1000, retryOnce: false },
      contentProbe: { enabled: false },
      antibot: { detectCodes: [], detectUrlPattern: '' },
      thresholds: { failedDaysWarning: 3 },
      heuristic: { enabled: false, maxAttempts: 5, skipOnAntibot: true, forceHeuristicOnCodes: [] },
      logging: { saveToFile: false, incremental: false, filePath: '' },
      git: { mode: 'debug', branch: 'master', prBranchPrefix: 'test-' },
      filtersdir: {
        repoPath,
        filterDirPattern: '*Filter',
        filePattern: '*.txt',
      },
      filtersdir_test: {
        repoPath,
        filterDirPattern: '*Filter',
        filePattern: '*.txt',
      },
    };
  }

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'rdc-integration-'));
    await fsp.mkdir(path.join(tmpDir, 'MixedFilter'));
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  test('mixed marker families: all families processed correctly end-to-end', async () => {
    const filterFile = path.join(tmpDir, 'MixedFilter', 'mixed.txt');

    // Create a filter file with ALL marker families in one file
    const content = [
      // --- Network rules (||domain^) ---
      '||example501.com^',
      '||example502.com/subpath^',
      // --- Basic cosmetic (##) ---
      'example501.com##.ad-banner',
      'example501.com,example502.com##.sidebar-ads',
      // --- Exception markers (#@# family) ---
      'example501.com#@#.no-ads',
      'example501.com#@##smartbanner.ios',
      'example501.com#@$#body { background: #fff !important; }',
      'example501.com#@?#.mb-6:contains(gesponsord)',
      'example501.com#@$?#.selector { remove: true; }',
      'example501.com#@%#//scriptlet(\'remove-class\', \'no_scroll\')',
      // --- Dollar-based cosmetic ($$ / $@$) ---
      'example501.com$$script:contains(duyuruModal)',
      'example501.com$@$script:contains(ad)',
      // --- uBO forms (##^, #@#^, ##+js, #@#+js) ---
      'example501.com##^script:has-text(runCount)',
      'example501.com#@#^script:has-text(runCount)',
      'example501.com##+js(acs, jQuery, cookie)',
      'example501.com#@#+js(acs, jQuery, cookie)',
      // --- List-valued modifiers ($domain=, $from=, $denyallow=, $to=) ---
      '||other.com^$domain=example501.com|nopattern.com',
      '||other.com^$from=example501.com|testsite.com',
      '||other.com^$denyallow=example501.com|mirror.com',
      '||other.com^$to=example501.com',
      // --- Wrapper syntax ([$domain=...]) ---
      '[$domain=example501.com|nopattern.com]#%#//scriptlet(\'set-constant\', \'ads\', \'false\')',
      '[$domain=example501.com]#@#.selector',
      '[$domain=example501.com]###banner',
    ].join('\n');
    await fsp.writeFile(filterFile, content, 'utf-8');

    const cfg = makeConfig(tmpDir);
    const logger = new Logger(cfg);
    const replacer = new FilterReplacer(cfg, logger, false);

    const replacements: ReplacementPair[] = [{
      siteName: 'TestSite',
      oldHost: 'example501.com',
      newHost: 'example502.com',
      startedHost: 'example501.com',
      checkDurationMs: 100,
    }];

    await replacer.applyReplacements(replacements, false);

    const written = await fsp.readFile(filterFile, 'utf-8');

    // Verify replacements happened in each marker family
    // Network rules
    expect(written).toContain('||example502.com^');
    expect(written).toContain('||example502.com/subpath^');

    // Basic cosmetic (##)
    expect(written).toContain('example502.com##.ad-banner');
    // Note: example501.com,example502.com##.sidebar-ads → deduplication removes duplicate
    expect(written).toContain('example502.com##.sidebar-ads');

    // Exception markers (#@# family)
    expect(written).toContain('example502.com#@#.no-ads');
    expect(written).toContain('example502.com#@##smartbanner.ios');
    expect(written).toContain('example502.com#@$#body { background: #fff !important; }');
    expect(written).toContain('example502.com#@?#.mb-6:contains(gesponsord)');
    expect(written).toContain('example502.com#@$?#.selector { remove: true; }');
    expect(written).toContain('example502.com#@%#//scriptlet(\'remove-class\', \'no_scroll\')');

    // Dollar-based cosmetic ($$ / $@$)
    expect(written).toContain('example502.com$$script:contains(duyuruModal)');
    expect(written).toContain('example502.com$@$script:contains(ad)');

    // uBO forms (##^, #@#^, ##+js, #@#+js)
    expect(written).toContain('example502.com##^script:has-text(runCount)');
    expect(written).toContain('example502.com#@#^script:has-text(runCount)');
    expect(written).toContain('example502.com##+js(acs, jQuery, cookie)');
    expect(written).toContain('example502.com#@#+js(acs, jQuery, cookie)');

    // List-valued modifiers
    expect(written).toContain('||other.com^$domain=example502.com|nopattern.com');
    expect(written).toContain('||other.com^$from=example502.com|testsite.com');
    expect(written).toContain('||other.com^$denyallow=example502.com|mirror.com');
    expect(written).toContain('||other.com^$to=example502.com');

    // Wrapper syntax
    expect(written).toContain('[$domain=example502.com|nopattern.com]#%#//scriptlet(\'set-constant\', \'ads\', \'false\')');
    expect(written).toContain('[$domain=example502.com]#@#.selector');
    expect(written).toContain('[$domain=example502.com]###banner');

    // Verify no old domains remain (except in wrapper where nopattern.com is expected)
    expect(written).not.toContain('example501.com');
  });

  test('mixed primary+additional replacements ignore non-pattern additions for pattern watcher', async () => {
    const filterFile = path.join(tmpDir, 'MixedFilter', 'pattern-only.txt');
    await fsp.writeFile(filterFile, 'example001.com##.ads\n[$domain=example001.com]###banner\n', 'utf-8');

    const cfg = makeConfig(tmpDir);
    const logger = new Logger(cfg);
    const replacer = new FilterReplacer(cfg, logger, false);

    const replacements: ReplacementPair[] = [
      {
        siteName: 'PatternWatcher',
        oldHost: 'example001.com',
        newHost: 'example118.com',
        startedHost: 'example001.com',
        checkDurationMs: 100,
      },
      {
        siteName: 'PatternWatcher',
        oldHost: 'example001.com',
        newHost: 'nopattern.com',
        startedHost: 'example001.com',
        checkDurationMs: 100,
      },
    ];

    await replacer.applyReplacements(replacements, false);

    const written = await fsp.readFile(filterFile, 'utf-8');
    expect(written).toContain('example118.com##.ads');
    expect(written).toContain('[$domain=example118.com]###banner');
    expect(written).not.toContain('nopattern.com');
  });
});
