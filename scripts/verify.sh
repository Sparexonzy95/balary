#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node scripts/contract-static-check.mjs
node --test test/*.test.mjs
if command -v compact >/dev/null 2>&1; then
  ./scripts/compile.sh
else
  echo
  echo "NOTICE: Compact compiler is not installed in this runtime."
  echo "Install Compact devtools and toolchain 0.31.1, then run: npm run compile"
fi
