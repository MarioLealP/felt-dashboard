#!/usr/bin/env bash
# Pull the current endfield.css from the design-system repo into src/styles/.
#
# The design system lives in its own repo (git.clockmost.com/Benylin/endfield-design);
# this template vendors a copy so a fresh clone builds offline. Re-run after the
# design system ships a new version.
#
#   scripts/sync-endfield.sh
#   EF_SRC=~/Projects/endfield-design/endfield.css scripts/sync-endfield.sh   # local checkout
set -euo pipefail
cd "$(dirname "$0")/.."

DEST="src/styles/endfield.css"
SRC="${EF_SRC:-https://git.clockmost.com/Benylin/endfield-design/raw/branch/main/endfield.css}"

if [ -f "$SRC" ]; then
  cp "$SRC" "$DEST"
else
  curl -fsSL "$SRC" -o "$DEST"
fi

lines=$(wc -l < "$DEST")
echo "synced $DEST  (<-  $SRC,  $lines lines)"
