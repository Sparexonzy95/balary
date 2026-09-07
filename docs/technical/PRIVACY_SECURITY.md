# Privacy and security

## Goals and non-goals

Goals: hide employee identity, salary, intent/allocation openings, and role secrets while enforcing exact funding and entitlement. Non-goals: hide public USDM settlement, contract existence, all lifecycle metadata, or witness data from an untrusted prover.

## Data and mechanisms

Authority commitments are domain-separated hashes of Admin/HR/Finance secrets. Employee keys are separately domain-derived. HR salary intents and allocation leaves use `persistentCommit` with private randomness so guessable salaries are not directly dictionary-testable. Allocation membership uses a depth-20 Merkle path/root. Claim and recovery nullifiers have separate domains. Salary coins are shielded and dedicated per allocation.

Ordinary ledger fields, roots/commitments, lifecycle state, aggregate counters, and disclosed nullifiers are public. Aggregate counts may reveal workforce size. Redemption releases unshielded USDM and intentionally ends payroll privacy.

## Enforced controls

The Gateway validates public USDM color, zUSDM color, reserve sufficiency, nonzero values, burn, and equal accounting. The Vault validates secret-derived roles, HR-before-Finance exact matching, unique approval/funding, activation completeness, employee identity, coin binding, membership, deadline, state, and nullifiers. Admin cannot cancel active payroll. Finance can recover only eligible unclaimed coins. Role rotation does not reset recovery identity.

`ownPublicKey()` is not authentication; it becomes the shielded recipient only after authorization or entitlement checks.

## Threat model

| Threat | Current control / boundary |
|---|---|
| Unbacked issuance or wrong assets | Receive configured USDM; domain-derived zUSDM; equal totals and reserve checks |
| Finance invents/changes salary | Exact randomized HR intent must match funded coin |
| Wrong/double claimant | Secret-derived key, membership, nullifier, coin consumption |
| Post-activation administrator rug | Cancellation restricted to `FUNDING` |
| Recovery after Finance rotation | Coin-derived recovery nullifier independent of role secret |
| Salary guessing | Private randomness in persistent commitments |
| Malicious/remote prover | Not eliminated: prover may see witnesses; use trusted/local proving |
| Key theft | Off-chain risk: use secure generation, distribution, backup, rotation, and access control |
| Metadata analysis | Counts and transaction/contract existence remain public |
| Public exit correlation | Accepted design boundary at redemption |

## Status and hardening

There is no claimed audit, formal verification, production key-management system, or mainnet deployment. Recommended hardening: independent Compact/security review, adversarial integration testing for every recovery/rotation path, locally controlled proving, hardware-backed secret custody, monitored reserve reconciliation, incident/runbooks, padded/batched counts, fee sponsorship, rate/operational controls, and staged mainnet readiness.
