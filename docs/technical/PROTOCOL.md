# Protocol

## Terms

**USDM** is the configured public asset. **zUSDM** is the Gateway-domain shielded 1:1 representation. **Color** identifies an asset. Preview values shown here use six decimals; 5 USDM is 5,000,000 raw units. A **salary intent** is HR's blinded approval. An **allocation** binds entitlement to an exact funded coin.

## Gateway lifecycle

`depositUSDM(amount, nonceSeed)` rejects zero amounts, broken accounting, or reserve shortfall; receives configured USDM; derives a nonce; mints zUSDM with domain `balary:zusdm:v1`; sends the full coin; increments locked/outstanding totals equally.

`redeemZUSDM(coin, recipient)` checks zUSDM color/value, accounting, outstanding/locked capacity, and reserves; receives and burns the full coin; sends equal public USDM; decrements both totals equally.

Invariant: `totalLocked == totalOutstanding`. The code has no administrator mint path.

## Payroll lifecycle

The constructor seals institution, payroll, Gateway, derived zUSDM color, expected allocations, and deadline. State begins `FUNDING`.

`approveAllocation` authenticates HR and creates a randomized `persistentCommit` over payroll ID, employee key, salary, allocation ID, and allocation blind. Only the commitment is inserted.

`fundAllocation` authenticates Finance, requires the exact approved/unfunded intent and correct nonzero zUSDM coin, receives it, commits payroll/employee/nonce/color/value with the allocation blind, and inserts the leaf. Full approval and funding activates the vault.

`claimSalary` requires `ACTIVE`, time at or before deadline, correct zUSDM, employee-secret-derived key, exact commitment leaf and accepted Merkle root, and a fresh domain-separated claim nullifier. It sends the whole coin to the caller and completes when all expected allocations are claimed.

Admin may `cancelPayroll` only in `FUNDING`. With no funding it closes; otherwise it becomes `CANCELLED`. Finance can `recoverCancelledAllocation`. After the deadline, Finance can `recoverExpiredAllocation`, moving `ACTIVE` to `EXPIRED`; once every allocation is claimed or recovered the run closes. Zswap consumption prevents recovery of claimed coins. Recovery nullifiers exclude the Finance secret so role rotation cannot create a second recovery identity.

Admin can rotate each authority commitment. Existing intents and allocations remain unchanged.

## Invariants and failures

- zUSDM color derives from the Gateway and fixed domain.
- Mint/redeem preserve equal recorded totals; reserves are checked.
- One intent cannot be approved or funded twice.
- Finance cannot change HR's bound value.
- Partial funding cannot activate.
- Employee key, coin fields, blind, payroll, and Merkle membership must agree.
- Claims require active state/deadline and unique nullifier.
- Active payroll cannot be cancelled.
- Recovery requires Finance, eligible state/time, membership, and an unspent coin.
- Whole salary coins avoid shared change.

Failures abort on invalid role secrets, state, time, token color, amount, commitment, root, nullifier, reserve, or already-consumed coin.

See [Privacy & security](PRIVACY_SECURITY.md) and [Preview proof](PREVIEW_PROOF.md).
