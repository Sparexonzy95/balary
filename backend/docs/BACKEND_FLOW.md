# Zalary Backend Flow: Onboarding to Withdrawal

## Milestone 1 — implemented

1. Wallet requests a nonce.
2. Wallet signs a domain-, chain-, nonce- and expiry-bound login message.
3. Backend issues JWT credentials.
4. Institution creates a local profile.
5. Backend prepares `registerMyInstitution(treasury, taxVault)` calldata.
6. User wallet broadcasts on Coston2.
7. Backend confirms the sender, contract, calldata, receipt, expected event and final Vault state.
8. Active Admin repeats the prepare-sign-confirm pattern for Admin, HR and Finance assignments.

## Milestone 2 — payroll intake and encryption

1. HR creates a payroll draft locally.
2. HR uploads a CSV or enters rows.
3. Backend validates addresses, six-decimal USD₮0 amounts, duplicate references and net totals.
4. Backend creates an opaque employee reference for each employee.
5. Canonical payroll JSON is built in memory.
6. Go encryption service fetches `/info`, verifies the TEE identity and ECIES-encrypts the JSON.
7. Plaintext upload and rows are discarded after successful encryption.
8. Backend stores only ciphertext, ciphertext hash, aggregate preview and validation audit metadata.

## Milestone 3 — on-chain payroll and FCC computation

1. HR signs `createPayrollDraft`.
2. Backend verifies `PayrollDraftCreated` and the Vault state.
3. HR signs `requestPayrollComputation` with encrypted bytes.
4. Backend stores the instruction ID and polls the FCC proxy.
5. Backend verifies the TEE action-result signature and signer epoch.
6. Backend relayer simulates and submits `finalizePayrollComputation`.
7. Backend confirms `PayrollComputationFinalized` and Vault status `Computed`.

## Milestone 4 — funding

1. HR signs `openFunding`.
2. Finance signs USD₮0 approval for the exact on-chain `totalRequired`.
3. Finance signs `fundPayroll`.
4. Backend confirms `PayrollActivated` and status `Active`.

## Milestone 5 — private withdrawal

1. Employee signs in with the wallet bound inside the private payroll.
2. Backend reads public withdrawal context and builds the employee authorization digest.
3. Employee signs destination, amount, nonce, current private root and expiry.
4. Backend verifies the employee signature and encrypts the withdrawal payload.
5. Approved relayer calls `requestPrivateWithdrawal`.
6. Backend polls and verifies the TEE authorization result.
7. Relayer simulates and submits `finalizePrivateWithdrawal`.
8. Backend confirms token movement, the nullifier and the new private root.

## Source of truth

The database is a query and orchestration layer. Contract state and confirmed events remain authoritative for registration, roles, payroll status, funding and withdrawal settlement.
