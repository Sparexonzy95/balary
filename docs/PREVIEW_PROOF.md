# Balary Midnight Preview Proof

Balary completed the full confidential payroll lifecycle on Midnight Preview using Preview USDM.

## Gateway

Gateway:

`34c67f4d4bbd15ac8cb4fa267b1162b59038a344606f8d1b52813ad7ab35c0b4`

Preview USDM color:

`003bacd9a361ba0d425e408776020e40271375e8b8de42d73eec046a44947d73`

zUSDM color:

`1e7e486a1dd6f652e0154e91f292dc234bb047fe348b4d389d52e79cf3ce32e0`

10 USDM was deposited and 10 shielded zUSDM was minted.

Deposit transaction:

`1809a3807ff95ff644c6b383c0b851b955aa7a295765cf2b575a31b63113a73d`

## Confidential Payroll

PayrollVault:

`1d5f51e61f0f990aabfcb5f4c91d0a416c3b9b091ab7fdf5f7712c931108a825`

HR privately approved a salary allocation of 5 zUSDM.

Finance funded exactly the approved 5 zUSDM allocation.

Funding transaction:

`37dc07d60cc38c7b7c3d4da19f22d9dbf1f737da97bf084fb64be158a6d4fec6`

Payroll state after funding:

`ACTIVE`

## Salary Claim

Salary claimed:

`5 zUSDM`

Allocation commitment:

`71395a977eb03eed8824da4c8646420f24a5d782d24f585ed8857c2fa0ae3934`

Claim transaction:

`f7c1579d2ad03e8c60a7f43ace75e2aa3f2df08cf1379ce62edad9d1924381ce`

Payroll state after claim:

`COMPLETED`

For the Preview demonstration, employer and employee roles used the same Preview wallet. A separate-wallet employee claim was successfully proven in the local Midnight integration flow.

## Redemption

5 zUSDM was burned and redeemed for 5 public USDM.

Redemption transaction:

`4e03d2a140f45f00dbce1044bce63adeef1e0d85aba88d886a46e4909e0f7e33`

Final state:

- Public USDM: 95 USDM
- Shielded zUSDM: 5 zUSDM
- Gateway locked USDM: 5 USDM
- Outstanding zUSDM: 5 zUSDM

## Core Invariant

`USDM locked in Gateway = outstanding redeemable zUSDM`

Final Preview state:

`5 USDM = 5 zUSDM`

The 1:1 accounting invariant remained intact throughout deposit, payroll funding, claim, and redemption.
