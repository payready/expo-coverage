# Using expo-coverage with agents

Drop this in `AGENTS.md`, `CLAUDE.md` or a Cursor rule.

```md
## End-to-end coverage

- Run tests with coverage: `npx expo-coverage run -- <test command>`.
- Find untested code: `npx expo-coverage gaps --top 10 --json`.
- See one file's uncovered ranges with source: `npx expo-coverage file <path>`.
- Before opening a PR: `npx expo-coverage diff origin/main`. Every changed line it lists was not run by any test.
- Write the missing Maestro flow or Playwright spec, re-run, and confirm the lines are gone from `diff`.
- Use `testID` and accessibility labels for selectors, never coordinates.
```

## MCP

```json
{ "mcpServers": { "expo-coverage": { "command": "npx", "args": ["expo-coverage", "mcp"] } } }
```

| Tool | Returns |
| --- | --- |
| `coverage_summary` | Overall and per-platform line coverage. |
| `coverage_gaps` | Files ranked by uncovered lines, with ranges. |
| `coverage_file` | Uncovered ranges for one file, with source. |
| `coverage_diff` | Changed lines against a git base that no test ran. |

Coverage is read from `.expo-coverage`, so the agent needs a run to have happened first.
