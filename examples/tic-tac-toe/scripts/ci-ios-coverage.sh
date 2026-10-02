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

# CI failures look like "[CP-User] Generate Specs failed" after codegen prints Done.
# Two issues stack:
# 1) withCodegenDiscovery never mkdir's SCRIPT_OUTPUT_FILE_0 (DERIVED_FILE_DIR).
# 2) generatePackageSwift writes Package.swift with a broken relative path to
#    react-native; xcodebuild then fails SPM resolve ("Could not resolve package
#    dependencies"). CocoaPods already builds ReactCodegen — skip Package.swift.
patch_rn_codegen_for_ci() {
  local phases="node_modules/react-native/scripts/react_native_pods_utils/script_phases.sh"
  local pkg_swift="node_modules/react-native/scripts/codegen/generate-artifacts-executor/generatePackageSwift.js"
  test -f "$phases" || { echo "missing $phases" >&2; return 1; }
  test -f "$pkg_swift" || { echo "missing $pkg_swift" >&2; return 1; }

  python3 - "$phases" "$pkg_swift" <<'PY'
from pathlib import Path
import sys

phases = Path(sys.argv[1])
pkg_swift = Path(sys.argv[2])

text = phases.read_text()
if "expo-coverage: ensure SCRIPT_OUTPUT_FILE_0" not in text:
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
    # CocoaPods builds ReactCodegen; delete SPM Package.swift (bad relative path on CI).
    find "$RCT_SCRIPT_APP_PATH" "$RCT_SCRIPT_OUTPUT_DIR" -path '*/generated/ios/Package.swift' -delete 2>/dev/null || true
}"""
    if needle not in text:
        raise SystemExit(f"could not patch {phases}: withCodegenDiscovery block not found")
    text = text.replace(needle, insert, 1)

old_done = "echo 'Done.' >> \"${SCRIPT_OUTPUT_FILE_0}\" 2>&1"
new_done = (
    'if [ -n "${SCRIPT_OUTPUT_FILE_0:-}" ]; then '
    'mkdir -p "$(dirname "$SCRIPT_OUTPUT_FILE_0")"; '
    'echo Done. >> "$SCRIPT_OUTPUT_FILE_0" 2>&1 || true; '
    'else echo Done.; fi'
)
if old_done in text:
    text = text.replace(old_done, new_done, 1)
phases.write_text(text)
print(f"patched {phases}")

# No-op Package.swift generation entirely.
pkg_swift.write_text(
    """/**
 * expo-coverage CI override: skip Package.swift.
 * The stock generator writes a broken relative path to react-native that makes
 * xcodebuild fail SPM resolve during [CP-User] Generate Specs. CocoaPods already
 * compiles ReactCodegen / ReactAppDependencyProvider.
 */
'use strict';
const {codegenLog} = require('./utils');
function generatePackageSwift() {
  codegenLog('Skipping Package.swift (expo-coverage CI)');
}
module.exports = {generatePackageSwift};
"""
)
print(f"patched {pkg_swift}")
PY
}

dump_xcode_failure_logs() {
  echo "::group::xcode failure hints"
  find "$HOME/Library/Developer/Xcode/DerivedData" ios/build -name '*.log' 2>/dev/null \
    | head -40 \
    | while read -r f; do
        if rg -q "error:|Could not resolve|Generate Specs|Package\.swift" "$f" 2>/dev/null; then
          echo "---- $f ----"
          rg -n "error:|Could not resolve|Generate Specs|Package\.swift|❌" "$f" | tail -40 || true
        fi
      done || true
  echo "::endgroup::"
}

bunx expo prebuild --platform ios --non-interactive --no-install
NODE_BIN="$(command -v node)"
# Absolute path so Xcode script phases do not rely on a bare `node` on PATH.
{
  echo "export NODE_BINARY=${NODE_BIN}"
  echo "export PATH=\"$(dirname "$NODE_BIN"):\$PATH\""
} > ios/.xcode.env.local
patch_rn_codegen_for_ci
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

set +e
bunx expo run:ios --configuration Debug --no-bundler --no-install
ios_build=$?
set -e
if [[ "$ios_build" -ne 0 ]]; then
  dump_xcode_failure_logs
  echo "expo run:ios failed (exit $ios_build)" >&2
  exit "$ios_build"
fi
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
