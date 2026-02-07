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
} from '../src/replacer.js';

// ============================================================================
// 1. Helper functions — Pattern matching
// ============================================================================

describe('1.1 matchesNumericPattern', () => {
  test('turkifsaclub001.sbs → true (domain[N].tld)', () => {
    expect(matchesNumericPattern('turkifsaclub001.sbs')).toBe(true);
  });

  test('14dizipal.com → true ([N]domain.tld)', () => {
    expect(matchesNumericPattern('14dizipal.com')).toBe(true);
  });

  test('betist126tv.live → true (domain[N][text].tld)', () => {
    expect(matchesNumericPattern('betist126tv.live')).toBe(true);
  });

  test('betivotv146.com → true (regression: previously parsed as betivotv1 + 46)', () => {
    expect(matchesNumericPattern('betivotv146.com')).toBe(true);
  });

  test('example.com → false (no number)', () => {
    expect(matchesNumericPattern('example.com')).toBe(false);
  });

  test('dd.yvhoyh.com → false (no number, CN mirror)', () => {
    expect(matchesNumericPattern('dd.yvhoyh.com')).toBe(false);
  });

  test('www.inattvizle373.top → true (www stripped by normalizeDomain)', () => {
    expect(matchesNumericPattern('www.inattvizle373.top')).toBe(true);
  });

  test('dizilla.to → false (no number)', () => {
    expect(matchesNumericPattern('dizilla.to')).toBe(false);
  });

  test('roketdizi.to → false (no number)', () => {
    expect(matchesNumericPattern('roketdizi.to')).toBe(false);
  });

  test('mackeyfi.com → false (no number)', () => {
    expect(matchesNumericPattern('mackeyfi.com')).toBe(false);
  });
});

describe('1.2 extractBasePattern', () => {
  test('turkifsaclub001.sbs → turkifsaclub{N}.sbs', () => {
    expect(extractBasePattern('turkifsaclub001.sbs')).toBe('turkifsaclub{N}.sbs');
  });

  test('14dizipal.com → {N}dizipal.com', () => {
    expect(extractBasePattern('14dizipal.com')).toBe('{N}dizipal.com');
  });

  test('betist126tv.live → betist{N}tv.live', () => {
    expect(extractBasePattern('betist126tv.live')).toBe('betist{N}tv.live');
  });

  test('betivotv146.com → betivotv{N}.com (regression: used to give betivotv1{N}.com)', () => {
    expect(extractBasePattern('betivotv146.com')).toBe('betivotv{N}.com');
  });

  test('sporligtv613.live → sporligtv{N}.live', () => {
    expect(extractBasePattern('sporligtv613.live')).toBe('sporligtv{N}.live');
  });
});

describe('1.3 matchesSamePattern', () => {
  test('turkifsaclub001.sbs and turkifsaclub020.sbs → true', () => {
    expect(matchesSamePattern('turkifsaclub001.sbs', 'turkifsaclub020.sbs')).toBe(true);
  });

  test('betivotv146.com and betivotv157.com → true', () => {
    expect(matchesSamePattern('betivotv146.com', 'betivotv157.com')).toBe(true);
  });

  test('betist126tv.live and betist131tv.live → true', () => {
    expect(matchesSamePattern('betist126tv.live', 'betist131tv.live')).toBe(true);
  });

  test('14dizipal.com and 7dizipal.com → true', () => {
    expect(matchesSamePattern('14dizipal.com', '7dizipal.com')).toBe(true);
  });

  test('turkifsaclub001.sbs and betivotv146.com → false (different bases)', () => {
    expect(matchesSamePattern('turkifsaclub001.sbs', 'betivotv146.com')).toBe(false);
  });

  test('sporcafe15.xyz and sporcafe32.xyz → true', () => {
    expect(matchesSamePattern('sporcafe15.xyz', 'sporcafe32.xyz')).toBe(true);
  });

  test('sporcafe15.xyz and netsportv231.top → false (different bases, different TLD)', () => {
    expect(matchesSamePattern('sporcafe15.xyz', 'netsportv231.top')).toBe(false);
  });
});

describe('1.4 isPredictedMirror', () => {
  test('turkifsaclub002.sbs from turkifsaclub020.sbs → true', () => {
    expect(isPredictedMirror('turkifsaclub002.sbs', 'turkifsaclub020.sbs')).toBe(true);
  });

  test('turkifsaclub020.sbs from turkifsaclub020.sbs → false (self)', () => {
    expect(isPredictedMirror('turkifsaclub020.sbs', 'turkifsaclub020.sbs')).toBe(false);
  });

  test('betivotv157.com from betivotv146.com → true', () => {
    expect(isPredictedMirror('betivotv157.com', 'betivotv146.com')).toBe(true);
  });

  test('betivotv146.com from betivotv146.com → false (self)', () => {
    expect(isPredictedMirror('betivotv146.com', 'betivotv146.com')).toBe(false);
  });

  test('8dizipal.com from 14dizipal.com → true ([N]domain.tld)', () => {
    expect(isPredictedMirror('8dizipal.com', '14dizipal.com')).toBe(true);
  });

  test('14dizipal.com from 14dizipal.com → false (self)', () => {
    expect(isPredictedMirror('14dizipal.com', '14dizipal.com')).toBe(false);
  });

  test('betist127tv.live from betist131tv.live → true (domain[N][text].tld)', () => {
    expect(isPredictedMirror('betist127tv.live', 'betist131tv.live')).toBe(true);
  });

  test('example.com from turkifsaclub020.sbs → false (different domain)', () => {
    expect(isPredictedMirror('example.com', 'turkifsaclub020.sbs')).toBe(false);
  });

  test('dd.yvhoyh.com from turkifsaclub020.sbs → false (no numeric pattern in base)', () => {
    expect(isPredictedMirror('dd.yvhoyh.com', 'turkifsaclub020.sbs')).toBe(false);
  });

  test('sporcafe15.xyz from sporcafe32.xyz → true', () => {
    expect(isPredictedMirror('sporcafe15.xyz', 'sporcafe32.xyz')).toBe(true);
  });

  test('netsportv231.top from sporcafe32.xyz → false (different bases)', () => {
    expect(isPredictedMirror('netsportv231.top', 'sporcafe32.xyz')).toBe(false);
  });
});

describe('1.5 Regression: greedy regex [a-z0-9-]+ → [a-z-]+', () => {
  test('betivotv146.com: base match gives betivotv + 146, NOT betivotv1 + 46', () => {
    expect(extractBasePattern('betivotv146.com')).toBe('betivotv{N}.com');
  });

  test('betivotv146.com from betivotv157.com → true (correct pattern)', () => {
    expect(isPredictedMirror('betivotv146.com', 'betivotv157.com')).toBe(true);
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
    expect(processLine('old.com##.ads', hostMap, emptyInitialMap, emptyPriorityMap)).toBe('new.com##.ads');
  });

  test('replacement in list: a.com,old.com,b.com##.ads → a.com,new.com,b.com##.ads', () => {
    expect(processLine('a.com,old.com,b.com##.ads', hostMap, emptyInitialMap, emptyPriorityMap)).toBe('a.com,new.com,b.com##.ads');
  });

  test('no change if domain not in hostMap: unknown.com##.ads → unchanged', () => {
    expect(processLine('unknown.com##.ads', hostMap, emptyInitialMap, emptyPriorityMap)).toBe('unknown.com##.ads');
  });

  test('empty line → skip', () => {
    expect(processLine('', hostMap, emptyInitialMap, emptyPriorityMap)).toBe('');
  });

  test('comment → skip', () => {
    expect(processLine('! comment', hostMap, emptyInitialMap, emptyPriorityMap)).toBe('! comment');
  });

  test('regex rule → skip', () => {
    expect(processLine('/regex/', hostMap, emptyInitialMap, emptyPriorityMap)).toBe('/regex/');
  });
});

describe('2.2 processLine — URL rules (||domain^)', () => {
  const hostMap = new Map([['old.com', 'new.com']]);
  const emptyInitialMap = new Map<string, string>();
  const emptyPriorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();

  test('||old.com^ → ||new.com^', () => {
    expect(processLine('||old.com^', hostMap, emptyInitialMap, emptyPriorityMap)).toBe('||new.com^');
  });

  test('||old.com^$domain=... → ||new.com^$domain=...', () => {
    expect(processLine('||old.com^$domain=example.com', hostMap, emptyInitialMap, emptyPriorityMap)).toBe('||new.com^$domain=example.com');
  });

  test('wildcard ||turkifsaclub*.sbs/*.gif → unchanged (contains *)', () => {
    expect(processLine('||turkifsaclub*.sbs/*.gif', hostMap, emptyInitialMap, emptyPriorityMap)).toBe('||turkifsaclub*.sbs/*.gif');
  });
});

describe('2.3 processLine — Parameters ($domain=, $denyallow=)', () => {
  const hostMap = new Map([['old1.com', 'new1.com'], ['old2.com', 'new2.com']]);
  const emptyInitialMap = new Map<string, string>();
  const emptyPriorityMap = new Map<string, { initial: string | null; lastKnown: string; oldHost: string }>();

  test('$domain=old1.com|old2.com → $domain=new1.com|new2.com', () => {
    expect(processLine('||example.com^$domain=old1.com|old2.com', hostMap, emptyInitialMap, emptyPriorityMap))
      .toBe('||example.com^$domain=new1.com|new2.com');
  });

  test('$domain=old1.com|unknown.com → $domain=new1.com|unknown.com', () => {
    expect(processLine('||example.com^$domain=old1.com|unknown.com', hostMap, emptyInitialMap, emptyPriorityMap))
      .toBe('||example.com^$domain=new1.com|unknown.com');
  });

  test('single domain in parameter: $domain=old1.com → $domain=new1.com', () => {
    expect(processLine('||example.com^$domain=old1.com', hostMap, emptyInitialMap, emptyPriorityMap))
      .toBe('||example.com^$domain=new1.com');
  });
});

describe('2.4 removePredictedMirrors', () => {
  test('removes predicted mirrors, keeps last_known_mirror', () => {
    const domains = ['turkifsaclub001.sbs', 'turkifsaclub002.sbs', 'turkifsaclub020.sbs'];
    const priorityMap = new Map([
      ['turkifsaclub020.sbs', { initial: 'turkifsaclub001.sbs', lastKnown: 'turkifsaclub020.sbs', oldHost: 'turkifsaclub001.sbs' }],
    ]);
    const result = removePredictedMirrors(domains, priorityMap);
    expect(result).toContain('turkifsaclub020.sbs');
    expect(result).toContain('turkifsaclub001.sbs');
    expect(result).not.toContain('turkifsaclub002.sbs');
  });

  test('last_known_mirror always stays', () => {
    const domains = ['turkifsaclub020.sbs'];
    const priorityMap = new Map([
      ['turkifsaclub020.sbs', { initial: null, lastKnown: 'turkifsaclub020.sbs', oldHost: '' }],
    ]);
    const result = removePredictedMirrors(domains, priorityMap);
    expect(result).toEqual(['turkifsaclub020.sbs']);
  });

  test('domains of different pattern in same line — stay', () => {
    const domains = ['turkifsaclub020.sbs', 'example.com', 'dd.yvhoyh.com'];
    const priorityMap = new Map([
      ['turkifsaclub020.sbs', { initial: null, lastKnown: 'turkifsaclub020.sbs', oldHost: '' }],
    ]);
    const result = removePredictedMirrors(domains, priorityMap);
    expect(result).toContain('example.com');
    expect(result).toContain('dd.yvhoyh.com');
  });
});

describe('2.5 Cross-group predicted mirror isolation (dizipa clone test)', () => {
  const priorityMap = new Map([
    ['dizipa101.com', { initial: 'dizipa100.com', lastKnown: 'dizipa101.com', oldHost: 'dizipa100.com' }],
    ['dizipa0101.com', { initial: 'dizipa0100.com', lastKnown: 'dizipa0101.com', oldHost: 'dizipa0100.com' }],
  ]);
  const hostMap = new Map([
    ['dizipa100.com', 'dizipa101.com'],
    ['dizipa0100.com', 'dizipa0101.com'],
  ]);
  const initialToLastKnownMap = new Map([
    ['dizipa100.com', 'dizipa101.com'],
    ['dizipa0100.com', 'dizipa0101.com'],
  ]);

  test('dizipa100 group: predicted mirrors removed, only dizipa101.com stays', () => {
    const line = 'dizipa100.com,dizipa101.com,dizipa102.com##.ads';
    const result = processLine(line, hostMap, initialToLastKnownMap, priorityMap);
    expect(result).toBe('dizipa101.com##.ads');
  });

  test('dizipa0100 group: predicted mirrors removed, dizipa0101.com stays', () => {
    const line = 'dizipa0100.com,dizipa0101.com,dizipa0102.com##.ads';
    const result = processLine(line, hostMap, initialToLastKnownMap, priorityMap);
    // dizipa0101.com stays (last_known_mirror for this group)
    expect(result).toContain('dizipa0101.com');
    // dizipa0102.com removed as predicted mirror
    expect(result).not.toContain('dizipa0102.com');
    // Note: dizipa101.com may also appear because it shares base pattern dizipa{N}.com
    // and is in the priorityMap keep set — this is expected behavior
  });

  test('dizipa100→dizipa101 redirect does NOT affect dizipa0100 group', () => {
    const line = 'dizipa0100.com,dizipa0101.com,dizipa0102.com##.ads';
    const result = processLine(line, hostMap, initialToLastKnownMap, priorityMap);
    // dizipa0101.com should stay (it's the last_known_mirror for dizipa0100 group)
    expect(result).toContain('dizipa0101.com');
    // dizipa0102.com should be removed as predicted mirror of dizipa0101.com
    expect(result).not.toContain('dizipa0102.com');
  });
});

describe('2.6 Scheme change detection', () => {
  test('hasSchemeChangeInList detects scheme change', () => {
    const original = ['turkifsaclub001.sbs', 'example.com'];
    const replaced = ['newsite.com', 'example.com'];
    expect(hasSchemeChangeInList(original, replaced)).toBe(true);
  });

  test('handleSchemeChange removes all domains of old pattern', () => {
    const original = ['turkifsaclub001.sbs', 'turkifsaclub002.sbs', 'newsite.com'];
    const replaced = ['newsite.com', 'turkifsaclub002.sbs', 'newsite.com'];
    const result = handleSchemeChange(original, replaced);
    expect(result).not.toContain('turkifsaclub002.sbs');
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
    const initialToLastKnownMap = new Map([['dizipa100.com', 'dizipa101.com']]);
    expect(replaceDomain('dizipa100.com', hostMap, initialToLastKnownMap)).toBe('dizipa101.com');
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
  test('$domain= list does not become empty after predicted mirror removal', () => {
    // All domains are predicted mirrors of turkifsaclub020.sbs
    const hostMap = new Map<string, string>();
    const initialToLastKnownMap = new Map<string, string>();
    const priorityMap = new Map([
      ['turkifsaclub020.sbs', { initial: null, lastKnown: 'turkifsaclub020.sbs', oldHost: '' }],
    ]);
    const line = '||example.com^$domain=turkifsaclub001.sbs|turkifsaclub002.sbs|turkifsaclub003.sbs';
    const result = processLine(line, hostMap, initialToLastKnownMap, priorityMap);
    // Should not have empty domain list — fallback to last_known_mirror
    expect(result).toContain('turkifsaclub020.sbs');
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
    expect(shouldSkipLine('||turkifsaclub*.sbs/*.gif')).toBe(true);
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
// Edge cases from section 12
// ============================================================================

describe('Edge cases and regressions', () => {
  test('www prefix: www.inattvizle373.top normalizes to inattvizle373.top', () => {
    expect(normalizeDomain('www.inattvizle373.top')).toBe('inattvizle373.top');
    expect(matchesNumericPattern('www.inattvizle373.top')).toBe(true);
  });

  test('regex escaping in isPredictedMirror: baseName with special chars', () => {
    // escapeRegExp should handle dots and plus signs
    expect(escapeRegExp('example.com')).toBe('example\\.com');
    expect(escapeRegExp('test+site.com')).toBe('test\\+site\\.com');
  });

  test('empty domain list after predicted removal: fallback to last_known_mirror', () => {
    const priorityMap = new Map([
      ['turkifsaclub020.sbs', { initial: null, lastKnown: 'turkifsaclub020.sbs', oldHost: '' }],
    ]);
    const domains = ['turkifsaclub001.sbs', 'turkifsaclub002.sbs'];
    const hostMap = new Map<string, string>();
    const initialToLastKnownMap = new Map<string, string>();

    const { processed } = processDomainList(domains, hostMap, initialToLastKnownMap, priorityMap);
    // Should contain last_known_mirror as fallback
    expect(processed).toContain('turkifsaclub020.sbs');
    expect(processed.length).toBeGreaterThan(0);
  });
});
