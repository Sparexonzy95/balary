# Balary local Midnight setup

This repository targets the versions in the bundled Midnight Preview compatibility matrix:

- Compact devtools: 0.5.1
- Compact toolchain: 0.31.1
- Compact runtime: 0.16.0
- Midnight.js / testkit-js: 4.1.1
- Wallet SDK: 1.2.0
- Proof server: 8.1.0

The Compact contracts use `pragma language_version 0.23;`.

## Windows

Midnight development is not supported natively on Windows in the current docs. Use WSL2 for the Compact toolchain and Docker Desktop for the local stack.

## Install Compact

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh

export PATH="$HOME/.compact/bin:$PATH"
compact update
compact --version
compact compile --version
```

The repository compile script pins toolchain 0.31.1:

```bash
npm run compile
```

It compiles, in order:

1. `MockUSDM.compact`
2. `BalaryStablecoinGateway.compact`
3. `BalaryPayrollVault.compact`

## First local economic test

The local test asset is `MockUSDM`. It is intentionally not part of Preview or production.

```text
MockUSDM contract
      ↓ mint public test supply
Employer wallet
      ↓ depositUSDM
BalaryStablecoinGateway
      ↓ lock MockUSDM 1:1
Employer wallet
      ↓ receives shielded zUSDM
```

The first success condition is:

```text
MockUSDM locked by Gateway == Gateway.totalLocked == Gateway.totalOutstanding
```

and the employer wallet shielded balance increases by exactly the deposited amount of zUSDM.

## Preview migration

After the local flow passes, replace the MockUSDM token color supplied to the Gateway constructor with the actual unshielded USDM token color on Midnight Preview. The Gateway and zUSDM economics do not change.
