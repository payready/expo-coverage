#!/usr/bin/env bash
# Build expo-coverage, pack it like npm would, and install that tarball into the demo app.
# A real tarball (not a symlink) keeps one copy of @playwright/test, exactly like a user's project.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
bun run --cwd "$root" build
mkdir -p "$root/.tmp"
tarball="$(cd "$root/packages/expo-coverage" && npm pack --silent --pack-destination "$root/.tmp")"
cd "$root/examples/tic-tac-toe"
# Fixed name so the demo's package.json survives version bumps.
cp "$root/.tmp/$tarball" "$root/.tmp/expo-coverage.tgz"
rm -f bun.lock  # the tarball hash changes every build
bun install
