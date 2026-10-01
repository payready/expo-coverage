'use strict';

/**
 * Babel preset: instruments your source with Istanbul when EXPO_COVERAGE=1, and does nothing otherwise,
 * so normal builds are untouched.
 *
 *   presets: ['babel-preset-expo', 'expo-coverage/babel']
 *
 * Options: { include?: string[], exclude?: string[], cwd?: string, force?: boolean }
 */
module.exports = function expoCoveragePreset(api, options = {}) {
  const enabled = options.force === true || process.env.EXPO_COVERAGE === '1';
  // Instrumented and plain output differ, so they must not share a cache entry.
  api.cache.using(() => (enabled ? 'expo-coverage:on' : 'expo-coverage:off'));
  if (!enabled) return {};
  return {
    plugins: [
      [
        require.resolve('babel-plugin-istanbul'),
        {
          cwd: options.cwd || process.cwd(),
          include: options.include,
          // test-exclude's defaults already skip node_modules and *.test.* files.
          exclude: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/e2e/**', '**/.expo/**', '**/.expo-coverage/**', ...(options.exclude || [])],
        },
      ],
    ],
  };
};
