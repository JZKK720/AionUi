#!/usr/bin/env bash
# prepare-release-assets.sh
#
# Normalize electron-updater metadata from multi-arch build artifacts
# into a deterministic release-assets/ directory.
#
# Usage:
#   ./scripts/prepare-release-assets.sh [ARTIFACTS_DIR] [OUTPUT_DIR]
#
# Defaults:
#   ARTIFACTS_DIR = build-artifacts
#   OUTPUT_DIR    = release-assets

set -euo pipefail

ARTIFACTS_DIR="${1:-build-artifacts}"
OUTPUT_DIR="${2:-release-assets}"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

find_first_metadata_for_path() {
  local artifact_name="$1"
  local file_name="$2"
  find "$ARTIFACTS_DIR" -type f -path "*/${artifact_name}/*" -name "$file_name" | sort | head -n 1 || true
}

find_unique_metadata_by_name() {
  local file_name="$1"
  mapfile -t matches < <(find "$ARTIFACTS_DIR" -type f -name "$file_name" | sort)

  if [ "${#matches[@]}" -eq 1 ]; then
    printf '%s\n' "${matches[0]}"
  fi
}

# ---------------------------------------------------------------------------
# 1) Copy all distributables (unique file names)
# ---------------------------------------------------------------------------
echo "==> Copying distributables from $ARTIFACTS_DIR ..."
mapfile -t DISTRIBUTABLES < <(find "$ARTIFACTS_DIR" -type f \( \
  -name "*.exe" -o \
  -name "*.msi" -o \
  -name "*.dmg" -o \
  -name "*.deb" -o \
  -name "*.zip" \
\) | sort)

DUPLICATE_BASENAMES=$(for file in "${DISTRIBUTABLES[@]}"; do basename "$file"; done | sort | uniq -d || true)
if [ -n "$DUPLICATE_BASENAMES" ]; then
  echo "::error::Found duplicate distributable basenames that would be overwritten in flat output:"
  echo "$DUPLICATE_BASENAMES"
  exit 1
fi

for file in "${DISTRIBUTABLES[@]}"; do
  cp -f "$file" "$OUTPUT_DIR/"
done

# ---------------------------------------------------------------------------
# 2) Collect updater metadata from each platform artifact directory
# ---------------------------------------------------------------------------
echo "==> Collecting updater metadata ..."

WIN_X64_LATEST=$(find_first_metadata_for_path "windows-build-x64" "latest.yml")
WIN_ARM64_LATEST=$(find_first_metadata_for_path "windows-build-arm64" "latest.yml")
MAC_X64_LATEST=$(find_first_metadata_for_path "macos-build-x64" "latest-mac.yml")
MAC_ARM64_LATEST=$(find_first_metadata_for_path "macos-build-arm64" "latest-mac.yml")
LINUX_X64_LATEST=$(find_first_metadata_for_path "linux-build-x64" "latest-linux.yml")
LINUX_ARM64_LATEST=$(find_first_metadata_for_path "linux-build-arm64" "latest-linux-arm64.yml")

# Reusable workflows and manual artifact downloads can flatten or rename the
# extracted artifact directories. Fall back to a unique metadata filename when
# the expected platform directory is absent but the metadata remains unambiguous.
[ -z "$WIN_X64_LATEST" ] && WIN_X64_LATEST=$(find_unique_metadata_by_name "latest.yml")
[ -z "$MAC_X64_LATEST" ] && MAC_X64_LATEST=$(find_unique_metadata_by_name "latest-mac.yml")
[ -z "$LINUX_X64_LATEST" ] && LINUX_X64_LATEST=$(find_unique_metadata_by_name "latest-linux.yml")
[ -z "$LINUX_ARM64_LATEST" ] && LINUX_ARM64_LATEST=$(find_unique_metadata_by_name "latest-linux-arm64.yml")

# ---------------------------------------------------------------------------
# 3) Publish deterministic canonical metadata for electron-updater
#    (avoid nondeterministic overwrite when multiple jobs produce same names)
# ---------------------------------------------------------------------------
echo "==> Writing canonical updater metadata ..."

[ -n "$WIN_X64_LATEST" ]    && cp -f "$WIN_X64_LATEST"    "$OUTPUT_DIR/latest.yml"
[ -n "$MAC_X64_LATEST" ]    && cp -f "$MAC_X64_LATEST"    "$OUTPUT_DIR/latest-mac.yml"
[ -n "$LINUX_X64_LATEST" ]  && cp -f "$LINUX_X64_LATEST"  "$OUTPUT_DIR/latest-linux.yml"
[ -n "$LINUX_ARM64_LATEST" ] && cp -f "$LINUX_ARM64_LATEST" "$OUTPUT_DIR/latest-linux-arm64.yml"

# ---------------------------------------------------------------------------
# 4) Architecture-specific metadata required by electron-updater
# ---------------------------------------------------------------------------
echo "==> Writing architecture-specific updater metadata ..."

[ -n "$WIN_ARM64_LATEST" ]  && cp -f "$WIN_ARM64_LATEST"  "$OUTPUT_DIR/latest-win-arm64.yml"

# electron-updater on macOS constructs the yml filename as "${channel}-mac.yml".
# For arm64, channel is "latest-arm64", so it looks for "latest-arm64-mac.yml".
[ -n "$MAC_ARM64_LATEST" ]  && cp -f "$MAC_ARM64_LATEST"  "$OUTPUT_DIR/latest-arm64-mac.yml"

# ---------------------------------------------------------------------------
# 5) Hard validation for required updater metadata
# ---------------------------------------------------------------------------
echo "==> Validating required metadata ..."

MISSING=0
REQUIRED_METADATA=()

[ -n "$WIN_X64_LATEST" ] && REQUIRED_METADATA+=(latest.yml)
[ -n "$WIN_ARM64_LATEST" ] && REQUIRED_METADATA+=(latest-win-arm64.yml)
[ -n "$MAC_X64_LATEST" ] && REQUIRED_METADATA+=(latest-mac.yml)
[ -n "$MAC_ARM64_LATEST" ] && REQUIRED_METADATA+=(latest-arm64-mac.yml)
[ -n "$LINUX_X64_LATEST" ] && REQUIRED_METADATA+=(latest-linux.yml)
[ -n "$LINUX_ARM64_LATEST" ] && REQUIRED_METADATA+=(latest-linux-arm64.yml)

if [ "${#REQUIRED_METADATA[@]}" -eq 0 ]; then
  if [ "${#DISTRIBUTABLES[@]}" -gt 0 ]; then
    echo "::error::Downloaded artifacts did not include recognizable updater metadata under $ARTIFACTS_DIR"
    echo "::group::Discovered artifact files"
    find "$ARTIFACTS_DIR" -maxdepth 4 -type f | sort
    echo "::endgroup::"
    exit 1
  fi

  echo "::error::No build artifacts found under $ARTIFACTS_DIR"
  exit 1
fi

for required in "${REQUIRED_METADATA[@]}"; do
  if [ ! -f "$OUTPUT_DIR/$required" ]; then
    echo "::error::Missing required updater metadata: $required"
    MISSING=1
  fi
done

if [ "$MISSING" -ne 0 ]; then
  exit 1
fi

echo ""
echo "==> Prepared release assets:"
ls -lh "$OUTPUT_DIR"
echo ""
echo "==> Done."
