import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startCollector } from '../src/core/collector';
import { buildCoverageData } from '../src/core/data';
import { mergeCoverageFile, rehome } from '../src/core/merge';
import { diff, fileView, gaps, missedRanges, summary } from '../src/core/query';
import { renderReport } from '../src/core/report';
import { fileCoverage, project, writeCoverage } from './helpers';

const SRC = Array.from({ length: 6 }, (_, i) => `const line${i + 1} = ${i + 1};`).join('\n');

describe('merge', () => {
  test('hits from separate posts add up', () => {
    const root = project({});
    const file = join(root, 'c.json');
    mergeCoverageFile(file, { [join(root, 'a.ts')]: fileCoverage(join(root, 'a.ts'), [1, 0]) });
    mergeCoverageFile(file, { [join(root, 'a.ts')]: fileCoverage(join(root, 'a.ts'), [2, 3]) });
    const merged = JSON.parse(readFileSync(file, 'utf8'));
    expect(Object.values(merged)[0]).toMatchObject({ s: { '0': 3, '1': 3 } });
  });

  test('rehome points a sibling worktree path at this root and drops strangers', () => {
    const out = rehome('/ws/app', {
      '/ws/app-other/src/a.ts': fileCoverage('/ws/app-other/src/a.ts', [1]),
      '/ws/app/src/b.ts': fileCoverage('/ws/app/src/b.ts', [1]),
      '/elsewhere/c.ts': fileCoverage('/elsewhere/c.ts', [1]),
    });
    expect(Object.keys(out).sort()).toEqual(['/ws/app/src/a.ts', '/ws/app/src/b.ts']);
  });
});

describe('collector', () => {
  test('stores posts per platform and enables CORS for web pages', async () => {
    const root = project({});
    const c = await startCollector({ root, port: 0, host: '127.0.0.1' });
    const body = { [join(root, 'a.ts')]: fileCoverage(join(root, 'a.ts'), [1]) };
    const res = await fetch(`http://127.0.0.1:${c.port}/__coverage?platform=ios`, { method: 'POST', body: JSON.stringify(body) });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(existsSync(join(root, '.expo-coverage/coverage-ios.json'))).toBe(true);
    expect(c.posts()).toBe(1);
    expect((await fetch(`http://127.0.0.1:${c.port}/__coverage`, { method: 'POST', body: '{nope' })).status).toBe(400);
    expect((await fetch(`http://127.0.0.1:${c.port}/other`)).status).toBe(404);
    await c.close();
  });
});

describe('data + queries', async () => {
  const root = project({ 'src/a.ts': SRC, 'src/b.ts': SRC });
  writeCoverage(root, 'ios', { 'src/a.ts': [1, 1, 0, 0, 0, 1], 'src/b.ts': [1, 1, 1, 1, 1, 1] });
  writeCoverage(root, 'web', { 'src/a.ts': [1, 0, 1, 0, 0, 1] });
  const data = await buildCoverageData({ root });

  test('combines platforms: a line counts when any platform ran it', () => {
    const a = data.files.find((f) => f.p === 'src/a.ts')!;
    expect(a.sums.ios!.l).toEqual([3, 6]);
    expect(a.sums.web!.l).toEqual([3, 6]);
    expect(a.sums.all!.l).toEqual([4, 6]);
    expect(data.platforms).toEqual(['ios', 'web']);
  });

  test('platform tabs only see files that platform loaded', () => {
    expect(data.files.find((f) => f.p === 'src/b.ts')!.sums.web).toBeUndefined();
    expect(summary(data, 'web').files).toBe(1);
    expect(summary(data, 'all').lines).toEqual({ covered: 10, total: 12, pct: 83.3 });
  });

  test('highlights source into tokens that reassemble to the original line', () => {
    expect(data.sources['src/a.ts']!.length).toBe(6);
    expect(data.sources['src/a.ts']![0]!.map(([t]) => t).join('')).toBe('const line1 = 1;');
    expect(data.palette.length).toBeGreaterThan(0);
  });

  test('missedRanges merges runs that are only separated by non-executable lines', () => {
    const a = data.files.find((f) => f.p === 'src/a.ts')!;
    expect(missedRanges(a, 'ios', data.platforms)).toEqual([[3, 5]]);
    expect(missedRanges(a, 'all', data.platforms)).toEqual([[4, 5]]);
  });

  test('gaps ranks by missed lines and reports ranges', () => {
    expect(gaps(data, { tab: 'all' })).toEqual([{ file: 'src/a.ts', missedLines: 2, totalLines: 6, pct: 66.7, ranges: ['4-5'] }]);
    expect(gaps(data, { under: 'nope/' })).toEqual([]);
  });

  test('fileView includes the source of every uncovered range', () => {
    const v = fileView(data, root, 'src/a.ts')!;
    expect(v.uncovered).toEqual([{ from: 4, to: 5, source: '4: const line4 = 4;\n5: const line5 = 5;' }]);
    expect(v.coveredBy).toEqual({ ios: 50, web: 50 });
    expect(fileView(data, root, 'missing.ts')).toBeNull();
  });

  test('diff reports changed lines that no test ran', () => {
    const report = diff(data, { 'src/a.ts': new Set([2, 4, 5, 99]) }, 'main');
    expect(report).toMatchObject({ executableChanged: 3, uncoveredChanged: 2, files: [{ file: 'src/a.ts', uncoveredLines: [4, 5] }] });
  });

  test('refuses to build with no coverage, saying what to do', async () => {
    await expect(buildCoverageData({ root: project({}) })).rejects.toThrow(/EXPO_COVERAGE=1/);
  });
});

describe('report', () => {
  test('injects data literally, even when source contains $& or </script>', () => {
    const template = '<script>window.__COVERAGE__ = /*__DATA__*/ null;</script>';
    const html = renderReport({ title: '$& </script>', generated: '', platforms: [], files: [], sources: {}, palette: [] }, template);
    expect(html).toContain('$&');
    expect(html).not.toContain('</script> ');
    expect(html.match(/<\/script>/g)!.length).toBe(1);
  });
});
