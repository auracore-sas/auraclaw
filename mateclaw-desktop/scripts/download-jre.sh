#!/usr/bin/env bash
#
# scripts/download-jre.sh — Download Eclipse Temurin JRE 21 for one or more
# target platforms and extract into resources/jre/<os>-<arch>/.
#
# The produced layout matches electron-builder's extraResources rule
# (`resources/jre/${os}-${arch}/` → `jre/`) and the lookup order of
# `electron/main/index.ts`:
#
#   mac-arm64/Contents/Home/bin/java     (macOS keeps the app-bundle layout)
#   mac-x64/Contents/Home/bin/java
#   linux-x64/bin/java                   (flat JRE layout)
#   linux-arm64/bin/java
#   win-x64/bin/java.exe
#   win-arm64/bin/java.exe
#
# Usage:
#   scripts/download-jre.sh                        # auto-detect current OS + arch
#   scripts/download-jre.sh linux-x64              # one explicit target
#   scripts/download-jre.sh win-x64 win-arm64      # several targets
#   scripts/download-jre.sh all                    # both macOS arches (legacy behavior)
#   scripts/download-jre.sh all-platforms          # every supported target
#
# Aliases kept for backwards compatibility: arm64 → mac-arm64, x64 → mac-x64.
#
# Override the output directory with JRE_DIR=... (useful for testing).
#
# AuraClaw note: upstream ships a macOS-only version of this script (the
# Adoptium URL has `/mac` hardcoded) even though its own `scripts/README.md`
# documents `win-x64` / `win-arm64` downloads, and `build-all-platforms.sh`
# advertises Windows packaging. The platform matrix below fixes that mismatch;
# see docs/CUSTOMIZATIONS.md.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
JRE_DIR="${JRE_DIR:-$PROJECT_ROOT/resources/jre}"

# Temurin 21 (LTS) JRE downloads via the Adoptium API.
ADOPTIUM_BASE="https://api.adoptium.net/v3/binary/latest/21/ga"

ALL_TARGETS="mac-arm64 mac-x64 linux-x64 linux-arm64 win-x64 win-arm64"
MAC_TARGETS="mac-arm64 mac-x64"

usage() {
  cat <<'EOF'
Usage: scripts/download-jre.sh [target ...]

Targets:
  auto                 auto-detect the current OS and architecture (default)
  mac-arm64, mac-x64   macOS (Apple Silicon / Intel)
  linux-x64, linux-arm64
  win-x64, win-arm64
  all                  both macOS architectures
  all-platforms        every target listed above
  arm64, x64           legacy aliases for mac-arm64 / mac-x64

Flags:
  -h, --help           print this help
  --dry-run            resolve the targets and print them without downloading

Environment:
  JRE_DIR   output directory (default: <desktop>/resources/jre)
EOF
}

# Echoes "<folder>|<adoptium-os>|<adoptium-arch>|<archive-ext>" for a target.
describe_target() {
  case "$1" in
    mac-arm64)   echo "mac-arm64|mac|aarch64|tar.gz" ;;
    mac-x64)     echo "mac-x64|mac|x64|tar.gz" ;;
    linux-x64)   echo "linux-x64|linux|x64|tar.gz" ;;
    linux-arm64) echo "linux-arm64|linux|aarch64|tar.gz" ;;
    win-x64)     echo "win-x64|windows|x64|zip" ;;
    win-arm64)   echo "win-arm64|windows|aarch64|zip" ;;
    *) return 1 ;;
  esac
}

detect_os() {
  case "$(uname -s)" in
    Darwin) echo "mac" ;;
    Linux) echo "linux" ;;
    MINGW* | MSYS* | CYGWIN*) echo "windows" ;;
    *) echo "" ;;
  esac
}

detect_arch() {
  local machine="${PROCESSOR_ARCHITECTURE:-$(uname -m)}"
  case "$machine" in
    arm64 | ARM64 | aarch64) echo "aarch64" ;;
    x86_64 | amd64 | AMD64) echo "x64" ;;
    *) echo "" ;;
  esac
}

auto_target() {
  local os arch
  os="$(detect_os)"
  arch="$(detect_arch)"
  if [ -z "$os" ] || [ -z "$arch" ]; then
    echo "ERROR: cannot auto-detect this platform (uname -s=$(uname -s), uname -m=$(uname -m))." >&2
    echo "       Pass an explicit target: $ALL_TARGETS" >&2
    exit 1
  fi
  local arch_name="arm64"
  [ "$arch" = "x64" ] && arch_name="x64"
  local os_name="$os"
  [ "$os" = "windows" ] && os_name="win"
  echo "${os_name}-${arch_name}"
}

download_and_extract() {
  local target="$1"
  local spec folder os arch ext
  if ! spec="$(describe_target "$target")"; then
    echo "ERROR: unknown target '$target'."
    usage
    exit 1
  fi
  IFS='|' read -r folder os arch ext <<<"$spec"

  local url="$ADOPTIUM_BASE/$os/$arch/jre/hotspot/normal/eclipse?project=jdk"
  local dest="$JRE_DIR/$folder"
  local tmp_archive="$JRE_DIR/.tmp-$folder.$ext"
  local tmp_dir="$JRE_DIR/.tmp-$folder"

  echo "==> Downloading Temurin 21 JRE for $os/$arch  →  resources/jre/$folder"
  mkdir -p "$JRE_DIR"
  curl -L --fail --progress-bar -o "$tmp_archive" "$url"

  echo "==> Extracting"
  rm -rf "$tmp_dir" "$dest"
  mkdir -p "$tmp_dir"
  case "$ext" in
    tar.gz) tar -xzf "$tmp_archive" -C "$tmp_dir" ;;
    zip)
      if ! command -v unzip >/dev/null 2>&1; then
        echo "ERROR: 'unzip' is required to extract the Windows JRE archive."
        exit 1
      fi
      unzip -q "$tmp_archive" -d "$tmp_dir"
      ;;
  esac

  # The archives contain a single top-level directory (jdk-21.x.y+z-jre).
  local extracted
  extracted="$(find "$tmp_dir" -maxdepth 1 -mindepth 1 -type d | head -1)"
  if [ -z "$extracted" ]; then
    echo "ERROR: no directory found inside $tmp_archive"
    exit 1
  fi

  if [ "$os" = "mac" ]; then
    # macOS: jdk-21.x.y+z-jre/Contents/Home/... → keep the bundle layout.
    if [ ! -d "$extracted/Contents" ]; then
      echo "ERROR: expected a Contents/ directory inside $extracted"
      exit 1
    fi
    mkdir -p "$dest"
    mv "$extracted/Contents" "$dest/Contents"
  else
    # Linux / Windows: flat layout (bin/java, lib/, …).
    mv "$extracted" "$dest"
  fi

  rm -rf "$tmp_dir" "$tmp_archive"

  local java_bin
  case "$os" in
    mac) java_bin="$dest/Contents/Home/bin/java" ;;
    windows) java_bin="$dest/bin/java.exe" ;;
    *) java_bin="$dest/bin/java" ;;
  esac

  if [ ! -f "$java_bin" ]; then
    echo "ERROR: java binary not found at $java_bin"
    exit 1
  fi
  chmod +x "$java_bin" 2>/dev/null || true
  echo "==> OK: $java_bin"
}

# electron/main/index.ts looks for `jre/win32-x64/bin/java.exe` in dev mode,
# while electron-builder's `${os}` macro expands to `win` for Windows packages.
# Point both names at the same JRE with a symlink instead of copying ~50 MB.
link_dev_alias() {
  local folder="$1" alias="$2"
  [ -d "$JRE_DIR/$folder" ] || return 0
  rm -rf "${JRE_DIR:?}/$alias"
  if ln -s "$folder" "$JRE_DIR/$alias" 2>/dev/null; then
    echo "==> Dev alias: resources/jre/$alias → $folder"
  else
    echo "    (note: could not create the $alias symlink — only affects dev mode)"
  fi
}

# ---------------------------------------------------------------------------
# Resolve the requested targets
# ---------------------------------------------------------------------------

requested=()
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    -h | --help)
      usage
      exit 0
      ;;
    --dry-run) DRY_RUN=1 ;;
    *) requested+=("$arg") ;;
  esac
done

if [ ${#requested[@]} -eq 0 ]; then
  requested=("auto")
fi

targets=()
for target in "${requested[@]}"; do
  case "$target" in
    auto) targets+=("$(auto_target)") ;;
    arm64) targets+=("mac-arm64") ;;
    x64) targets+=("mac-x64") ;;
    all) targets+=($MAC_TARGETS) ;;
    all-platforms) targets+=($ALL_TARGETS) ;;
    *) targets+=("$target") ;;
  esac
done

for target in "${targets[@]}"; do
  if [ "$DRY_RUN" = "1" ]; then
    if describe_target "$target" >/dev/null; then
      echo "would download: $target"
    else
      echo "ERROR: unknown target '$target'" >&2
      exit 1
    fi
    continue
  fi
  download_and_extract "$target"
done

if [ "$DRY_RUN" = "1" ]; then
  exit 0
fi

# Windows dev-mode alias (cheap, symlink only).
for target in "${targets[@]}"; do
  [ "$target" = "win-x64" ] && link_dev_alias "win-x64" "win32-x64"
done

echo "==> JRE setup complete: ${targets[*]}"
