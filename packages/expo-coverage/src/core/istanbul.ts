/**
 * Minimal Istanbul coverage-map operations (merge, line coverage, summary).
 * Hand-rolled because it is small and keeps Bun, Node and the browser-free CLI dependency-light.
 */
type Counts = Record<string, number>;
type BranchCounts = Record<string, number[]>;
interface Pos {
  line: number;
  column?: number | null;
}
interface Loc {
  start: Pos;
  end?: Pos;
}
export interface FnMeta {
  name?: string;
  line?: number;
  decl?: Loc;
  loc?: Loc;
}
export interface BranchMeta {
  type?: string;
  line?: number;
  loc?: Loc;
  locations?: Loc[];
}
export interface RawFileCoverage {
  path: string;
  statementMap: Record<string, Loc>;
  s: Counts;
  fnMap: Record<string, unknown>;
  f: Counts;
  branchMap: Record<string, unknown>;
  b: BranchCounts;
  /** Line-level map (lcov import, inventory baseline): one statement per line, so merges fold it by line rather than by location. */
  lineLevel?: boolean;
}
export type RawCoverage = Record<string, RawFileCoverage>;

const posKey = (p?: Pos) => (p ? `${p.line}:${p.column ?? ''}` : '');
const locKey = (l?: Loc) => (l ? `${posKey(l.start)}-${posKey(l.end)}` : '');
const fnLine = (m: FnMeta) => m.decl?.start.line ?? m.loc?.start.line ?? m.line ?? 0;
const fnKey = (m: FnMeta) => `${m.name ?? ''}@${locKey(m.decl ?? m.loc)}`;
const brLine = (m: BranchMeta) => m.loc?.start.line ?? m.line ?? 0;
const brKey = (m: BranchMeta) => `${m.type ?? ''}@${locKey(m.loc)}#${m.locations?.length ?? 0}`;

/**
 * Fold one kind of counter (statements, functions or branches) from `b` into `a`.
 * Same id at the same location adds up; otherwise match by location, so maps from different instrumenters
 * (Metro e2e vs Jest) union instead of colliding on ids. `fold` places an lcov entry onto real ids by line.
 */
function foldCounts<M, C>(
  aMap: Record<string, M>,
  aCounts: Record<string, C>,
  bMap: Record<string, M>,
  bCounts: Record<string, C>,
  key: (m: M) => string,
  add: (x: C | undefined, y: C) => C,
  fold?: (m: M) => string[] | null,
): [Record<string, M>, Record<string, C>] {
  const map = { ...aMap };
  const counts = { ...aCounts };
  const byKey = new Map<string, string>();
  for (const [id, m] of Object.entries(aMap)) if (!byKey.has(key(m))) byKey.set(key(m), id);
  let next = Math.max(-1, ...Object.keys(map).map(Number).filter(Number.isFinite)) + 1;
  for (const [id, m] of Object.entries(bMap ?? {})) {
    const c = bCounts?.[id];
    if (c === undefined) continue;
    const k = key(m);
    const same = map[id] !== undefined && key(map[id]!) === k ? id : byKey.get(k);
    if (same !== undefined) {
      counts[same] = add(counts[same], c);
      continue;
    }
    const targets = fold?.(m);
    if (targets) {
      for (const t of targets) counts[t] = add(counts[t], c);
      continue;
    }
    const fresh = map[id] === undefined ? id : String(next++);
    if (fresh === id && Number(id) >= next) next = Number(id) + 1;
    map[fresh] = m;
    counts[fresh] = c;
    byKey.set(k, fresh);
  }
  return [map, counts];
}

const addN = (x: number | undefined, y: number) => (x ?? 0) + y;
const addArr = (x: number[] | undefined, y: number[]) => (x?.length === y.length ? y.map((n, i) => n + (x[i] ?? 0)) : (x ?? y));

/** Ids in `map` grouped by start line. */
function idsByLine<M>(map: Record<string, M>, line: (m: M) => number): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const [id, m] of Object.entries(map)) {
    const n = line(m);
    out.set(n, [...(out.get(n) ?? []), id]);
  }
  return out;
}

export function mergeFile(a: RawFileCoverage, b: RawFileCoverage): RawFileCoverage {
  // Keep the real (located) map as the base; an lcov map folds into it by line.
  if (a.lineLevel && !b.lineLevel) return mergeFile(b, a);
  const lineFold = !!b.lineLevel && !a.lineLevel;
  const stLines = lineFold ? idsByLine(a.statementMap ?? {}, (l) => l.start.line) : null;
  const fnLines = lineFold ? idsByLine((a.fnMap ?? {}) as Record<string, FnMeta>, fnLine) : null;
  const brLines = lineFold ? idsByLine((a.branchMap ?? {}) as Record<string, BranchMeta>, brLine) : null;
  const usedBr = new Set<string>();

  const [statementMap, s] = foldCounts(a.statementMap ?? {}, a.s ?? {}, b.statementMap ?? {}, b.s ?? {}, locKey, addN, (l) => stLines?.get(l.start.line) ?? null);
  const [fnMap, f] = foldCounts(
    (a.fnMap ?? {}) as Record<string, FnMeta>,
    a.f ?? {},
    (b.fnMap ?? {}) as Record<string, FnMeta>,
    b.f ?? {},
    fnKey,
    addN,
    (m) => {
      if (!lineFold) return null;
      // lcov without FN lines (bun) has nowhere to go; the located map already counts those functions.
      const ids = fnLines!.get(fnLine(m));
      return fnLine(m) === 0 ? [] : ids ? ids.slice(0, 1) : null;
    },
  );
  const [branchMap, br] = foldCounts(
    (a.branchMap ?? {}) as Record<string, BranchMeta>,
    a.b ?? {},
    (b.branchMap ?? {}) as Record<string, BranchMeta>,
    b.b ?? {},
    brKey,
    addArr,
    (m) => {
      if (!lineFold) return null;
      const arms = m.locations?.length ?? 0;
      const id = brLines!.get(brLine(m))?.find((i) => !usedBr.has(i) && ((a.branchMap as Record<string, BranchMeta>)[i]?.locations?.length ?? 0) === arms);
      if (id === undefined) return null;
      usedBr.add(id);
      return [id];
    },
  );
  const out: RawFileCoverage = { ...a, statementMap, s, fnMap, f, branchMap, b: br };
  if (!(a.lineLevel && b.lineLevel)) delete out.lineLevel;
  return out;
}

export function mergeInto(target: RawCoverage, incoming: RawCoverage): RawCoverage {
  for (const [path, fc] of Object.entries(incoming)) target[path] = target[path] ? mergeFile(target[path], fc) : fc;
  return target;
}

export function lineCoverage(fc: RawFileCoverage): Record<number, number> {
  const lines: Record<number, number> = {};
  for (const [id, loc] of Object.entries(fc.statementMap)) {
    const line = loc.start.line;
    const hits = fc.s[id] ?? 0;
    lines[line] = Math.max(lines[line] ?? 0, hits);
  }
  return lines;
}

const pair = (counts: number[]): [number, number] => [counts.filter((n) => n > 0).length, counts.length];

export function summarize(fc: RawFileCoverage) {
  return {
    l: pair(Object.values(lineCoverage(fc))),
    s: pair(Object.values(fc.s ?? {})),
    f: pair(Object.values(fc.f ?? {})),
    b: pair(Object.values(fc.b ?? {}).flat()),
  };
}
