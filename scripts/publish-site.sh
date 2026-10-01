#!/usr/bin/env bash
# Build the demo app for web, put the latest coverage report at /coverage, and deploy with EAS Hosting.
# Needs EXPO_TOKEN (CI) or `eas login` (local). Pass --prod for the production alias.
set -euo pipefail
cd "$(dirname "$0")/../examples/tic-tac-toe"
test -f .expo-coverage/report.html || { echo "No report. Run: bun run coverage:web" >&2; exit 1; }
rm -rf dist
CI=1 npx expo export -p web
mkdir -p dist/coverage
cp .expo-coverage/report.html dist/coverage/index.html
npx eas-cli deploy ${1:+"$1"}
