# How it works

1. **Instrument.** The Babel preset runs `babel-plugin-istanbul` over your source and puts `import 'expo-coverage/autostart'` at the top of your entry file.
2. **Collect.** The runtime posts `globalThis.__coverage__` to a collector every two seconds, when the app backgrounds and when a web page hides. Metro answers `/__coverage` itself for web and dev builds. `run` and `serve` start a standalone collector for everything else.
3. **Merge.** Posts for the same platform add up, so a JS reload does not lose earlier hits. Sibling git worktrees that share Metro's cache are rewritten to the project root.
4. **Report.** Platforms are merged line by line, highlighted with Shiki and rendered by a React Native Web app (PanelUI and Uniwind) into a single HTML file.

## Limits worth knowing

- **JavaScript only.** Native Swift, Kotlin and Java code is not measured.
- **Dev and instrumented builds.** Instrumented code is slower and bigger. Do not ship it. The flag keeps it out of normal builds.
- **Files the app never loads are not listed (default).** Coverage comes from loaded modules, so a screen your tests never reach is missing rather than shown as 0%. Pass `report --all` (or `EXPO_COVERAGE_ALL=1`) for an Istanbul-style inventory: every file matching the Babel include/exclude starts at 0% (line-based baseline) until hits arrive.
- **Verified on web, iOS, and Android in CI.** [`demo-e2e.yml`](../.github/workflows/demo-e2e.yml) merges all three into one `demo-coverage-report` artifact.
- **Dev servers.** In dev builds the app finds Metro on its own. For release or prebuilt apps, bake `EXPO_PUBLIC_COVERAGE_URL` and use `expo-coverage serve`.
