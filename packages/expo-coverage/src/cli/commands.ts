import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { startCollector } from '../core/collector';
import { buildCoverageData } from '../core/data';
import { importCoverage } from '../core/import';
import { DEFAULT_DIR, DEFAULT_PORT, reportFile } from '../core/paths';
import * as query from '../core/query';
import { writeReport } from '../core/report';
import { PLATFORMS, PLATFORM_LABEL, TABS, type CoverageData, type Platform, type Tab } from '../core/types';
import { parseArgs, str, type Parsed } from './args';

export interface Ctx {
  root: string;
  dir: string;
  log: (line: string) => void;
}

export const contextFrom = (p: Parsed, log = console.log): Ctx => ({ root: resolve(str(p.flags.root) ?? process.cwd()), dir: str(p.flags.dir) ?? DEFAULT_DIR, log });

function tabOf(p: Parsed): Tab {
  const tab = str(p.flags.tab) ?? 'all';
  if (!TABS.includes(tab as Tab)) throw new Error(`--tab must be one of ${TABS.join(', ')}`);
  return tab as Tab;
}

/** `build` is the slow part (syntax highlighting); queries skip it. */
export const load = (ctx: Ctx, highlight = false): Promise<CoverageData> => buildCoverageData({ root: ctx.root, dir: ctx.dir, highlight });

export function summaryLine(data: CoverageData): string {
  const s = query.summary(data);
  return Object.entries(s.byPlatform)
    .filter(([k]) => k !== 'all' || data.platforms.length > 1)
    .map(([k, v]) => `${PLATFORM_LABEL[k as Tab]} ${v}%`)
    .join('  ·  ');
}

export async function serve(ctx: Ctx, p: Parsed): Promise<void> {
  const port = Number(str(p.flags.port) ?? DEFAULT_PORT);
  const collector = await startCollector({ root: ctx.root, dir: ctx.dir, port });
  ctx.log(`expo-coverage collecting on :${collector.port}  →  ${relative(process.cwd(), resolve(ctx.root, ctx.dir)) || '.'}`);
  ctx.log('Point instrumented apps at it with EXPO_PUBLIC_COVERAGE_URL=http://127.0.0.1:' + collector.port);
  await new Promise<void>((done) => {
    process.on('SIGINT', done);
    process.on('SIGTERM', done);
  });
  await collector.close();
}

export async function report(ctx: Ctx, p: Parsed): Promise<string> {
  const data = await buildCoverageData({ root: ctx.root, dir: ctx.dir, title: str(p.flags.title) ?? 'End-to-end coverage' });
  const out = resolve(ctx.root, str(p.flags.out) ?? reportFile(ctx.root, ctx.dir));
  writeReport(data, out);
  const s = query.summary(data);
  ctx.log(`Coverage  ${summaryLine(data)}`);
  ctx.log(`${s.lines.covered}/${s.lines.total} lines · ${s.files} files · ${s.neverRan} never ran`);
  ctx.log(`Report    ${relative(process.cwd(), out)}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### E2E coverage\n\n| | Lines |\n|---|---|\n${Object.entries(s.byPlatform).map(([k, v]) => `| ${PLATFORM_LABEL[k as Tab]} | ${v}% |`).join('\n')}\n\n`);
  }
  if (p.flags.open) spawnSync(process.platform === 'darwin' ? 'open' : 'xdg-open', [out], { stdio: 'ignore' });
  return out;
}

/** Collector + your test command + report, in one go. */
export async function run(ctx: Ctx, p: Parsed): Promise<number> {
  if (!p.rest.length) throw new Error('Usage: expo-coverage run -- <your test command>');
  const port = Number(str(p.flags.port) ?? DEFAULT_PORT);
  const collector = await startCollector({ root: ctx.root, dir: ctx.dir, port });
  // Android emulators reach the host through adb, not localhost.
  spawnSync('adb', ['reverse', `tcp:${collector.port}`, `tcp:${collector.port}`], { stdio: 'ignore' });
  ctx.log(`expo-coverage: collecting on :${collector.port}, running ${p.rest.join(' ')}`);
  const code = await new Promise<number>((done) => {
    const child = spawn(p.rest[0]!, p.rest.slice(1), {
      cwd: ctx.root,
      stdio: 'inherit',
      env: { ...process.env, EXPO_COVERAGE: '1', EXPO_PUBLIC_COVERAGE_URL: `http://127.0.0.1:${collector.port}`, EXPO_COVERAGE_PORT: String(collector.port) },
    });
    child.on('exit', (c) => done(c ?? 1));
    child.on('error', (e) => {
      ctx.log(`expo-coverage: could not start "${p.rest[0]}": ${e.message}`);
      done(127);
    });
  });
  // The app posts every couple of seconds; give the last one time to land.
  await new Promise((r) => setTimeout(r, Number(str(p.flags.grace) ?? 2500)));
  const posts = collector.posts();
  await collector.close();
  if (posts === 0) ctx.log('expo-coverage: no coverage arrived. Is the app built with EXPO_COVERAGE=1 (see `expo-coverage init`)?');
  else await report(ctx, p);
  return code;
}

/** Merge a unit-test coverage file (Jest JSON or bun lcov) in as another platform. */
export function importCmd(ctx: Ctx, p: Parsed): void {
  const file = p.positionals[0];
  const platform = str(p.flags.platform) ?? 'unit';
  if (!file) throw new Error('Usage: expo-coverage import --platform unit <coverage-final.json|lcov.info> [--exclude <glob>]...');
  if (!PLATFORMS.includes(platform as Platform)) throw new Error(`--platform must be one of ${PLATFORMS.join(', ')}`);
  const r = importCoverage({ root: ctx.root, dir: ctx.dir, platform: platform as Platform, file, exclude: p.lists.exclude });
  ctx.log(`Imported ${r.imported} files${r.excluded ? ` (${r.excluded} excluded)` : ''} into ${relative(process.cwd(), r.file)}`);
  if (!r.imported) ctx.log('expo-coverage: nothing imported. Check --root and --exclude.');
}

export async function gapsCmd(ctx: Ctx, p: Parsed): Promise<void> {
  const rows = query.gaps(await load(ctx), { tab: tabOf(p), top: Number(str(p.flags.top) ?? 10), under: str(p.flags.under) });
  if (p.flags.json) return ctx.log(JSON.stringify(rows, null, 2));
  for (const g of rows) ctx.log(`${String(g.missedLines).padStart(5)} missed  ${String(Math.round(g.pct)).padStart(3)}%  ${g.file}  ${g.ranges.slice(0, 6).join(',')}`);
  if (!rows.length) ctx.log('No gaps.');
}

export async function fileCmd(ctx: Ctx, p: Parsed): Promise<void> {
  const path = p.positionals[0];
  if (!path) throw new Error('Usage: expo-coverage file <path>');
  const view = query.fileView(await load(ctx), ctx.root, path, tabOf(p));
  if (!view) throw new Error(`No coverage for ${path}`);
  if (p.flags.json) return ctx.log(JSON.stringify(view, null, 2));
  ctx.log(`${view.file}: ${view.pct.toFixed(1)}% · ${view.missedLines} lines missed`);
  for (const u of view.uncovered) ctx.log(`\n--- lines ${u.from}-${u.to} ---\n${u.source}`);
}

export async function diffCmd(ctx: Ctx, p: Parsed): Promise<void> {
  const base = p.positionals[0] ?? 'origin/main';
  const report = query.diff(await load(ctx), query.changedLines(ctx.root, base), base, tabOf(p));
  if (p.flags.json) return ctx.log(JSON.stringify(report, null, 2));
  ctx.log(`Changed lines vs ${base}: ${report.executableChanged - report.uncoveredChanged}/${report.executableChanged} covered (${report.pct}%)`);
  for (const f of report.files) ctx.log(`  ${f.file}: ${f.uncoveredLines.join(', ')}`);
}

export async function summaryCmd(ctx: Ctx, p: Parsed): Promise<void> {
  const s = query.summary(await load(ctx), tabOf(p));
  ctx.log(p.flags.json ? JSON.stringify(s, null, 2) : `${s.lines.pct}% of ${s.lines.total} lines (${s.neverRan} of ${s.files} files never ran)`);
}

export { parseArgs };
