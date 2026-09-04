# Balary

## One-line pitch

Balary is a confidential institutional stablecoin payroll protocol on Midnight that lets organizations settle with USDM while keeping employee salary allocations and claims private.

## The Problem

Blockchain payroll can expose sensitive salary information, payment relationships, and employee financial history.

Institutions also need proper controls so that one person cannot unilaterally approve and pay salaries.

## The Solution

Balary combines public stablecoin settlement with confidential payroll execution.

Employers deposit public USDM into the Balary Stablecoin Gateway.

The Gateway locks USDM 1:1 and issues an equal amount of shielded zUSDM.

HR privately approves employee salary instructions.

Finance can only fund the exact allocation approved by HR.

Employees privately prove entitlement and claim their shielded salary.

When an employee wants public settlement, zUSDM is burned and the same amount of USDM is released.

## Why Midnight

Midnight enables Balary to keep payroll-sensitive information private while still enforcing institutional rules and verifiable settlement on-chain.

Balary uses:

- shielded tokens
- blinded commitments
- Merkle membership proofs
- private employee secret-derived identities
- claim nullifiers
- secret-derived Admin, HR, and Finance authorities

## Preview Proof

Balary completed the full lifecycle on Midnight Preview using Preview USDM:

1. 10 USDM deposited
2. 10 shielded zUSDM minted
3. HR privately approved a 5 zUSDM salary
4. Finance funded the exact approved allocation
5. Payroll became ACTIVE
6. Salary was successfully claimed
7. Payroll became COMPLETED
8. 5 zUSDM was redeemed for 5 public USDM

The core invariant remained true:

USDM locked in Gateway = outstanding redeemable zUSDM

## What Makes Balary Different

Balary is not creating another independent stablecoin.

zUSDM is a shielded 1:1 representation of USDM already locked in the Gateway.

This allows public stablecoin settlement and private payroll execution to coexist in one protocol.

## Status

The protocol has:

- passed 32 architecture and security checks
- passed 42 protocol-model tests
- compiled all 3 Compact contracts successfully
- completed local end-to-end execution
- completed real Midnight Preview Gateway execution
- completed confidential Preview payroll funding
- completed Preview salary claim
- completed Preview zUSDM redemption
