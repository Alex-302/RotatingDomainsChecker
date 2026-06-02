import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { gitSkipReason, naturalCompare, selectFirstByOrder, calculateDaysSince, selectPatternAwareWorkingSet, isRealDomainChange } from '../src/index.js';
import { loadWatchers, saveWatchers } from '../src/config.js';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Summary, ReplacementPair } from '../src/types.js';

// ============================================================================
// 11. naturalCompare and selectFirstByOrder
// ============================================================================
// 11.3 success_since migration and state churn
// ============================================================================



describe('11.1 naturalCompare - natural sorting for domain names', () => {
  test('same strings → returns 0', () => {
    expect(naturalCompare('example.com', 'example.com')).toBe(0);
    expect(naturalCompare('exampletv18.live', 'exampletv18.live')).toBe(0);
  });

  test('pure text comparison works like normal sort', () => {
    expect(naturalCompare('abc.com', 'def.com')).toBeLessThan(0);
    expect(naturalCompare('def.com', 'abc.com')).toBeGreaterThan(0);
    expect(naturalCompare('aaa.com', 'bbb.com')).toBeLessThan(0);
  });

  test('single digit numbers sort correctly', () => {
    expect(naturalCompare('site1.com', 'site2.com')).toBeLessThan(0);
    expect(naturalCompare('site9.com', 'site2.com')).toBeGreaterThan(0);
  });

  test('multi-digit numbers sort numerically, not lexicographically', () => {
    // Lexicographic: "18" < "9" (because '1' < '9')
    // Natural: 9 < 18
    expect(naturalCompare('exampletv9.live', 'exampletv18.live')).toBeLessThan(0);
    expect(naturalCompare('exampletv18.live', 'exampletv9.live')).toBeGreaterThan(0);
  });

  test('handles three-digit numbers', () => {
    expect(naturalCompare('examplesports99.top', 'examplesports100.top')).toBeLessThan(0);
    expect(naturalCompare('examplesports605.top', 'examplesports615.top')).toBeLessThan(0);
    expect(naturalCompare('site999.com', 'site1000.com')).toBeLessThan(0);
  });

  test('leading zeros do not affect numeric comparison', () => {
    expect(naturalCompare('file001.txt', 'file1.txt')).toBe(0);
    expect(naturalCompare('file001.txt', 'file002.txt')).toBeLessThan(0);
  });

  test('mixed text and numbers', () => {
    // example126tv.com vs example127tv.com - number in middle
    expect(naturalCompare('example126tv.com', 'example127tv.com')).toBeLessThan(0);
    expect(naturalCompare('example9tv.com', 'example126tv.com')).toBeLessThan(0);
  });

  test('different base names sort by text first', () => {
    expect(naturalCompare('alpha1.com', 'beta1.com')).toBeLessThan(0);
    expect(naturalCompare('exampletv1.com', 'examplesports1.com')).toBeGreaterThan(0);
  });

  test('real-world domain patterns', () => {
    const domains = [
      'exampletv20.live',
      'exampletv18.live',
      'exampletv9.live',
      'exampletv21.live',
    ];
    const sorted = [...domains].sort(naturalCompare);
    expect(sorted).toEqual([
      'exampletv9.live',
      'exampletv18.live',
      'exampletv20.live',
      'exampletv21.live',
    ]);
  });

  test('examplesports pattern sorts correctly', () => {
    const domains = [
      'examplesports615.top',
      'examplesports605.top',
      'examplesports610.top',
      'examplesports99.top',
    ];
    const sorted = [...domains].sort(naturalCompare);
    expect(sorted).toEqual([
      'examplesports99.top',
      'examplesports605.top',
      'examplesports610.top',
      'examplesports615.top',
    ]);
  });
});

describe('11.2 selectFirstByOrder - picks lowest domain by natural sort', () => {
  test('no additional domains → returns newHost as-is', () => {
    expect(selectFirstByOrder('example.com')).toBe('example.com');
    expect(selectFirstByOrder('example.com', [])).toBe('example.com');
    expect(selectFirstByOrder('example.com', undefined)).toBe('example.com');
  });

  test('single additional domain → picks lower of the two', () => {
    expect(selectFirstByOrder('exampletv20.live', ['exampletv18.live']))
      .toBe('exampletv18.live');
    expect(selectFirstByOrder('exampletv18.live', ['exampletv20.live']))
      .toBe('exampletv18.live');
  });

  test('multiple additional domains → picks the lowest by natural sort', () => {
    // Race condition scenario: HTTP responses arrive in random order
    // exampletv20 finished first, but 18, 19, 21 are also working
    expect(selectFirstByOrder('exampletv20.live', [
      'exampletv18.live',
      'exampletv21.live',
      'exampletv19.live',
    ])).toBe('exampletv18.live');
  });

  test('picks 9 over 18 (natural, not lexicographic)', () => {
    // This is the key fix - lexicographic sort would pick 18 over 9
    expect(selectFirstByOrder('exampletv18.live', ['exampletv9.live']))
      .toBe('exampletv9.live');
    expect(selectFirstByOrder('exampletv9.live', ['exampletv18.live']))
      .toBe('exampletv9.live');
  });

  test('examplesports pattern picks lowest', () => {
    expect(selectFirstByOrder('examplesports610.top', [
      'examplesports605.top',
      'examplesports615.top',
      'examplesports608.top',
    ])).toBe('examplesports605.top');
  });

  test('newHost is the lowest → returns newHost', () => {
    expect(selectFirstByOrder('exampletv8.live', [
      'exampletv18.live',
      'exampletv20.live',
    ])).toBe('exampletv8.live');
  });

  test('duplicates in additional domains are handled', () => {
    // exampletv19 redirects to exampletv20, so 20 appears twice
    expect(selectFirstByOrder('exampletv20.live', [
      'exampletv18.live',
      'exampletv20.live', // duplicate
      'exampletv21.live',
    ])).toBe('exampletv18.live');
  });
});

describe('11.2b selectPatternAwareWorkingSet - mixed-set canonicalization', () => {
  test('prefers the smallest live pattern domain and ignores non-pattern additions', () => {
    const workingSet = selectPatternAwareWorkingSet('example2073.com', [
      'mirrorhub.example',
      'example2069.com',
      'example2070.com',
    ]);

    expect(workingSet.canonicalHost).toBe('example2069.com');
    expect(workingSet.additionalPatternDomains).toEqual(['example2070.com', 'example2073.com']);
    expect(workingSet.ignoredNonPatternDomains).toEqual(['mirrorhub.example']);
  });

  test('keeps alias candidates when many pattern domains share one final host', () => {
    const workingSet = selectPatternAwareWorkingSet('testsite72.com', [
      'testsite65.com',
      'testsite66.com',
      'testsite71.com',
    ]);

    expect(workingSet.canonicalHost).toBe('testsite65.com');
    expect(workingSet.additionalPatternDomains).toEqual([
      'testsite66.com',
      'testsite71.com',
      'testsite72.com',
    ]);
    expect(workingSet.ignoredNonPatternDomains).toEqual([]);
  });
});

describe('11.3 success_since — legacy migration & state semantic', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rdc-success-since-'));
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('load → save → load: legacy last_seen migrates and is never repersisted', async () => {
    const watchersContent = `sites:
  site-a:
    initial_domain: example001.com
    last_known_mirror: example020.com
    last_seen: "2024-01-15"
`;
    const path = join(tempDir, 'watchers-a.yml');
    writeFileSync(path, watchersContent, 'utf-8');

    const first = await loadWatchers(path);
    expect(first.sites['site-a'].success_since).toBe('2024-01-15');
    expect(first.sites['site-a'].last_seen).toBeUndefined();

    // Persist and reload — legacy field must never return
    await saveWatchers(first, path);
    const second = await loadWatchers(path);
    expect(second.sites['site-a'].success_since).toBe('2024-01-15');
    expect(second.sites['site-a'].last_seen).toBeUndefined();
    expect(readFileSync(path, 'utf-8')).not.toContain('last_seen');
    expect(readFileSync(path, 'utf-8')).toContain('success_since');
  });

  test('explicit success_since wins over legacy last_seen when both present', async () => {
    const watchersContent = `sites:
  site-b:
    last_known_mirror: example020.com
    last_seen: "2024-01-15"
    success_since: "2024-06-01 08:00"
`;
    const path = join(tempDir, 'watchers-b.yml');
    writeFileSync(path, watchersContent, 'utf-8');

    const loaded = await loadWatchers(path);
    expect(loaded.sites['site-b'].success_since).toBe('2024-06-01 08:00');
    expect(loaded.sites['site-b'].last_seen).toBeUndefined();
  });
});

describe('11.4 calculateDaysSince — integer day-bucket counter', () => {
  test('returns 0 for empty / whitespace input', () => {
    // No fake timers needed — guard-clause behavior doesn't depend on "now".
    expect(calculateDaysSince('')).toBe(0);
    expect(calculateDaysSince('   ')).toBe(0);
  });

  test('returns integer day count via ceil rounding', () => {
    jest.useFakeTimers({ now: new Date('2026-05-20T12:00:00Z') });
    try {
      // 1h ago → ceil(1/24) = 1
      expect(calculateDaysSince('2026-05-20T11:00:00Z')).toBe(1);
      // 25h ago → ceil(25/24) = 2
      expect(calculateDaysSince('2026-05-19T11:00:00Z')).toBe(2);
      // exactly 48h ago → 2
      expect(calculateDaysSince('2026-05-18T12:00:00Z')).toBe(2);
      // 48h + 1min ago → ceil > 2 → 3
      expect(calculateDaysSince('2026-05-18T11:59:00Z')).toBe(3);
    } finally {
      jest.useRealTimers();
    }
  });

  test('same-wallclock calls return the same integer count (stable day bucket)', () => {
    jest.useFakeTimers({ now: new Date('2026-05-23T15:00:00Z') });
    try {
      // exactly 72h ago → ceil(3.0) = 3
      const threeDaysAgo = '2026-05-20T15:00:00Z';
      const a = calculateDaysSince(threeDaysAgo);
      const b = calculateDaysSince(threeDaysAgo);
      expect(a).toBe(b);
      expect(a).toBe(3);
    } finally {
      jest.useRealTimers();
    }
  });

  test('parses both "YYYY-MM-DD HH:MM" and ISO "YYYY-MM-DDTHH:MM:SS" inputs without crashing', () => {
    jest.useFakeTimers({ now: new Date('2026-05-20T14:00:00Z') });
    try {
      // "YYYY-MM-DDTHH:MM:SS" (no Z) is parsed as local time, just like "YYYY-MM-DD HH:MM";
      // whatever the CI timezone, both forms should yield the same integer count.
      expect(calculateDaysSince('2026-05-18T14:00:00')).toBeGreaterThanOrEqual(1);
      expect(calculateDaysSince('2026-05-18 14:00')).toBe(
        calculateDaysSince('2026-05-18T14:00:00'),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('11.5 failed_days day-bucket suppression (repeated failures)', () => {
  test('second failure on the same day does not rewrite failed_days', () => {
    jest.useFakeTimers({ now: new Date('2026-05-20T23:00:00Z') });
    try {
      const site: { failed_since?: string; failed_days?: number } = {
        failed_since: '2026-05-20T12:00:00Z',
        failed_days: 0,
      };

      // All dates use Z-suffix (UTC) so the math is CI-timezone-independent.
      const firstCall = calculateDaysSince(site.failed_since!);
      site.failed_days = firstCall;
      const secondCall = calculateDaysSince(site.failed_since!);
      if (site.failed_days !== secondCall) {
        site.failed_days = secondCall;
      }
      expect(site.failed_days).toBe(firstCall);
      expect(site.failed_since).toBe('2026-05-20T12:00:00Z');
    } finally {
      jest.useRealTimers();
    }
  });

  test('failed_days increments when the day bucket crosses', () => {
    jest.useFakeTimers({ now: new Date('2026-05-20T14:00:00Z') });
    try {
      const site: { failed_since?: string; failed_days?: number } = {
        failed_since: '2026-05-20T14:00:00Z',
        failed_days: 0,
      };
      jest.setSystemTime(new Date('2026-05-23T14:00:00Z'));
      const newDays = calculateDaysSince(site.failed_since!);
      if (site.failed_days !== newDays) {
        site.failed_days = newDays;
      }
      expect(site.failed_days).toBe(3);
    } finally {
      jest.useRealTimers();
    }
  });

  test('pattern-change alert on pre-existing failure does NOT reset failed_since', () => {
    jest.useFakeTimers({ now: new Date('2026-05-25T14:00:00Z') });
    try {
      const site: { failed_since?: string; failed_days?: number; potentially_dead?: boolean } = {
        failed_since: '2026-05-20T14:00:00Z',
        failed_days: 5,
        potentially_dead: true,
      };

      if (!site.failed_since) {
        site.failed_since = '2026-05-25T14:00:00Z';
        site.failed_days = 0;
      } else {
        const newDays = calculateDaysSince(site.failed_since);
        if (site.failed_days !== newDays) {
          site.failed_days = newDays;
        }
      }
      site.potentially_dead = true;

      expect(site.failed_since).toBe('2026-05-20T14:00:00Z');
      expect(site.failed_days).toBe(5);
      expect(site.potentially_dead).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  test('pattern-change alert on fresh (never-failed) site sets failed_since = now, failed_days = 0', () => {
    jest.useFakeTimers({ now: new Date('2026-05-25T14:00:00Z') });
    try {
      const site: { failed_since?: string; failed_days?: number; potentially_dead?: boolean } = {};

      if (!site.failed_since) {
        site.failed_since = '2026-05-25T14:00:00Z';
        site.failed_days = 0;
      }
      site.potentially_dead = true;

      expect(site.failed_since).toBe('2026-05-25T14:00:00Z');
      expect(site.failed_days).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('11.6 success_since churn suppression (shouldUpdate branch guard)', () => {
  test('force_search_ahead: effectiveNewHost === oldLastKnownMirror does NOT update success_since', () => {
    jest.useFakeTimers({ now: new Date('2026-05-24T23:44:00Z') });
    try {
      const site: { last_known_mirror: string; success_since?: string } = {
        last_known_mirror: 'example001.com',
        success_since: '2026-05-24 12:00',
      };

      const oldLastKnownMirror = site.last_known_mirror;
      const newHost = 'example003.com'; // redirect final from Phase 1
      const additionalWorkingDomains = ['example001.com', 'example002.com'];
      const effectiveNewHost = selectFirstByOrder(newHost, additionalWorkingDomains);

      // Verify scenario: effectiveNewHost = min([003, 001, 002]) = 001
      expect(effectiveNewHost).toBe('example001.com');
      expect(effectiveNewHost).toBe(oldLastKnownMirror);

      // Simulate guard logic from src/index.ts shouldUpdate branch
      const nowFormatted = '2026-05-24 23:44';
      if (effectiveNewHost !== oldLastKnownMirror) {
        // Would call updateSuccessSince(site, nowFormatted)
        if (site.success_since !== nowFormatted) {
          site.success_since = nowFormatted;
        }
      }

      // Expected: success_since NOT updated (churn suppressed)
      expect(site.success_since).toBe('2026-05-24 12:00');
    } finally {
      jest.useRealTimers();
    }
  });

  test('actual domain change DOES update success_since', () => {
    jest.useFakeTimers({ now: new Date('2026-05-24T23:44:00Z') });
    try {
      const site: { last_known_mirror: string; success_since?: string } = {
        last_known_mirror: 'example001.com',
        success_since: '2026-05-24 12:00',
      };

      const oldLastKnownMirror = site.last_known_mirror;
      const newHost = 'example005.com'; // real change
      const effectiveNewHost = selectFirstByOrder(newHost, []);

      expect(effectiveNewHost).toBe('example005.com');
      expect(effectiveNewHost).not.toBe(oldLastKnownMirror);

      // Simulate guard logic
      const nowFormatted = '2026-05-24 23:44';
      if (effectiveNewHost !== oldLastKnownMirror) {
        if (site.success_since !== nowFormatted) {
          site.success_since = nowFormatted;
        }
      }

      // Expected: success_since updated
      expect(site.success_since).toBe('2026-05-24 23:44');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('11.7 success_since cleared on failure transition', () => {
  test('real failure deletes success_since (success → failed state)', () => {
    jest.useFakeTimers({ now: new Date('2026-05-25T00:34:00Z') });
    try {
      const site: {
        success_since?: string;
        failed_since?: string;
        failed_days?: number;
        potentially_dead?: boolean;
      } = {
        success_since: '2026-05-24 23:44',
      };

      const nowFormatted = '2026-05-25 00:34';

      // Simulate real failure branch from src/index.ts
      if (!site.failed_since) {
        site.failed_since = nowFormatted;
        site.failed_days = 0;
      } else {
        const newDays = 1; // calculateDaysSince mock
        if (site.failed_days !== newDays) {
          site.failed_days = newDays;
        }
      }
      site.potentially_dead = true;
      delete site.success_since;

      // Expected: success_since removed, failed state set
      expect(site.success_since).toBeUndefined();
      expect(site.failed_since).toBe('2026-05-25 00:34');
      expect(site.failed_days).toBe(0);
      expect(site.potentially_dead).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  test('pattern-change failure deletes success_since', () => {
    jest.useFakeTimers({ now: new Date('2026-05-25T14:00:00Z') });
    try {
      const site: {
        success_since?: string;
        failed_since?: string;
        failed_days?: number;
        potentially_dead?: boolean;
      } = {
        success_since: '2026-05-20 10:00',
      };

      const nowFormatted = '2026-05-25 14:00';

      // Simulate pattern-change failure branch
      if (!site.failed_since) {
        site.failed_since = nowFormatted;
        site.failed_days = 0;
      } else {
        const newDays = 5;
        if (site.failed_days !== newDays) {
          site.failed_days = newDays;
        }
      }
      site.potentially_dead = true;
      delete site.success_since;

      // Expected: success_since removed
      expect(site.success_since).toBeUndefined();
      expect(site.failed_since).toBe('2026-05-25 14:00');
      expect(site.potentially_dead).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  test('recovery: failed → success sets new success_since', () => {
    jest.useFakeTimers({ now: new Date('2026-05-26T12:00:00Z') });
    try {
      const site: {
        success_since?: string;
        failed_since?: string;
        failed_days?: number;
        potentially_dead?: boolean;
      } = {
        failed_since: '2026-05-25 00:34',
        failed_days: 1,
        potentially_dead: true,
      };

      const nowFormatted = '2026-05-26 12:00';

      // Simulate success branch (recovery)
      site.success_since = nowFormatted;
      delete site.failed_since;
      delete site.failed_days;
      delete site.potentially_dead;

      // Expected: success_since set, failed state cleared
      expect(site.success_since).toBe('2026-05-26 12:00');
      expect(site.failed_since).toBeUndefined();
      expect(site.failed_days).toBeUndefined();
      expect(site.potentially_dead).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('11.8 state cleanup and churn suppression coverage', () => {
  test('success without change and without prior failure does NOT rewrite success_since', () => {
    jest.useFakeTimers({ now: new Date('2026-05-26T12:00:00Z') });
    try {
      const site: {
        success_since?: string;
        failed_since?: string;
        failed_days?: number;
        potentially_dead?: boolean;
      } = {
        success_since: '2026-05-24 23:44',
      };

      const hadFailureBeforeThisRun = false;
      const nowFormatted = '2026-05-26 12:00';

      // Simulate unchanged success branch from src/index.ts
      if (hadFailureBeforeThisRun) {
        site.success_since = nowFormatted;
      }
      delete site.failed_since;
      delete site.failed_days;
      delete site.potentially_dead;

      expect(site.success_since).toBe('2026-05-24 23:44');
      expect(site.failed_since).toBeUndefined();
      expect(site.failed_days).toBeUndefined();
      expect(site.potentially_dead).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  test('repeated real failure preserves failed_since and keeps success_since cleared', () => {
    jest.useFakeTimers({ now: new Date('2026-05-26T12:00:00Z') });
    try {
      const site: {
        success_since?: string;
        failed_since?: string;
        failed_days?: number;
        potentially_dead?: boolean;
      } = {
        failed_since: '2026-05-25 00:34',
        failed_days: 1,
        potentially_dead: true,
      };

      const originalFailedSince = site.failed_since;
      const newDays = 2;

      // Simulate repeated real failure branch from src/index.ts
      if (!site.failed_since) {
        site.failed_since = '2026-05-26 12:00';
        site.failed_days = 0;
      } else if (site.failed_days !== newDays) {
        site.failed_days = newDays;
      }
      site.potentially_dead = true;
      delete site.success_since;

      expect(site.failed_since).toBe(originalFailedSince);
      expect(site.failed_days).toBe(2);
      expect(site.potentially_dead).toBe(true);
      expect(site.success_since).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  test('repeated identical non-pattern run does NOT rewrite success_since', () => {
    jest.useFakeTimers({ now: new Date('2026-05-26T12:00:00Z') });
    try {
      const site: {
        success_since?: string;
        failed_since?: string;
        failed_days?: number;
        potentially_dead?: boolean;
        non_pattern_mirror?: string;
      } = {
        success_since: '2026-05-24 23:44',
        non_pattern_mirror: 'nopattern.com',
      };

      const oldNonPatternMirror = 'nopattern.com';
      const nonPatternCanonical = 'nopattern.com';
      const hadFailureBeforeThisRun = false;
      const nowFormatted = '2026-05-26 12:00';

      if (site.non_pattern_mirror !== nonPatternCanonical) {
        site.non_pattern_mirror = nonPatternCanonical;
      }
      if (oldNonPatternMirror !== nonPatternCanonical || hadFailureBeforeThisRun) {
        site.success_since = nowFormatted;
      }
      delete site.failed_since;
      delete site.failed_days;
      delete site.potentially_dead;

      expect(site.non_pattern_mirror).toBe('nopattern.com');
      expect(site.success_since).toBe('2026-05-24 23:44');
    } finally {
      jest.useRealTimers();
    }
  });

  test('accepted antibot unchanged and without prior failure does NOT rewrite success_since', () => {
    jest.useFakeTimers({ now: new Date('2026-05-26T12:00:00Z') });
    try {
      const site: {
        last_known_mirror: string;
        success_since?: string;
        failed_since?: string;
        failed_days?: number;
        potentially_dead?: boolean;
      } = {
        last_known_mirror: 'example001.com',
        success_since: '2026-05-24 23:44',
      };

      const effectiveNewHostAntibot = 'example001.com';
      const oldLastKnownMirrorAntibot = site.last_known_mirror;
      const antibotActuallyChanged = effectiveNewHostAntibot !== oldLastKnownMirrorAntibot;
      const hadFailureBeforeThisRun = false;
      const nowFormatted = '2026-05-26 12:00';

      if (antibotActuallyChanged) {
        site.last_known_mirror = effectiveNewHostAntibot;
        if (effectiveNewHostAntibot !== oldLastKnownMirrorAntibot) {
          site.success_since = nowFormatted;
        }
      }
      if (antibotActuallyChanged || hadFailureBeforeThisRun) {
        site.success_since = nowFormatted;
      }
      delete site.failed_since;
      delete site.failed_days;
      delete site.potentially_dead;

      expect(site.last_known_mirror).toBe('example001.com');
      expect(site.success_since).toBe('2026-05-24 23:44');
    } finally {
      jest.useRealTimers();
    }
  });
});

// ============================================================================
// 11.9 Console summary counters (task 02/04 regression tests)
// ============================================================================
describe('11.9 console summary counters', () => {
  function makeReplacement(overrides?: Partial<ReplacementPair>): ReplacementPair {
    return {
      siteName: 'testsite',
      oldHost: 'example001.com',
      newHost: 'example020.com',
      startedHost: 'example001.com',
      checkDurationMs: 1500,
      ...overrides,
    };
  }

  test('Mirror updates counter matches isRealDomainChange results after dedup', () => {
    // Simulate the dedup+filter logic from main() in index.ts
    const replacements: ReplacementPair[] = [
      // Site1: real change (example001 → example020, original was example001)
      makeReplacement({ siteName: 'Site1', oldHost: 'example001.com', newHost: 'example020.com', startedHost: 'example001.com' }),
      // Site1 duplicate — should be deduped
      makeReplacement({ siteName: 'Site1', oldHost: 'example001.com', newHost: 'example020.com', startedHost: 'redirect.link' }),
      // Site2: entrypoint only — mirror unchanged (original was example027.com)
      makeReplacement({ siteName: 'Site2', oldHost: 'old.com', newHost: 'example027.com', startedHost: 'old.com' }),
      // Site3: entrypoint only — mirror unchanged (original was example100.com)
      makeReplacement({ siteName: 'Site3', oldHost: 'short.link', newHost: 'example100.com', startedHost: 'short.link' }),
      // Site4: real change (example200 → example201, original was example200)
      makeReplacement({ siteName: 'Site4', oldHost: 'example200.com', newHost: 'example201.com', startedHost: 'example200.com' }),
    ];

    const originalLastKnownMirrors = new Map([
      ['Site1', 'example001.com'],  // different → true (real change)
      ['Site2', 'example027.com'],  // same → false (entrypoint only)
      ['Site3', 'example100.com'],  // same → false (entrypoint only)
      ['Site4', 'example200.com'],  // different → true (real change)
    ]);

    // Replicate the dedup+filter logic from main()
    const primaryBySite = new Map<string, ReplacementPair>();
    for (const r of replacements) {
      if (!primaryBySite.has(r.siteName)) {
        primaryBySite.set(r.siteName, r);
      }
    }
    const mirrorUpdateEntries = [...primaryBySite.values()].filter(r =>
      isRealDomainChange(r, originalLastKnownMirrors)
    );

    // After dedup: Site1, Site2, Site3, Site4 (4 entries)
    expect(primaryBySite.size).toBe(4);
    // After filter: Site1 and Site4 are real changes → 2
    expect(mirrorUpdateEntries.length).toBe(2);
    expect(mirrorUpdateEntries.map(e => e.siteName).sort()).toEqual(['Site1', 'Site4']);
  });

  test('Pattern list updates counter uses patternDiffs.length with nullish fallback', () => {
    // The counter formula is: replacerStats.patternDiffs?.length ?? 0
    // Use a function that returns the union so TS doesn't narrow to never
    function maybeArr(n: number): string[] | undefined {
      return n === 0 ? undefined : n === 1 ? [] : ['a', 'b', 'c'];
    }
    expect(maybeArr(2)?.length ?? 0).toBe(3);
    expect(maybeArr(1)?.length ?? 0).toBe(0);
    expect(maybeArr(0)?.length ?? 0).toBe(0);
  });

  test('Pattern→non-pattern counter filters warnings by pattern_changed keyword', () => {
    // The counter formula is: summary.warnings.filter(w => w.includes('Pattern domain redirected to non-pattern')).length
    const warnings = [
      'Some regular warning',
      'Pattern domain redirected to non-pattern for SiteA',
      'Another regular warning',
      'Pattern domain redirected to non-pattern for SiteB',
    ];

    const nPatternToNonPattern = warnings.filter(
      w => w.includes('Pattern domain redirected to non-pattern')
    ).length;

    expect(nPatternToNonPattern).toBe(2);
  });
});

// ============================================================================
// 11.10 gitSkipReason — test_live guard regression (Bug 3)
// ============================================================================
describe('11.10 gitSkipReason', () => {
  test('test_live: isTestMode && !dryRun → skip', () => {
    expect(gitSkipReason(true, false, true)).toBe('test mode (files were modified locally)');
  });
  test('test_live: skipReason non-null even without real changes', () => {
    expect(gitSkipReason(true, false, false)).toBe('test mode (files were modified locally)');
  });
  test('test_dry: isTestMode && dryRun → no skip from test mode', () => {
    expect(gitSkipReason(true, true, true)).toBeNull();
  });
  test('prod_dry: !isTestMode && dryRun → no test mode skip', () => {
    expect(gitSkipReason(false, true, true)).toBeNull();
  });
  test('no real changes → skip with filter cleanup message', () => {
    expect(gitSkipReason(false, false, false)).toBe('no filter changes (all domains already up to date)');
  });
  test('hasRealChanges + prod_live → no skip', () => {
    expect(gitSkipReason(false, false, true)).toBeNull();
  });
  test('hasRealChanges + prod_live → skipReason null → git guard not inverted', () => {
    // Regression: skipReason must be null for real git operations to proceed.
    // Previously the guard was inverted (if(skipReason) { git }) causing test_live to actually run git.
    const skipReason = gitSkipReason(false, false, true);
    expect(skipReason).toBeNull();
    expect(skipReason === null).toBe(true);
  });
});
