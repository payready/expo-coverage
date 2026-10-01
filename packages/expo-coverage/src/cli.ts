#!/usr/bin/env node
import { fileCmd, gapsCmd, diffCmd, contextFrom, parseArgs, report, run, serve, summaryCmd } from './cli/commands';
import { init } from './cli/init';
import { mcp } from './cli/mcp';

const HELP = `expo-coverage: e2e JS coverage for Expo apps (iOS, Android, web) in one report

  init [--yes]            wire up Babel, Metro and the config plugin (shows the edits first)
  run -- <command>        collect coverage while <command> runs, then write the report
  serve [--port 9082]     collect from instrumented apps until stopped (prebuilt apps)
  report [--open]         merge every platform into .expo-coverage/report.html
  gaps [--top 10]         files with the most uncovered lines        (--json, --tab ios|android|web)
  file <path>             uncovered ranges of one file, with source
  diff [base]             changed lines vs a git base that no test ran
  summary                 one-line numbers
  mcp                     MCP server for agents (stdio)

  --root <dir>   project root (default: cwd)     --dir <name>  output folder (default: .expo-coverage)
`;

const parsed = parseArgs(process.argv.slice(2));
const ctx = contextFrom(parsed);

async function main(): Promise<number> {
  switch (parsed.command) {
    case 'init': {
      const edits = init(ctx, false);
      for (const e of edits) ctx.log(`${e.next !== undefined ? '•' : e.manual ? '!' : '✓'} ${e.file}: ${e.note}${e.manual ? `\n    do by hand: ${e.manual}` : ''}`);
      if (!edits.some((e) => e.next !== undefined)) return 0;
      if (!parsed.flags.yes) {
        ctx.log('\nRe-run with --yes to apply the edits marked •.');
        return 0;
      }
      init(ctx, true);
      ctx.log('\nDone. Next: expo-coverage run -- <your test command>');
      return 0;
    }
    case 'run':
      return run(ctx, parsed);
    case 'serve':
      await serve(ctx, parsed);
      return 0;
    case 'report':
    case 'combine':
      await report(ctx, parsed);
      return 0;
    case 'gaps':
      await gapsCmd(ctx, parsed);
      return 0;
    case 'file':
      await fileCmd(ctx, parsed);
      return 0;
    case 'diff':
      await diffCmd(ctx, parsed);
      return 0;
    case 'summary':
      await summaryCmd(ctx, parsed);
      return 0;
    case 'mcp':
      await mcp(ctx);
      return new Promise<number>(() => {});
    default:
      ctx.log(HELP);
      return parsed.command ? 1 : 0;
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`expo-coverage: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  },
);
