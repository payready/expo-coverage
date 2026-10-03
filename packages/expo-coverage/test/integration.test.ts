import { describe, expect, test } from 'bun:test';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { parseArgs } from '../src/cli/args';

const require = createRequire(import.meta.url);

describe('args', () => {
  test('flags, positionals and the command after --', () => {
    expect(parseArgs(['run', '--port', '9000', '--open', '--', 'maestro', 'test', '.maestro'])).toEqual({
      command: 'run',
      positionals: [],
      flags: { port: '9000', open: true },
      rest: ['maestro', 'test', '.maestro'],
    });
    expect(parseArgs(['file', 'app/a.tsx', '--tab=ios']).positionals).toEqual(['app/a.tsx']);
  });
});

describe('babel preset', () => {
  const preset = require('../babel.cjs');
  const api = () => ({ cache: { using: () => {} } });

  test('does nothing unless EXPO_COVERAGE=1', () => {
    delete process.env.EXPO_COVERAGE;
    expect(preset(api())).toEqual({});
  });

  test('adds the Istanbul plugin when enabled, scoped to the project', () => {
    process.env.EXPO_COVERAGE = '1';
    const out = preset(api(), { exclude: ['**/generated/**'] });
    delete process.env.EXPO_COVERAGE;
    const [plugin, options] = out.plugins[0];
    expect(plugin).toContain('babel-plugin-istanbul');
    expect(options.cwd).toBe(process.cwd());
    expect(options.exclude).toEqual(expect.arrayContaining(['**/node_modules/**', '**/generated/**', '**/*.d.ts']));
  });

  test('actually instruments code through Babel', () => {
    const babel = require('@babel/core');
    process.env.EXPO_COVERAGE = '1';
    const filename = join(process.cwd(), 'src/example.js');
    const { code } = babel.transformSync('export const add = (a, b) => a + b;', { filename, presets: [require.resolve('../babel.cjs')], babelrc: false, configFile: false });
    delete process.env.EXPO_COVERAGE;
    expect(code).toContain('__coverage__');
  });

  test('starts the runtime from the entry file only', () => {
    const babel = require('@babel/core');
    const { mkdtempSync, writeFileSync } = require('node:fs');
    const { tmpdir } = require('node:os');
    const root = require('node:fs').realpathSync(mkdtempSync(join(tmpdir(), 'expo-coverage-entry-')));
    writeFileSync(join(root, 'package.json'), JSON.stringify({ main: 'index.js' }));
    writeFileSync(join(root, 'index.js'), '');
    process.env.EXPO_COVERAGE = '1';
    const run = (file: string) =>
      babel.transformSync('export const x = 1;', { filename: join(root, file), presets: [[require.resolve('../babel.cjs'), { cwd: root }]], babelrc: false, configFile: false }).code;
    const entry = run('index.js');
    const other = run('other.js');
    delete process.env.EXPO_COVERAGE;
    expect(entry).toContain('expo-coverage/autostart');
    expect(other).not.toContain('expo-coverage/autostart');
  });
});

describe('metro wrapper', () => {
  const { withCoverage } = require('../metro.cjs');

  test('returns the config untouched when disabled', () => {
    delete process.env.EXPO_COVERAGE;
    const config = { projectRoot: '/x' };
    expect(withCoverage(config)).toBe(config);
  });

  test('keys the cache on the flag and keeps an earlier middleware hook', () => {
    process.env.EXPO_COVERAGE = '1';
    const enhance = (m: unknown) => m;
    const out = withCoverage({ projectRoot: '/x', cacheVersion: '7', server: { enhanceMiddleware: enhance } });
    delete process.env.EXPO_COVERAGE;
    expect(out.cacheVersion).toBe('7+expo-coverage');
    expect(typeof out.server.enhanceMiddleware).toBe('function');
  });
});
