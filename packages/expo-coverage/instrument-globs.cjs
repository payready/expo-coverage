'use strict';

/**
 * Include/exclude used by both the Babel preset (babel-plugin-istanbul) and
 * `expo-coverage report --all` inventory. Keep these in one place so the
 * denominator matches what instrumentation would have covered.
 */
module.exports = {
  /** Always applied on top of any babel `exclude` option. */
  DEFAULT_EXCLUDE: [
    '**/node_modules/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/__tests__/**',
    '**/e2e/**',
    '**/.expo/**',
    '**/.expo-coverage/**',
    '**/*.d.ts',
  ],
  /** Same extensions babel-plugin-istanbul / test-exclude understand by default. */
  DEFAULT_EXTENSION: ['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx'],
};
