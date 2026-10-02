#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export EXPO_COVERAGE=1
export CI=1

bunx expo prebuild --platform ios --non-interactive --no-install
(cd ios && pod install)
bunx expo run:ios --configuration Debug --no-bundler --no-install

bunx expo start --port 8081 &
metro_pid=$!
cleanup() { kill "$metro_pid" 2>/dev/null || true; }
trap cleanup EXIT

for _ in $(seq 1 60); do
  curl -sf http://127.0.0.1:8081/status >/dev/null && break
  sleep 2
done

bunx expo-coverage run -- maestro test .maestro
