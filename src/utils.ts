/**
 * Shared utility functions for Rotating Domains Checker
 */

/**
 * Natural comparison for domain names - compares numeric chunks as numbers.
 * Example: example9 < example18 < example20 (not lexicographic: example18 < example20 < example9)
 */
export function naturalCompare(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g;
  const chunksA = a.match(re) ?? [a];
  const chunksB = b.match(re) ?? [b];
  for (let i = 0; i < Math.max(chunksA.length, chunksB.length); i++) {
    const ca = chunksA[i] ?? '';
    const cb = chunksB[i] ?? '';
    const na = parseInt(ca, 10);
    const nb = parseInt(cb, 10);
    if (!isNaN(na) && !isNaN(nb)) {
      if (na !== nb) return na - nb;
    } else {
      if (ca < cb) return -1;
      if (ca > cb) return 1;
    }
  }
  return 0;
}

/**
 * Calculate days elapsed since a given date string.
 * Parses both "YYYY-MM-DD" and "YYYY-MM-DD HH:MM" formats.
 * Returns 0 for empty/whitespace-only strings or parse errors.
 */
export function calculateDaysSince(dateStr: string): number {
  if (!dateStr || dateStr.trim() === '') return 0;
  try {
    const parsedDate = new Date(dateStr.replace(" ", "T"));
    const now = new Date();
    const diffMs = Math.abs(now.getTime() - parsedDate.getTime());
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return 0;
  }
}
