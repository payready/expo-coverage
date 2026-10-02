#!/usr/bin/env bash
# Single-process script for android-emulator-runner (it runs each YAML line as its own sh -c).
set -euo pipefail
cd "$(dirname "$0")/.."
export EXPO_COVERAGE=1
export CI=1

bunx expo prebuild --platform android --non-interactive --no-install
bunx expo run:android --no-bundler --no-install

bunx expo start --port 8081 &
metro_pid=$!
cleanup() { kill "$metro_pid" 2>/dev/null || true; }
trap cleanup EXIT

for _ in $(seq 1 90); do
  curl -sf http://127.0.0.1:8081/status >/dev/null && break
  sleep 2
done

bunx expo-coverage run -- maestro test .maestro
