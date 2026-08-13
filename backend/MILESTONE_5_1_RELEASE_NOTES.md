# Zalary Backend Milestone 5.1 — Email Delivery Correctness

## Outcome

Milestone 5.1 corrects the email state model: a successful SMTP submission is now `accepted`, never `delivered`. Inbox delivery is recorded only after a verified transactional-provider event.

## Included

- Safe migration of legacy `sent` rows to `accepted` and removal of integer send counts masquerading as provider IDs.
- RFC Message-ID generation plus separate provider response, acceptance, delivery, bounce, error, and attempt fields.
- Privacy-safe headers and structured worker diagnostics.
- SMTP provider and Resend transactional provider with request idempotency.
- Signed, replay-protected Resend webhook handling for delivery, bounce, delay, complaint, failure, rejection, and suppression events.
- `diagnose_email` with authentication-only `--no-send` mode.
- Retry and duplicate-execution protection, encrypted-recipient boundary, and public-serializer protections.
- PowerShell verification, operating guidance, architecture documentation, and expanded automated coverage.

## Compatibility

Existing `sent_at` and `error_message` fields remain available for older database/API integrations. API delivery states now expose the more accurate `accepted` state. Operators should update any UI that previously displayed `sent` as delivered.

## Delivery claims

- SMTP authentication can be tested independently.
- SMTP acceptance means the provider accepted responsibility for one message.
- Provider delivery is confirmed only by a verified provider event.
- Recipient inbox observation is outside this backend and was not asserted by this patch.

No payroll, smart-contract, FCC, TEE, funding, withdrawal, encryption, wallet-authentication, or transaction-reconciliation path was redesigned by this milestone.

