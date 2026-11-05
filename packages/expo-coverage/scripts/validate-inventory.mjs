#!/usr/bin/env node
/**
 * Node smoke check for inventory merge / globs (no Bun, no istanbul-lib-instrument).
 *
 *   node --experimental-strip-types packages/expo-coverage/scripts/validate-inventory.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildInventoryBaseline,
  emptyCoverageFor,
  fillMissing,
  listInventoryFiles,
  readInstrumentGlobs,
} from '../src/core/inventory.ts';

const root = join(tmpdir(), `expo-cov-inv-${process.pid}`);
mkdirSync(join(root, 'src'), { recursive: true });
mkdirSync(join(root, 'lib'), { recursive: true });
writeFileSync(join(root, 'src/a.ts'), 'export const a = 1;\n');
writeFileSync(join(root, 'src/untouched.ts'), 'export function neverLoaded() {\n  return 42;\n}\n');
writeFileSync(join(root, 'lib/c.ts'), 'export const c = 1;\n');
writeFileSync(
  join(root, 'babel.config.json'),
  JSON.stringify({ presets: [['expo-coverage/babel', { include: ['src/**'], exclude: ['**/generated/**'] }]] }),
);

const globs = readInstrumentGlobs(root);
if (JSON.stringify(globs.include) !== JSON.stringify(['src/**'])) throw new Error(`include: ${globs.include}`);
if (!globs.exclude.includes('**/generated/**')) throw new Error('missing babel exclude');

const listed = listInventoryFiles(root, globs).map((p) => p.slice(root.length + 1)).sort();
if (JSON.stringify(listed) !== JSON.stringify(['src/a.ts', 'src/untouched.ts'])) throw new Error(`list: ${listed}`);

const a = join(root, 'src/a.ts');
const actual = {
  [a]: {
    path: a,
    statementMap: { 0: { start: { line: 1 }, end: { line: 1 } } },
    s: { 0: 3 },
    fnMap: {},
    f: {},
    branchMap: {},
    b: {},
  },
};
const baseline = buildInventoryBaseline(root);
const merged = fillMissing(actual, baseline);
if (merged[a].s[0] !== 3) throw new Error('fillMissing overwrote hits');
const u = join(root, 'src/untouched.ts');
if (!merged[u] || Object.values(merged[u].s).some((n) => n !== 0)) throw new Error('inventory zeros missing');
if (merged[join(root, 'lib/c.ts')]) throw new Error('lib/c should be outside include');

const empty = emptyCoverageFor('/x.ts', 'const x = 1;\n// c\nconst y = 2;\n');
if (!empty || Object.keys(empty.s).length !== 2) throw new Error('emptyCoverageFor failed');

console.log('validate-inventory: ok', { listed, inventoryFiles: Object.keys(baseline).length });
