# Final Judge Build Status

This package reflects the **current Balary confidential payroll build** after the pre-Confidential-Credits reset and the final FCC/TEE lifecycle fixes completed in August 2026.

## Current submission state

Balary is running as a **Flare Confidential Compute application on Coston2**.

The active architecture uses:

- confidential payroll computation
- encrypted payroll payloads
- Flare Confidential Compute / FCC
- a registered TEE
- a confidential Gateway
- a private payroll Vault
- USD₮0 settlement
- automatic TEE lifecycle reconciliation

The later experimental Confidential Credits / reserve / redemption architecture is **not part of the current judge build**.

## Verified during deployment

- Smart-contract suite: **168 passing**.
- Frontend test suite: **24 passing across 12 test files**.
- Frontend TypeScript validation: **passed**.
- Frontend production build: **passed**.
- Coston2 environment validation passed on chain ID `114`.
- Current Private Payroll Vault:
  `0xBBDDd3fFa53385c4149A0513F1E06FF36BC85020`
- Current Confidential Gateway:
  `0xf69CaAF395af6A7DeCB0ac2f86430E6c889A8216`
- Settlement token USD₮0:
  `0xC1A5B41512496B80903D1f32d6dEa3a73212E71F`
- USD₮0 decimals: `6`
- FCC extension registered: `66209` (`0x102a1`).
- Active simulated TEE:
  `0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0`
- FCC registry `teeProxyId`:
  `0xFf92e0231756Ee0444694C80F459Bf69e5beCe6D`
- Gateway ActionResult signer:
  `0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0`
- Gateway signer epoch: `2`
- Gateway active: `true`
- Flare TEE manager:
  `0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE`
- FCC proxy:
  `https://payroll-fcc.balary.lol`
- Public API:
  `https://zalary-api.104.237.9.230.sslip.io/api/v1`
- Frontend:
  `https://balary.lol`

## Important signer correction

The working FCC integration distinguishes between the FCC registry `teeProxyId` and the signer of the FCC `ActionResult`.

The registry currently reports:

```text
TEE:
0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0

teeProxyId:
0xFf92e0231756Ee0444694C80F459Bf69e5beCe6D
```

However, the recovered signer of `ActionResult.signature` is:

```text
0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0
```

Therefore:

```text
teeProxyId != ActionResult signer
```

The Gateway is currently reconciled to:

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

This distinction is enforced by the automatic TEE lifecycle controller.

## FCC / TEE lifecycle verification

Automatic lifecycle reconciliation is enabled and runs continuously.

The lifecycle controller:

1. discovers the live registered TEE
2. validates the FCC registry state
3. reads the registry `teeProxyId`
4. derives the expected ActionResult signer from the TEE identity
5. compares the live Gateway signer
6. compares signer epoch state
7. reconciles the Gateway when required
8. fails closed when the FCC state is ambiguous

A successful reconciliation reports:

```text
Live TEE: 0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0
FCC teeProxyId: 0xFf92e0231756Ee0444694C80F459Bf69e5beCe6D
ActionResult signer: 0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0
Gateway signer: 0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0
Gateway epoch: 2
Gateway active: True
TEE lifecycle already reconciled
```

## Confidential encryptor verification

The backend uses the configured confidential payload encryptor:

```text
/usr/local/bin/zalary-encrypt
```

The runtime environment points to:

```env
ZALARY_ENCRYPTOR_COMMAND=/usr/local/bin/zalary-encrypt
```

The encryptor was manually tested against:

```text
FCC proxy:
https://payroll-fcc.balary.lol

TEE:
0x144C0FFbF98C5029E94DA4F75F27f325d2BA1BB0
```

and returned a valid encrypted ciphertext payload.

## End-to-end flow verification

The working flow has been verified through:

- institution registration
- employee creation
- payroll validation
- confidential payroll encryption
- on-chain payroll draft creation
- FCC computation request
- TEE processing
- ActionResult verification
- signer validation
- payroll progression
- Finance funding
- employee withdrawal authorization
- withdrawal settlement

The final working flow confirms that the confidential-compute path is not just mocked in the UI. The application integrates the encrypted instruction, FCC request, registered TEE, signed result, Gateway verification and on-chain settlement workflow.

## Simulated TEE mode

The current hackathon deployment uses the Flare extension scaffold in:

```env
MODE=1
SIMULATED_TEE=true
```

This is intentional for the hackathon environment.

The submission does **not** claim hardware-backed production-enclave guarantees for this deployment.

Instead, it demonstrates the complete application architecture and trust model:

- encrypted instruction generation
- FCC request submission
- TEE execution boundary
- signed ActionResult production
- signer verification
- signer epoch management
- fail-closed lifecycle reconciliation
- on-chain payroll settlement

## Backend verification

- Backend migrations: no pending migrations.
- Public health endpoint returns HTTP `200`.
- Public readiness endpoint returns HTTP `200`.
- Readiness checks include:
  - database
  - field encryption
  - Redis
  - FCC configuration
  - Celery worker
- Automatic TEE lifecycle service is active.
- Django, Celery, Redis and Postgres are containerized.
- Confidential encryptor is mounted into the required backend containers.

Health endpoints:

```text
GET https://zalary-api.104.237.9.230.sslip.io/api/v1/health/
GET https://zalary-api.104.237.9.230.sslip.io/api/v1/health/ready/
```

## Frontend verification

Recent frontend validation:

```text
Test Files: 12 passed
Tests:      24 passed
Typecheck:  passed
Build:      passed
```

The frontend includes:

- Balary product branding
- institution registration refresh improvements
- animated transaction buttons during processing
- clearer transaction-state feedback
- responsive layouts
- withdrawal activity/action presentation
- profile placeholder cleanup

The frontend dependency tree is intentionally not committed. Vercel installs dependencies from `package-lock.json` during deployment.

## VPS resilience checks

The live VPS includes safeguards intended to keep the hackathon demo stable:

- Docker log rotation
- build-cache cleanup
- bounded journal size
- hourly disk guard
- daily safe maintenance
- persistent database volumes
- persistent TEE state
- Docker live restore

Current Docker logging configuration:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5"
  },
  "live-restore": true
}
```

## Packaging checks

The final package is intended to exclude:

- private keys
- production `.env` files
- database dumps
- TEE state keys
- signing secrets
- TLS private keys
- Confidential Credits modules
- reserve contracts
- redemption flows
- credit-specific workers
- credit-specific APIs
- credit UI

Public Coston2 addresses and identifiers are included because they are required for reproducibility and judge verification.

## Active architecture only

This submission intentionally uses the clean pre-Confidential-Credits architecture:

```text
Encrypted payroll inputs
        ↓
Flare Confidential Compute
        ↓
Trusted Execution Environment
        ↓
Signed ActionResult
        ↓
Confidential Gateway
        ↓
Private Payroll Vault
        ↓
USD₮0 settlement on Coston2
```

This is the architecture judges should evaluate.

## Final judge summary

Balary is not presented as a normal payroll dApp.

It is a **Confidential Compute application** where payroll is the real-world use case demonstrating:

- sensitive private inputs
- TEE-based confidential execution
- signed off-chain results
- on-chain verification
- signer lifecycle enforcement
- public settlement
- explicit trust assumptions
- production-style operational resilience

The current judge build is intended to demonstrate the complete path from encrypted private input to verifiable on-chain settlement.
