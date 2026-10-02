#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export EXPO_COVERAGE=1
export CI=1
export MAESTRO_CLI_NO_ANALYTICS=1

# Xcode script phases need a real node on PATH (bun alone is not enough for codegen).
if ! command -v node >/dev/null 2>&1; then
  echo "node is required for iOS codegen; install Node before this script" >&2
  exit 1
fi

bunx expo prebuild --platform ios --non-interactive --no-install
echo "export NODE_BINARY=$(command -v node)" > ios/.xcode.env.local
(cd ios && pod install)

bunx expo start --port 8081 &
metro_pid=$!
cleanup() { kill "$metro_pid" 2>/dev/null || true; }
trap cleanup EXIT

for _ in $(seq 1 60); do
  curl -sf http://127.0.0.1:8081/status >/dev/null && break
  sleep 2
done
echo "Warming iOS bundle…"
curl -sf "http://127.0.0.1:8081/index.bundle?platform=ios&dev=true&minify=false" -o /dev/null

bunx expo run:ios --configuration Debug --no-bundler --no-install
sleep 5

set +e
bunx expo-coverage run -- maestro test .maestro
maestro_code=$?
set -e

if [[ -s .expo-coverage/coverage-ios.json ]]; then
  echo "coverage-ios.json present ($(wc -c < .expo-coverage/coverage-ios.json) bytes); maestro exit=$maestro_code"
  exit 0
fi
echo "missing coverage-ios.json (maestro exit=$maestro_code)" >&2
exit "${maestro_code:-1}"
