# Ballary

**Private payroll on Flare Coston2 with confidential computation, on-chain payroll controls, and self-healing TEE authorization.**

Ballary is the hackathon-ready continuation of the pre-confidential-credit Zalary architecture. This repository intentionally **does not use the later Confidential Credits / reserve / redemption layer**. Employers create and fund payrolls, the FCC/TEE path computes private employee allocations, and authorized employees withdraw through the payroll vault.

## Judge quick links

- Frontend: `frontend/`
- Backend API: `backend/`
- Smart contracts: `contracts/`
- FCC / TEE scaffold: `confidential-engine/`
- Architecture: `docs/ARCHITECTURE.md`
- Judge walkthrough: `docs/JUDGE_GUIDE.md`
- Deployment guide: `docs/DEPLOYMENT.md`
- Automatic TEE lifecycle: `docs/TEE_LIFECYCLE.md`
- Security/privacy notes: `docs/SECURITY_AND_PRIVACY.md`

## Live Coston2 deployment

| Component | Value |
|---|---|
| Network | Flare Coston2 |
| Chain ID | `114` |
| Stablecoin | USD₮0, `0xC1A5B41512496B80903D1f32d6dEa3a73212E71F` |
| Private Payroll Vault | `0xBBDDd3fFa53385c4149A0513F1E06FF36BC85020` |
| Confidential Gateway | `0xf69CaAF395af6A7DeCB0ac2f86430E6c889A8216` |
| Flare TEE Manager | `0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE` |
| FCC extension ID | `66209` |
| Active TEE ID | `0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0` |
| TEE proxy signer | `0xFf92e0231756Ee0444694C80F459Bf69e5beCe6D` |
| TEE signer epoch | `1` |
| FCC proxy | `https://payroll-fcc.balary.lol` |
| Public API | `https://zalary-api.104.237.9.230.sslip.io/api/v1` |
| Frontend | `https://balary.lol` |

The current hackathon TEE deployment uses the Flare scaffold's **simulated TEE mode** (`MODE=1`, `SIMULATED_TEE=true`). The code is structured so that the backend verifies the active machine on-chain and fails closed if the FCC state is ambiguous.

## What makes this version different

This repository is deliberately based on the last clean **pre-confidential-credit** architecture. It contains:

- direct confidential payroll allocation
- private payroll vault and confidential gateway
- full-salary withdrawal flow
- FCC/TEE authorization
- a zero-delay TEE signer rotation constant for hackathon operations
- automatic TEE lifecycle reconciliation
- fail-closed single-active-TEE enforcement
- Vercel-ready frontend
- Dockerized Django/Postgres/Redis/Celery backend

It does **not** include:

- confidential salary credits
- reserve contracts
- credit issuance
- redemption/finalization flows
- credit-specific workers or APIs

## Repository structure

```text
ballary/
├── frontend/               React + Vite app, Vercel-ready
├── backend/                Django REST API + Celery
├── contracts/              Hardhat smart contracts and tests
├── confidential-engine/    Flare FCC/TEE extension scaffold
├── deploy/                 deployment notes
└── docs/                   judge, architecture, lifecycle, security docs
```

## Contract tests

The contract suite for this reset was run after removing the signer wait and reached:

```text
168 passing
```

The important no-wait behavior is represented by `TEE_SIGNER_ROTATION_DELAY = 0` in `contracts/ZalaryConfidentialGateway.sol`. Funding and withdrawal safety windows remain separate and were not removed.

## Frontend on Vercel

Import this repository into Vercel and set the project root directory to:

```text
frontend
```

Set the variables from `frontend/.env.production.example`. The important values are:

```env
VITE_APP_NAME=Balary
VITE_API_BASE_URL=https://zalary-api.104.237.9.230.sslip.io/api/v1
VITE_COSTON2_CHAIN_ID=114
VITE_ZALARY_VAULT=0xBBDDd3fFa53385c4149A0513F1E06FF36BC85020
VITE_ZALARY_GATEWAY=0xf69CaAF395af6A7DeCB0ac2f86430E6c889A8216
VITE_ZALARY_USDT0_TOKEN=0xC1A5B41512496B80903D1f32d6dEa3a73212E71F
```

Vercel build command:

```bash
npm run build
```

Output directory:

```text
dist
```

## Backend deployment

Copy `backend/.env.example` to a protected `.env` and provide real secrets. Then:

```bash
cd backend
docker compose -f docker-compose.prod.yml -f docker-compose.lifecycle.yml up -d --build
```

The lifecycle service executes `python manage.py reconcile_tee_lifecycle` every 60 seconds. It discovers the live TEE and the on-chain `teeProxyId` instead of trusting a static signer value.

Health endpoints:

```text
GET /api/v1/health/
GET /api/v1/health/ready/
```

## Smart contract deployment

```bash
cd contracts
cp .env.example .env
npm ci
npm test
npm run deploy:coston2
```

After the FCC extension and TEE are registered, configure the Gateway:

```bash
npx hardhat run scripts/configure-fcc.ts --network coston2
```

The current deployment metadata is also stored in `contracts/deployments/coston2-current.json`.

## Security note

No private keys, production `.env` files, database dumps, or TEE state secrets are included in this repository. All credentials in examples are placeholders. The public values listed above are Coston2 testnet addresses and identifiers.

## Legacy internal naming

A few environment variables and contract class names intentionally retain the `ZALARY_` / `Zalary...` prefix for compatibility with the audited pre-credit code path. The product-facing name in this repository is **Balary**, while the requested repository folder/name is **ballary**.
