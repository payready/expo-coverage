import { readFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { mergeFile, type BranchMeta, type FnMeta, type RawCoverage, type RawFileCoverage } from './istanbul';
import { mergeCoverageFile } from './merge';
import { coverageFile } from './paths';
import type { Platform } from './types';

const at = (line: number) => ({ start: { line, column: 0 }, end: { line, column: 0 } });

/** lcov.info → Istanbul map: one statement per DA line, plus FN/FNDA functions and BRDA branches when present. */
export function lcovToIstanbul(text: string, root: string): RawCoverage {
  const out: RawCoverage = {};
  let fc: RawFileCoverage | null = null;
  let fnByName = new Map<string, string>();
  let brByBlock = new Map<string, string>();
  let fnCounts: [found: number, hit: number] | null = null;

  const finish = () => {
    if (!fc) return;
    // bun reports only FNF/FNH; stand in placeholder functions so the unit tab's function ratio is right.
    if (fnCounts && !Object.keys(fc.fnMap).length) {
      for (let i = 0; i < fnCounts[0]; i++) {
        fc.fnMap[i] = { name: `(function ${i + 1})`, line: 0, decl: at(0), loc: at(0) } satisfies FnMeta;
        fc.f[i] = i < fnCounts[1] ? 1 : 0;
      }
    }
    out[fc.path] = out[fc.path] ? mergeFile(out[fc.path]!, fc) : fc;
    fc = null;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const colon = line.indexOf(':');
    const tag = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1);
    if (tag === 'SF') {
      finish();
      const path = resolve(root, value);
      fc = { path, statementMap: {}, s: {}, fnMap: {}, f: {}, branchMap: {}, b: {}, lcov: true };
      fnByName = new Map();
      brByBlock = new Map();
      fnCounts = null;
      continue;
    }
    if (tag === 'end_of_record') {
      finish();
      continue;
    }
    if (!fc) continue;
    const parts = value.split(',');
    switch (tag) {
      case 'DA': {
        const n = Number(parts[0]);
        const id = String(Object.keys(fc.statementMap).length);
        fc.statementMap[id] = at(n);
        fc.s[id] = Number(parts[1]) || 0;
        break;
      }
      case 'FN': {
        // `FN:<line>,<name>` or lcov 2's `FN:<line>,<end>,<name>`.
        const n = Number(parts[0]);
        const hasEnd = parts.length > 2 && /^\d+$/.test(parts[1]!);
        const name = parts.slice(hasEnd ? 2 : 1).join(',');
        const id = String(Object.keys(fc.fnMap).length);
        fc.fnMap[id] = { name, line: n, decl: at(n), loc: { start: { line: n, column: 0 }, end: { line: hasEnd ? Number(parts[1]) : n, column: 0 } } } satisfies FnMeta;
        fc.f[id] = 0;
        fnByName.set(name, id);
        break;
      }
      case 'FNDA': {
        const id = fnByName.get(parts.slice(1).join(','));
        if (id !== undefined) fc.f[id] = (fc.f[id] ?? 0) + (Number(parts[0]) || 0);
        break;
      }
      case 'FNF':
        fnCounts = [Number(value) || 0, fnCounts?.[1] ?? 0];
        break;
      case 'FNH':
        fnCounts = [fnCounts?.[0] ?? 0, Number(value) || 0];
        break;
      case 'BRDA': {
        const [lineNo, block] = parts;
        const n = Number(lineNo);
        const key = `${lineNo},${block}`;
        let id = brByBlock.get(key);
        if (id === undefined) {
          id = String(Object.keys(fc.branchMap).length);
          brByBlock.set(key, id);
          fc.branchMap[id] = { type: 'branch', line: n, loc: at(n), locations: [] } satisfies BranchMeta;
          fc.b[id] = [];
        }
        (fc.branchMap[id] as BranchMeta).locations!.push(at(n));
        fc.b[id]!.push(parts[3] === '-' ? 0 : Number(parts[3]) || 0);
        break;
      }
    }
  }
  finish();
  return out;
}

/** Glob → RegExp for `*`, `**`, `?` and `{a,b}`, matched against a root-relative path. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const slash = glob[i + 2] === '/';
        re += slash ? '(?:.*/)?' : '.*';
        i += slash ? 2 : 1;
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const close = glob.indexOf('}', i);
      if (close === -1) re += '\\{';
      else {
        re += `(?:${glob
          .slice(i + 1, close)
          .split(',')
          .map((alt) => globToRegExp(alt).source.slice(1, -1))
          .join('|')})`;
        i = close;
      }
    } else re += /[.+^$()|[\]\\]/.test(c) ? `\\${c}` : c;
  }
  return new RegExp(`^${re}$`);
}

/** Read Jest's coverage-final.json or an lcov.info, with every path made absolute against `root`. */
export function readExternalCoverage(file: string, root: string): RawCoverage {
  const text = readFileSync(file, 'utf8');
  if (/^\s*\{/.test(text)) {
    const json = JSON.parse(text);
    // Some tools wrap the map as `{ data: {...} }` per file (istanbul-lib-coverage's toJSON of a FileCoverage).
    const out: RawCoverage = {};
    for (const [key, value] of Object.entries<Record<string, any>>(json)) {
      const fc = (value?.data ?? value) as RawFileCoverage;
      const path = resolve(root, fc.path ?? key);
      out[path] = { ...fc, path };
    }
    return out;
  }
  if (/^(TN|SF):/m.test(text)) return lcovToIstanbul(text, root);
  throw new Error(`${file} is neither an Istanbul coverage JSON nor an lcov.info file`);
}

export interface ImportResult {
  file: string;
  imported: number;
  excluded: number;
}

/** Merge an external coverage file (Jest JSON or lcov) into `<dir>/coverage-<platform>.json`. */
export function importCoverage(opts: { root: string; dir?: string; platform: Platform; file: string; exclude?: string[] }): ImportResult {
  const map = readExternalCoverage(resolve(opts.root, opts.file), opts.root);
  // A pattern without a slash matches the file name anywhere, as in .gitignore.
  const patterns = ['**/node_modules/**', ...(opts.exclude ?? [])].map((g) => ({ re: globToRegExp(g), base: !g.includes('/') }));
  const kept: RawCoverage = {};
  let excluded = 0;
  for (const [path, fc] of Object.entries(map)) {
    const rel = relative(opts.root, path);
    if (patterns.some((p) => p.re.test(p.base ? basename(rel) : rel))) excluded++;
    else kept[path] = fc;
  }
  const out = coverageFile(opts.root, opts.platform, opts.dir);
  mergeCoverageFile(out, kept);
  return { file: out, imported: Object.keys(kept).length, excluded };
}
