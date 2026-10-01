/**
 * Minimal Istanbul coverage-map operations (merge, line coverage, summary).
 * Hand-rolled because it is ~60 lines and keeps Bun, Node and the browser-free CLI dependency-light.
 */
type Counts = Record<string, number>;
type BranchCounts = Record<string, number[]>;
export interface RawFileCoverage {
  path: string;
  statementMap: Record<string, { start: { line: number }; end?: { line: number } }>;
  s: Counts;
  fnMap: Record<string, unknown>;
  f: Counts;
  branchMap: Record<string, unknown>;
  b: BranchCounts;
}
export type RawCoverage = Record<string, RawFileCoverage>;

export function mergeFile(a: RawFileCoverage, b: RawFileCoverage): RawFileCoverage {
  const sum = (x: Counts, y: Counts): Counts => {
    const out: Counts = { ...x };
    for (const [k, v] of Object.entries(y)) out[k] = (out[k] ?? 0) + v;
    return out;
  };
  const b2: BranchCounts = { ...a.b };
  for (const [k, v] of Object.entries(b.b ?? {})) b2[k] = b2[k]?.length ? v.map((n, i) => n + (b2[k]?.[i] ?? 0)) : v;
  return { ...a, s: sum(a.s ?? {}, b.s ?? {}), f: sum(a.f ?? {}, b.f ?? {}), b: b2 };
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
