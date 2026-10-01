# Using expo-coverage with agents

Everything in the report is available as JSON, so an agent can find what no test has run.

## Commands

```bash
bunx expo-coverage gaps --top 5 --json
```

```
8 missed   53%  src/game.ts  28-33,36-37
5 missed   78%  src/App.tsx  20,29,33-35
```

```bash
bunx expo-coverage file src/game.ts      # uncovered ranges, with the source
bunx expo-coverage diff origin/main      # lines you changed that no test ran
bunx expo-coverage summary --json
```

A good prompt is: "Run `expo-coverage diff origin/main` and add a Maestro flow for any changed lines that are untested."

## Rule for your agent

Drop this in `AGENTS.md`, `CLAUDE.md` or a Cursor rule.

```md
## End-to-end coverage

- Run tests with coverage: `bunx expo-coverage run -- <test command>`.
- Find untested code: `bunx expo-coverage gaps --top 10 --json`.
- See one file's uncovered ranges with source: `bunx expo-coverage file <path>`.
- Before opening a PR: `bunx expo-coverage diff origin/main`. Every changed line it lists was not run by any test.
- Write the missing Maestro flow or Playwright spec, re-run, and confirm the lines are gone from `diff`.
- Use `testID` and accessibility labels for selectors, never coordinates.
```

## MCP

```json
{ "mcpServers": { "expo-coverage": { "command": "bunx", "args": ["expo-coverage", "mcp"] } } }
```

If your agent client can't find `bunx` (clients often start MCP servers without your shell's PATH), use `"command": "npx"` instead.

| Tool | Returns |
| --- | --- |
| `coverage_summary` | Overall and per-platform line coverage. |
| `coverage_gaps` | Files ranked by uncovered lines, with ranges. |
| `coverage_file` | Uncovered ranges for one file, with source. |
| `coverage_diff` | Changed lines against a git base that no test ran. |

Coverage is read from `.expo-coverage`, so the agent needs a run to have happened first.
