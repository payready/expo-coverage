# Contributing

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

## Demo site

`bun run site:publish` (or run the `site` workflow by hand) exports the tic-tac-toe app for web, adds the latest report at `/coverage`, and deploys with [EAS Hosting](https://docs.expo.dev/eas/hosting/introduction/). It needs an `EXPO_TOKEN` secret and a one-time `eas init` in `examples/tic-tac-toe`.

## README copy

`packages/expo-coverage/README.md` is the copy that ships to npm. Keep it the same as the root `README.md`, with links rewritten to absolute GitHub URLs.
