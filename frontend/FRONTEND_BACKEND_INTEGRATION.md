# Zalary Frontend to Milestone 5.2 Integration

## Design boundary

The sample frontend controls the visual layer. Its CSS files, tokens, fonts, spacing, responsive rules, animations, and favicon are unchanged. Integration changes are limited to product wording, data adapters, API hooks, wallet transaction handling, and route behavior.

## Transaction boundary

The frontend never re-encodes a smart-contract call. For institution, payroll, computation, funding, and role operations it submits the exact `to`, `data`, and `value` returned by the backend prepared-transaction endpoint. The connected wallet and chain ID are verified before submission.

## Privacy boundary

Employee records are created through the encrypted employee API. Payroll CSV files sent to `/payrolls/{id}/encrypt/` contain only the backend-required employee reference, authorization wallet, and aggregate atomic values. Private withdrawals use the backend-generated authorization digest and relayer/FCC flow. The frontend does not request or display private ledger balances.

## API base

`http://127.0.0.1:8001/api/v1`

## Network

- Flare Coston2 chain ID: `114`
- Vault: `0xA5277D55a46514740b0C716C691d92b8D9E64e5E`
- Gateway: `0xFE9A84346A614599C9A0b5a1F444bd816a6C100A`
- USD₮0: `0xC1A5B41512496B80903D1f32d6dEa3a73212E71F`
