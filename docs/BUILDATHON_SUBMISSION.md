# Balary

## One-line pitch

Balary is a confidential institutional stablecoin payroll protocol on Midnight that lets organizations settle with USDM while keeping employee salary allocations and claims private.

## Problem

Payroll is highly sensitive.

Putting payroll directly on a public blockchain can expose employee salaries, payment relationships, and financial history.

Institutions also need separation of duties. HR should approve salaries, Finance should fund approved allocations, and employees should only claim what they are entitled to.

## Solution

Balary combines public stablecoin settlement with private payroll execution.

Employers deposit USDM into the Balary Stablecoin Gateway.

The Gateway locks USDM 1:1 and issues an equal amount of shielded zUSDM.

HR privately approves salary instructions.

Finance can only fund the exact salary allocation approved by HR.

Employees privately prove entitlement and claim their shielded salary.

When settlement is required, zUSDM is burned and the same amount of public USDM is released.

## Why Midnight

Midnight allows Balary to protect sensitive payroll information while still enforcing institutional controls on-chain.

Balary uses shielded assets, blinded commitments, Merkle membership proofs, private secret-derived identities, nullifiers, and secret-derived institutional authorities.

This allows payroll privacy without sacrificing verifiable settlement.

## Technical Architecture

Balary is built around two core Compact contracts.

### BalaryStablecoinGateway

The Gateway accepts configured public USDM, locks it 1:1, and mints an equal amount of shielded zUSDM.

When zUSDM is redeemed, the Gateway burns it and releases the same amount of public USDM.

Core invariant:

USDM locked in Gateway = outstanding redeemable zUSDM

### BalaryPayrollVault

Each PayrollVault represents one payroll run.

It enforces separate institutional authorities for:

- Institution Admin
- HR
- Finance
- Employee

HR privately approves salary intent.

Finance can only fund the exact HR-approved allocation.

Employees claim using private entitlement material.

The Vault uses blinded commitments, Merkle membership proofs, claim nullifiers, private employee secret-derived identity, and shielded salary coins.

## Innovation

Balary is not another independent stablecoin.

zUSDM is a private 1:1 representation of USDM already locked in the Gateway.

This creates a clean boundary between:

- public settlement
- private payroll execution

Balary also enforces real institutional separation of duties instead of letting one wallet control the entire payroll process.

This makes confidential stablecoin payroll practical for organizations that need both privacy and internal controls.

## Midnight Preview Proof

Balary completed the full confidential payroll lifecycle on Midnight Preview using Preview USDM.

### Gateway

Gateway:

`34c67f4d4bbd15ac8cb4fa267b1162b59038a344606f8d1b52813ad7ab35c0b4`

10 USDM was deposited and 10 shielded zUSDM was minted.

Deposit transaction:

`1809a3807ff95ff644c6b383c0b851b955aa7a295765cf2b575a31b63113a73d`

### Confidential Payroll

PayrollVault:

`1d5f51e61f0f990aabfcb5f4c91d0a416c3b9b091ab7fdf5f7712c931108a825`

HR privately approved a salary of 5 zUSDM.

Finance funded exactly the approved allocation.

Funding transaction:

`37dc07d60cc38c7b7c3d4da19f22d9dbf1f737da97bf084fb64be158a6d4fec6`

The PayrollVault became ACTIVE.

### Salary Claim

The salary was successfully claimed.

Claim transaction:

`f7c1579d2ad03e8c60a7f43ace75e2aa3f2df08cf1379ce62edad9d1924381ce`

After the claim, the PayrollVault became COMPLETED.

### Redemption

5 zUSDM was redeemed back into 5 public USDM.

Redemption transaction:

`4e03d2a140f45f00dbce1044bce63adeef1e0d85aba88d886a46e4909e0f7e33`

Final state:

- Public USDM: 95 USDM
- Shielded zUSDM: 5 zUSDM
- Gateway locked USDM: 5 USDM
- Outstanding zUSDM: 5 zUSDM

The 1:1 Gateway invariant remained intact.

## Validation

Balary currently passes:

- 32 static architecture and security checks
- 42 protocol-model tests
- successful compilation of all 3 Compact contracts
- successful local end-to-end execution
- successful Midnight Preview Gateway execution
- successful Preview confidential payroll funding
- successful Preview salary claim
- successful Preview zUSDM redemption

## Current Status

Balary's core protocol is functional.

The confidential payroll flow has been proven locally and on Midnight Preview.

For the final Preview claim demonstration, employer and employee roles used the same Preview wallet to avoid waiting for a newly created employee wallet to accumulate tDUST.

A separate-wallet employee claim was already successfully proven in the local Midnight integration flow.

## Roadmap

Next steps for Balary include:

- production-grade institution onboarding
- reusable payroll management interface
- dedicated employer and employee dashboards
- separate-wallet Preview employee claims
- sponsored transaction fees for employees
- batched payroll execution
- improved workforce metadata privacy
- institutional reporting and audit tooling
- security review and external audit
- mainnet deployment when infrastructure is ready

## Vision

Balary aims to become privacy infrastructure for institutional stablecoin payroll.

Organizations should be able to use transparent stablecoins for settlement without publishing every employee salary relationship to the world.

Midnight makes that possible.

## Closing

Balary gives institutions:

- public USDM settlement
- private salary execution
- HR and Finance separation of duties
- private employee claims
- verifiable 1:1 reserves
- redeemable shielded payroll assets

Balary brings payroll privacy to stablecoin settlement without sacrificing institutional control or on-chain verifiability.
