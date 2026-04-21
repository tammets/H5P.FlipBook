#!/usr/bin/env bash
# Build H5P.FlipBook.h5p — a distributable H5P package.
#
# Layout produced (matches what h5p-cli pack emits):
#   h5p.json                        (content-package manifest)
#   content/content.json            (empty content instance)
#   H5P.FlipBook-1.0/...            (library files)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR_NAME="H5P.FlipBook-1.0"
OUTPUT="${1:-$ROOT/H5P.FlipBook.h5p}"
STAGE="$ROOT/build/stage"

rm -rf "$ROOT/build"
mkdir -p "$STAGE/$LIB_DIR_NAME"

cp "$ROOT/h5p.json" "$STAGE/"
cp -R "$ROOT/content" "$STAGE/"

for item in library.json semantics.json icon.svg js css lib; do
  cp -R "$ROOT/$item" "$STAGE/$LIB_DIR_NAME/"
done

rm -f "$OUTPUT"
(
  cd "$STAGE"
  zip -r -D -q "$OUTPUT" h5p.json content "$LIB_DIR_NAME" \
    -x "*.DS_Store" "*/.DS_Store"
)

rm -rf "$ROOT/build"
echo "Built $OUTPUT"
