# Zalary Confidential Payroll v3: Full Pre-Deployment Test Matrix

This package expands the original 12-case hardened security suite into a broad local pre-deployment gate. It exercises every public contract component, the main state transitions, TEE result authentication, stablecoin accounting, failure cleanup, and multi-payroll isolation.

## Required pass criteria

Before deploying to Coston2, all of these must succeed:

```powershell
npm run predeploy:local
npm run validate:env:coston2
```

The first command cleans, compiles for Cancun, and runs the complete local suite. The second checks the live Coston2 RPC, chain ID, deployer account, stablecoin contract, and FCC registry contracts.

## Test groups

| Command | Coverage |
|---|---|
| `npm run test:smoke` | Original hardened end-to-end and exploit-regression tests |
| `npm run test:deployment` | Constructors, immutable addresses, extension binding, TEE signer delay/rotation/revocation, relayer role |
| `npm run test:roles` | Institution registration, activation, HR/Finance roles, admin transfer, delayed recovery, treasury/tax snapshots |
| `npm run test:lifecycle` | Draft validation, computation state, funding windows, partial/full funding, tax payout, cancellation, expiry |
| `npm run test:gateway` | Payload limits, TEE selection, signature binding, status, result expiry, field-by-field tampering, replay, failure and stale cleanup |
| `npm run test:withdrawals` | Relayer access, single-lane serialization, ledger-root transitions, nullifiers, minimum amount, grace settlement, fee-token rollback |
| `npm run test:operations` | Pause behavior, deadline extension, pending-request closure protection, token/native rescue and gateway-only boundaries |
| `npm run test:invariants` | `totalEscrowed`, stablecoin balance, multi-payroll isolation, total/tax/net consistency and rollback invariants |
| `npm run test:abi` | Constants, domains, operation commands, contexts, request views and event emission |
| `npm run test:full` | Every test file |

## Runtime scope

The suite contains approximately 150 runtime cases. Two files generate field-by-field mismatch cases dynamically, so the runtime count is higher than the literal number of `it(...)` declarations.

## Critical invariants checked

1. `totalRequired == employeeNetTotal + aggregateTaxTotal`.
2. The vault stablecoin balance is never below `totalEscrowed` after a successful transaction.
3. A reverted withdrawal does not change the ledger root, withdrawn amount, nullifier state, or escrow.
4. Only the configured gateway can mutate confidential payroll state.
5. Only a result signed by the machine-bound active TEE signer and current signer epoch can finalize.
6. Each payroll has at most one active withdrawal instruction, while different payrolls remain independent.
7. Every successful withdrawal advances the private ledger root and consumes a unique nullifier.
8. Employee escrow cannot be rescued as protocol surplus.
9. Pauses extend applicable employee and funding deadlines rather than consuming them.
10. An employer cannot close an expired payroll while a withdrawal request is still tracked.

## What this suite does not prove

Passing tests do not replace an independent professional audit. Local mocks cannot prove the behavior of the live Flare FCC manager, extension proxy, simulated TEE process, indexer, or test stablecoin. After local tests pass, run an end-to-end Coston2 test with the registered Zalary FCE and verify every emitted instruction and signed response.
