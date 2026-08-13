# Zalary Backend Milestone 3 API

Base URL: `http://127.0.0.1:8000/api/v1`

All endpoints require `Authorization: Bearer <access-token>` unless stated otherwise.

## Existing privacy flow

1. Create institution and confirm on-chain registration.
2. Assign active HR and Finance wallets.
3. Create encrypted employee records.
4. Create a payroll run.
5. Validate and encrypt its CSV.

The payroll must have status `encrypted_ready` before draft preparation.

## Prepare payroll draft

```http
POST /payrolls/{id}/draft/prepare/
Idempotency-Key: payroll-august-draft-1
```

Response:

```json
{
  "prepared_transaction": {
    "id": "uuid",
    "chain_id": 114,
    "intent_type": "CREATE_PAYROLL_DRAFT",
    "from_address": "0xHR",
    "to": "0xA5277D55a46514740b0C716C691d92b8D9E64e5E",
    "data": "0x...",
    "value": "0",
    "expected_event": "PayrollDraftCreated"
  }
}
```

The frontend asks the connected HR/Admin wallet to broadcast this exact transaction.

## Confirm submitted draft

```http
POST /payrolls/{id}/draft/confirm/
Content-Type: application/json

{
  "prepared_transaction_id": "uuid",
  "tx_hash": "0x..."
}
```

The backend records it as pending. Receipt synchronization validates the sender, target, calldata, value, event and resulting Draft state.

## Prepare confidential computation request

Available after the draft reaches `draft_onchain`:

```http
POST /payrolls/{id}/computation/prepare/
Idempotency-Key: payroll-august-computation-1
```

The prepared transaction targets the deployed Gateway and contains:

- payroll ID
- encrypted payroll ciphertext
- configured FCC fee as transaction value

The ciphertext is not returned by the normal payroll-detail endpoint.

## Confirm submitted computation request

```http
POST /payrolls/{id}/computation/confirm/
Content-Type: application/json

{
  "prepared_transaction_id": "uuid",
  "tx_hash": "0x..."
}
```

After receipt synchronization, the backend records:

- instruction ID
- request transaction hash
- selected TEE identity
- TEE signer and epoch
- on-chain request timestamp

The payroll becomes `tee_processing`.

## FCC instructions

```http
GET /fcc/instructions/
GET /fcc/instructions/{id}/
POST /fcc/instructions/{id}/process/
```

Processing performs one safe iteration:

1. fetch ActionResult;
2. verify instruction ID and schema;
3. normalize the TEE signature;
4. reconstruct the exact Flare signing digest;
5. recover and verify the bound TEE signer;
6. validate the payroll-result envelope and aggregates;
7. store the signed result;
8. finalize with the relayer when configured.

Raw result data and signatures are not returned by the API serializer.

## Transaction synchronization

```http
POST /transactions/{id}/sync/
```

This can be used after either user-signed payroll transaction. A Celery worker or the existing receipt-sync command can also process pending transactions.

## Public FCC configuration

```http
GET /fcc/configuration/
```

It returns public addresses/configuration and booleans indicating whether the encryptor and relayer are configured. It never returns private keys.

# Milestone 4 funding and withdrawal API

## Funding context

```http
GET /payrolls/{id}/funding/context/
```

Returns on-chain payroll status, total required, amount funded, exact remaining amount, Finance-wallet USD₮0 balance, Vault allowance and effective funding timestamps.

## Open funding

```http
POST /payrolls/{id}/funding/open/prepare/
Idempotency-Key: payroll-august-open-funding
```

HR/Admin broadcasts the returned Vault transaction, then confirms it:

```http
POST /payrolls/{id}/funding/open/confirm/

{
  "prepared_transaction_id": "uuid",
  "tx_hash": "0x..."
}
```

## Approve exact USD₮0 amount

```http
POST /payrolls/{id}/funding/approval/prepare/
Idempotency-Key: payroll-august-approval
```

The returned ERC-20 transaction approves only the current remaining payroll amount.

```http
POST /payrolls/{id}/funding/approval/confirm/
```

## Fund exact remaining amount

```http
POST /payrolls/{id}/funding/fund/prepare/
Idempotency-Key: payroll-august-fund
```

Preparation fails unless the Finance wallet has enough USD₮0 and allowance.

```http
POST /payrolls/{id}/funding/fund/confirm/
```

After receipt synchronization, the backend verifies `PayrollFunded` and `PayrollActivated` before marking the payroll `active`.

## Employee withdrawal context

```http
GET /withdrawals/context/{payroll_database_id}/
```

Returns the opaque employee reference, next private nonce, current private-ledger root, minimum withdrawal, deadlines and public contract addresses. It does not return the employee's private balance.

## Prepare withdrawal authorization

Amounts are USD₮0 atomic units. One USD₮0 is `1000000`.

```http
POST /withdrawals/prepare/

{
  "payroll_id": 12,
  "destination": "0xEmployeeWallet",
  "amount": "1000000"
}
```

The response includes a 32-byte `auth_digest`. The frontend signs that digest with EIP-191 `personal_sign` semantics.

## Submit signed private withdrawal

```http
POST /withdrawals/{withdrawal_uuid}/submit/

{
  "signature": "0x..."
}
```

The backend verifies the employee signer, current root, nonce, expiry and payroll status; encrypts the payload; and submits `requestPrivateWithdrawal` through the approved relayer.

## Process or resume withdrawal

```http
POST /withdrawals/{withdrawal_uuid}/process/
```

This safely resumes a previously broadcast request transaction, polls the TEE result and finalizes it when the relayer is configured.


# Milestone 5 operational API

## Notifications

```http
GET /notifications/
GET /notifications/?unread=true&category=payroll
GET /notifications/unread-count/
POST /notifications/{id}/read/
POST /notifications/read-all/
GET /notifications/preferences/?institution_id={id}
PATCH /notifications/preferences/
GET /notifications/email-deliveries/?status=failed
POST /notifications/email-deliveries/{id}/retry/
```

Recipient email addresses are encrypted in delivery logs and are never returned by the API.

Email delivery statuses distinguish provider acceptance from confirmed delivery. `accepted` means SMTP or the selected API provider accepted the message; only a verified provider webhook produces `delivered`. Public responses omit recipient ciphertext/plaintext and raw provider responses.

The Resend webhook is intentionally unauthenticated by JWT but cryptographically authenticated with the provider signature:

```http
POST /notifications/provider-webhooks/resend/
```

Invalid, stale, and replayed events cannot mutate delivery state. Gmail SMTP does not provide this webhook capability.

## Recurring payroll schedules

```http
GET /schedules/
POST /schedules/
GET /schedules/{id}/
PATCH /schedules/{id}/
DELETE /schedules/{id}/
POST /schedules/{id}/run-now/
POST /schedules/{id}/pause/
POST /schedules/{id}/resume/
```

Create example:

```json
{
  "institution": 1,
  "name": "Monthly payroll",
  "title_template": "Payroll - {period}",
  "period_label_template": "{month} {year}",
  "frequency": "monthly",
  "timezone_name": "Africa/Lagos",
  "next_run_at": "2026-08-25T08:00:00Z",
  "funding_start_offset_minutes": 10,
  "funding_window_hours": 24,
  "minimum_withdrawal_window_seconds": 86400,
  "settlement_grace_period_seconds": 3600
}
```

Supported template tokens are `{institution}`, `{month}`, `{month_short}`, `{year}`, `{date}`, and `{period}`. A schedule creates a fresh draft payroll shell only.

## Audit and reports

```http
GET /audit/events/?institution_id={id}&action=payroll_active
GET /audit/events.csv?institution_id={id}
GET /audit/payrolls/{payroll_database_id}/
GET /audit/payrolls/{payroll_database_id}.csv
```

Reports expose aggregate totals, proof hashes, roots, nullifiers and transaction hashes. They do not expose plaintext salary rows or FCC ciphertext.

## Readiness

```http
GET /health/ready/
```
