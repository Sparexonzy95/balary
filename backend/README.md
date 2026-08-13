# Zalary Backend — Milestone 5

Django REST backend for Zalary Confidential Payroll on Flare Coston2.

## Verified foundations

- Milestone 1: wallet authentication, institution onboarding and role transactions
- Milestone 2: encrypted employee records, payroll CSV validation and Go ECIES encryption
- Milestone 3: payroll draft creation, FCC computation orchestration and signed TEE-result finalization
- Milestone 3 was verified locally on Windows with clean migrations and all 20 tests passing

## Added in Milestone 4

- User-signed `openFunding` transaction preparation and confirmation
- Finance-wallet USD₮0 allowance and balance checks
- Exact remaining-amount `approve` transaction preparation
- Exact remaining-amount `fundPayroll` transaction preparation
- `PayrollFundingOpened`, `Approval`, `PayrollFunded` and `PayrollActivated` verification
- Local activation, withdrawal-deadline and settlement-deadline tracking
- Employee-only withdrawal context and authorization digest generation
- Exact EIP-191 withdrawal signature verification
- Employee signature normalization for the Go TEE engine
- Encrypted private-withdrawal payload creation
- Backend-relayer `requestPrivateWithdrawal` submission with the FCC fee
- Resume-safe request transaction storage before receipt waiting
- Withdrawal instruction, selected TEE and signer-epoch verification
- Withdrawal ActionResult decoding and binding verification
- Success, signed-failure and stale-request finalization
- Private-ledger root, nullifier and public settlement verification
- Same-nonce retry after a failed or expired private request

## Added in Milestone 5

- Encrypted email-delivery logs, templates, preferences, retries and manual retry API
- Institution, role, employee, payroll, funding, withdrawal and failure notifications
- In-app notification inbox and unread-count API
- Weekly, biweekly, monthly and quarterly payroll schedules
- IANA timezone and month-end anchor support
- Funding and withdrawal deadline reminders
- Append-only audit events and CSV export
- Aggregate payroll JSON/CSV reports without plaintext salary rows
- Celery Beat operational schedules
- Production Docker, Gunicorn, PostgreSQL and Redis configuration
- Readiness checks, request IDs, security checks and structured logs

Recurring schedules create a fresh empty payroll shell. HR must upload a new private CSV each period. No previous salary rows or ciphertext are reused.

## Signing boundaries

User wallets sign:

1. institution and role onboarding;
2. payroll draft creation;
3. confidential payroll computation requests;
4. opening payroll funding;
5. USD₮0 approval;
6. exact payroll funding;
7. employee withdrawal authorization.

The backend relayer signs only:

1. private withdrawal instruction submission;
2. signed TEE-result finalization;
3. stale instruction cleanup.

A real relayer private key is never included in a snapshot.

## Proven Coston2 deployment

| Component | Value |
|---|---|
| Chain ID | `114` |
| Vault | `0xA5277D55a46514740b0C716C691d92b8D9E64e5E` |
| Gateway | `0xFE9A84346A614599C9A0b5a1F444bd816a6C100A` |
| USD₮0 | `0xC1A5B41512496B80903D1f32d6dEa3a73212E71F` |
| TEE identity | `0x7748CB088399CB4223375298F7404394A1680D2D` |
| TEE signer epoch | `2` |
| FCC fee | `1,000,000 wei` |

## Windows setup

```powershell
cd C:\Users\cashkink\Downloads\zalary-backend-milestone-5

& C:\Users\cashkink\Downloads\zalary-backend-milestone-1\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

Copy-Item `
    C:\Users\cashkink\Downloads\zalary-backend-milestone-3\.env `
    .\.env `
    -Force

python manage.py migrate
python manage.py seed_coston2
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Expected test count: **44**.

Do not add the relayer key for unit tests.

## Live relayer configuration

Live private-withdrawal submission and automatic FCC finalization require:

```env
ZALARY_RELAYER_PRIVATE_KEY=
```

Configure it only in a local secret file or hosted secret manager. The relayer wallet must hold `RELAYER_ROLE` and enough C2FLR for gas plus the FCC request fee.

## Milestone 4 flow

```text
Computed payroll
  → HR opens funding
  → Finance approves exact remaining USD₮0
  → Finance funds exact remaining USD₮0
  → backend verifies activation
  → employee requests current withdrawal context
  → backend returns root-bound EIP-191 digest
  → employee signs digest
  → backend verifies signer and encrypts payload
  → relayer submits private withdrawal request
  → signed TEE result is polled and verified
  → relayer finalizes success/failure
  → private ledger root and public USD₮0 settlement are reconciled
```

The backend never stores plaintext salary rows or the TEE private ledger.
