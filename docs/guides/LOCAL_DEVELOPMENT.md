# Local development

## Supported versions

Node.js 22+, npm lockfile install, Compact devtools (validated with 0.5.2)/toolchain 0.31.1, Compact runtime 0.16.0, Midnight.js/testkit 4.1.1, Wallet SDK 1.2.0, proof server 8.1.0. Contracts target Compact language 0.23. Docker is required for the local stack. On Windows, use WSL2 plus Docker Desktop.

## Install and validate

```bash
npm ci
npm run check:contracts
npm run test:model
npm run compile
npm run gate
```

`npm run gate` is the hard gate: 32 static checks, 42 model tests, and compilation of MockUSDM, Gateway, and PayrollVault. `npm run verify` runs checks/tests and compiles when Compact is available.

Install Compact from its official distribution, ensure `compact` is on `PATH`, and verify `compact compile --version`. The compile script pins `+0.31.1`.

## Local stack

```bash
npm run env:up
npm run local:gateway
npm run local:payroll
npm run local:claim
npm run local:redeem
npm run env:down
```

Compose binds proof server `127.0.0.1:6300`, indexer `127.0.0.1:8088`, and node `127.0.0.1:9944`. Local uses development-only MockUSDM. The proven local lifecycle is MockUSDM ? Gateway ? zUSDM ? Vault ? HR approval ? Finance funding ? separate employee-wallet claim ? redemption ? public MockUSDM.

Runners may require addresses/colors emitted by earlier steps. `BALARY_GATEWAY_ADDRESS` and `BALARY_ZUSDM_COLOR` are read by the local payroll runner; `MIDNIGHT_SEED` may select local wallet material. Follow runner output and never commit runtime state.

## Preview boundary

Preview uses `MIDNIGHT_MNEMONIC_PREVIEW` (with legacy fallback in some runners), `BALARY_PRIVATE_STATE_PASSWORD`, optional `MIDNIGHT_PROOF_SERVER`, and optional `WALLET_STATE_FILE`. It uses external Preview USDM?not MockUSDM?and requires tDUST. Do not place credentials in shell history, docs, logs, or Git.

## Troubleshooting

- **Compact missing/version mismatch:** install devtools and toolchain 0.31.1, then rerun `npm run compile`.
- **Services unhealthy:** inspect `docker compose ps` and port conflicts.
- **Generated imports missing:** compile before TypeScript integration runners.
- **No eligible shielded coin / mt_index:** allow wallet/indexer sync and use the state emitted by the preceding step.
- **Preview transaction cannot prove:** verify prover reachability, tDUST, correct network and token color.
- **Private state cannot open:** supply the same protected password/store association; do not delete state casually.

`.env*`, `.cache/`, `generated/`, LevelDB, wallet-state files, keys, seeds, and private claim directories are ignored. Treat every role/employee secret and claim opening as credential material.
