import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { RawCoverage, RawFileCoverage } from './istanbul';

/** Keep in sync with instrument-globs.cjs (Babel preset + inventory). */
export const DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**',
  '**/e2e/**',
  '**/.expo/**',
  '**/.expo-coverage/**',
  '**/*.d.ts',
];

export const DEFAULT_EXTENSION = ['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx'];

/** Directories we never walk into (fast path; excludes still apply to paths). */
const SKIP_DIRS = new Set(['node_modules', '.git', '.expo', '.expo-coverage', 'coverage', 'dist', 'build', '.next']);

export interface InstrumentGlobs {
  include?: string[];
  exclude: string[];
  extension: string[];
}

export interface InventoryOptions {
  /** Override include globs (otherwise read from babel / defaults). */
  include?: string[];
  /** Extra exclude globs on top of defaults + babel options. */
  exclude?: string[];
}

/**
 * Read `include` / `exclude` from the project's `expo-coverage/babel` preset options.
 * Falls back to instrument-globs defaults when babel config is missing or has no options.
 */
export function readInstrumentGlobs(root: string, extra: InventoryOptions = {}): InstrumentGlobs {
  const fromBabel = loadBabelCoverageOptions(root);
  const include = extra.include ?? fromBabel?.include;
  const exclude = [...DEFAULT_EXCLUDE, ...(fromBabel?.exclude ?? []), ...(extra.exclude ?? [])];
  return { include, exclude, extension: DEFAULT_EXTENSION };
}

type BabelCoverageOptions = { include?: string[]; exclude?: string[] };

function loadBabelCoverageOptions(root: string): BabelCoverageOptions | null {
  const config = loadBabelConfigExport(root);
  if (!config) return null;
  const presets = config.presets;
  if (!Array.isArray(presets)) return null;
  for (const entry of presets) {
    const [name, options] = Array.isArray(entry) ? entry : [entry, undefined];
    if (typeof name !== 'string') continue;
    if (name === 'expo-coverage/babel' || name.endsWith('/expo-coverage/babel') || /[/\\]babel\.cjs$/.test(name)) {
      if (options && typeof options === 'object') {
        const o = options as BabelCoverageOptions;
        return { include: o.include, exclude: o.exclude };
      }
      return {};
    }
  }
  return null;
}

function loadBabelConfigExport(root: string): { presets?: unknown[] } | null {
  const json = join(root, 'babel.config.json');
  if (existsSync(json)) {
    try {
      return JSON.parse(readFileSync(json, 'utf8')) as { presets?: unknown[] };
    } catch {
      return null;
    }
  }

  // JS configs: require only under Node. Bun hangs on some CJS graphs in this repo's
  // environment; inventory tests use babel.config.json, and the CLI runs on Node.
  if (typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined') return null;

  const require = createRequire(join(root, 'package.json'));
  for (const name of ['babel.config.js', 'babel.config.cjs']) {
    const file = join(root, name);
    if (!existsSync(file)) continue;
    try {
      const abs = require.resolve(file);
      delete require.cache[abs];
      const mod = require(abs);
      const api = {
        cache: { using: () => {}, forever: () => {}, never: () => {}, invalidate: () => {} },
        env: () => process.env.BABEL_ENV || process.env.NODE_ENV || 'development',
        caller: () => undefined,
      };
      const config = typeof mod === 'function' ? mod(api) : mod;
      return config && typeof config === 'object' ? (config as { presets?: unknown[] }) : null;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Convert a minimatch-ish glob to a RegExp (supports **, *, ?, and path seps). */
export function globToRegExp(pattern: string): RegExp {
  let out = '^';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === '*' && pattern[i + 1] === '*') {
      out += '.*';
      i++;
      if (pattern[i + 1] === '/' || pattern[i + 1] === '\\') i++;
    } else if (c === '*') out += '[^/\\\\]*';
    else if (c === '?') out += '[^/\\\\]';
    else if ('.$^+{}()|[]\\'.includes(c)) out += `\\${c}`;
    else out += c;
  }
  return new RegExp(`${out}$`);
}

function matchesGlob(rel: string, pattern: string): boolean {
  const norm = rel.replace(/\\/g, '/');
  const re = globToRegExp(pattern.replace(/\\/g, '/'));
  if (re.test(norm)) return true;
  // Patterns like **/foo also match foo at root (istanbul/test-exclude behavior).
  if (pattern.startsWith('**/') && globToRegExp(pattern.slice(3)).test(norm)) return true;
  return false;
}

function matchesAny(rel: string, patterns: string[]): boolean {
  return patterns.some((p) => matchesGlob(rel, p));
}

function hasExtension(file: string, extensions: string[]): boolean {
  const lower = file.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

function walkFiles(dir: string, root: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith('.') && ent.name !== '.expo') {
      // skip dotfiles/dirs except we already SKIP .expo via SKIP_DIRS when named
    }
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walkFiles(abs, root, out);
    } else if (ent.isFile()) {
      out.push(abs);
    }
  }
}

/** Absolute paths of every source file that would be instrumented. */
export function listInventoryFiles(root: string, globs: InstrumentGlobs = readInstrumentGlobs(root)): string[] {
  const all: string[] = [];
  walkFiles(root, root, all);
  const include = globs.include?.length ? globs.include : null;
  return all
    .filter((abs) => {
      const rel = relative(root, abs).split(sep).join('/');
      if (!hasExtension(abs, globs.extension)) return false;
      if (matchesAny(rel, globs.exclude)) return false;
      if (include && !matchesAny(rel, include)) return false;
      return true;
    })
    .map((abs) => resolve(abs))
    .sort();
}

/**
 * Zero-hit coverage map for one file (line-based inventory, no Istanbul instrumenter).
 * Each non-empty, non-comment-only line becomes a statement at 0 hits so unloaded
 * files pull overall % down the same way nyc `--all` does for the denominator.
 */
export function emptyCoverageFor(absPath: string, source?: string): RawFileCoverage | null {
  let code = source;
  if (code === undefined) {
    try {
      code = readFileSync(absPath, 'utf8');
    } catch {
      return null;
    }
  }
  const statementMap: RawFileCoverage['statementMap'] = {};
  const s: Record<string, number> = {};
  let id = 0;
  const lines = code.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('//')) continue;
    if (trimmed.startsWith('/*') && trimmed.endsWith('*/')) continue;
    if (trimmed.startsWith('*')) continue;
    if (trimmed === '{' || trimmed === '}' || trimmed === '};') continue;
    statementMap[String(id)] = { start: { line: i + 1 }, end: { line: i + 1 } };
    s[String(id)] = 0;
    id++;
  }
  if (id === 0) return null;
  return { path: absPath, statementMap, s, fnMap: {}, f: {}, branchMap: {}, b: {} };
}

/**
 * Baseline coverage map: every inventory file starts at 0% until posts arrive.
 * Files with no executable-looking lines are skipped.
 */
export function buildInventoryBaseline(root: string, opts: InventoryOptions = {}): RawCoverage {
  const globs = readInstrumentGlobs(root, opts);
  const baseline: RawCoverage = {};
  for (const abs of listInventoryFiles(root, globs)) {
    const fc = emptyCoverageFor(abs);
    if (fc) baseline[abs] = fc;
  }
  return baseline;
}

/**
 * Keep real posts as-is; add inventory entries only for paths that never posted.
 * Avoids merging incompatible statement maps from offline vs runtime instrumentation.
 */
export function fillMissing(actual: RawCoverage, inventory: RawCoverage): RawCoverage {
  const out: RawCoverage = { ...actual };
  for (const [path, fc] of Object.entries(inventory)) {
    if (!out[path]) out[path] = fc;
  }
  return out;
}
