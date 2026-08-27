# Balary

Confidential institutional USDM payroll on Midnight.

## Core flow

```text
USDM (unshielded)
  -> Balary Stablecoin Gateway
  -> lock USDM 1:1
  -> mint shielded zUSDM
  -> Balary Payroll Vault
  -> HR-approved private salary instructions
  -> Finance-funded salary allocations
  -> employee private claim
  -> zUSDM redemption
  -> burn zUSDM
  -> release USDM
```

Balary does not create an independent economic stablecoin. `zUSDM` is a shielded 1:1 representation of USDM locked in the Balary Gateway.

## Institutional separation of duties

Balary separates institutional payroll responsibilities:

- **Institution Admin** manages role authority and can cancel a payroll only while it is still funding.
- **HR** privately approves employee salary instructions.
- **Finance** funds only the exact salary instructions approved by HR and handles permitted recovery.
- **Employee** privately proves entitlement and claims the exact shielded salary allocation.

Role secrets are never stored directly in ledger state. The contract stores secret-derived authority commitments and does not use `ownPublicKey()` as institutional authentication.

See [`docs/INSTITUTIONAL_ROLES.md`](docs/INSTITUTIONAL_ROLES.md).

## Contracts

### MockUSDM

Local development only.

- development-only unshielded token
- deterministically funds local wallets
- never used as the production or Preview USDM asset

### BalaryStablecoinGateway

- accepts only the configured unshielded USDM color
- locks USDM
- mints equal shielded zUSDM
- burns redeemed zUSDM
- releases equal USDM
- enforces `totalLocked == totalOutstanding`

### BalaryPayrollVault

One vault instance represents one payroll run for one institution.

- institution identifier
- Admin, HR, and Finance authority commitments
- HR-approved blinded salary intents
- Finance funding restricted to exact approved intents
- private employee identity derived from secret
- blinded salary allocation commitments
- Merkle membership claims
- dedicated shielded salary coin per allocation
- claim and recovery nullifiers
- deadline enforcement
- pre-activation Admin cancellation
- post-cancellation and post-expiry Finance recovery of unclaimed coins
- role rotation

## Privacy boundary

Public by design:

- USDM deposits and withdrawals
- Gateway reserve accounting
- institution/payroll references
- payroll lifecycle state
- authority commitments
- blinded intent commitments
- payroll Merkle root
- aggregate approval/funding/claim/recovery counts in the current implementation
- nullifiers

Private by design:

- Admin, HR, Finance, and employee secrets
- employee identity
- exact salary
- salary approval opening
- salary coin opening
- allocation blinding randomness
- which allocation is being claimed

A later privacy-hardening pass can pad counts or batches if workforce-size metadata itself must be hidden.

## Fresh Buildathon codebase

This repository is a clean Midnight implementation. The legacy Flare Balary sample is product/reference material only and is not copied into this codebase.

## Local verification

```bash
npm install
npm test
npm run check:contracts
```

With Compact devtools installed and compiler `0.31.1` available:

```bash
npm run compile
```

Or run the project verification script:

```bash
npm run verify
```

See [`docs/LOCAL_SETUP.md`](docs/LOCAL_SETUP.md) for the local toolchain flow.

## License

Apache-2.0.
