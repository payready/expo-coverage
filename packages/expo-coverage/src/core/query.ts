import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CoverageData, FileEntry, Platform, Tab } from './types';

const hitsFor = (hits: (number | null)[], tab: Tab, platforms: Platform[]): number | null =>
  tab === 'all' ? hits.reduce<number>((a, h) => a + (h ?? 0), 0) : (hits[platforms.indexOf(tab)] ?? null);

/** Contiguous runs of uncovered executable lines: [[62,88],[104,121]]. Runs may span non-executable lines (blank, comments). */
export function missedRanges(file: FileEntry, tab: Tab, platforms: Platform[]): [number, number][] {
  const missed = Object.entries(file.lc)
    .filter(([, hits]) => hitsFor(hits, tab, platforms) === 0)
    .map(([n]) => Number(n))
    .sort((a, b) => a - b);
  const ranges: [number, number][] = [];
  for (const n of missed) {
    const last = ranges[ranges.length - 1];
    if (last && n - last[1] <= 2) last[1] = n;
    else ranges.push([n, n]);
  }
  return ranges;
}

export interface Summary {
  tab: Tab;
  platforms: Platform[];
  lines: { covered: number; total: number; pct: number };
  files: number;
  neverRan: number;
  byPlatform: Partial<Record<Tab, number>>;
}

const pct = (c: number, t: number) => (t ? Math.round((c / t) * 1000) / 10 : 100);

export function summary(data: CoverageData, tab: Tab = 'all'): Summary {
  const files = data.files.filter((f) => f.sums[tab]);
  let covered = 0;
  let total = 0;
  for (const f of files) {
    covered += f.sums[tab]!.l[0];
    total += f.sums[tab]!.l[1];
  }
  const byPlatform: Summary['byPlatform'] = {};
  for (const t of [...data.platforms, 'all'] as Tab[]) {
    let c = 0;
    let n = 0;
    for (const f of data.files) {
      const l = f.sums[t]?.l;
      if (l) {
        c += l[0];
        n += l[1];
      }
    }
    byPlatform[t] = pct(c, n);
  }
  return { tab, platforms: data.platforms, lines: { covered, total, pct: pct(covered, total) }, files: files.length, neverRan: files.filter((f) => f.sums[tab]!.l[0] === 0).length, byPlatform };
}

export interface Gap {
  file: string;
  missedLines: number;
  totalLines: number;
  pct: number;
  ranges: string[];
}

/** Files ranked by how many lines nothing ran. The shortest path to "what should I test next?". */
export function gaps(data: CoverageData, opts: { tab?: Tab; top?: number; under?: string } = {}): Gap[] {
  const tab = opts.tab ?? 'all';
  return data.files
    .filter((f) => f.sums[tab] && (!opts.under || f.p.startsWith(opts.under)))
    .map((f) => {
      const [covered, total] = f.sums[tab]!.l;
      return { file: f.p, missedLines: total - covered, totalLines: total, pct: pct(covered, total), ranges: missedRanges(f, tab, data.platforms).map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)) };
    })
    .filter((g) => g.missedLines > 0)
    .sort((a, b) => b.missedLines - a.missedLines)
    .slice(0, opts.top ?? 10);
}

export interface FileView {
  file: string;
  pct: number;
  missedLines: number;
  ranges: string[];
  /** Uncovered ranges with their source, so an agent can read exactly what to exercise. */
  uncovered: { from: number; to: number; source: string }[];
  coveredBy: Partial<Record<Platform, number>>;
}

export function fileView(data: CoverageData, root: string, path: string, tab: Tab = 'all'): FileView | null {
  const file = data.files.find((f) => f.p === path || f.p.endsWith(`/${path}`));
  if (!file || !file.sums[tab]) return null;
  let text: string[] = [];
  try {
    text = readFileSync(join(root, file.p), 'utf8').split('\n');
  } catch {
    /* source not on disk */
  }
  const ranges = missedRanges(file, tab, data.platforms);
  const [covered, total] = file.sums[tab]!.l;
  const coveredBy: FileView['coveredBy'] = {};
  for (const p of data.platforms) coveredBy[p] = file.sums[p] ? pct(file.sums[p]!.l[0], file.sums[p]!.l[1]) : 0;
  return {
    file: file.p,
    pct: pct(covered, total),
    missedLines: total - covered,
    ranges: ranges.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)),
    uncovered: ranges.map(([from, to]) => ({ from, to, source: text.slice(from - 1, to).map((l, i) => `${from + i}: ${l}`).join('\n') })),
    coveredBy,
  };
}

/** Lines added or changed against `base` (git), per file: `{ 'app/a.tsx': Set(12, 13) }`. */
export function changedLines(root: string, base: string): Record<string, Set<number>> {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  // Diff from where this branch left `base`, through the working tree, so uncommitted edits count too.
  let from = base;
  try {
    from = git('merge-base', base, 'HEAD').trim();
  } catch {
    // Not a branch point (e.g. a bare commit); diff against it directly.
  }
  const out = git('diff', '--unified=0', '--no-color', '--relative', from, '--', '.');
  const result: Record<string, Set<number>> = {};
  let current: Set<number> | null = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('+++ b/')) current = result[line.slice(6)] = new Set();
    else if (line.startsWith('@@') && current) {
      const m = /\+(\d+)(?:,(\d+))?/.exec(line);
      if (m) for (let i = 0; i < Number(m[2] ?? 1); i++) current.add(Number(m[1]) + i);
    }
  }
  return result;
}

export interface DiffReport {
  base: string;
  changedFiles: number;
  executableChanged: number;
  uncoveredChanged: number;
  pct: number;
  files: { file: string; uncoveredLines: number[] }[];
}

/** Of the lines you changed, which ones did no test run? */
export function diff(data: CoverageData, changed: Record<string, Set<number>>, base: string, tab: Tab = 'all'): DiffReport {
  let executable = 0;
  let uncovered = 0;
  const files: DiffReport['files'] = [];
  for (const f of data.files) {
    const lines = changed[f.p];
    if (!lines || !f.sums[tab]) continue;
    const miss: number[] = [];
    for (const n of lines) {
      const hits = f.lc[n];
      if (!hits) continue;
      executable++;
      if (hitsFor(hits, tab, data.platforms) === 0) {
        uncovered++;
        miss.push(n);
      }
    }
    if (miss.length) files.push({ file: f.p, uncoveredLines: miss.sort((a, b) => a - b) });
  }
  return { base, changedFiles: Object.keys(changed).length, executableChanged: executable, uncoveredChanged: uncovered, pct: pct(executable - uncovered, executable), files };
}
