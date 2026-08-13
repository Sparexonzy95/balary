# Zalary Email Notification Architecture

## Active send path

Zalary now mirrors the supplied sample backend for normal email notifications:

1. `emit_notification` creates the in-app notification and one encrypted `EmailDelivery` record.
2. `enqueue_email_delivery` queues `apps.notifications.tasks.send_email_notification`.
3. The Celery task claims the delivery row and calls `send_email_delivery`.
4. The recipient address is decrypted only inside the send boundary.
5. Django `EmailMessage` sends one plain-text message using `DEFAULT_FROM_EMAIL`.
6. The only custom outgoing header is `X-Zalary-Notification-ID`.
7. A successful Django send records `accepted_at` and the compatibility `sent_at`.

Django and Gmail generate their normal transport headers. Zalary does not inject a local-domain Message-ID, `Auto-Submitted`, provider headers, or tracking headers into the active SMTP message.

## Delivery truth

- `pending`: queued but not claimed.
- `sending`: claimed by a worker.
- `accepted`: Django handed one message to the configured email backend successfully.
- `failed`: the attempt raised an exception and can be retried.
- `skipped`: no send was attempted because the recipient was missing or preferences disabled email.

`accepted` does not prove Inbox placement. The receiving user must confirm receipt. Legacy delivery fields and provider/webhook models remain for database compatibility, but the normal SMTP send path does not depend on them.

## Privacy and idempotency

The normalized recipient is encrypted at rest and accompanied by a one-way lookup hash. Plaintext is not exposed through public serializers or routine worker logs. Row locking, terminal-state checks, deduplication keys, bounded retries, and the stale-send lease prevent normal duplicate delivery.

No email task invokes payroll funding, withdrawal, FCC, or blockchain transaction code.

## Operator test

With Redis and one Celery worker running:

```powershell
python manage.py send_test_notification --recipient user@example.com
```

The command uses the same production notification path and reports only whether Django completed the send, Celery completed the task, and `sent_at` was recorded.
