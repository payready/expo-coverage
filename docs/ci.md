# CI recipes

The report is one file, `.expo-coverage/report.html`. Raw data lives next to it as `coverage-<platform>.json`.

## This repo: `demo-e2e` (web + iOS + Android)

[`.github/workflows/demo-e2e.yml`](../.github/workflows/demo-e2e.yml) is the dogfood pipeline:

1. **web** — Playwright `coverage:web` → `coverage-web.json`
2. **ios** (`macos-15`) — Maestro on the simulator → `coverage-ios.json`
3. **android** — Maestro on an emulator → `coverage-android.json`
4. **report** (`if: always()`) — downloads `coverage-*`, builds the merged HTML with the local composite action (`uses: ./` + `package: ./packages/expo-coverage`), validates styles, uploads **`demo-coverage-report`**

The artifact's `report.html` has **iOS / Android / Web / All** tabs when all three jobs produced JSON.

Uses Bun, `bun run example:install`, and the in-repo action — not an unpublished `payready/expo-coverage@v0` tag.

## GitHub Actions: web only (consumer snippet)

```yaml
name: e2e
on: pull_request
jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bunx playwright install --with-deps chromium
      - run: bunx expo-coverage run -- bunx playwright test
      - uses: payready/expo-coverage@v0   # or uses: ./ while dogfooding this monorepo
        with:
          fail-under: 70
          # Optional: count unloaded source files as 0% (Istanbul --all)
          # all: true
```

The composite action builds the report, uploads it as an artifact and writes the numbers to the job summary. `fail-under` is optional. Pass `package: ./packages/expo-coverage` (after `bun run build`) when running the action from this repository before the package is published.

## Full three-platform merge (consumer template)

Copy [examples/tic-tac-toe/workflows/e2e.yml](../examples/tic-tac-toe/workflows/e2e.yml) into your app. Web, iOS and Android each upload `coverage-*.json`; the **report** job merges them. Until `payready/expo-coverage` is published, point the report step at a local checkout (`uses: ./` with `package: ./packages/expo-coverage`) or run `bunx expo-coverage report` after installing the package.

## One report from several jobs

Upload each job's coverage JSON, download them into one directory, and run the action there. Files for the same platform add up, and different platforms sit side by side.

```yaml
  report:
    needs: [web, ios, android]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          pattern: coverage-*
          path: .expo-coverage
          merge-multiple: true
      - uses: payready/expo-coverage@v0
```

Each platform job ends with:

```yaml
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-ios
          path: .expo-coverage/coverage-ios.json
```

## EAS Workflows (Maestro on a simulator build)

Build the profile with `EXPO_COVERAGE=1`, run the flows with the collector up, then upload the folder.

```yaml
# .eas/workflows/e2e-ios.yml
jobs:
  build:
    type: build
    params: { platform: ios, profile: e2e-simulator }
  test:
    needs: [build]
    type: maestro
    environment: preview
    params:
      build_id: ${{ needs.build.outputs.build_id }}
      flow_path: ['.maestro/win.yaml']
```

```jsonc
// eas.json
{ "build": { "e2e-simulator": { "ios": { "simulator": true }, "env": { "EXPO_COVERAGE": "1" } } } }
```

The EAS Maestro job does not give the app a route to a collector on your CI machine. Either run the flows from a runner you control (`bunx expo-coverage run -- maestro test .maestro`) or point the build at a collector you host with `EXPO_PUBLIC_COVERAGE_URL`. This path has not been exercised end to end yet.

## A comment on the pull request

```yaml
      - uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const { execSync } = require('child_process');
            const gaps = execSync('bunx expo-coverage diff origin/${{ github.base_ref }}').toString();
            await github.rest.issues.createComment({
              ...context.repo,
              issue_number: context.issue.number,
              body: `**Changed lines no e2e test ran**\n\n\`\`\`\n${gaps}\n\`\`\``,
            });
```
