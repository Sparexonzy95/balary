# Milestone 4 Release Notes

Milestone 4 completes the backend flow from a computed confidential payroll to an employee private withdrawal.

## Funding

- Opens funding only from on-chain `Computed` status.
- Reads the current Vault state before every Finance action.
- Approves and funds the exact remaining amount.
- Confirms sender, target, calldata, value, receipt, event and resulting Vault state.
- Records activation and effective withdrawal/settlement deadlines.

## Withdrawal privacy

- Resolves employees by a hash of the connected authentication wallet.
- Generates the exact documented `ZALARY_FCC_WITHDRAWAL_AUTH_V1` digest.
- Binds authorizations to chain, Gateway, Vault, extension, payroll, employee reference, destination, amount, nonce, current private root and expiry.
- Encrypts the payload only after signature recovery succeeds.
- Does not store the private ledger or plaintext salary rows.

## Relayer safety

- Saves the withdrawal request transaction hash immediately after broadcast.
- Resumes the same transaction instead of rebroadcasting after an RPC timeout.
- Stores the signed TEE result before finalization.
- Verifies result bindings, the new root, withdrawal nullifier and settlement events.
- Reuses the same private nonce after a signed failure or stale expiration because those outcomes do not mutate TEE state.
