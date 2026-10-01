import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Minimal Istanbul file coverage: one statement per entry in `hits`, on consecutive lines starting at line 1. */
export function fileCoverage(path: string, hits: number[]) {
  const statementMap: Record<string, unknown> = {};
  const s: Record<string, number> = {};
  hits.forEach((h, i) => {
    statementMap[i] = { start: { line: i + 1, column: 0 }, end: { line: i + 1, column: 10 } };
    s[i] = h;
  });
  return { path, statementMap, s, fnMap: {}, f: {}, branchMap: {}, b: {} };
}

export function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'expo-coverage-'));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

export function writeCoverage(root: string, platform: string, entries: Record<string, number[]>, dir = '.expo-coverage') {
  mkdirSync(join(root, dir), { recursive: true });
  const map = Object.fromEntries(Object.entries(entries).map(([rel, hits]) => [join(root, rel), fileCoverage(join(root, rel), hits)]));
  writeFileSync(join(root, dir, `coverage-${platform}.json`), JSON.stringify(map));
}
