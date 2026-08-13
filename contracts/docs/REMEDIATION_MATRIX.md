# Audit Remediation Matrix

## High severity

| Finding | Remediation |
|---|---|
| H-01 Public withdrawal-lane DoS | `requestPrivateWithdrawal` requires `RELAYER_ROLE`; request TTL reduced to 15 minutes; signed failures and permissionless stale cleanup release the lane. |
| H-02 Selected TEE not bound to signer | Each selected `teeId` has a time-delayed signer binding and epoch. Requests snapshot the machine, signer, epoch and extension ID. Results must reproduce all four values and the current binding must remain active. |
| H-03 Funding immediately before claim expiry | Funding has its own deadline. Full funding sets `activatedAt` and creates a fresh withdrawal window from activation. |
| H-04 Pending request lost at expiry | Requests opened before the withdrawal cutoff may settle through a separate grace deadline. The vault tracks pending instruction IDs and blocks closure while any remain. |
| H-05 Pause runs down deadlines | Vault pause duration is accumulated and added to funding, withdrawal and settlement deadlines. New withdrawals and result finalization are not blocked by the gateway pause. |
| H-06 Failed TEE result cannot close | `finalizeFailedRequest` verifies a status-0 TEE result and closes the request without changing payroll balances. |
| H-07 Signer cannot rotate | Machine-specific signer proposals have a one-hour delay. Activation increments an epoch. Emergency revocation invalidates all open requests for that machine. |

## Medium severity

| Finding | Remediation |
|---|---|
| M-01 Requester leaks employee identity | Only Zalary relayers submit requests. Withdrawal storage/events do not store the employee authentication wallet or raw requester identity. |
| M-02 Payroll linkability | Withdrawal events use instruction IDs/nullifiers rather than employee identity. Residual payroll and ERC-20 transfer linkability cannot be fully removed on a public EVM chain and is documented. |
| M-03 Recipient may receive less | `_pushExact` verifies both the vault balance decrease and recipient balance increase. |
| M-04 Institution can lose all admins | Last-admin removal is blocked. Two-step admin transfer and two-day protocol recovery are included. |
| M-05 Unbounded extension scan | `setExtensionId(uint256)` is admin-only and verifies the registry maps the supplied ID to this gateway. |
| M-06 Private ledger state loss | The FCE must persist authenticated encrypted snapshots and deterministic withdrawal journals. See `PRIVATE_STATE_RECOVERY.md`. |

## Low severity

| Finding | Remediation |
|---|---|
| L-01 Incorrect closed escrow view | `payrollEscrowRemaining` returns zero for closed/cancelled/non-funded states. |
| L-02 Withdrawal indexing | Instruction ID and nullifier provide safe indexing without requiring an employee identity field. |
| L-03 Tiny withdrawals | Each payroll snapshots a configurable minimum atomic withdrawal amount. Recommended Coston2 value: `1`. |
| L-04 Native token rescue | Both contracts include admin-only native-token rescue. |
| L-05 Test coverage | Security tests cover relayer access, signed failures, stale expiry, activation windows, pause extensions, grace settlement, pending closure, signer rotation, admin recovery and outgoing transfer fees. |

## Residual assumptions

- The protocol admin correctly binds the signer reported by the Flare proxy to the exact selected machine ID. The provided Flare interface exposes random machine selection but does not expose a documented signer getter usable by this contract.
- The FCE implementation correctly verifies encrypted employee authorization and maintains its private ledger.
- The configured stablecoin is non-rebasing and behaves like a standard ERC-20.
- Public ERC-20 transfer amounts and destination addresses remain visible.
