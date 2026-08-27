#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/generated/mock-usdm" "$ROOT/generated/gateway" "$ROOT/generated/payroll"

# Preview compatibility matrix in the bundled Midnight docs pins Compact
# toolchain 0.31.1 while the contracts target Compact language 0.23.
compact compile +0.31.1 "$ROOT/contracts/MockUSDM.compact" "$ROOT/generated/mock-usdm"
compact compile +0.31.1 "$ROOT/contracts/BalaryStablecoinGateway.compact" "$ROOT/generated/gateway"
compact compile +0.31.1 "$ROOT/contracts/BalaryPayrollVault.compact" "$ROOT/generated/payroll"
