import { describe, expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCoverageData } from '../src/core/data';
import { globToRegExp, importCoverage, lcovToIstanbul } from '../src/core/import';
import { lineCoverage, mergeFile, summarize } from '../src/core/istanbul';
import { gaps, summary } from '../src/core/query';
import { fileCoverage, project, writeCoverage } from './helpers';

const SRC = Array.from({ length: 6 }, (_, i) => `const line${i + 1} = ${i + 1};`).join('\n');

/** What `bun test --coverage --coverage-reporter=lcov` writes: relative SF, DA lines, FNF/FNH counts only. */
const BUN_LCOV = ['TN:', 'SF:src/a.ts', 'FNF:2', 'FNH:1', 'DA:1,1', 'DA:2,1', 'DA:3,0', 'DA:5,4', 'LF:4', 'LH:3', 'end_of_record', ''].join('\n');

/** Classic lcov (genhtml, c8, Jest's lcov reporter) with FN/FNDA and BRDA records. */
const FULL_LCOV = [
  'TN:',
  'SF:/abs/src/b.ts',
  'FN:2,7,handle',
  'FN:9,other',
  'FNDA:3,handle',
  'FNDA:0,other',
  'DA:2,3',
  'DA:3,3',
  'DA:9,0',
  'BRDA:3,0,0,2',
  'BRDA:3,0,1,-',
  'BRDA:4,1,0,1',
  'end_of_record',
].join('\n');

describe('lcov → istanbul', () => {
  test('one statement per DA line, relative paths made absolute against root', () => {
    const map = lcovToIstanbul(BUN_LCOV, '/proj');
    const fc = map['/proj/src/a.ts']!;
    expect(Object.keys(map)).toEqual(['/proj/src/a.ts']);
    expect(fc.path).toBe('/proj/src/a.ts');
    expect(lineCoverage(fc)).toEqual({ 1: 1, 2: 1, 3: 0, 5: 4 });
    expect(summarize(fc).l).toEqual([3, 4]);
  });

  test('FNF/FNH without FN records still give a function ratio', () => {
    expect(summarize(lcovToIstanbul(BUN_LCOV, '/proj')['/proj/src/a.ts']!).f).toEqual([1, 2]);
  });

  test('FN/FNDA become functions and BRDA blocks become branches (- counts as 0)', () => {
    const fc = lcovToIstanbul(FULL_LCOV, '/proj')['/abs/src/b.ts']!;
    expect(Object.values(fc.fnMap).map((f: any) => [f.name, f.loc.start.line, f.loc.end.line])).toEqual([
      ['handle', 2, 7],
      ['other', 9, 9],
    ]);
    expect(Object.values(fc.f)).toEqual([3, 0]);
    expect(Object.values(fc.b)).toEqual([[2, 0], [1]]);
    expect(summarize(fc)).toEqual({ l: [2, 3], s: [2, 3], f: [1, 2], b: [2, 3] });
  });
});

describe('glob', () => {
  test('**, *, ? and {a,b}', () => {
    expect(globToRegExp('**/*.test.{ts,tsx}').test('src/x/a.test.tsx')).toBe(true);
    expect(globToRegExp('**/*.test.{ts,tsx}').test('a.test.ts')).toBe(true);
    expect(globToRegExp('**/*.test.{ts,tsx}').test('src/a.ts')).toBe(false);
    expect(globToRegExp('src/*.ts').test('src/x/a.ts')).toBe(false);
    expect(globToRegExp('**/__mocks__/**').test('src/__mocks__/x.ts')).toBe(true);
  });
});

describe('import', () => {
  test('merges lcov into coverage-unit.json, dropping excluded and node_modules files', () => {
    const root = project({ 'src/a.ts': SRC });
    const lcov = [BUN_LCOV, 'SF:src/a.test.ts\nDA:1,1\nend_of_record', 'SF:node_modules/x/i.js\nDA:1,1\nend_of_record', 'SF:src/a.stories.tsx\nDA:1,1\nend_of_record'].join('\n');
    writeFileSync(join(root, 'lcov.info'), lcov);
    const r = importCoverage({ root, platform: 'unit', file: 'lcov.info', exclude: ['**/*.test.ts', '*.stories.tsx'] });
    expect(r).toMatchObject({ imported: 1, excluded: 3 });
    expect(r.file).toBe(join(root, '.expo-coverage/coverage-unit.json'));
    expect(Object.keys(JSON.parse(readFileSync(r.file, 'utf8')))).toEqual([join(root, 'src/a.ts')]);
  });

  test('accepts a Jest coverage-final.json and adds up on repeat imports', () => {
    const root = project({ 'src/a.ts': SRC });
    const abs = join(root, 'src/a.ts');
    writeFileSync(join(root, 'coverage-final.json'), JSON.stringify({ [abs]: fileCoverage(abs, [1, 0, 2]) }));
    importCoverage({ root, platform: 'unit', file: 'coverage-final.json' });
    importCoverage({ root, platform: 'unit', file: 'coverage-final.json' });
    const map = JSON.parse(readFileSync(join(root, '.expo-coverage/coverage-unit.json'), 'utf8'));
    expect(map[abs].s).toEqual({ '0': 2, '1': 0, '2': 4 });
  });

  test('rejects files that are neither format', () => {
    const root = project({ 'x.txt': 'hello' });
    expect(() => importCoverage({ root, platform: 'unit', file: 'x.txt' })).toThrow(/neither/);
  });
});

describe('unit alongside e2e', async () => {
  const root = project({ 'src/a.ts': SRC, 'src/b.ts': SRC });
  writeCoverage(root, 'ios', { 'src/a.ts': [1, 1, 0, 0, 0, 1] });
  writeFileSync(join(root, 'lcov.info'), ['SF:src/a.ts', 'DA:3,2', 'DA:4,0', 'DA:5,0', 'DA:6,0', 'end_of_record', 'SF:src/b.ts', 'DA:1,1', 'DA:2,0', 'end_of_record'].join('\n'));
  importCoverage({ root, platform: 'unit', file: 'lcov.info' });
  const data = await buildCoverageData({ root, highlight: false });

  test('unit is a platform of its own', () => {
    expect(data.platforms).toEqual(['ios', 'unit']);
    const a = data.files.find((f) => f.p === 'src/a.ts')!;
    expect(a.sums.unit!.l).toEqual([1, 4]);
    expect(a.lc['3']).toEqual([0, 2]);
    expect(a.lc['1']).toEqual([1, null]);
  });

  test('all counts a line covered when any platform, unit included, ran it', () => {
    const a = data.files.find((f) => f.p === 'src/a.ts')!;
    expect(a.sums.all!.l).toEqual([4, 6]);
    expect(data.files.find((f) => f.p === 'src/b.ts')!.sums.all!.l).toEqual([1, 2]);
    expect(summary(data).byPlatform).toEqual({ ios: 50, unit: 33.3, all: 62.5 });
    expect(gaps(data, { tab: 'unit' })[0]).toMatchObject({ file: 'src/a.ts', missedLines: 3 });
  });
});

describe('merging maps from different instrumenters', () => {
  test('statements union by location instead of colliding on ids', () => {
    const a = fileCoverage('/p/a.ts', [1, 0]);
    const b = { ...fileCoverage('/p/a.ts', [5]), statementMap: { '0': { start: { line: 9, column: 2 }, end: { line: 9, column: 8 } } } };
    const m = mergeFile(a, b);
    expect(lineCoverage(m)).toEqual({ 1: 1, 2: 0, 9: 5 });
  });

  test('an lcov line folds into the located statements on that line', () => {
    const real = fileCoverage('/p/a.ts', [0, 0]);
    const lcov = lcovToIstanbul('SF:/p/a.ts\nDA:2,3\nDA:4,1\nend_of_record', '/');
    for (const m of [mergeFile(real, lcov['/p/a.ts']!), mergeFile(lcov['/p/a.ts']!, real)]) {
      expect(lineCoverage(m)).toEqual({ 1: 0, 2: 3, 4: 1 });
      expect(m.lineLevel).toBeUndefined();
    }
  });
});

describe('unit with an inventory denominator (--all)', async () => {
  // Real maps have statements on lines 1..n; the source has more non-blank lines than that, so a line-level guess would differ.
  const SRC10 = Array.from({ length: 10 }, (_, i) => `const line${i + 1} = ${i + 1};`).join('\n');
  const root = project({ 'src/a.ts': SRC10, 'src/unit.ts': 'export const u = 1;\nexport const v = 2;\n', 'src/never.ts': 'export const n = 1;\nexport const m = 2;\n' });
  writeCoverage(root, 'ios', { 'src/a.ts': [1, 1, 0] });
  writeFileSync(join(root, 'lcov.info'), 'SF:src/unit.ts\nDA:1,1\nend_of_record\n');
  importCoverage({ root, platform: 'unit', file: 'lcov.info' });
  const data = await buildCoverageData({ root, highlight: false, all: true });
  const a = data.files.find((f) => f.p === 'src/a.ts')!;

  test('a platform that never loaded a file starts from the real map at zero', () => {
    expect(a.sums.unit!.l).toEqual([0, 3]);
    expect(a.sums.all!.l).toEqual([2, 3]);
  });

  test('lcov line sets are reused for platforms that never loaded the file', () => {
    expect(data.files.find((f) => f.p === 'src/unit.ts')!.sums.ios!.l).toEqual([0, 1]);
  });

  test('files nothing loaded still get the line-level baseline', () => {
    expect(data.files.find((f) => f.p === 'src/never.ts')!.sums.ios!.l).toEqual([0, 2]);
  });
});
