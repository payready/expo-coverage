# CI recipes

The report is one file, `.expo-coverage/report.html`. Raw data lives next to it as `coverage-<platform>.json`.

## GitHub Actions: web

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
      - uses: payready/expo-coverage@v0
        with:
          fail-under: 70
```

The composite action builds the report, uploads it as an artifact and writes the numbers to the job summary. `fail-under` is optional.

Complete web + iOS + Android + merge workflows for the demo are in [examples/tic-tac-toe/workflows/e2e.yml](../examples/tic-tac-toe/workflows/e2e.yml), and [`demo-e2e.yml`](../.github/workflows/demo-e2e.yml) runs the web job on this repo.

## One report from several jobs

Upload each job's `.expo-coverage` folder, download them into one directory, and run the action there. Files for the same platform add up, and different platforms sit side by side.

```yaml
  report:
    needs: [web, ios, android]
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
