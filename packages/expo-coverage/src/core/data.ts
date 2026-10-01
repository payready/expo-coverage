import { existsSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { createHighlighter, type BundledLanguage } from 'shiki';
import { coverageFile } from './paths';
import { rehome } from './merge';
import { readMeta } from './meta';
import { PLATFORMS, type CoverageData, type FileEntry, type Platform, type Sums, type Tab, type Token } from './types';

import { lineCoverage, mergeInto, summarize, type RawCoverage } from './istanbul';

const LANG: Record<string, BundledLanguage> = { '.ts': 'ts', '.tsx': 'tsx', '.js': 'js', '.jsx': 'jsx', '.mjs': 'js', '.cjs': 'js', '.json': 'json' };

export interface BuildOptions {
  root: string;
  dir?: string;
  title?: string;
  /** Skip syntax highlighting (fast; used by queries that never render source). */
  highlight?: boolean;
}

export function platformsPresent(root: string, dir?: string): Platform[] {
  return PLATFORMS.filter((p) => existsSync(coverageFile(root, p, dir)));
}

/** Merge every platform's raw Istanbul map into one structure the report (and the agent queries) read. */
export async function buildCoverageData(opts: BuildOptions): Promise<CoverageData> {
  const { root, dir } = opts;
  const present = platformsPresent(root, dir);
  if (!present.length) throw new Error(`No coverage found in ${join(root, dir ?? '.expo-coverage')}. Run your tests with EXPO_COVERAGE=1 first.`);

  const maps = {} as Record<Platform, RawCoverage>;
  const all: RawCoverage = {};
  for (const p of present) {
    const raw = rehome(root, JSON.parse(readFileSync(coverageFile(root, p, dir), 'utf8')));
    maps[p] = raw as RawCoverage;
    mergeInto(all, structuredClone(raw) as RawCoverage);
  }

  const files: FileEntry[] = [];
  const absByRel = new Map<string, string>();
  for (const abs of Object.keys(all).sort()) {
    const rel = relative(root, abs);
    absByRel.set(rel, abs);
    const lineSets = present.map((p) => (maps[p][abs] ? lineCoverage(maps[p][abs]) : null));
    const lineNumbers = [...new Set(lineSets.flatMap((l) => (l ? Object.keys(l) : [])))].map(Number).sort((a, b) => a - b);
    const lc: FileEntry['lc'] = {};
    for (const n of lineNumbers) lc[n] = lineSets.map((l) => (l ? (l[n] ?? 0) : null));
    const sums: FileEntry['sums'] = { all: summarize(all[abs]!) };
    for (const p of present) if (maps[p][abs]) sums[p as Tab] = summarize(maps[p][abs]);
    files.push({ p: rel, lc, sums });
  }

  const sources: Record<string, Token[][]> = {};
  const palette: [string, string][] = [];
  if (opts.highlight !== false) {
    const highlighter = await createHighlighter({ themes: ['github-light', 'github-dark'], langs: ['ts', 'tsx', 'js', 'jsx', 'json'] });
    const index = new Map<string, number>();
    const colorOf = (style: Record<string, string> = {}): number => {
      const light = style['--shiki-light'] ?? '';
      const dark = style['--shiki-dark'] ?? '';
      const key = `${light}|${dark}`;
      let i = index.get(key);
      if (i === undefined) {
        i = palette.length;
        index.set(key, i);
        palette.push([light, dark]);
      }
      return i;
    };
    for (const [rel, abs] of absByRel) {
      if (!existsSync(abs)) continue;
      const { tokens } = highlighter.codeToTokens(readFileSync(abs, 'utf8'), {
        lang: LANG[extname(abs)] ?? 'ts',
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: false,
      });
      sources[rel] = tokens.map((line) => line.map((t): Token => [t.content, colorOf(t.htmlStyle as Record<string, string>)]));
    }
    highlighter.dispose();
  }

  return { title: opts.title ?? 'End-to-end coverage', meta: readMeta(root), generated: new Date().toISOString(), platforms: present, files, sources, palette };
}
