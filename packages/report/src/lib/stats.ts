import type { CoverageData, FileEntry, Platform, Ratio, SumKey, Sums, Tab } from './types';

export const LABEL: Record<Tab, string> = { ios: 'iOS', android: 'Android', web: 'Web', all: 'All' };

export const pct = ([covered, total]: Ratio): number => (total ? (covered / total) * 100 : 100);
export const fmt = (n: number): string => n.toLocaleString();

export type Health = 'good' | 'warn' | 'bad';
export const health = (p: number): Health => (p >= 80 ? 'good' : p >= 50 ? 'warn' : 'bad');

export function sumsFor(file: FileEntry, tab: Tab): Sums | undefined {
  return file.sums[tab];
}

/** Files a tab can see: a platform tab ignores files that platform never loaded (as Istanbul does). */
export function visibleFiles(data: CoverageData, tab: Tab): FileEntry[] {
  return data.files.filter((f) => f.sums[tab]);
}

export function totals(files: FileEntry[], tab: Tab, key: SumKey): Ratio {
  let covered = 0;
  let total = 0;
  for (const f of files) {
    const s = f.sums[tab]?.[key];
    if (s) {
      covered += s[0];
      total += s[1];
    }
  }
  return [covered, total];
}

export function missed(file: FileEntry, tab: Tab): number {
  const l = file.sums[tab]?.l;
  return l ? l[1] - l[0] : 0;
}

export function areaOf(path: string): string {
  const parts = path.split('/');
  return parts.length > 2 ? parts.slice(0, 2).join('/') : (parts[0] ?? path);
}

/** Hit count for one line under a tab. null = not executable there / file not loaded. */
export function lineHit(hits: (number | null)[], tab: Tab, platforms: Platform[]): number | null {
  if (tab === 'all') return hits.reduce<number>((a, h) => a + (h ?? 0), 0);
  return hits[platforms.indexOf(tab)] ?? null;
}

export interface Overlap {
  none: number;
  all: number;
  some: number;
  only: Record<Platform, number>;
}

/** For every executable line: which platforms ran it. */
export function overlap(data: CoverageData): Overlap {
  const result: Overlap = { none: 0, all: 0, some: 0, only: { ios: 0, android: 0, web: 0 } };
  const n = data.platforms.length;
  for (const f of data.files) {
    for (const hits of Object.values(f.lc)) {
      const on = data.platforms.filter((_, i) => (hits[i] ?? 0) > 0);
      if (on.length === 0) result.none++;
      else if (on.length === 1 && n > 1) result.only[on[0] as Platform]++;
      else if (on.length === n) result.all++;
      else result.some++;
    }
  }
  return result;
}
