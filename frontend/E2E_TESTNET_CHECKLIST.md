# Zalary Flare Coston2 E2E Checklist

Use this checklist for manual browser-based testing of the converted frontend in `balary_frontend_from_zalary/`.

## Local Services

Open separate terminals.

### Redis

Redis is required because Celery uses `REDIS_URL`, defaulting to `redis://localhost:6379/0`.

```powershell
docker run --rm --name balary-redis -p 6379:6379 redis:7
```

If Redis is installed locally instead:

```powershell
redis-server
```

### Django Backend

```powershell
cd C:\Users\cashkink\Downloads\balary-payroll-hardhat\balary-payroll-hardhat\balary_backend
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

For browser calls from Vite, the backend environment must allow:

```text
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

### Celery Worker

On Windows, use the solo pool:

```powershell
cd C:\Users\cashkink\Downloads\balary-payroll-hardhat\balary-payroll-hardhat\balary_backend
celery -A config.celery worker -l info -P solo
```

### Converted Frontend

```powershell
cd C:\Users\cashkink\Downloads\balary-payroll-hardhat\balary_frontend_from_zalary
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Open:

```text
http://localhost:5173/
```

The frontend public config should resolve to:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000/api
VITE_ARC_CHAIN_ID=5042002
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_BALARY_PAYROLL_MANAGER=0xf094973c311E528de529b74BDD94A3c755499FB9
VITE_ARC_USDC_TOKEN=0x3600000000000000000000000000000000000000
```

## Flow A - Institution Admin

1. Open `http://localhost:5173/`.
2. Click `Open app`, then connect the institution admin wallet.
3. Confirm the wallet switches to or adds Flare Coston2:
   - Chain ID `5042002`
   - RPC `https://rpc.testnet.arc.network`
   - Native gas token `USDC`
4. Sign the Zalary login nonce.
5. Open `Institution` or `Register institution`.
6. Enter institution name, treasury wallet, and tax vault wallet.
7. Click `Register with wallet`.
8. Confirm the wallet submits `registerMyInstitution`.
9. Confirm the UI submits the registration transaction hash to Django.
10. Confirm the institution appears as pending before backend receipt confirmation.
11. Run or wait for backend receipt sync.
12. Confirm the UI shows registered/confirmed only after backend confirmation.
13. Open `Roles`.
14. Assign the HR wallet and submit the backend-prepared role transaction.
15. Confirm the HR role is pending, then active after backend confirmation.
16. Assign the Finance wallet and repeat the same pending-to-active confirmation.

## Flow B - HR

1. Log out, then login as the HR wallet.
2. Open `HR`.
3. Click `New payroll`.
4. Create a payroll draft with title, period label, and claim deadline.
5. Open the payroll detail page.
6. Paste valid CSV with:
   - `employee_name`
   - `employee_email`
   - `employee_address`
   - `net_amount`
   - `tax_amount`
7. Click `Upload rows`.
8. Click `Validate CSV`.
9. Paste invalid CSV and confirm row errors display.
10. Confirm `Build root package` is disabled until backend has `onchain_payroll_id`.
11. Click `Create draft on-chain`.
12. Confirm the wallet submits `createPayrollDraftAuto`.
13. Confirm the UI submits the transaction hash to Django.
14. Wait for backend receipt/event validation to populate the on-chain payroll id.
15. Confirm `Build root package` becomes enabled after `onchain_payroll_id` appears.
16. Click `Build root package`.
17. Click `Upload package`.
18. Confirm the wallet submits `uploadPayroll`.
19. Wait for backend confirmation.
20. Click `Mark funding ready`.
21. Confirm the wallet submits `activatePayrollForFunding`.
22. Confirm the UI shows `funding_ready` only after backend confirmation.

## Flow C - Finance

1. Log out, then login as the Finance wallet.
2. Open `Finance`.
3. Open a payroll run with status `funding_ready`.
4. Confirm the amount required equals the payroll gross total.
5. Click `Fund payroll`.
6. If prompted, approve Coston2 USD₮0 for the Zalary manager.
7. Confirm the wallet submits `fundPayroll`.
8. Confirm the UI submits only the funding transaction hash to Django for the payroll run.
9. Confirm the UI shows pending after hash submission.
10. Wait for backend receipt/event validation.
11. Confirm the UI shows `active` only after backend confirms the funding event.

## Flow D - Employee

1. Log out, then login as an employee wallet included in the payroll CSV.
2. Open `Claims`.
3. Confirm only that employee wallet's available claim appears.
4. Open the claim detail page.
5. Confirm the frontend fetches the backend claim payload.
6. Click `Claim payment`.
7. Confirm the wallet submits `claimPayment` using the backend payload.
8. Confirm the UI submits the claim transaction hash to Django.
9. Confirm pending state while the backend validates the event.
10. Confirm claimed/finalized state only after backend event validation.

## Flow E - Notifications

1. Login as institution admin and confirm registration/role notifications appear.
2. Login as Finance and confirm funding-ready notifications appear.
3. Login as employee and confirm claim-available notifications appear.
4. Complete a claim and confirm claim-confirmed notification appears after backend validation.
5. Open `Notifications`.
6. Click individual notifications and confirm mark-read works.
7. Click `Mark all read` and confirm unread styling clears.

## Safety Checks During E2E

Confirm the frontend never asks for, displays, or edits private keys.

Confirm the frontend does not:

- Generate final Merkle proofs in the browser.
- Build claim proofs in the browser.
- Let employees edit payment objects.
- Mark payroll `active` immediately after funding hash submission.
- Mark claims `claimed` immediately after claim hash submission.
- Render full payroll payment rows to employee dashboards.

