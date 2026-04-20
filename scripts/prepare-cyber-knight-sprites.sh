#!/usr/bin/env bash
# ABOUTME: Downsamples the full-resolution cyber-knight sprite sheets from ~/Downloads to public/assets.
# ABOUTME: Idempotent — rerun after Sami drops updated PNGs in ~/Downloads. Requires `magick` (ImageMagick).

set -euo pipefail

SRC_STAND="${HOME}/Downloads/A-front-facing-cel-shaded-cybernetic-knight-depict-max-px-64 (1).png"
SRC_FIGHT="${HOME}/Downloads/A-front-facing-cel-shaded-cybernetic-knight-depict-max-px-64.png"

REPO_ROOT="$(git rev-parse --show-toplevel)"
OUT_DIR="${REPO_ROOT}/public/assets"

if [ ! -d "$OUT_DIR" ]; then
  echo "Error: $OUT_DIR does not exist. Run this from inside the spire-like project." >&2
  exit 1
fi

if [ ! -f "$SRC_STAND" ]; then
  echo "Error: missing source standing sheet: $SRC_STAND" >&2
  exit 1
fi

if [ ! -f "$SRC_FIGHT" ]; then
  echo "Error: missing source fighting sheet: $SRC_FIGHT" >&2
  exit 1
fi

magick "$SRC_STAND" -resize 864x1040! "${OUT_DIR}/cyber_knight_idle.png"
magick "$SRC_FIGHT" -resize 25% "${OUT_DIR}/cyber_knight_attack.png"

echo "OK: wrote"
echo "  ${OUT_DIR}/cyber_knight_idle.png"
echo "  ${OUT_DIR}/cyber_knight_attack.png"
