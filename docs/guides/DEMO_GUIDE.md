# Demo guide

## 30-second pitch

Balary is confidential institutional USDM payroll on Midnight. Public USDM is locked 1:1 for shielded zUSDM; HR privately approves exact salaries, Finance funds only those approvals, and employees privately claim. Redemption burns zUSDM for equal public USDM. The full lifecycle is proven on Preview, with the separate-wallet claim additionally proven locally.

## 60-second pitch

Public payroll exposes salaries and relationships; a single privileged wallet also violates institutional separation of duties. Balary creates a private payroll layer without inventing a new stablecoin. Show the Gateway invariant, then HR approval, Finance exact funding, employee Merkle claim, and public redemption. Close with the honest boundary: the Preview claim shared a wallet due to tDUST, while separate wallets succeeded locally.

## Three-to-five-minute flow

1. Open the README hero, guarantee, and evidence table.
2. Show `BalaryStablecoinGateway.compact`: configured color, deposit/mint, burn/release, equal totals.
3. Show `BalaryPayrollVault.compact`: sealed run configuration, role hashes, randomized intents, Merkle allocations, claim/recovery nullifiers.
4. Run `npm run check:contracts` and `npm run test:model`; if Compact is installed, run `npm run gate`.
5. Open [Preview proof](../technical/PREVIEW_PROOF.md) and walk deposit, funding, claim, redemption, and final 5=5 invariant.
6. Disclose the shared-wallet Preview caveat, local separate-wallet proof, prover boundary, metadata leakage, audit status, and public exit.

Never display mnemonics, seeds, environment files, wallet state, private-state passwords, or allocation openings.

## Likely questions

- **Is zUSDM another stablecoin?** No. It is a shielded claim backed by equal USDM locked in the Gateway.
- **Why no oracle/AMM?** Equal custody/mint/burn accounting replaces price and liquidity mechanisms.
- **Can Finance change salary?** No; the funded coin must reproduce HR's exact blinded intent.
- **Can Admin cancel after activation?** No.
- **How is double claim prevented?** A claim nullifier plus shielded coin consumption.
- **Is everything private?** No. Settlement, state, commitments, counts, and disclosed nullifiers are public; salaries/identities/openings are private.
- **Can the prover see salary witnesses?** It may; sensitive use needs a trusted/local prover.
- **Mainnet/audited?** No; Preview-proven, locally tested, not externally audited.

## Recovery plan

If Preview infrastructure is unavailable, use committed transaction evidence and the proof visualization, run deterministic checks/model tests, compile locally if possible, and show contract/state-machine code. Do not imply that a historical transaction was replayed live.
