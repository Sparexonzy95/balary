# Zalary Backend Milestone 5 — Operational Product Layer

Milestone 5 extends the live-verified Milestone 4.2 backend without changing the proven FCC, funding, or private-withdrawal cryptography.

## Added

### Onboarding and notifications

- Wallet-account welcome notification after an email is added
- Institution onboarding and on-chain activation notices
- HR, Finance, and Admin invitation/status notices
- Encrypted employee onboarding email delivery
- Payroll-created, encrypted, computed, funding-ready, active, closed, and failed notices
- Employee private-withdrawal readiness and completion receipts
- Funding and withdrawal deadline reminders at 24, 6, and 1 hour
- Deadline-passed alerts
- Transaction-failure alerts
- In-app inbox, unread count, mark-read, and mark-all-read APIs
- Global and institution-scoped notification preferences
- Encrypted recipient email storage in delivery logs
- Idempotent notification and email deduplication keys
- Delivery attempts, exponential retry windows, provider result, failure reason, and manual retry API

### Recurring payroll scheduling

- Weekly, biweekly, monthly, and quarterly schedules
- IANA timezone support, including DST-aware wall times
- Month-end anchor-day preservation
- Pause, resume, update, and run-now operations
- Idempotent schedule execution records
- Fresh payroll-shell generation for every period
- Automatic funding timestamps and deadlines
- Celery Beat task for due schedules
- No salary rows or old ciphertext are copied into recurring payrolls

Every scheduled cycle deliberately creates an empty payroll shell. HR must upload a fresh private CSV so salary changes are never silently reused.

### Audit and reporting

- Append-only audit events for institutions, roles, employees, payroll states, chain transactions, schedules, email outcomes, and withdrawals
- Institution-scoped audit API with action, target, and date filters
- CSV audit export
- Aggregate payroll report in JSON and CSV
- Proof hashes, transaction hashes, roots, nullifiers, and aggregate totals
- No plaintext salary rows in reports

### Production operations

- SMTP/provider-neutral email configuration
- PostgreSQL, Redis, web, Celery worker, and Celery Beat production compose file
- Gunicorn runtime and container health checks
- Database, Redis, field-encryption, FCC, email, and Celery readiness reporting
- Secure proxy, cookie, HSTS, frame, and content-type settings
- Structured console logging
- Deployment system checks
- Test-email, due-schedule, and operational-preflight commands
- Request ID middleware

## New API groups

- `/api/v1/notifications/`
- `/api/v1/schedules/`
- `/api/v1/audit/`
- `/api/v1/health/ready/`

## New periodic jobs

- Pending chain transaction synchronization every 30 seconds
- Pending FCC instruction processing every 15 seconds
- Due payroll schedule processing every minute
- Unsigned withdrawal authorization expiry every minute
- Failed email delivery retry every minute
- Payroll deadline reminders every 15 minutes

## Security boundaries retained

- No plaintext salary rows are stored
- Employee email remains encrypted at rest
- Email-delivery recipient addresses are encrypted at rest
- No private key is included in the repository
- No relayer key is required for unit tests
- Scheduling never broadcasts blockchain transactions
- Notifications never sign or rebroadcast transactions
- Audit reports exclude ciphertext and private salary rows

## External configuration still required for deployment

The code is complete, but production operators must supply their own:

- PostgreSQL credentials
- Redis endpoint
- SMTP or transactional-email credentials
- Fernet field-encryption key
- Hosted FCC endpoint URL
- Relayer private key through a secret manager
- Production domain, frontend origin, TLS, and DNS

These secrets and hosted services are intentionally not embedded in the snapshot.
