import { describe, test, expect } from '@jest/globals';
import { formatWatcherSummaryEntry, isRealDomainChange } from '../src/utils.js';
import type { ReplacementPair } from '../src/types.js';

/**
 * Tests for isRealDomainChange — the shared predicate that decides
 * whether a replacement entry represents a real mirror update.
 *
 * The key improvement over the old inline filter: it uses the original
 * last_known_mirror (captured before processing started), not just
 * the startedHost or oldHost.
 */

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

describe('isRealDomainChange', () => {
  // --------------------------------------------------------------------------
  // Happy path: with originalLastKnownMirrors
  // --------------------------------------------------------------------------

  test('discovery entrypoint: startedHost changed but mirror unchanged → false', () => {
    // old.com → example027.com, where mirror was already example027.com
    const r = makeReplacement({
      siteName: 'sitename1',
      oldHost: 'old.com',
      newHost: 'example027.com',
      startedHost: 'old.com',
    });
    const originalMirrors = new Map([['sitename1', 'example027.com']]);
    expect(isRealDomainChange(r, originalMirrors)).toBe(false);
  });

  test('discovery entrypoint: gateway → same mirror → false', () => {
    const r = makeReplacement({
      siteName: 'sitename2',
      oldHost: 'gateway.com',
      newHost: 'mirror.com',
      startedHost: 'gateway.com',
    });
    const originalMirrors = new Map([['sitename2', 'mirror.com']]);
    expect(isRealDomainChange(r, originalMirrors)).toBe(false);
  });

  test('redirect source changed + mirror unchanged → false', () => {
    // example922.com → example1010.com, mirror already 1010
    const r = makeReplacement({
      siteName: 'sitename3',
      oldHost: 'example922.com',
      newHost: 'example1010.com',
      startedHost: 'example922.com',
    });
    const originalMirrors = new Map([['sitename3', 'example1010.com']]);
    expect(isRealDomainChange(r, originalMirrors)).toBe(false);
  });

  test('real mirror change → true', () => {
    // example001.com → example020.com, mirror was 001
    const r = makeReplacement({
      siteName: 'testsite',
      oldHost: 'example001.com',
      newHost: 'example020.com',
      startedHost: 'example001.com',
    });
    const originalMirrors = new Map([['testsite', 'example001.com']]);
    expect(isRealDomainChange(r, originalMirrors)).toBe(true);
  });

  test('redirect source changed + mirror changed → true', () => {
    // example922.com → example1020.com, mirror was 1010
    const r = makeReplacement({
      siteName: 'sitename3',
      oldHost: 'example922.com',
      newHost: 'example1020.com',
      startedHost: 'example922.com',
    });
    const originalMirrors = new Map([['sitename3', 'example1010.com']]);
    expect(isRealDomainChange(r, originalMirrors)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Fallback behaviour: without originalLastKnownMirrors (backward compat)
  // --------------------------------------------------------------------------

  test('no map → fallback to fromHost !== newHost (redirect detected)', () => {
    const r = makeReplacement({
      oldHost: 'example001.com',
      newHost: 'example020.com',
      startedHost: 'example001.com',
    });
    expect(isRealDomainChange(r, undefined)).toBe(true);
  });

  test('no map → fallback: same host → false', () => {
    const r = makeReplacement({
      oldHost: 'example001.com',
      newHost: 'example001.com',
      startedHost: 'example001.com',
    });
    expect(isRealDomainChange(r, undefined)).toBe(false);
  });

  test('no map → fallback: entrypoint resolution still detected as change', () => {
    // Without originalMirrors, old.com → mirror looks like a change (old behaviour)
    const r = makeReplacement({
      siteName: 'sitename1',
      oldHost: 'old.com',
      newHost: 'example027.com',
      startedHost: 'old.com',
    });
    expect(isRealDomainChange(r, undefined)).toBe(true);
  });

  test('empty map → siteName not found → fallback', () => {
    const r = makeReplacement();
    expect(isRealDomainChange(r, new Map())).toBe(true);
  });
});

describe('formatWatcherSummaryEntry', () => {
  test('formats watcher name with active host', () => {
    expect(formatWatcherSummaryEntry('PapazSports', 'www.papazsports1009.pro'))
      .toBe('PapazSports (www.papazsports1009.pro)');
  });
});
