# Usage

How to collect coverage from each kind of test, and how to combine the results. For the three-command version, see the [quick start](../README.md#quick-start).

The [tic-tac-toe app](../examples/tic-tac-toe) in this repo is wired up end to end, with Playwright specs and Maestro flows that deliberately leave some branches untested.

## What `init` changes

`bunx expo-coverage init` shows these edits first. Add `--yes` to apply them.

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

## Web with Playwright

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
bunx expo-coverage run -- bunx playwright test
```

## iOS and Android with Maestro

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
EXPO_COVERAGE=1 bunx expo run:ios       # or run:android
bunx expo-coverage run -- maestro test .maestro
```

Android emulators reach the host through `adb reverse`. `run` sets that up for you. Physical devices can set `EXPO_PUBLIC_COVERAGE_URL=http://<your-lan-ip>:9082` at build time.

## Prebuilt apps (EAS, CI artifacts)

Build once with `EXPO_COVERAGE=1`, then collect from whatever drives the app:

```bash
bunx expo-coverage serve &        # collector on :9082 until stopped
maestro test .maestro
bunx expo-coverage report
```

## Several platforms into one report

Every run writes `.expo-coverage/coverage-<platform>.json` and merges into what is already there. Run iOS, Android and web in any order, or download the folders from separate CI jobs into one directory, then:

```bash
bunx expo-coverage report --open
```

## Unit tests

Unit coverage shows up as a fourth platform, **Unit**, next to the e2e ones. Run your tests with coverage, then import the file:

```bash
# Jest (coverageReporters must include "json")
bunx jest --coverage
bunx expo-coverage import --platform unit coverage/coverage-final.json

# bun test
bun test --coverage --coverage-reporter=lcov
bunx expo-coverage import --platform unit coverage/lcov.info \
  --exclude '**/*.test.{ts,tsx}' --exclude '**/*.stories.tsx' --exclude '**/__mocks__/**'

bunx expo-coverage report
```

The All tab counts a line as covered if any platform, unit included, ran it. Use `--tab unit` with `gaps`, `file`, `diff` and `summary` to look at unit tests alone.

## Next

- [CI recipes](ci.md)
- [Using it with agents](agents.md)
- [CLI reference](cli.md)
