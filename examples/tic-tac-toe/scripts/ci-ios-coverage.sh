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

# RN's withCodegenDiscovery path never mkdir's SCRIPT_OUTPUT_FILE_0's parent
# (DERIVED_FILE_DIR). The final `echo Done >> "$SCRIPT_OUTPUT_FILE_0"` then
# fails under `set -e` after codegen already printed Done — Expo reports that
# as "[CP-User] Generate Specs failed". Harden before xcodebuild runs it.
patch_rn_codegen_script() {
  local script="node_modules/react-native/scripts/react_native_pods_utils/script_phases.sh"
  test -f "$script" || { echo "missing $script" >&2; return 1; }
  if grep -q 'expo-coverage: ensure SCRIPT_OUTPUT_FILE_0' "$script"; then
    return 0
  fi
  python3 - "$script" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text()
needle = "withCodegenDiscovery () {\n    find_node\n    find_codegen\n    generateArtifacts\n}"
insert = """withCodegenDiscovery () {
    # expo-coverage: ensure SCRIPT_OUTPUT_FILE_0 dir exists (Xcode outputPaths)
    if [ -n "${SCRIPT_OUTPUT_FILE_0:-}" ]; then
        mkdir -p "$(dirname "$SCRIPT_OUTPUT_FILE_0")"
        : > "$SCRIPT_OUTPUT_FILE_0"
    fi
    find_node
    find_codegen
    generateArtifacts
}"""
if needle not in text:
    raise SystemExit(f"could not patch {path}: withCodegenDiscovery block not found")
path.write_text(text.replace(needle, insert, 1))
print(f"patched {path}")
PY
  # Final Done line must not fail the phase if the log path is still missing.
  perl -i -0pe 's/echo '\''Done\.'\'' >> "\$\{SCRIPT_OUTPUT_FILE_0\}" 2>&1/if [ -n "${SCRIPT_OUTPUT_FILE_0:-}" ]; then mkdir -p "$(dirname "$SCRIPT_OUTPUT_FILE_0")"; echo Done. >> "$SCRIPT_OUTPUT_FILE_0" 2>&1 || true; else echo Done.; fi/s' "$script"
}

bunx expo prebuild --platform ios --non-interactive --no-install
NODE_BIN="$(command -v node)"
# Absolute path so Xcode script phases do not rely on a bare `node` on PATH.
{
  echo "export NODE_BINARY=${NODE_BIN}"
  echo "export PATH=\"$(dirname "$NODE_BIN"):\$PATH\""
} > ios/.xcode.env.local
patch_rn_codegen_script
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
