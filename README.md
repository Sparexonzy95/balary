# Balary

> **Confidential payroll computation powered by Flare Confidential Compute. Private execution inside a TEE, verifiable coordination on Coston2.**

[![Flare](https://img.shields.io/badge/Flare-Coston2-red)](https://flare.network/)
[![Chain ID](https://img.shields.io/badge/Chain%20ID-114-blue)](#live-coston2-deployment)
[![Frontend](https://img.shields.io/badge/App-balary.lol-brightgreen)](https://balary.lol)
[![FCC](https://img.shields.io/badge/Confidential%20Compute-FCC-purple)](#flare-confidential-compute)
[![Contracts](https://img.shields.io/badge/Contracts-168%20tests%20passing-success)](#testing)

---

## Build private applications with Flare Confidential Compute

**Balary is a real-world Confidential Compute application built on Flare.**

Payroll is the first use case.

The underlying problem is broader:

> How can an application process sensitive business data privately while still producing results that smart contracts can verify and consume?

Public blockchains are transparent by design. That is useful for settlement and verification, but it creates a problem for workflows such as payroll where sensitive inputs should not become public state.

Balary solves that by separating:

```text
PRIVATE EXECUTION
        +
PUBLIC VERIFICATION
        +
ON-CHAIN SETTLEMENT
```

Sensitive payroll information is encrypted and sent through **Flare Confidential Compute** to a **Trusted Execution Environment (TEE)**.

The TEE performs confidential computation off-chain and produces a signed result.

Balary then verifies that result against the registered TEE, signer binding and request context before allowing the corresponding payroll workflow to progress on Flare Coston2.

The result is a payroll system where sensitive computation does not need to be exposed publicly while blockchain contracts still control lifecycle, funding and settlement.

---

# Why Confidential Compute?

A conventional smart-contract payroll system risks exposing information such as:

- employee salary amounts
- compensation structure
- internal payroll totals
- recurring payment behavior
- employee-wallet relationships
- treasury activity
- sensitive financial workflows

Simply putting payroll logic inside a smart contract does not solve this problem because smart-contract execution and state are observable.

Balary instead uses Confidential Compute to create a clear privacy boundary.

### Inside the confidential environment

Sensitive payroll computation can happen privately:

```text
Employee payroll inputs
        ↓
Encrypted payload
        ↓
Flare Confidential Compute
        ↓
Trusted Execution Environment
        ↓
Private payroll computation
```

### On-chain

Flare Coston2 remains responsible for:

```text
Institution registration
Role authorization
Payroll lifecycle
TEE request binding
Funding custody
Replay protection
Withdrawal settlement
Transaction verification
```

This gives Balary the properties we wanted:

- **private inputs**
- **confidential execution**
- **verifiable outputs**
- **on-chain settlement**
- **wallet-controlled user authorization**

---

# Flare Confidential Compute

Balary integrates the **Flare Compute Extension / Confidential Compute path** through a registered TEE and FCC proxy.

The application does not simply call an off-chain server and trust the response.

The confidential workflow binds computation to:

- the FCC request
- the selected TEE
- the expected ActionResult signer
- the current signer epoch
- the corresponding on-chain payroll state

A simplified flow looks like this:

```text
┌───────────────────────────────┐
│        Balary Frontend        │
│     React + Vite + Viem       │
└───────────────┬───────────────┘
                │
                │ wallet-signed transaction
                ▼
┌───────────────────────────────┐
│          Django API           │
│ auth / workflow / tx prepare  │
└───────────────┬───────────────┘
                │
                │ encrypted instruction
                ▼
┌───────────────────────────────┐
│      Flare FCC Extension      │
│      Extension ID 66209       │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│              TEE              │
│                               │
│  private payroll computation  │
│  protected execution state    │
│  signed ActionResult          │
└───────────────┬───────────────┘
                │
                │ signed result
                ▼
┌───────────────────────────────┐
│    Confidential Gateway       │
│                               │
│ TEE binding                   │
│ signer validation             │
│ epoch validation              │
│ replay protection             │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│   Private Payroll Vault       │
│                               │
│ lifecycle                     │
│ funding                       │
│ employee settlement           │
└───────────────────────────────┘
```

---

# What runs privately inside the TEE?

The confidential execution layer handles sensitive payroll computation rather than requiring those inputs to become ordinary public contract state.

The TEE path is responsible for confidential operations such as:

- processing encrypted payroll payloads
- validating confidential payroll instructions
- calculating private employee payroll allocations
- maintaining protected computation state
- producing signed computation results
- authorizing confidential payroll state transitions

Only the information required for the on-chain workflow is returned to the public blockchain layer.

---

# What is verified on-chain?

The public contracts do not need access to the original confidential payroll input.

Instead, Balary verifies the result and controls the corresponding public workflow.

On-chain state covers:

- institution registration
- HR and Finance authorization
- payroll creation
- computation request state
- FCC request binding
- funding windows
- USD₮0 custody
- withdrawal eligibility
- replay protection
- final settlement

This is the core design principle of Balary:

> **Sensitive computation remains private while settlement remains verifiable.**

---

# Judge quick start

If you are reviewing Balary for the Flare Confidential Compute bounty, start here:

| Resource | Location |
|---|---|
| Live application | https://balary.lol |
| Frontend | `frontend/` |
| Backend API | `backend/` |
| Smart contracts | `contracts/` |
| FCC / TEE engine | `confidential-engine/` |
| Architecture | `docs/ARCHITECTURE.md` |
| Judge walkthrough | `docs/JUDGE_GUIDE.md` |
| Deployment | `docs/DEPLOYMENT.md` |
| TEE lifecycle | `docs/TEE_LIFECYCLE.md` |
| Security & privacy | `docs/SECURITY_AND_PRIVACY.md` |

---

# Live Coston2 deployment

Balary currently runs on **Flare Testnet Coston2**.

| Component | Current value |
|---|---|
| Network | Flare Testnet Coston2 |
| Chain ID | `114` |
| RPC | `https://coston2-api.flare.network/ext/C/rpc` |
| Explorer | `https://coston2-explorer.flare.network` |
| Stablecoin | USD₮0 |
| USD₮0 address | `0xC1A5B41512496B80903D1f32d6dEa3a73212E71F` |
| USD₮0 decimals | `6` |
| Private Payroll Vault | `0xBBDDd3fFa53385c4149A0513F1E06FF36BC85020` |
| Confidential Gateway | `0xf69CaAF395af6A7DeCB0ac2f86430E6c889A8216` |
| Flare TEE Manager | `0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE` |
| FCC Extension ID | `66209` |
| FCC Extension ID hex | `0x102a1` |
| Active TEE ID | `0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0` |
| FCC registry `teeProxyId` | `0xFf92e0231756Ee0444694C80F459Bf69e5beCe6D` |
| Gateway ActionResult signer | `0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0` |
| Gateway signer epoch | `2` |
| Gateway active | `true` |
| FCC proxy | `https://payroll-fcc.balary.lol` |
| Public API | `https://zalary-api.104.237.9.230.sslip.io/api/v1` |
| Frontend | `https://balary.lol` |

---

# Important signer distinction

One of the most important integration details in Balary is the distinction between the registered FCC proxy metadata and the signer of the confidential result.

The FCC machine registry currently reports:

```text
TEE:
0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0

teeProxyId:
0xFf92e0231756Ee0444694C80F459Bf69e5beCe6D
```

However:

```text
ActionResult.signature signer:
0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0
```

Therefore:

```text
teeProxyId != ActionResult signer
```

The `teeProxyId` is registry/proxy metadata.

The **TEE machine identity itself signs the FCC ActionResult** used by the current Balary payroll integration.

The Gateway is therefore currently bound to:

```text
TEE:
0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0

Signer:
0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0

Epoch:
2

Active:
true
```

This distinction is enforced by Balary's automatic TEE lifecycle reconciliation.

---

# Self-healing TEE lifecycle

TEE authorization should not depend on an operator remembering to manually synchronize addresses after a TEE change.

Balary includes an automatic lifecycle controller:

```text
backend/apps/fcc/management/commands/reconcile_tee_lifecycle.py
```

A dedicated Docker service runs reconciliation every 60 seconds.

It:

1. discovers the live registered TEE
2. validates the machine registration
3. checks the current Gateway TEE
4. checks the expected ActionResult signer
5. checks signer epoch state
6. proposes/activates the correct binding when needed
7. fails closed when FCC state is ambiguous

The current reconciled state is:

```text
Live TEE:
0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0

FCC teeProxyId:
0xFf92e0231756Ee0444694C80F459Bf69e5beCe6D

ActionResult signer:
0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0

Gateway signer:
0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0

Gateway epoch:
2

Gateway active:
true
```

This allows the confidential infrastructure to recover from legitimate signer lifecycle changes without weakening request validation.

---

# Hackathon TEE mode and trust assumptions

The current hackathon deployment uses the Flare extension scaffold in:

```env
MODE=1
SIMULATED_TEE=true
```

This is intentional for the hackathon environment.

Balary therefore does **not** claim that this deployment provides the same hardware-backed guarantees as a production enclave deployment.

Instead, this submission demonstrates the complete application architecture and integration model:

- encrypted instruction generation
- FCC request submission
- TEE execution boundary
- registered-machine discovery
- signed ActionResult production
- signer verification
- signer epoch management
- fail-closed lifecycle enforcement
- on-chain payroll settlement

A production deployment can replace the simulated machine with the appropriate hardware-backed TEE environment without changing the high-level payroll architecture.

This trust assumption is explicit rather than hidden.

---

# End-to-end payroll flow

## 1. Institution registration

An administrator connects a wallet and registers an institution.

The vault records the institution and its authorized operational roles.

## 2. HR prepares payroll

HR:

- creates employee records
- uploads payroll data
- validates the payroll package
- prepares the confidential payload

Sensitive employee information is not intended to become ordinary public contract data.

## 3. Payroll encryption

Before FCC submission, Balary encrypts the payroll payload using the configured confidential-compute encryptor.

The production backend exposes the encryptor internally as:

```text
/usr/local/bin/zalary-encrypt
```

The encryptor targets:

```text
FCC proxy:
https://payroll-fcc.balary.lol

TEE:
0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0
```

## 4. On-chain draft

The user signs the exact backend-prepared payroll transaction.

The frontend does not independently reconstruct confidential transaction calldata when the backend has already prepared the canonical request.

## 5. FCC computation request

The confidential instruction is submitted through the Gateway/FCC integration.

The request is bound to the selected TEE.

## 6. TEE executes sensitive logic

The TEE:

- decrypts the instruction
- performs confidential payroll computation
- updates protected state
- creates the result
- signs the FCC ActionResult

## 7. Result verification

Balary verifies:

- the FCC request
- selected TEE
- ActionResult signature
- signer epoch
- replay status
- workflow state

A mismatched TEE or signer causes the operation to fail closed.

## 8. Finance funding

Finance opens and funds the payroll using USD₮0.

The settlement token is:

```text
0xC1A5B41512496B80903D1f32d6dEa3a73212E71F
```

with 6 decimals.

## 9. Employee withdrawal

An eligible employee requests withdrawal.

Balary creates the server-authorized withdrawal context and the employee signs the required authorization digest.

The confidential workflow authorizes the corresponding transition.

## 10. On-chain settlement

The payroll vault settles the authorized amount on Flare Coston2.

The final token transfer remains publicly verifiable while the sensitive computation that determined the authorization remains within the confidential execution path.

---

# Why payroll is a strong Confidential Compute use case

Payroll combines three properties that make it particularly suitable for confidential execution.

### Sensitive inputs

Salary and employee compensation data should not be globally visible.

### Deterministic business logic

Payroll processing follows clear rules that can be executed inside a controlled confidential environment.

### Verifiable settlement

The final result still benefits from blockchain settlement, auditability and wallet-based authorization.

This creates a natural architecture:

```text
Private data
      ↓
Confidential computation
      ↓
Verified result
      ↓
Public settlement
```

Balary demonstrates this pattern end-to-end.

---

# Privacy boundary

Balary does not claim to make blockchain transactions invisible.

Instead, the privacy boundary is precise.

## Protected by confidential execution

Depending on the workflow, confidential information includes:

- raw payroll payloads
- sensitive employee compensation inputs
- internal confidential computation
- protected TEE state

## Publicly observable

Because Balary settles on a public testnet, the following remain observable:

- contract addresses
- transactions
- institution lifecycle transactions
- payroll lifecycle transitions
- token funding
- final token transfers
- public event data emitted by contracts

The goal is not blanket anonymity.

The goal is:

> **Do not expose sensitive business inputs merely because the workflow needs blockchain verification and settlement.**

---

# Repository structure

```text
ballary/
├── frontend/
├── backend/
├── contracts/
├── confidential-engine/
├── deploy/
└── docs/
```

---

# Intentionally excluded: Confidential Credits

This repository deliberately uses the clean **pre-Confidential-Credits payroll architecture**.

The active hackathon application does not use the later experimental confidential-credit system.

The following are intentionally excluded:

- confidential salary credits
- reserve contracts
- credit issuance
- redemption
- credit finalization
- ledger gateway
- credit-specific workers
- credit APIs
- credit UI

The active architecture is:

```text
Confidential payroll
        ↓
FCC / TEE computation
        ↓
Private Payroll Vault
        ↓
USD₮0 settlement
```

---

# Smart contracts

The primary contract architecture contains:

### `ZalaryPrivatePayrollVault`

Responsible for:

- institutions
- operational roles
- payroll lifecycle
- funding
- USD₮0 custody
- employee settlement

### `ZalaryConfidentialGateway`

Responsible for:

- FCC request handling
- selected TEE validation
- ActionResult signer validation
- signer epoch validation
- replay protection
- communication with the payroll vault

Some Solidity class names intentionally retain the historical `Zalary` prefix because they are deployed/source identifiers.

The product name is **Balary**.

---

# Signer rotation

For hackathon operation:

```solidity
TEE_SIGNER_ROTATION_DELAY = 0;
```

This removes the waiting period for legitimate TEE signer lifecycle changes.

It does **not** remove separate payroll safety controls.

Funding and withdrawal safety windows remain independent.

---

# Testing

The smart-contract suite has reached:

```text
168 passing
```

Recent frontend validation:

```text
Test Files: 12 passed
Tests:      24 passed
Typecheck:  passed
Build:      passed
```

---

# Frontend

Production:

```text
https://balary.lol
```

Important public configuration:

```env
VITE_APP_NAME=Balary
VITE_API_BASE_URL=https://zalary-api.104.237.9.230.sslip.io/api/v1
VITE_COSTON2_CHAIN_ID=114
VITE_COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
VITE_COSTON2_EXPLORER_URL=https://coston2-explorer.flare.network
VITE_COSTON2_NATIVE_SYMBOL=C2FLR
VITE_ZALARY_VAULT=0xBBDDd3fFa53385c4149A0513F1E06FF36BC85020
VITE_ZALARY_GATEWAY=0xf69CaAF395af6A7DeCB0ac2f86430E6c889A8216
VITE_ZALARY_USDT0_TOKEN=0xC1A5B41512496B80903D1f32d6dEa3a73212E71F
VITE_ZALARY_USDT0_DECIMALS=6
```

Build:

```bash
cd frontend
npm ci
npm run typecheck
npm test
npm run build
```

---

# Backend

The backend uses:

- Django REST Framework
- PostgreSQL
- Redis
- Celery Worker
- Celery Beat
- FCC integration
- TEE lifecycle reconciliation

Production:

```bash
cd backend

docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.lifecycle.yml \
  up -d --build
```

Health:

```text
GET /api/v1/health/
GET /api/v1/health/ready/
```

Current public API:

```text
https://zalary-api.104.237.9.230.sslip.io/api/v1
```

---

# Confidential encryptor

Balary encrypts payroll payloads before FCC processing.

The backend runtime mounts the confidential-payload encryptor at:

```text
/usr/local/bin/zalary-encrypt
```

The runtime configuration points to:

```env
ZALARY_ENCRYPTOR_COMMAND=/usr/local/bin/zalary-encrypt
```

---

# Automatic TEE lifecycle service

The production stack includes:

```text
tee-lifecycle
```

which periodically executes:

```bash
python manage.py reconcile_tee_lifecycle
```

The current loop runs approximately every 60 seconds.

---

# Security properties

Balary's design deliberately separates responsibilities.

### Browser

Can:

- authenticate wallet ownership
- sign prepared transactions
- display workflow state

Cannot:

- sign TEE ActionResults
- forge registered-machine identity
- directly access backend private keys

### Backend

Can:

- authenticate users
- prepare transaction payloads
- orchestrate workflows
- encrypt confidential payloads

Cannot legitimately bypass:

- contract authorization
- registered TEE signer verification
- Gateway replay protection

### TEE

Can:

- process protected payroll inputs
- produce the expected confidential result signature

### Smart contracts

Enforce:

- institution authorization
- payroll state
- TEE binding
- signer epoch
- replay protection
- funding custody
- settlement

---

# Failure model

Balary favors failing closed for confidential authorization.

```text
Wrong selected TEE
→ reject

Wrong ActionResult signer
→ reject

Wrong signer epoch
→ reject

Already-consumed request
→ reject

Unauthorized institution role
→ reject

Ambiguous lifecycle state
→ do not silently authorize
```

---

# Trust assumptions

Balary's current hackathon trust model includes:

- trust in the Flare Coston2 network for blockchain consensus
- trust in the configured FCC infrastructure
- trust in the registered TEE execution boundary
- trust in simulated TEE mode for this hackathon demonstration
- trust in the backend for orchestration, while contracts remain responsible for critical on-chain authorization and settlement
- trust in administrators holding authorized institutional wallets

These assumptions are documented explicitly.

---

# Why this submission fits the Flare Confidential Compute bounty

Balary directly addresses the central challenge of the bounty:

> **Run sensitive logic privately off-chain while connecting verified results back into on-chain workflows.**

Balary demonstrates:

### Sensitive private inputs

Payroll and employee compensation information.

### Private execution

Sensitive computation runs through the FCC / TEE path.

### Signed confidential output

The TEE produces the ActionResult required by the confidential workflow.

### On-chain verification

The Gateway validates TEE identity, signer and signer epoch.

### On-chain consumption

Verified results affect payroll lifecycle and employee settlement.

### Real user experience

Users interact through:

- institution registration
- HR payroll creation
- Finance funding
- confidential computation
- employee withdrawal
- wallet transactions
- explorer-verifiable Coston2 settlement

This is not a standalone TEE demo.

It is an end-to-end application where **Confidential Compute is necessary to the product's privacy model.**

---

# Future directions

Payroll is the first application.

The same architecture can be extended to other workflows where private inputs must produce blockchain-consumable results, such as:

- confidential treasury policies
- private business-rule execution
- confidential employee benefits
- private scoring
- sealed financial approvals
- TEE-secured agents
- confidential AI-assisted financial workflows

These are future directions, not claims about the current deployed product.

---

# Security and secrets

The repository does not intentionally include:

- production private keys
- `.env` secret files
- database dumps
- TEE state keys
- signing secrets
- TLS private keys

Public Coston2 addresses and identifiers are documented because they are required to reproduce and verify the testnet deployment.

---

# Legacy naming

The product is:

```text
Balary
```

Some internal compatibility identifiers still use:

```text
Zalary
ZALARY_
```

Examples include deployed Solidity class names, backend environment keys, frontend environment variables, and legacy internal module names.

Those names are intentionally preserved where renaming them would break compatibility with the working deployment.

The repository may also retain the historical folder spelling:

```text
ballary
```

The public product brand is **Balary**.

---

# Quick verification

Frontend:

```bash
cd frontend
npm ci
npm run typecheck
npm test
npm run build
```

Contracts:

```bash
cd contracts
npm ci
npm test
```

Backend:

```bash
cd backend
docker compose -f docker-compose.prod.yml -f docker-compose.lifecycle.yml up -d
```

FCC proxy:

```text
https://payroll-fcc.balary.lol
```

Application:

```text
https://balary.lol
```

---

# Closing

Balary explores a simple but important idea:

> **Blockchain applications should not have to expose sensitive inputs just to gain verifiable execution and settlement.**

By combining encrypted payroll inputs, Flare Confidential Compute, TEE execution, signer-bound verification and Coston2 settlement, Balary demonstrates a practical architecture for applications that need both:

**privacy and verifiability.**

That is the problem Balary was built to solve.
