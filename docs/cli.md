# CLI reference

| Command | What it does |
| --- | --- |
| `init [--yes]` | Show or apply the Babel, Metro, config plugin and `.gitignore` edits. |
| `run -- <cmd>` | Start the collector, run `<cmd>` with `EXPO_COVERAGE=1`, write the report. |
| `serve [--port 9082]` | Collect until stopped. For prebuilt apps. |
| `import <file> [--platform unit] [--exclude glob]...` | Merge a Jest `coverage-final.json` or an `lcov.info` into `coverage-<platform>.json`. |
| `report [--open] [--all] [--out file]` | Merge all platforms into one HTML file. |
| `gaps [--top n] [--tab ios\|android\|web\|unit\|all] [--json] [--all]` | Files with the most uncovered lines. |
| `file <path>` | Uncovered ranges of one file, with source. |
| `diff [base]` | Changed lines (vs a git base) that no test ran. |
| `summary [--json] [--all]` | Numbers only. |
| `mcp` | MCP server for agents. |

Global flags: `--root <dir>` (project root) and `--dir <name>` (output folder, default `.expo-coverage`).

`--all` uses an Istanbul-style inventory denominator: every source file matching the Babel preset's include/exclude starts at 0% until hits arrive. Unloaded modules show as never-ran and pull the overall % down. Default stays load-based (only modules the app posted). Same effect via `EXPO_COVERAGE_ALL=1`.

## `import`

```bash
expo-coverage import --platform unit <file> [--root .] [--dir .expo-coverage] [--exclude <glob>]...
```

- `<file>` is an Istanbul `coverage-final.json` (Jest's `json` reporter) or an `lcov.info` (`bun test --coverage --coverage-reporter=lcov`).
- lcov becomes one statement per `DA` line, plus functions (`FN`/`FNDA`, or bun's `FNF`/`FNH` counts) and branches (`BRDA`).
- Relative paths resolve against `--root`, so bun's `SF:src/a.ts` lines up with the e2e maps.
- `--exclude` is repeatable. A pattern without `/` matches the file name anywhere. `node_modules` is always dropped.
- Imports add to what is already in the file, so import once per test run (or delete `coverage-unit.json` first).

## Babel preset options

```js
presets: [['expo-coverage/babel', { include: ['src/**'], exclude: ['**/generated/**'], entry: 'index.js' }]]
```

`report --all` reads those same `include` / `exclude` options from `babel.config.js` (plus the defaults in `instrument-globs.cjs`).
