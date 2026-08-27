# Project Status

## Current implementation

The repository currently contains:

- `MockUSDM.compact` for local development
- `BalaryStablecoinGateway.compact`
- `BalaryPayrollVault.compact`
- institutional Admin, HR, Finance, and Employee role model
- HR-approved blinded salary intents
- Finance funding restricted to exact HR-approved intents
- institutional role rotation
- confidential salary allocation commitments
- claim and recovery nullifiers
- executable protocol model
- 42 passing protocol-model tests
- static contract architecture checks
- Compact compile scripts targeting compiler `0.31.1`
- local Midnight Docker configuration

## Current verification state

Verified in the repository environment:

- protocol model tests pass
- contract static architecture checks pass

Still required on the development machine:

1. Compile `MockUSDM.compact`.
2. Compile `BalaryStablecoinGateway.compact`.
3. Compile `BalaryPayrollVault.compact`.
4. Resolve any compiler errors before treating the Compact source as valid.
5. Deploy MockUSDM and Gateway locally.
6. Verify local unshielded MockUSDM deposit and shielded zUSDM issuance.
7. Validate the Gateway redemption implementation against actual runtime semantics.
8. Deploy a Payroll Vault with Admin, HR, and Finance authorities.
9. HR approves a private salary intent.
10. Finance funds the exact approved salary with zUSDM.
11. Verify mismatched and unapproved Finance funding fails.
12. Claim from an Employee wallet and verify duplicate claim rejection.
13. Test Admin cancellation, Finance recovery, deadline expiry, and role rotation.
14. Move integration testing to Midnight Preview with the actual Preview USDM asset and tDUST-funded wallets.

## Technical gate

The source should not be described as compiler-certified until the installed Midnight Compact compiler accepts all contracts. Compilation is the next hard gate.
