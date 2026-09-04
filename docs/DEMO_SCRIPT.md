# Balary Demo Script

## 1. Opening

Balary is a confidential institutional stablecoin payroll protocol built on Midnight.

Companies can hold and settle in USDM publicly while keeping employee salary allocations and claims private.

## 2. The Problem

Traditional blockchain payroll exposes sensitive information such as employee payments, salary relationships, and payment history.

Institutions also need proper separation of duties between HR, Finance, administrators, and employees.

Balary solves both problems.

## 3. How Balary Works

The employer starts with public USDM.

The Balary Stablecoin Gateway locks USDM 1:1 and issues an equal amount of shielded zUSDM.

zUSDM is not a new independent stablecoin. It is a private representation of USDM already locked in the Gateway.

HR privately approves salary instructions.

Finance can only fund the exact salary allocation approved by HR.

The employee privately proves entitlement and claims the shielded salary.

When the employee wants public settlement, zUSDM is redeemed through the Gateway.

The Gateway burns zUSDM and releases the same amount of USDM.

## 4. Preview Proof

Balary has completed this lifecycle on Midnight Preview using Preview USDM.

Gateway:

34c67f4d4bbd15ac8cb4fa267b1162b59038a344606f8d1b52813ad7ab35c0b4

We deposited 10 USDM.

The Gateway locked 10 USDM and minted 10 shielded zUSDM.

Deposit transaction:

1809a3807ff95ff644c6b383c0b851b955aa7a295765cf2b575a31b63113a73d

## 5. Confidential Payroll

PayrollVault:

1d5f51e61f0f990aabfcb5f4c91d0a416c3b9b091ab7fdf5f7712c931108a825

HR privately approved a salary of 5 zUSDM.

Finance funded exactly that approved allocation.

Funding transaction:

37dc07d60cc38c7b7c3d4da19f22d9dbf1f737da97bf084fb64be158a6d4fec6

The PayrollVault became ACTIVE.

## 6. Employee Claim

The employee successfully claimed the 5 zUSDM salary.

Claim transaction:

f7c1579d2ad03e8c60a7f43ace75e2aa3f2df08cf1379ce62edad9d1924381ce

After the claim, the PayrollVault state became COMPLETED.

For the final Preview demonstration, employer and employee roles used the same Preview wallet.

A separate-wallet claim was also successfully proven in Balary's local Midnight integration flow.

## 7. Redemption

We then redeemed 5 zUSDM back into public USDM.

Redemption transaction:

4e03d2a140f45f00dbce1044bce63adeef1e0d85aba88d886a46e4909e0f7e33

Public USDM increased from 90 to 95.

Shielded zUSDM decreased from 10 to 5.

Gateway locked USDM decreased from 10 to 5.

Outstanding zUSDM decreased from 10 to 5.

The core invariant remained true:

USDM locked in Gateway = outstanding redeemable zUSDM.

## 8. Privacy

Balary does not publish an employee-to-salary mapping.

Employee identity is derived from a private secret.

Salary allocations use blinded commitments and Merkle membership proofs.

HR salary intentions are also blinded.

Claim nullifiers prevent double claims.

Institutional authentication uses secret-derived authority commitments instead of wallet public keys.

## 9. Closing

Balary gives institutions public stablecoin settlement with private payroll execution.

USDM remains transparent where settlement requires transparency.

Payroll information remains confidential where employees and institutions require privacy.

That is Balary.
