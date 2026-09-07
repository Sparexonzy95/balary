# Midnight Preview proof

## Scope

This is the committed execution record for Balary's full lifecycle on **Midnight Preview**, not mainnet. It demonstrates protocol execution and accounting; it is not an audit, production certification, or proof that every modeled failure path ran on Preview.

Preview USDM color: `003bacd9a361ba0d425e408776020e40271375e8b8de42d73eec046a44947d73`

Initial employer balance: **100 USDM**.

## 1. Deposit and mint

| Field | Value |
|---|---|
| Gateway | `34c67f4d4bbd15ac8cb4fa267b1162b59038a344606f8d1b52813ad7ab35c0b4` |
| zUSDM color | `1e7e486a1dd6f652e0154e91f292dc234bb047fe348b4d389d52e79cf3ce32e0` |
| Deposit | 10 USDM / 10,000,000 raw units |
| Transaction | `1809a3807ff95ff644c6b383c0b851b955aa7a295765cf2b575a31b63113a73d` |

Public USDM moved 100 ? 90; shielded zUSDM moved 0 ? 10. Gateway locked and outstanding totals both became 10,000,000.

## 2. Payroll approval and funding

| Field | Value |
|---|---|
| PayrollVault | `1d5f51e61f0f990aabfcb5f4c91d0a416c3b9b091ab7fdf5f7712c931108a825` |
| Salary | 5 zUSDM / 5,000,000 raw units |
| Funding transaction | `37dc07d60cc38c7b7c3d4da19f22d9dbf1f737da97bf084fb64be158a6d4fec6` |

HR privately approved the salary intent. Finance funded that exact allocation. Employer zUSDM moved 10 ? 5 and the vault became `ACTIVE`.

## 3. Claim

| Field | Value |
|---|---|
| Allocation commitment | `71395a977eb03eed8824da4c8646420f24a5d782d24f585ed8857c2fa0ae3934` |
| Salary Zswap `mt_index` | `53192` |
| Transaction | `f7c1579d2ad03e8c60a7f43ace75e2aa3f2df08cf1379ce62edad9d1924381ce` |

The 5 zUSDM salary was claimed. Wallet zUSDM moved 5 ? 10 and payroll became `COMPLETED`.

**Preview caveat:** employer and employee roles used the same Preview wallet because a newly generated employee wallet needed time to accumulate tDUST. A genuinely separate employer/employee wallet claim was successfully executed in the local Midnight flow. No private claim opening, seed, mnemonic, or role secret is recorded here.

## 4. Redemption

| Field | Value |
|---|---|
| Redeemed | 5 zUSDM / 5,000,000 raw units |
| Transaction | `4e03d2a140f45f00dbce1044bce63adeef1e0d85aba88d886a46e4909e0f7e33` |

Shielded zUSDM moved 10 ? 5; public USDM 90 ? 95; locked and outstanding totals each moved 10,000,000 ? 5,000,000.

## Final accounting

```text
5,000,000 locked USDM = 5,000,000 outstanding redeemable zUSDM
```

## Reproduction boundary

The committed runners are `npm run preview:gateway`, `preview:payroll`, `preview:claim`, and `preview:redeem`. They require generated artifacts, a Preview wallet with tDUST, external USDM, a proof server, private-state password, and protected mnemonic; they are not a one-command public replay. For secret-free verification run `npm run check:contracts`, `npm run test:model`, or the full `npm run gate`.

This proves the named Preview lifecycle and final invariant. It does not prove mainnet deployment, separate-wallet Preview claim, external audit, all adversarial paths on Preview, production key custody, or prover confidentiality.
