/**
 * Shared utility functions for Rotating Domains Checker
 */

import type { ReplacementPair } from "./types.js";

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

/**
 * Determines whether a replacement entry represents a real mirror update.
 * Uses the original last_known_mirror (captured before processing started)
 * to distinguish actual changes from redirect-only or discovery-entrypoint noise.
 *
 * @param replacement — the replacement pair to evaluate
 * @param originalLastKnownMirrors — optional map of siteName → original last_known_mirror
 * @returns true if the domain actually changed relative to the original mirror
 */
export function isRealDomainChange(
  replacement: ReplacementPair,
  originalLastKnownMirrors?: Map<string, string>,
): boolean {
  const originalMirror = originalLastKnownMirrors?.get(replacement.siteName);
  if (originalMirror !== undefined) {
    return replacement.newHost !== originalMirror;
  }
  // Fallback: compare startedHost/oldHost with newHost (legacy behaviour)
  const fromHost = replacement.startedHost || replacement.oldHost;
  return fromHost !== replacement.newHost;
}

export function formatWatcherSummaryEntry(siteName: string, activeHost: string): string {
  return `${siteName} (${activeHost})`;
}
