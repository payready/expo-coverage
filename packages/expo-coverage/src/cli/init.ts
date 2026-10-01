import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Ctx } from './commands';

interface Edit {
  file: string;
  note: string;
  next?: string;
  manual?: string;
}

/** Plan (and optionally apply) the three small edits that turn coverage on. Idempotent. */
export function init(ctx: Ctx, apply: boolean): Edit[] {
  const edits: Edit[] = [];
  const read = (f: string) => (existsSync(join(ctx.root, f)) ? readFileSync(join(ctx.root, f), 'utf8') : null);

  // 1. Babel preset
  const babel = read('babel.config.js') ?? read('babel.config.cjs');
  const babelFile = existsSync(join(ctx.root, 'babel.config.js')) ? 'babel.config.js' : 'babel.config.cjs';
  if (babel === null) edits.push({ file: 'babel.config.js', note: 'Add the preset', manual: "presets: ['babel-preset-expo', 'expo-coverage/babel']" });
  else if (babel.includes('expo-coverage/babel')) edits.push({ file: babelFile, note: 'Already has the preset' });
  else if (/presets:\s*\[/.test(babel)) {
    let next = babel.replace(/presets:\s*\[/, "presets: ['expo-coverage/babel', ");
    // The default `api.cache(true)` would pin the config; key it on the flag instead.
    next = next.replace(/api\.cache\(true\)/, 'api.cache.using(() => process.env.EXPO_COVERAGE)');
    edits.push({ file: babelFile, note: 'Add the Babel preset', next });
  } else edits.push({ file: babelFile, note: 'Add the preset', manual: "presets: ['babel-preset-expo', 'expo-coverage/babel']" });

  // 2. Metro
  const metro = read('metro.config.js');
  if (metro === null) {
    edits.push({
      file: 'metro.config.js',
      note: 'Create a Metro config with the coverage wrapper',
      next: "const { getDefaultConfig } = require('expo/metro-config');\nconst { withCoverage } = require('expo-coverage/metro');\n\nmodule.exports = withCoverage(getDefaultConfig(__dirname));\n",
    });
  } else if (metro.includes('expo-coverage/metro')) edits.push({ file: 'metro.config.js', note: 'Already wrapped' });
  else if (/module\.exports\s*=\s*config\s*;?/.test(metro)) {
    edits.push({
      file: 'metro.config.js',
      note: 'Wrap the Metro config',
      next: `const { withCoverage } = require('expo-coverage/metro');\n${metro.replace(/module\.exports\s*=\s*config\s*;?/, 'module.exports = withCoverage(config);')}`,
    });
  } else edits.push({ file: 'metro.config.js', note: 'Wrap your export', manual: 'module.exports = withCoverage(yourConfig)  // const { withCoverage } = require("expo-coverage/metro")' });

  // 3. Native networking (config plugin)
  const appJson = read('app.json');
  if (appJson) {
    const json = JSON.parse(appJson);
    const plugins: unknown[] = json.expo?.plugins ?? [];
    if (plugins.includes('expo-coverage/app.plugin')) edits.push({ file: 'app.json', note: 'Already has the config plugin' });
    else {
      json.expo = { ...json.expo, plugins: [...plugins, 'expo-coverage/app.plugin'] };
      edits.push({ file: 'app.json', note: 'Add the config plugin', next: `${JSON.stringify(json, null, 2)}\n` });
    }
  } else edits.push({ file: 'app.config.ts', note: 'Add the config plugin', manual: "plugins: [..., 'expo-coverage/app.plugin']" });

  // 4. .gitignore
  const gi = read('.gitignore');
  if (gi !== null && !gi.includes('.expo-coverage')) edits.push({ file: '.gitignore', note: 'Ignore coverage output', next: `${gi.replace(/\n?$/, '\n')}.expo-coverage\n` });

  if (apply) for (const e of edits) if (e.next !== undefined) writeFileSync(join(ctx.root, e.file), e.next);
  return edits;
}
