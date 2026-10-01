# expo-coverage

**End-to-end JavaScript coverage for Expo apps. iOS, Android and web in one report.**

Run your Maestro flows, Playwright specs or Detox tests. Get Istanbul line hits for every platform in a single, shareable HTML file. Agents can read the same data and write the tests that are missing.

![Report](docs/report-light.png)

- **One report, every platform.** Tabs for iOS, Android, Web and All. A line counts when any platform ran it, and you can see who covered what.
- **Three small edits.** A Babel preset, a Metro wrapper and a config plugin. `npx expo-coverage init` shows you the diff first.
- **No code changes in your app.** The runtime starts itself from your entry file and only exists when `EXPO_COVERAGE=1`.
- **One static file.** `report.html` has no server and no network. Attach it to CI, open it from disk, send it in Slack.
- **Agent friendly.** `gaps`, `file`, `diff` and `summary --json`, plus an MCP server, so an agent can see what no test has touched.
- **MIT, no telemetry.** Made by Pay Ready.

## Quick start

```bash
bun add -d expo-coverage      # or npm i -D / pnpm add -D / yarn add -D
npx expo-coverage init        # shows the edits; add --yes to apply them
npx expo-coverage run -- npx playwright test
```

```
expo-coverage: collecting on :9082, running npx playwright test
  2 passed (4.0s)
Coverage  Web 68.3%
28/41 lines · 3 files · 0 never ran
Report    .expo-coverage/report.html
```

Open `.expo-coverage/report.html`. That is the whole loop.

### What `init` changes

```js
// babel.config.js
module.exports = function (api) {
  api.cache.using(() => process.env.EXPO_COVERAGE);
  return { presets: ['babel-preset-expo', 'expo-coverage/babel'] };
};
```

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withCoverage } = require('expo-coverage/metro');

module.exports = withCoverage(getDefaultConfig(__dirname));
```

```json
// app.json
{ "expo": { "plugins": ["expo-coverage/app.plugin"] } }
```

With `EXPO_COVERAGE` unset, all three do nothing. Your normal builds are byte for byte the same.

## Examples

The [tic-tac-toe app](examples/tic-tac-toe) in this repo is wired up end to end, with Playwright specs and Maestro flows that deliberately leave some branches untested.

### Web with Playwright

```ts
// e2e/game.spec.ts
import { expect, test } from 'expo-coverage/playwright';

test('X wins along the top row', async ({ page }) => {
  await page.goto('/');
  for (const cell of [0, 3, 1, 4, 2]) await page.getByTestId(`cell-${cell}`).click();
  await expect(page.getByTestId('status')).toHaveText('X wins!');
});
```

`expo-coverage/playwright` re-exports `test` and `expect` and flushes coverage when each test ends, so short tests are not lost.

```bash
npx expo-coverage run -- npx playwright test
```

### iOS and Android with Maestro

```yaml
# .maestro/win.yaml
appId: dev.example.tictactoe
---
- launchApp
- tapOn:
    id: cell-0
- tapOn:
    id: cell-3
- assertVisible: "X's turn"
```

Build a dev client or a simulator build with the flag, then run your flows. The app posts its coverage to the collector every two seconds and when it goes to the background.

```bash
EXPO_COVERAGE=1 npx expo run:ios       # or run:android
npx expo-coverage run -- maestro test .maestro
```

Android emulators reach the host through `adb reverse`. `run` sets that up for you. Physical devices can set `EXPO_PUBLIC_COVERAGE_URL=http://<your-lan-ip>:9082` at build time.

### Prebuilt apps (EAS, CI artifacts)

Build once with `EXPO_COVERAGE=1`, then collect from whatever drives the app:

```bash
npx expo-coverage serve &        # collector on :9082 until stopped
maestro test .maestro
npx expo-coverage report
```

### Several platforms into one report

Every run writes `.expo-coverage/coverage-<platform>.json` and merges into what is already there. Run iOS, Android and web in any order, or download the folders from separate CI jobs into one directory, then:

```bash
npx expo-coverage report --open
```

## CI

The composite action in this repo builds the report, uploads it as an artifact and writes the numbers to the job summary.

```yaml
# .github/workflows/e2e.yml
- run: npx expo-coverage run -- npx playwright test
- uses: payready/expo-coverage@v0
  with:
    fail-under: 70        # optional
```

See [docs/ci.md](docs/ci.md) for the artifact layout, a PR-comment recipe and an EAS Workflows example.

## For agents

Everything in the report is available as JSON, so an agent can find what no test has run.

```bash
npx expo-coverage gaps --top 5 --json
```

```
8 missed   53%  src/game.ts  28-33,36-37
5 missed   78%  src/App.tsx  20,29,33-35
```

```bash
npx expo-coverage file src/game.ts      # uncovered ranges, with the source
npx expo-coverage diff origin/main      # lines you changed that no test ran
npx expo-coverage summary --json
```

Or give your agent the MCP server (stdio):

```json
{ "mcpServers": { "expo-coverage": { "command": "npx", "args": ["expo-coverage", "mcp"] } } }
```

Tools: `coverage_summary`, `coverage_gaps`, `coverage_file`, `coverage_diff`. A good prompt is: "Run `expo-coverage diff origin/main` and add a Maestro flow for any changed lines that are untested." There is a ready-made rule in [docs/agents.md](docs/agents.md).

## How it works

1. **Instrument.** The Babel preset runs `babel-plugin-istanbul` over your source and puts `import 'expo-coverage/autostart'` at the top of your entry file.
2. **Collect.** The runtime posts `globalThis.__coverage__` to a collector every two seconds, when the app backgrounds and when a web page hides. Metro answers `/__coverage` itself for web and dev builds. `run` and `serve` start a standalone collector for everything else.
3. **Merge.** Posts for the same platform add up, so a JS reload does not lose earlier hits. Sibling git worktrees that share Metro's cache are rewritten to the project root.
4. **Report.** Platforms are merged line by line, highlighted with Shiki and rendered by a React Native Web app (PanelUI and Uniwind) into a single HTML file.

## Commands

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

### Babel preset options

```js
presets: [['expo-coverage/babel', { include: ['src/**'], exclude: ['**/generated/**'], entry: 'index.js' }]]
```

## Limits worth knowing

- **JavaScript only.** Native Swift, Kotlin and Java code is not measured.
- **Dev and instrumented builds.** Instrumented code is slower and bigger. Do not ship it. The flag keeps it out of normal builds.
- **Files the app never loads are not listed.** Coverage comes from loaded modules, so a screen your tests never reach will be missing rather than shown as 0%.
- **Native is unverified in this repo's CI.** The web path is tested end to end here. The iOS and Android path uses the same runtime and collector, and the Maestro flows are included, but run them on your own simulator or device before relying on it.

## Repository layout

```
packages/expo-coverage   CLI, runtime, Babel preset, Metro wrapper, config plugin, MCP server
packages/report          The report app (React Native Web, PanelUI, Uniwind), built to one HTML file
examples/tic-tac-toe     Demo Expo app with Playwright specs and Maestro flows
```

## Development

Uses [Bun](https://bun.sh) 1.3.

```bash
bun install
bun run build                 # report, then the package
bun run test
bun run example:install       # pack expo-coverage and install it into the demo app
cd examples/tic-tac-toe && bun run coverage:web
```

## License

MIT © Pay Ready
