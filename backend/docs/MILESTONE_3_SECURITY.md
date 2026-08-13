# Milestone 3 Security Notes

## User signing

Draft creation and payroll computation requests remain user-wallet actions. Django returns exact transaction calldata and value but does not hold the HR wallet key.

## Relayer signing

Only FCC result finalization and stale-request cleanup use the backend relayer. The key is read from a runtime secret and excluded from snapshots.

## Receipt verification

Every prepared user transaction is bound to:

- account
- chain
- sender
- contract
- calldata hash
- native value
- intended model and action
- expiry

## FCC verification

Before finalization, the backend verifies:

- ActionResult instruction ID
- status is 0 or 1
- 65-byte signature and recovery value
- exact Flare ActionResult digest
- recovered TEE signer
- request-selected TEE
- signer epoch
- payroll, institution and contract addresses
- metadata and ciphertext commitments
- stablecoin and decimals
- employee count and aggregate totals
- result validity window

The Gateway repeats the authoritative checks on-chain.

## Resume behavior

The complete signed ActionResult is stored before relayer broadcast. A broadcast failure can therefore retry the same result. The backend must never create a new computation request after a status-1 result until the original instruction has been reconciled.
