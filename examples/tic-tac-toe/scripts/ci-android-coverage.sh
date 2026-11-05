#!/usr/bin/env bash
# Single-process script for android-emulator-runner (it runs each YAML line as its own sh -c).
set -euo pipefail
cd "$(dirname "$0")/.."
export EXPO_COVERAGE=1
export CI=1
export MAESTRO_CLI_NO_ANALYTICS=1

bunx expo prebuild --platform android --non-interactive --no-install

# Metro must be up and have produced an Android bundle before Maestro taps.
bunx expo start --port 8081 &
metro_pid=$!
cleanup() { kill "$metro_pid" 2>/dev/null || true; }
trap cleanup EXIT

for _ in $(seq 1 90); do
  curl -sf http://127.0.0.1:8081/status >/dev/null && break
  sleep 2
done
echo "Warming Android bundle…"
curl -sf "http://127.0.0.1:8081/index.bundle?platform=android&dev=true&minify=false" -o /dev/null

bunx expo run:android --no-bundler --no-install
# Dev client needs a moment after install before UI is hittable.
sleep 8

set +e
bunx expo-coverage run -- maestro test .maestro
maestro_code=$?
set -e

# Metro withCoverage writes the JSON even when the standalone collector sees 0 posts.
if [[ -s .expo-coverage/coverage-android.json ]]; then
  echo "coverage-android.json present ($(wc -c < .expo-coverage/coverage-android.json) bytes); maestro exit=$maestro_code"
  exit 0
fi
echo "missing coverage-android.json (maestro exit=$maestro_code)" >&2
exit "${maestro_code:-1}"
