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

# Xcode still marks [CP-User] Generate Specs as failed on GHA even after codegen
# prints Done (Expo then aborts the build). CocoaPods already generated the
# artifacts during `pod install`; turn the phase into a no-op so the app builds.
noop_generate_specs_phase() {
  python3 - <<'PY'
from pathlib import Path
import re
pbx = Path("ios/Pods/Pods.xcodeproj/project.pbxproj")
text = pbx.read_text()
# Replace only the Generate Specs shellScript body.
pat = re.compile(
    r'(name = "\[CP-User\] Generate Specs";\s*'
    r'outputPaths = \(\s*"[^"]+"\s*,\s*\);\s*'
    r"runOnlyForDeploymentPostprocessing = 0;\s*"
    r"shellPath = /bin/sh;\s*"
    r'shellScript = ")(.*?)(";\s*\})',
    re.S,
)
# pbxproj stores the script with \n escapes. Create the declared outputPath so
# Xcode does not fail the phase for a missing react-codegen.log.
noop = (
    "mkdir -p \\\"${DERIVED_FILE_DIR:-/tmp}\\\"\\n"
    "touch \\\"${DERIVED_FILE_DIR:-/tmp}/react-codegen.log\\\"\\n"
    "echo expo-coverage: Generate Specs no-op\\n"
    "exit 0\\n"
)
m = pat.search(text)
if not m:
    raise SystemExit("Generate Specs shellScript not found in Pods.xcodeproj")
text = pat.sub(m.group(1) + noop + m.group(3), text, count=1)
pbx.write_text(text)
print("Generate Specs phase set to no-op")
PY
}
noop_generate_specs_phase

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

# Bypass `expo run:ios` — on GHA it exits 65 with an opaque
# "Could not resolve package dependencies" after codegen already succeeded.
boot_sim() {
  xcrun simctl list devices available -j | python3 -c '
import json, sys
devs = json.load(sys.stdin)["devices"]
for runtime, devices in devs.items():
    if "iOS" not in runtime:
        continue
    for d in devices:
        if d.get("isAvailable") and "iPhone" in d.get("name", ""):
            print(d["udid"])
            raise SystemExit
raise SystemExit("no iPhone simulator")
'
}

SIM_UDID="$(boot_sim)"
echo "Using simulator $SIM_UDID"
xcrun simctl boot "$SIM_UDID" 2>/dev/null || true
xcrun simctl bootstatus "$SIM_UDID" -b

set +e
xcodebuild \
  -workspace ios/TicTacToe.xcworkspace \
  -scheme TicTacToe \
  -configuration Debug \
  -destination "platform=iOS Simulator,id=${SIM_UDID}" \
  -derivedDataPath ios/DerivedData \
  ONLY_ACTIVE_ARCH=YES \
  EXCLUDED_ARCHS=x86_64 \
  CODE_SIGNING_ALLOWED=NO \
  COMPILER_INDEX_STORE_ENABLE=NO \
  build 2>&1 | tee ios/xcodebuild-ci.log
ios_build=${PIPESTATUS[0]}
set -e
if [[ "$ios_build" -ne 0 ]]; then
  echo "::group::xcodebuild errors"
  rg -n "error:|fatal|SwiftCompile failed|❌" ios/xcodebuild-ci.log | tail -80 || true
  echo "::endgroup::"
  dump_xcode_failure_logs
  echo "xcodebuild failed (exit $ios_build)" >&2
  exit "$ios_build"
fi

APP="$(find ios/DerivedData/Build/Products -name 'TicTacToe.app' -type d | head -1)"
test -n "$APP" || { echo "TicTacToe.app not found under DerivedData" >&2; exit 1; }
xcrun simctl install "$SIM_UDID" "$APP"
xcrun simctl launch "$SIM_UDID" dev.example.tictactoe
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
