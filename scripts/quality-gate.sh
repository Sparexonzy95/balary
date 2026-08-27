#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Balary / Current hard gate =="
echo

if ! command -v compact >/dev/null 2>&1; then
  echo "ERROR: Compact devtools are not installed or not on PATH."
  echo "See docs/LOCAL_SETUP.md"
  exit 2
fi

printf "Compact devtools: "
compact --version
printf "Compact compiler: "
compact compile --version

echo
echo "[1/3] Static architecture checks"
npm run check:contracts

echo
echo "[2/3] Protocol-model tests"
npm run test:model

echo
echo "[3/3] Compact compiler gate"
npm run compile

echo
echo "SUCCESS: MockUSDM, Gateway, and PayrollVault compiled and model tests passed."
echo "Next gate: start the local Midnight stack and execute MockUSDM -> zUSDM end-to-end."
