# Post-Patch Security Review

## Decision

**The v2 audit findings have been addressed in source, but v3 is not approved for deployment until it compiles and the complete Hardhat suite passes locally.**

## Static review outcome

No obvious unauthenticated stablecoin-drain path was identified in the patched source under the stated TEE and admin assumptions.

The following deployment blockers from v2 are removed:

- public withdrawal-lane spam;
- one-day failed-request lock;
- loose global TEE signer;
- signer immutability;
- funding immediately before employee expiry;
- loss of on-time requests at the deadline;
- pause-based deadline exhaustion;
- last institution-admin removal;
- sender-only fee-token checks;
- incorrect closed-payroll escrow reporting;
- unbounded extension discovery.

## New invariants

1. Only the configured gateway can move employee escrow.
2. Only a `RELAYER_ROLE` account can open a withdrawal instruction.
3. Every withdrawal instruction is tracked by the vault before execution.
4. Every successful result is bound to chain, gateway, vault, extension, selected TEE, signer epoch, payroll, ciphertext and request time.
5. A nullifier is used at most once.
6. A private-ledger transition must start from the current root.
7. Payroll closure requires the settlement deadline to pass and zero pending requests.
8. Paused time is added to employee deadlines.
9. Stablecoin rescue cannot reduce `totalEscrowed`.
10. The final institution admin cannot be removed.

## Residual risks

- Machine-to-signer binding is configured from the Flare proxy/setup output because the provided registry interface does not expose a documented signer getter. Use a multisig, verify the machine ID carefully, and observe the one-hour delay.
- A compromised active TEE signer can still authorize incorrect private state transitions. This is inherent in the single-TEE trust model used for the hackathon simulation.
- Public ERC-20 transfers reveal amount and destination.
- Contract bytecode size and compiler correctness remain unverified until local Hardhat compilation.
- Private ledger availability depends on encrypted snapshots and deterministic recovery procedures.

## Required final checks

```powershell
npm install
npm run clean
npm run compile
npm run test:security
```

Then inspect the compiler's deployed bytecode size for both contracts and run one complete Coston2 flow before accepting payroll funds.
