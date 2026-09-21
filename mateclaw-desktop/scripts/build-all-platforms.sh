#!/usr/bin/env bash
#
# scripts/build-all-platforms.sh — One-click packaging for macOS, Windows and
# Linux in the selected build mode.
#
# Pipeline (see scripts/README.md):
#   1. resources/app.jar        ← Spring Boot fat JAR   (only in local mode)
#   2. resources/jre/<os>-<arch> ← Adoptium JRE 21      (only in local mode)
#   3. dist/ + dist-electron/   ← Vue + Electron frontend build
#   4. release/                 ← electron-builder artifacts
#
# Usage:
#   scripts/build-all-platforms.sh [mode] [platform]
#
#   mode (default --all):
#     --all      local mode, every platform        (same as --local)
#     --local    full build: bundles the JRE + JAR
#     --remote   lightweight build: no JRE/JAR resources (~530 MB smaller);
#                the app can only connect to a remote server
#   platform (default: macOS + Windows):
#     --mac-only | --win-only | --linux-only | --all-platforms
#
# Examples:
#   scripts/build-all-platforms.sh --remote --all-platforms
#   scripts/build-all-platforms.sh --local --linux-only
#
# AuraClaw note: upstream's version called electron-builder directly, so the
# frontend (`npm run build`) and the per-platform JRE were never produced —
# the packaged app would reuse a stale `dist-electron/` and fail to find a JRE
# for Windows/Linux. This version follows what scripts/README.md already
# documents. See docs/CUSTOMIZATIONS.md.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  cat <<'EOF'
Usage: scripts/build-all-platforms.sh [mode] [platform]

Mode (default: --all):
  --all        local mode, macOS + Windows (same as --local)
  --local      full build: bundles the JRE + JAR
  --remote     lightweight build: no JRE/JAR resources

Platform (default: macOS + Windows):
  --mac-only | --win-only | --linux-only | --all-platforms

Examples:
  scripts/build-all-platforms.sh --remote --all-platforms
  scripts/build-all-platforms.sh --local --linux-only
EOF
}

MODE="local"
PLATFORMS="mac win"

while [ $# -gt 0 ]; do
  case "$1" in
    --all)
      MODE="local"
      PLATFORMS="mac win"
      ;;
    --local) MODE="local" ;;
    --remote) MODE="remote" ;;
    --mac-only) PLATFORMS="mac" ;;
    --win-only) PLATFORMS="win" ;;
    --linux-only) PLATFORMS="linux" ;;
    --all-platforms) PLATFORMS="mac win linux" ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

cd "$PROJECT_ROOT"

echo "==> Building platforms: $PLATFORMS (BUILD_MODE=$MODE)"

if [ "$MODE" = "local" ]; then
  # 1. Spring Boot fat JAR → resources/app.jar
  bash "$SCRIPT_DIR/build.sh"

  # 2. JRE per platform: electron-builder's ${os}-${arch} extraResources rule
  #    needs one directory per (os, arch) pair it will package.
  for platform in $PLATFORMS; do
    case "$platform" in
      mac) bash "$SCRIPT_DIR/download-jre.sh" all ;;
      win) bash "$SCRIPT_DIR/download-jre.sh" win-x64 win-arm64 ;;
      linux) bash "$SCRIPT_DIR/download-jre.sh" linux-x64 linux-arm64 ;;
    esac
  done
else
  echo "==> remote mode: skipping the JAR and JRE downloads (not bundled)"
fi

# 3. Vue + Electron frontend (dist/ + dist-electron/), shared by all platforms
echo "==> Building frontend (vue-tsc + vite)"
npm run build

# 4. Package
for platform in $PLATFORMS; do
  echo "==> Packaging: $platform"
  case "$platform" in
    mac) BUILD_MODE="$MODE" npx electron-builder --mac ;;
    win) BUILD_MODE="$MODE" npx electron-builder --win ;;
    linux) BUILD_MODE="$MODE" npx electron-builder --linux ;;
  esac
done

echo "==> All builds complete. Artifacts in release/"
