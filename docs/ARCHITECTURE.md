# Balary Architecture

## Purpose

Balary is confidential institutional stablecoin payroll on Midnight.

USDM remains the public entry and exit asset. Balary's Gateway locks USDM and issues an equal amount of shielded zUSDM. Institutional payroll runs use zUSDM privately. Redemption burns zUSDM and releases equal USDM.

## Economic flow

```text
USDM (unshielded)
  -> BalaryStablecoinGateway
  -> USDM locked 1:1
  -> zUSDM minted shielded
  -> BalaryPayrollVault
  -> HR approval
  -> Finance funding
  -> private employee claim
  -> employee receives shielded zUSDM
  -> Gateway redemption
  -> zUSDM burned
  -> USDM released
```

## Core reserve invariant

```text
Gateway totalLocked == Gateway totalOutstanding
```

New zUSDM is issued only after the Gateway successfully receives the configured USDM asset.

## Contract 1: BalaryStablecoinGateway

Responsibilities:

- pin the configured USDM token color at deployment
- receive unshielded USDM
- mint zUSDM under a contract-specific domain separator
- deliver zUSDM shielded to the depositor
- receive zUSDM for redemption
- burn redeemed zUSDM
- release equal unshielded USDM
- maintain 1:1 accounting

The Gateway intentionally has no administrator-only unbacked mint function.

## Contract 2: BalaryPayrollVault

One vault instance represents one payroll run for one institution.

### Institutional roles

The vault uses secret-derived authority commitments for three institutional roles:

- **Admin:** role rotation and cancellation while payroll is still in `FUNDING`
- **HR:** approves private salary intents
- **Finance:** funds exact HR-approved intents and recovers eligible unclaimed funds

Employees are claimants rather than institutional administrators.

The role model prevents a single institutional function from both defining and moving salary funds.

### Public state

- institution reference
- payroll reference
- Gateway address and derived zUSDM color
- Admin, HR, and Finance authority commitments
- lifecycle state
- expected, approved, funded, claimed, recovered, and settled counts
- deadline
- blinded HR salary-intent commitments
- funded-intent markers
- Merkle root for funded salary allocation commitments
- claim and recovery nullifiers

### Private data

- Admin, HR, Finance, and employee secrets
- employee derived identity
- salary amount
- salary intent blind
- allocation identifier
- allocation blind
- salary coin nonce/value/opening data
- Merkle opening/path supplied during claim or recovery

The salary coin itself is owned by the Payroll Vault at the shielded Zswap layer. The contract does not write `QualifiedShieldedCoinInfo` directly into ordinary ledger state because ordinary ledger state is public.

## HR salary intent

HR approves an exact private salary instruction before Finance can fund it.

Conceptually:

```text
intent = persistentCommit(
  payrollId,
  employeeKey,
  salaryValue,
  allocationId,
  allocationBlind,
  intentBlind
)
```

Only the blinded commitment is placed in the public `approvedIntents` set.

Finance must reproduce the same commitment using the value of the zUSDM coin being funded. This means Finance cannot:

- create an allocation HR never approved
- change the salary amount
- fund the same approval twice

## Funded allocation commitment

After an approved exact zUSDM salary coin is received, the vault commits the employee entitlement to the actual funded coin.

Conceptually:

```text
allocation = persistentCommit(
  payrollId,
  employeeKey,
  coinNonce,
  zUSDMColor,
  salaryAmount,
  allocationBlind
)
```

The blinded commitment is inserted into a `MerkleTree<20, Bytes<32>>`. Random blinding prevents direct salary guessing.

## Activation rule

A payroll remains in `FUNDING` until:

```text
approvedCount == expectedAllocations
AND
fundedCount == expectedAllocations
```

Only then does it become `ACTIVE`.

This prevents partially approved or partially funded payrolls from becoming claimable.

## Employee claim

The employee privately proves that:

1. their secret derives the employee key bound into the funded allocation
2. the exact contract-owned zUSDM coin is bound into that allocation
3. the allocation belongs to the payroll Merkle tree
4. the payroll is active and within the claim deadline
5. the claim nullifier has not already been used

The vault then spends the complete dedicated salary coin to the current caller with `sendShielded`.

Whole-coin salary allocations avoid shared change-coin accounting and reduce claim contention.

## Cancellation and recovery

- only Admin can cancel a payroll
- cancellation is allowed only while the payroll is in `FUNDING`
- once `ACTIVE`, the payroll cannot be arbitrarily cancelled
- Finance can recover funded allocations from a cancelled payroll
- after the active payroll deadline, Finance can recover only still-unclaimed salary coins
- claimed salary coins cannot be recovered because the Zswap coin has already been consumed

Recovery nullifiers are derived independently of the Finance secret, so rotating the Finance role does not create a second recovery identity for the same salary coin.

## Role rotation

Admin may rotate Admin, HR, or Finance authority commitments. The new role holder controls a new private secret whose derived authority commitment matches the stored value.

Rotation does not rewrite existing salary commitments or funded allocations.

## Gateway redemption implementation experiment

The Gateway currently contains an atomic redemption candidate:

```text
fresh zUSDM output to Gateway
  -> receiveShielded
  -> sendImmediateShielded to shieldedBurnAddress
  -> sendUnshielded USDM to recipient
```

This must be compile- and runtime-tested against the current Midnight toolchain. If consuming a freshly received shielded output in the same contract call is not supported, Balary will use a request/finalize committed-coin redemption flow. The economic architecture remains unchanged.
