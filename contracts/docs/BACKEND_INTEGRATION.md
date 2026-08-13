# Backend Integration

## Roles

The backend relayer wallet must hold `RELAYER_ROLE` on `ZalaryConfidentialGateway`. Employees never submit the public FCE withdrawal transaction directly.

## Payroll flow

1. Create draft through `createPayrollDraft` with:
   - `fundingStartsAt`
   - `fundingDeadline`
   - `minimumWithdrawalWindow`
   - `settlementGracePeriod`
2. Encrypt payroll with the FCE public key.
3. HR calls `requestPayrollComputation`.
4. Store instruction ID, ciphertext hash and selected TEE status.
5. Relay either `finalizePayrollComputation` or `finalizeFailedRequest`.
6. HR calls `openFunding`.
7. Finance approves and calls `fundPayroll`.

## Withdrawal flow

1. Employee authenticates privately to the backend.
2. Employee signs a withdrawal intent containing chain ID, vault, destination, amount, nonce and expiry.
3. Backend encrypts the intent for the FCE.
4. An approved relayer calls `requestPrivateWithdrawal`.
5. Store the instruction ID only in the private backend record.
6. Relay `finalizePrivateWithdrawal` on success or `finalizeFailedRequest` on failure.
7. If no result arrives within 15 minutes, call `expireStaleRequest`.

## Deadline handling

Use vault view functions, not raw struct fields:

- `effectiveFundingStartsAt(payrollId)`
- `effectiveFundingDeadline(payrollId)`
- `effectiveWithdrawalDeadline(payrollId)`
- `effectiveSettlementDeadline(payrollId)`

These include pause extensions.

## Indexing

Index withdrawals by `instructionId` and `withdrawalNullifier`. Do not place employee emails, employee IDs or authentication wallets in public event metadata.

## Error handling

- A status-0 TEE response must be relayed through `finalizeFailedRequest` immediately.
- `TeeBindingChanged` means the signer was rotated or revoked; let the request expire, then retry with the active machine binding.
- `PendingWithdrawalExists` means payroll closure must wait until the request succeeds, fails or expires.
