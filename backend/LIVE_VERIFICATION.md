# Zalary Backend Milestone 4.2 — Live Verified

Verification date: 2026-07-31
Network: Flare Coston2
Chain ID: 114

## Deployed Contracts

- Vault: 0xA5277D55a46514740b0C716C691d92b8D9E64e5E
- Gateway: 0xFE9A84346A614599C9A0b5a1F444bd816a6C100A
- USD0: 0xC1A5B41512496B80903D1f32d6dEa3a73212E71F
- Registered TEE: 0x59268355660DCb868507E538b967fc0eB05A394C
- TEE signer epoch: 2

## Live Payroll

- Payroll ID: 44958541763155445
- Employee count: 1
- Payroll total: 2.000000 USD0
- Final payroll status: Active
- On-chain status: 5

## Verified Transactions

### Payroll Draft

- Transaction: 0x5bb0ed5a66acf2c13049a8c9454f610f265319f99a67c0c7e78ae6c1985f24f7
- Block: 33469334
- Event: PayrollDraftCreated

### FCC Payroll Computation Request

- Transaction: 0xf7df4ffa0650d8c4cf40ce911bfa9f7ed789d7dbf926ec5ae94c9182f6577bf4
- Instruction: 0x8efd0838aa2769369c1284a5d57fa9fa99e466851f4cc1cf308c3e28bf7b33f4
- Event: PayrollComputationRequested

### Payroll Computation Finalization

- Transaction: 0x6241312c7eab2b9e736d16f8591c8b9405dca9d30540793a6b5446ecc2050d37
- Block: 33470818
- Event: PayrollComputationFinalized
- Initial private ledger root: 0xf7b4364a866629859d1af31c18c6380344fa99f3054bd6aab21c7d48b644dddf

### Open Funding

- Transaction: 0xed8a81e4b747e79110f292af2e74bba434a6cbd9d577425d2693ee0367eb820a
- Block: 33470948
- Event: PayrollFundingOpened

### USD0 Approval

- Transaction: 0x192fc51f09c2afff280088c48fde3a19cc706ec9b94b23c2c523b0af9ccda3c3
- Block: 33471517
- Approved amount: 2.000000 USD0
- Event: Approval

### Payroll Funding

- Transaction: 0x0dd47c2984950eec9a60b2d7550f9e22e8a3600dd21edee6b102afdeb6ecd2a4
- Block: 33471788
- Funded amount: 2.000000 USD0
- Event: PayrollFunded
- Finance wallet: 9.000000 → 7.000000 USD0
- Vault: 1.000000 → 3.000000 USD0

### Private Withdrawal Request

- Transaction: 0x41e3fcbcc449f5f71a004d4133a6ddaa9a4e4496a8e769a9ccd2e649db989255
- Block: 33472043
- Instruction: 0x2b176e144e8e9ec834daf174ede52fc50ce7d0f0d5b4711b3fee2ff302a6c612
- Event: PrivateWithdrawalRequested

### Private Withdrawal Finalization

- Transaction: 0xa754c0722314798d48d5a650d5328dd774a9cebae30f79f3b58832a63d4561a2
- Block: 33472050
- Amount: 1.000000 USD0
- Nullifier: 0x8443352fa30221c63f7736023e2cbe145f4774cc574c017b4ae96521d4f518da
- New private ledger root: 0x73c594bcf826ccaebecc8a46a97382ed9d44c037e4d3edc2f056ba5b65139327
- Events:
  - PrivateWithdrawalFinalized
  - PrivateWithdrawalExecuted
- Destination wallet: 7.000000 → 8.000000 USD0
- Vault: 3.000000 → 2.000000 USD0

## Security Checks

- Wallet nonce replay blocked
- Employee identity encrypted at rest
- Plaintext payroll CSV not written to disk
- TEE signer recovered and verified
- Withdrawal authorization bound to nonce, amount, destination, expiry and ledger root
- Withdrawal nullifier stored
- Private ledger root updated
- No private key printed
- No private key stored in backend configuration
- No JWT printed
- No employee signature printed

## Regression

- Django system check passed
- Migration drift check passed
- Full backend test suite passed
- No transactions or token movements occurred during regression testing
