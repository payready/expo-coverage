# CLI reference

| Command | What it does |
| --- | --- |
| `init [--yes]` | Show or apply the Babel, Metro, config plugin and `.gitignore` edits. |
| `run -- <cmd>` | Start the collector, run `<cmd>` with `EXPO_COVERAGE=1`, write the report. |
| `serve [--port 9082]` | Collect until stopped. For prebuilt apps. |
| `report [--open] [--out file]` | Merge all platforms into one HTML file. |
| `gaps [--top n] [--tab ios\|android\|web] [--json]` | Files with the most uncovered lines. |
| `file <path>` | Uncovered ranges of one file, with source. |
| `diff [base]` | Changed lines (vs a git base) that no test ran. |
| `summary [--json]` | Numbers only. |
| `mcp` | MCP server for agents. |

Global flags: `--root <dir>` (project root) and `--dir <name>` (output folder, default `.expo-coverage`).

## Babel preset options

```js
presets: [['expo-coverage/babel', { include: ['src/**'], exclude: ['**/generated/**'], entry: 'index.js' }]]
```
