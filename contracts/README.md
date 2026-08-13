# Zalary Confidential Payroll v3

Hardened stablecoin payroll contracts for **Flare Summer Signal, Bounty 2: Confidential Compute Apps**.

## Product flow

1. HR creates a payroll draft with a funding window and minimum employee withdrawal window.
2. HR encrypts the payroll and submits it to the Zalary Flare Compute Extension (FCE).
3. A selected, registered TEE machine computes private balances and returns a signed aggregate result.
4. The gateway verifies the selected machine, signer epoch, extension, request, ciphertext and result lifetime.
5. Finance funds the vault with the configured stablecoin.
6. Employees submit encrypted withdrawal intents through an approved Zalary relayer.
7. The TEE privately checks the employee balance and signs a state transition.
8. The vault executes the transfer and updates the private-ledger root.

Employee rows, salary calculations, deductions, tax details and remaining balances are not stored in the Solidity contracts.

## Contracts

- `ZalaryPrivatePayrollVault.sol`: stablecoin custody, company roles, deadlines, tax payout, pending-request tracking and TEE-approved withdrawals.
- `ZalaryConfidentialGateway.sol`: FCE instruction submission, machine-specific signer binding, signed success/failure verification and replay protection.

## Major v3 security changes

- Only approved `RELAYER_ROLE` accounts may submit encrypted withdrawal requests.
- Withdrawal requests expire after 15 minutes, not 24 hours.
- TEE-signed failure responses close requests immediately.
- Every request is bound to a selected TEE machine, extension ID, signer and signer epoch.
- TEE signer rotation is time-delayed; emergency revocation is immediate.
- Funding has a separate deadline.
- Employee withdrawal time starts at activation, not draft creation.
- A settlement grace period protects requests submitted before the cutoff.
- Payroll closure is blocked while a withdrawal request is pending.
- Vault pauses extend payroll deadlines; approved withdrawals and cleanup remain available.
- The final institution admin cannot be removed.
- Institution-admin recovery is time-delayed.
- Incoming and outgoing stablecoin transfers are checked on both sender and recipient balances.
- Stablecoin surplus rescue cannot touch escrowed payroll funds.
- The extension ID is supplied explicitly and verified instead of discovered through an unbounded scan.

See `docs/REMEDIATION_MATRIX.md` for the audit-by-audit mapping.

## Install and test

```powershell
npm install
Copy-Item .env.example .env
npm run compile
npm test
```

Do not deploy unless compilation and every security test pass locally.

## Coston2 deployment

```powershell
npm run deploy:coston2
```

Register the deployed gateway as the instruction sender for the Zalary FCE. Then add the assigned extension ID, selected TEE machine ID and signer reported by the extension proxy to `.env`.

Run:

```powershell
npm run configure:fcc:coston2
```

The first run proposes the machine-to-signer binding. Run it again after the one-hour security delay to activate the signer.

Finally:

```powershell
npm run verify:setup:coston2
```

## Required deployment controls

Use a multisig for `PROTOCOL_ADMIN`. Keep at least two approved relayers. Verify the TEE machine ID and signer directly from the Flare extension proxy/setup output before proposing the binding.

## Privacy boundary

Flare Confidential Compute protects payroll inputs, calculations, private balances and withdrawal authorization. A normal stablecoin transfer on Coston2 still exposes the transfer amount and destination. The approved relayer removes the public link to the employee's authentication wallet, but it does not make ERC-20 transfers invisible.

## Verification status

The source has been statically reviewed and the test suite has been expanded for the audit findings. Full Hardhat compilation could not be executed in this environment because its internal npm mirror does not contain the required packages. Compile and run the tests locally before deployment.
