# Balary ? Buildathon submission

## One-line pitch

Balary is a confidential institutional stablecoin payroll protocol on Midnight that lets organizations settle with public USDM while keeping employee salary allocations and claims private.

## Problem and solution

Public blockchain payroll reveals salaries, relationships, and payment history. Institutions also need Admin, HR, Finance, and Employee powers separated. Balary locks public USDM in a Gateway, mints equal shielded zUSDM, lets HR approve blinded salary instructions, restricts Finance to exact approved funding, and lets employees prove entitlement privately. Redemption burns zUSDM and releases equal USDM.

Core guarantee: `USDM locked in Gateway = outstanding redeemable zUSDM`.

zUSDM is not an independent stablecoin, oracle synthetic, AMM token, pool asset, or swap dependency.

## Why Midnight

Compact and Midnight shielded assets allow private salary inputs and entitlement proofs alongside public lifecycle enforcement. Balary uses randomized commitments, Merkle membership, secret-derived role/employee identity, domain-separated nullifiers, and dedicated shielded salary coins.

## Architecture and institutional controls

The Gateway pins external USDM color, performs equal deposit/mint and burn/release, and has no unbacked administrator mint. Each PayrollVault is one immutable payroll run. Admin rotates authority and may cancel only before activation; HR approves exact private intent; Finance funds only the match and recovers eligible unclaimed coins; Employee proves and claims.

## Proven execution

Preview USDM color: `003bacd9a361ba0d425e408776020e40271375e8b8de42d73eec046a44947d73`

Gateway: `34c67f4d4bbd15ac8cb4fa267b1162b59038a344606f8d1b52813ad7ab35c0b4`

- Deposit 10 USDM: `1809a3807ff95ff644c6b383c0b851b955aa7a295765cf2b575a31b63113a73d`
- PayrollVault: `1d5f51e61f0f990aabfcb5f4c91d0a416c3b9b091ab7fdf5f7712c931108a825`
- Fund 5 zUSDM: `37dc07d60cc38c7b7c3d4da19f22d9dbf1f737da97bf084fb64be158a6d4fec6`
- Claim 5 zUSDM: `f7c1579d2ad03e8c60a7f43ace75e2aa3f2df08cf1379ce62edad9d1924381ce`
- Redeem 5 zUSDM: `4e03d2a140f45f00dbce1044bce63adeef1e0d85aba88d886a46e4909e0f7e33`
- Final: 95 public USDM, 5 shielded zUSDM, 5 USDM locked, 5 zUSDM outstanding.

The final Preview claim shared the employer wallet because a new employee wallet needed tDUST time. Separate employer/employee wallets succeeded locally.

## Validation

The hard gate reports 32 static architecture/security checks, 42 model tests, and successful compilation of three Compact contracts. Local integration covers MockUSDM through a separate employee claim and redemption. Preview covers the external asset lifecycle above.

## Privacy, boundaries, and status

Salaries, identities, role secrets, blinds, and openings are private inputs. Contract/state metadata, commitments, roots, counts, nullifiers when disclosed, and public settlement remain public. Counts may reveal workforce size. A prover may see witness data, so sensitive use needs a trusted/local prover. There is no external audit, formal verification, UI, registry, mainnet deployment, or production-readiness claim.

## Roadmap

Separate-wallet Preview demonstration, fee sponsorship, institution onboarding, dashboards, batch/padded payroll, metadata hardening, security review, and a mainnet path.

See the [repository README](../../README.md), [architecture](../technical/ARCHITECTURE.md), and [Preview proof](../technical/PREVIEW_PROOF.md).
