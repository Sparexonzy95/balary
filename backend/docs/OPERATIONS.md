# Milestone 5 Operations

## Local processes

Run the API:

```powershell
python manage.py runserver 127.0.0.1:8001
```

Run the Celery worker:

```powershell
celery -A config worker -l info --pool=solo
```

Run the scheduler:

```powershell
celery -A config beat -l info
```

On Windows, `--pool=solo` avoids multiprocessing issues during local development.

## One-time setup

```powershell
python manage.py migrate
python manage.py seed_coston2
python manage.py check
python manage.py ops_preflight
python manage.py test
```

No command above broadcasts a blockchain transaction.

## Test email

Zalary uses the same simple Django `EmailMessage` plus Celery path as the supplied sample backend. Configure the existing SMTP variables in the uncommitted `.env`, start Redis and one Celery worker, then run:

```powershell
python manage.py send_test_notification --recipient you@example.com
```

The active message is plain text, uses `DEFAULT_FROM_EMAIL`, and adds only `X-Zalary-Notification-ID`. The recipient remains encrypted at rest and is decrypted only inside the send task.

A successful result records `accepted_at` and `sent_at`. It confirms that Django completed the configured backend send; the recipient must still confirm Inbox receipt manually.

For Gmail, the authenticated Gmail address must match the address inside `DEFAULT_FROM_EMAIL`. Use port 465 with SSL or port 587 with STARTTLS, never both. Store the Google App Password only in `.env` or a secret manager. Restart the Celery worker after changing email settings.

## Accepted versus delivered

SMTP success moves a delivery to `accepted`. In particular, Gmail's successful SMTP response means Gmail accepted the message for processing; it does not prove placement in Inbox, Spam, Promotions, Junk, or All Mail. Only a verified transactional-provider webhook moves a record to `delivered`. Zalary does not claim Gmail SMTP supplies delivery webhooks.

For Gmail development, use the authenticated Gmail address as `DEFAULT_FROM_EMAIL`, port 465 with SSL or port 587 with STARTTLS (never both), and a Google App Password. Keep the password only in the uncommitted `.env` or a secret manager.

For production, prefer `ZALARY_EMAIL_PROVIDER=resend` with a verified custom domain. Publish and validate SPF and DKIM, then deploy an aligned DMARC record in monitoring mode before increasing enforcement. Configure the Resend webhook URL as `/api/v1/notifications/provider-webhooks/resend/` and store its signing secret as `ZALARY_RESEND_WEBHOOK_SECRET`.

## Credential and configuration changes

Do not edit production configuration through source control. Apply new values through the host's secret manager or, for local development only, an operator-owned `.env` edit. For example:

```powershell
Copy-Item .env.example .env
notepad .env
```

After rotating an SMTP password, Resend API key, or webhook secret, revoke the old credential and restart every process that caches Django settings:

```powershell
Restart-Service ZalaryWeb
Restart-Service ZalaryCeleryWorker
Restart-Service ZalaryCeleryBeat
```

Use the service names defined by your deployment. On a local console, stop and restart `runserver`, the Celery worker, and Celery Beat. Never paste credential values into tickets, logs, shell history, or diagnostic output.

Run the complete non-transactional verification from PowerShell:

```powershell
.\scripts\verify_email_delivery.ps1 -PythonPath python -DiagnosticRecipient operator@example.com
```

This applies migrations, runs all tests, authenticates SMTP without sending, checks Redis, and queries Celery's control channel with `inspect stats`. It neither invokes an unregistered `celery.ping` task nor broadcasts blockchain transactions.

## Process due schedules manually

```powershell
python manage.py run_due_schedules --limit 100
```

This creates local payroll shells only. It never uploads salary data, signs a wallet transaction, or moves tokens.

## Production services

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

The compose stack includes:

- PostgreSQL
- Redis
- Gunicorn web API
- Celery worker
- Celery Beat

## Readiness

```http
GET /api/v1/health/ready/
```

Readiness checks database connectivity, Redis when workers are enabled, field-encryption configuration, FCC endpoint configuration, email backend, and Celery mode.

## Key rotation

`ZALARY_FIELD_ENCRYPTION_KEY` protects employee and email-delivery addresses. Rotating it requires decrypting with the old key and re-encrypting with the new key in a controlled migration. Never replace it casually on a live database.

`ZALARY_RELAYER_PRIVATE_KEY` must be held in a secret manager. Never commit it to `.env`, a ZIP snapshot, source control, logs, or frontend code.

## Encryptor binary in production

The backend calls the configured Go ECIES helper through `ZALARY_ENCRYPTOR_COMMAND`. Build a Linux binary from the approved confidential-engine source and copy or mount it into the web container. Do not reuse the Windows `.exe` inside a Linux container.
