# Balary Frontend

This frontend keeps the supplied sample frontend visual system unchanged and connects it to the Balary Milestone 5.2 backend.

## Locked design

The original sample CSS, typography, spacing, responsive rules, animations, and favicon are preserved byte-for-byte. No replacement theme or new visual framework was added.

## Integrated backend flows

- Coston2 wallet authentication
- institution registration and role assignment
- encrypted employee records
- private payroll CSV validation and encryption
- backend-prepared Coston2 transactions
- Flare Confidential Compute instructions
- exact USD₮0 approval and payroll funding
- private withdrawal authorization and processing
- notifications, audit events, recurring schedules, and transaction history

## Local configuration

```powershell
Copy-Item .env.example .env
npm ci
npm run verify:integration
npm run typecheck
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 5173
```

Backend API: `http://127.0.0.1:8001/api/v1`

Frontend: `http://127.0.0.1:5173`
