'use strict';

/**
 * Babel preset: instruments your source with Istanbul when EXPO_COVERAGE=1, and does nothing otherwise,
 * so normal builds are untouched.
 *
 *   presets: ['babel-preset-expo', 'expo-coverage/babel']
 *
 * Options: { include?: string[], exclude?: string[], cwd?: string, entry?: string, force?: boolean }
 */
const fs = require('node:fs');
const path = require('node:path');

/** Absolute path of the app's entry file: the `entry` option, else package.json "main", else index.js. */
function resolveEntry(cwd, entry) {
  let target = entry;
  if (!target) {
    try {
      target = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).main;
    } catch {}
  }
  target = target || 'index.js';
  const local = path.resolve(cwd, target);
  try {
    // A file in the project ("index.js", "./src/main.ts") wins over a package ("expo-router/entry").
    return fs.realpathSync(fs.existsSync(local) ? local : require.resolve(target, { paths: [cwd] }));
  } catch {
    return null;
  }
}

/** Puts `import 'expo-coverage/autostart'` at the top of the entry so the runtime starts with the app. */
function injectRuntime(entryPath) {
  return function ({ types: t }) {
    return {
      name: 'expo-coverage-runtime',
      visitor: {
        Program(programPath, state) {
          if (!entryPath || !state.filename) return;
          let file;
          try {
            file = fs.realpathSync(state.filename);
          } catch {
            return;
          }
          if (file !== entryPath) return;
          programPath.unshiftContainer('body', t.importDeclaration([], t.stringLiteral('expo-coverage/autostart')));
        },
      },
    };
  };
}

module.exports = function expoCoveragePreset(api, options = {}) {
  const enabled = options.force === true || process.env.EXPO_COVERAGE === '1';
  // Instrumented and plain output differ, so they must not share a cache entry.
  api.cache.using(() => (enabled ? 'expo-coverage:on' : 'expo-coverage:off'));
  if (!enabled) return {};
  const cwd = options.cwd || process.cwd();
  return {
    plugins: [
      [
        require.resolve('babel-plugin-istanbul'),
        {
          cwd,
          include: options.include,
          // test-exclude's defaults already skip node_modules and *.test.* files.
          exclude: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/e2e/**', '**/.expo/**', '**/.expo-coverage/**', ...(options.exclude || [])],
        },
      ],
      injectRuntime(resolveEntry(cwd, options.entry)),
    ],
  };
};
