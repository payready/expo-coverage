import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  buildInventoryBaseline,
  emptyCoverageFor,
  fillMissing,
  listInventoryFiles,
  readInstrumentGlobs,
} from '../src/core/inventory';
import { fileCoverage, project } from './helpers';

/** Inventory unit tests — no Shiki / collector / istanbul-lib-instrument. */

describe('inventory', () => {
  test('readInstrumentGlobs picks babel include/exclude from babel.config.json', () => {
    const root = project({
      'babel.config.json': JSON.stringify({
        presets: [['expo-coverage/babel', { include: ['src/**'], exclude: ['**/generated/**'] }]],
      }),
      'src/a.ts': 'export const a = 1;\n',
      'src/generated/x.ts': 'export const x = 1;\n',
      'lib/b.ts': 'export const b = 1;\n',
    });
    const globs = readInstrumentGlobs(root);
    expect(globs.include).toEqual(['src/**']);
    expect(globs.exclude).toEqual(expect.arrayContaining(['**/generated/**', '**/node_modules/**', '**/*.d.ts']));
    const listed = listInventoryFiles(root, globs).map((abs) => abs.slice(root.length + 1)).sort();
    expect(listed).toEqual(['src/a.ts']);
  });

  test('fillMissing keeps real posts and adds fixture inventory zeros', () => {
    const root = '/proj';
    const actual = { [`${root}/src/a.ts`]: fileCoverage(`${root}/src/a.ts`, [5, 0]) };
    const inventory = {
      [`${root}/src/a.ts`]: fileCoverage(`${root}/src/a.ts`, [0, 0]),
      [`${root}/src/b.ts`]: fileCoverage(`${root}/src/b.ts`, [0, 0, 0]),
    };
    const merged = fillMissing(actual, inventory);
    expect(merged[`${root}/src/a.ts`]!.s).toEqual({ '0': 5, '1': 0 });
    expect(merged[`${root}/src/b.ts`]!.s).toEqual({ '0': 0, '1': 0, '2': 0 });
  });

  test('emptyCoverageFor builds zero-hit line map from source text', () => {
    const fc = emptyCoverageFor('/x/a.ts', 'export const add = (a, b) => a + b;\n\n// skip\nconst z = 1;\n');
    expect(fc).not.toBeNull();
    expect(Object.values(fc!.s).every((n) => n === 0)).toBe(true);
    expect(Object.keys(fc!.statementMap).length).toBe(2);
    expect(fc!.statementMap['0']!.start.line).toBe(1);
    expect(fc!.statementMap['1']!.start.line).toBe(4);
  });

  test('buildInventoryBaseline respects include override', () => {
    const root = project({
      'src/a.ts': 'export const a = 1;\n',
      'lib/b.ts': 'export const b = 1;\n',
    });
    const baseline = buildInventoryBaseline(root, { include: ['src/**'] });
    expect(Object.keys(baseline).map((p) => p.slice(root.length + 1))).toEqual(['src/a.ts']);
    expect(Object.values(baseline[join(root, 'src/a.ts')]!.s).every((n) => n === 0)).toBe(true);
  });
});
