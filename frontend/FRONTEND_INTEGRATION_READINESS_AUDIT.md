# Zalary Frontend Integration Readiness Audit

Scope: `balary_frontend_from_zalary/`.

Do not use `zalary-cofhe-frontend/` or `balary_frontend/` for this audit.

## Service Status Observed

| Service | Expected | Observed | Command |
| --- | --- | --- | --- |
| Converted frontend | `http://localhost:5173/` | Listening on `5173` | `npm run dev -- --host 0.0.0.0 --port 5173` |
| Django backend | `http://127.0.0.1:8000/api` | Not listening during audit | `python manage.py runserver 127.0.0.1:8000` |
| Redis | `localhost:6379` | Not listening during audit | `docker run --rm --name balary-redis -p 6379:6379 redis:7` |
| Celery worker | `config.celery` | Not running during audit | `celery -A config.celery worker -l info -P solo` |

## Public Frontend Config

| Config | Expected | Source |
| --- | --- | --- |
| API base | `http://127.0.0.1:8000/api` | `src/lib/env.ts`, `.env.example` |
| Chain ID | `5042002` | `src/lib/env.ts`, `.env.example` |
| RPC | `https://rpc.testnet.arc.network` | `src/lib/env.ts`, `.env.example` |
| Explorer | `https://testnet.arcscan.app` | `src/lib/env.ts`, `.env.example` |
| Manager | `0xf094973c311E528de529b74BDD94A3c755499FB9` | `src/lib/env.ts`, `.env.example` |
| Coston2 USD₮0 | `0x3600000000000000000000000000000000000000` | `src/lib/env.ts`, `.env.example` |

## API Route Alignment

All frontend endpoints are relative to `VITE_API_BASE_URL`, which normalizes to `/api`.

| Frontend file/function | Method | Frontend endpoint | Actual backend route | Auth required | Aligned | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `src/lib/auth.tsx loginWithWallet` | POST | `/auth/nonce/` | `/api/auth/nonce/` | No | Yes | `AllowAny` nonce request |
| `src/lib/auth.tsx loginWithWallet` | POST | `/auth/verify/` | `/api/auth/verify/` | No | Yes | `AllowAny` JWT issue |
| `src/hooks/useArcConfig.ts useArcConfig` | GET | `/chains/arc-testnet/` | `/api/chains/arc-testnet/` | No | Yes | Public chain config |
| `src/hooks/useInstitutions.ts usePrepareRegistration` | POST | `/institutions/prepare-self-registration/` | `/api/institutions/prepare-self-registration/` | Yes | Yes | Backend prepares `registerMyInstitution` |
| `src/hooks/useInstitutions.ts useConfirmRegistration` | POST | `/institutions/confirm-registration-tx/` | `/api/institutions/confirm-registration-tx/` | Yes | Yes | Submits tx hash |
| `src/hooks/useInstitutions.ts useInstitutions` | GET | `/institutions/me/` | `/api/institutions/me/` | Yes | Yes | Scoped to authenticated wallet |
| `src/hooks/useInstitutions.ts usePrepareRole` | POST | `/institutions/:id/roles/hr/prepare/` | `/api/institutions/<int:pk>/roles/hr/prepare/` | Yes | Yes | Admin-only in service |
| `src/hooks/useInstitutions.ts usePrepareRole` | POST | `/institutions/:id/roles/finance/prepare/` | `/api/institutions/<int:pk>/roles/finance/prepare/` | Yes | Yes | Admin-only in service |
| `src/hooks/useInstitutions.ts useConfirmRole` | POST | `/institutions/:id/roles/confirm-tx/` | `/api/institutions/<int:pk>/roles/confirm-tx/` | Yes | Yes | Submits role tx hash |
| `src/hooks/usePayroll.ts usePayrollRuns` | GET | `/payroll-runs/` | `/api/payroll-runs/` | Yes | Yes | Admin/HR/Finance scoped list |
| `src/hooks/usePayroll.ts useCreatePayrollRun` | POST | `/payroll-runs/` | `/api/payroll-runs/` | Yes | Yes | HR-only creation |
| `src/hooks/usePayroll.ts usePayrollRun` | GET | `/payroll-runs/:id/` | `/api/payroll-runs/<int:pk>/` | Yes | Yes | Admin/HR/Finance detail |
| `src/hooks/usePayroll.ts useUploadPayroll` | POST | `/payroll-runs/:id/upload/` | `/api/payroll-runs/<int:pk>/upload/` | Yes | Yes | HR-only CSV upload |
| `src/hooks/usePayroll.ts useValidatePayroll` | POST | `/payroll-runs/:id/validate/` | `/api/payroll-runs/<int:pk>/validate/` | Yes | Yes | Displays latest row errors |
| `src/hooks/usePayroll.ts usePreparePayrollTx("create")` | POST | `/payroll-runs/:id/prepare-create-draft/` | `/api/payroll-runs/<int:pk>/prepare-create-draft/` | Yes | Yes | Backend prepares draft tx |
| `src/hooks/usePayroll.ts useConfirmPayrollTx("create")` | POST | `/payroll-runs/:id/confirm-create-draft-tx/` | `/api/payroll-runs/<int:pk>/confirm-create-draft-tx/` | Yes | Yes | Submits draft tx hash |
| `src/hooks/usePayroll.ts useGeneratePayrollPackage` | POST | `/payroll-runs/:id/generate-merkle/` | `/api/payroll-runs/<int:pk>/generate-merkle/` | Yes | Yes | Backend generates root/proofs |
| `src/hooks/usePayroll.ts usePreparePayrollTx("upload")` | POST | `/payroll-runs/:id/prepare-upload/` | `/api/payroll-runs/<int:pk>/prepare-upload/` | Yes | Yes | Backend prepares root upload |
| `src/hooks/usePayroll.ts useConfirmPayrollTx("upload")` | POST | `/payroll-runs/:id/confirm-upload-tx/` | `/api/payroll-runs/<int:pk>/confirm-upload-tx/` | Yes | Yes | Submits upload tx hash |
| `src/hooks/usePayroll.ts usePreparePayrollTx("activate")` | POST | `/payroll-runs/:id/prepare-activate/` | `/api/payroll-runs/<int:pk>/prepare-activate/` | Yes | Yes | Backend prepares activation |
| `src/hooks/usePayroll.ts useConfirmPayrollTx("activate")` | POST | `/payroll-runs/:id/confirm-activate-tx/` | `/api/payroll-runs/<int:pk>/confirm-activate-tx/` | Yes | Yes | Submits activation tx hash |
| `src/hooks/usePayroll.ts usePreparePayrollTx("fund")` | POST | `/payroll-runs/:id/prepare-fund/` | `/api/payroll-runs/<int:pk>/prepare-fund/` | Yes | Yes | Backend returns approval + funding payloads |
| `src/hooks/usePayroll.ts useConfirmPayrollTx("fund")` | POST | `/payroll-runs/:id/confirm-fund-tx/` | `/api/payroll-runs/<int:pk>/confirm-fund-tx/` | Yes | Yes | Submits funding tx hash |
| `src/hooks/useClaims.ts useAvailableClaims` | GET | `/claims/available/` | `/api/claims/available/` | Yes | Yes | Scoped to employee wallet |
| `src/hooks/useClaims.ts useClaimPayload` | GET | `/claims/:paymentId/payload/` | `/api/claims/<int:payment_id>/payload/` | Yes | Yes | Backend claim payload |
| `src/hooks/useClaims.ts useConfirmClaim` | POST | `/claims/:paymentId/confirm-tx/` | `/api/claims/<int:payment_id>/confirm-tx/` | Yes | Yes | Submits claim tx hash |
| `src/hooks/useNotifications.ts useNotifications` | GET | `/notifications/` | `/api/notifications/` | Yes | Yes | User notifications |
| `src/hooks/useNotifications.ts useMarkNotificationsRead` | POST | `/notifications/:id/read/` | `/api/notifications/<int:pk>/read/` | Yes | Yes | Scoped to user |
| `src/hooks/useNotifications.ts useMarkNotificationsRead` | POST | `/notifications/read-all/` | `/api/notifications/read-all/` | Yes | Yes | Marks all for user |
| `src/hooks/useNotifications.ts useNotificationPreferences` | GET | `/notifications/preferences/` | `/api/notifications/preferences/` | Yes | Yes | Preference read |
| `src/hooks/useNotifications.ts useUpdateNotificationPreferences` | PATCH | `/notifications/preferences/` | `/api/notifications/preferences/` | Yes | Yes | Preference update |
| `src/hooks/useTransactions.ts useTransactions` | GET | `/transactions/` | `/api/transactions/` | Yes | Yes | Sender wallet scoped |
| `src/hooks/useTransactions.ts useTransaction` | GET | `/transactions/:id/` | `/api/transactions/<int:pk>/` | Yes | Yes | Sender wallet scoped |

Endpoint mismatches found: none.

Endpoint-related frontend fixes made during audit:

- Added use of `/payroll-runs/:id/validate/` in the HR payroll detail flow.
- Displayed CSV validation errors from the backend.

## Frontend Safety Checks

| Check | Result | Proof |
| --- | --- | --- |
| Frontend does not generate final Merkle proofs | Pass | No frontend `build_payment_leaf`, `get_merkle_root`, or `get_merkle_proof`; package generation calls `routes.payroll.generateMerkle`. |
| Frontend does not build claim proofs | Pass | Employee claim detail calls `useClaimPayload`, which fetches `/claims/:paymentId/payload/`. |
| Frontend does not let employee edit payment object | Pass | Claim page has no editable payment fields; it signs the backend payload. |
| Frontend does not mark payroll active after tx submission alone | Pass | Finance page renders backend `run.status`; test covers pending funding remaining pending. |
| Frontend does not mark claim claimed after tx submission alone | Pass | Claim confirmation invalidates queries; claimed status comes from backend claim/payroll data. |
| Frontend waits for backend status after tx hash confirmation | Pass | Payroll/claims/transactions queries invalidate and poll after hash submission. |
| Employee pages use claim payload endpoint, not payroll rows | Pass | `ClaimDetailPage` uses `useClaimPayload`; employee claims list uses `/claims/available/`. |
| Payment rows are not rendered to employee dashboards except own claim | Pass | Full payment rows render only in HR payroll detail; employee dashboard renders available claims scoped by backend. |
| Role-protected screens are guarded | Pass | `RoleRoute` gates institution/admin, HR, and Finance routes. |
| Wrong network warning appears | Pass | `NetworkWarning` appears when connected chain is not Flare Coston2. |

