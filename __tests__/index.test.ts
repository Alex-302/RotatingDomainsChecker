import { describe, test, expect } from '@jest/globals';
import { naturalCompare, selectFirstByOrder } from '../src/index.js';

// ============================================================================
// 11. naturalCompare and selectFirstByOrder
// ============================================================================

describe('11.1 naturalCompare - natural sorting for domain names', () => {
  test('same strings → returns 0', () => {
    expect(naturalCompare('example.com', 'example.com')).toBe(0);
    expect(naturalCompare('piabettv18.live', 'piabettv18.live')).toBe(0);
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
    expect(naturalCompare('piabettv9.live', 'piabettv18.live')).toBeLessThan(0);
    expect(naturalCompare('piabettv18.live', 'piabettv9.live')).toBeGreaterThan(0);
  });

  test('handles three-digit numbers', () => {
    expect(naturalCompare('hdselcuksports99.top', 'hdselcuksports100.top')).toBeLessThan(0);
    expect(naturalCompare('hdselcuksports605.top', 'hdselcuksports615.top')).toBeLessThan(0);
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
    expect(naturalCompare('piabettv1.com', 'hdselcuk1.com')).toBeGreaterThan(0);
  });

  test('real-world domain patterns', () => {
    const domains = [
      'piabettv20.live',
      'piabettv18.live',
      'piabettv9.live',
      'piabettv21.live',
    ];
    const sorted = [...domains].sort(naturalCompare);
    expect(sorted).toEqual([
      'piabettv9.live',
      'piabettv18.live',
      'piabettv20.live',
      'piabettv21.live',
    ]);
  });

  test('hdselcuksports pattern sorts correctly', () => {
    const domains = [
      'hdselcuksports615.top',
      'hdselcuksports605.top',
      'hdselcuksports610.top',
      'hdselcuksports99.top',
    ];
    const sorted = [...domains].sort(naturalCompare);
    expect(sorted).toEqual([
      'hdselcuksports99.top',
      'hdselcuksports605.top',
      'hdselcuksports610.top',
      'hdselcuksports615.top',
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
    expect(selectFirstByOrder('piabettv20.live', ['piabettv18.live']))
      .toBe('piabettv18.live');
    expect(selectFirstByOrder('piabettv18.live', ['piabettv20.live']))
      .toBe('piabettv18.live');
  });

  test('multiple additional domains → picks the lowest by natural sort', () => {
    // Race condition scenario: HTTP responses arrive in random order
    // piabettv20 finished first, but 18, 19, 21 are also working
    expect(selectFirstByOrder('piabettv20.live', [
      'piabettv18.live',
      'piabettv21.live',
      'piabettv19.live',
    ])).toBe('piabettv18.live');
  });

  test('picks 9 over 18 (natural, not lexicographic)', () => {
    // This is the key fix - lexicographic sort would pick 18 over 9
    expect(selectFirstByOrder('piabettv18.live', ['piabettv9.live']))
      .toBe('piabettv9.live');
    expect(selectFirstByOrder('piabettv9.live', ['piabettv18.live']))
      .toBe('piabettv9.live');
  });

  test('hdselcuksports pattern picks lowest', () => {
    expect(selectFirstByOrder('hdselcuksports610.top', [
      'hdselcuksports605.top',
      'hdselcuksports615.top',
      'hdselcuksports608.top',
    ])).toBe('hdselcuksports605.top');
  });

  test('newHost is the lowest → returns newHost', () => {
    expect(selectFirstByOrder('piabettv8.live', [
      'piabettv18.live',
      'piabettv20.live',
    ])).toBe('piabettv8.live');
  });

  test('duplicates in additional domains are handled', () => {
    // piabettv19 redirects to piabettv20, so 20 appears twice
    expect(selectFirstByOrder('piabettv20.live', [
      'piabettv18.live',
      'piabettv20.live', // duplicate
      'piabettv21.live',
    ])).toBe('piabettv18.live');
  });
});
