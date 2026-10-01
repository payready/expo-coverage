import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

// App-side code runs in React Native / the browser; everything else runs in Node.
const app = await Bun.build({ entrypoints: ['src/runtime.ts', 'src/autostart.ts'], outdir: 'dist', target: 'browser', format: 'esm', external: ['react-native', './runtime'] });
const tool = await Bun.build({ entrypoints: ['src/cli.ts', 'src/index.ts', 'src/playwright.ts'], outdir: 'dist', target: 'node', format: 'esm', packages: 'external' });
for (const result of [app, tool]) {
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }
}
chmodSync('dist/cli.js', 0o755);

const tsc = spawnSync('bunx', ['tsc', '--emitDeclarationOnly', '--declaration', '--outDir', 'dist', '--noEmit', 'false'], { stdio: 'inherit' });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

// The report app is built by packages/report and ships inside this package.
const report = '../report/dist/index.html';
if (!existsSync(report)) {
  console.error('Build packages/report first (bun run --cwd packages/report build).');
  process.exit(1);
}
mkdirSync('assets', { recursive: true });
copyFileSync(report, 'assets/report.html');
console.log('built dist/ and assets/report.html');
