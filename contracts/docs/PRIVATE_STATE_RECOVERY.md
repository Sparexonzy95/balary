# Private Ledger Recovery

The Solidity vault stores only `privateLedgerRoot`. The FCE must therefore make its private state recoverable without exposing employee data.

## Required FCE persistence

After payroll creation and after every successful withdrawal, the FCE must persist:

- encrypted canonical employee-balance snapshot;
- snapshot version;
- payroll ID and institution binding;
- old and new private-ledger roots;
- withdrawal nullifier;
- withdrawal amount commitment;
- action/instruction ID;
- ordered sequence number;
- authenticated checksum/MAC.

Snapshots must be encrypted under a recovery key held outside the runtime. Store at least two copies in separate locations.

## Deterministic rebuild

1. Restore the latest authenticated encrypted snapshot.
2. Verify its calculated root equals the latest root stored in `ZalaryPrivatePayrollVault`.
3. Replay later finalized withdrawal journal entries in strict sequence order.
4. Recalculate each intermediate root.
5. Refuse service if any root, nullifier or sequence number differs from the onchain record.

No Solidity “admin reset root” function is included. That omission is deliberate. An unrestricted root reset would allow payroll balances to be rewritten. Recovery must reconstruct the exact onchain root.

## Backup test

Before the demo, destroy the local FCE state in a test environment, restore from the encrypted snapshot, and successfully authorize a withdrawal from the same onchain root.
