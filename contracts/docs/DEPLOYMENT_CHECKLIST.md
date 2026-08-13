# Coston2 Deployment Checklist

## Before deployment

- [ ] `npm run compile` passes.
- [ ] `npm test` passes.
- [ ] Stablecoin address and decimals are verified.
- [ ] Protocol admin is a multisig or hardened admin wallet.
- [ ] At least two operational relayer wallets are available.
- [ ] Flare extension and machine registry addresses are current.
- [ ] `.env` contains no committed secrets.

## Deploy

1. Deploy `ZalaryPrivatePayrollVault(protocolAdmin, stablecoin, minimumWithdrawalAmount)`.
2. Deploy `ZalaryConfidentialGateway(protocolAdmin, initialRelayer, extensionRegistry, machineRegistry, vault)`.
3. Call `vault.setConfidentialGateway(gateway)` once.
4. Register the gateway as the Zalary FCE instruction sender.
5. Obtain the assigned public extension ID.
6. Call `gateway.setExtensionId(extensionId)`.
7. Read the exact TEE machine ID and signing address from the proxy/setup output.
8. Call `gateway.proposeTeeSigner(teeId, signer)`.
9. After one hour, call `gateway.activateTeeSigner(teeId)`.
10. Grant `RELAYER_ROLE` to a second relayer.
11. Run `verify-setup.ts`.

## Before accepting payroll funds

- [ ] Send a test payroll instruction and finalize it.
- [ ] Send a signed failure result and confirm the request closes.
- [ ] Allow a request to expire and confirm permissionless cleanup works.
- [ ] Fund a small test payroll.
- [ ] Finalize a withdrawal after the withdrawal cutoff but within the grace period.
- [ ] Confirm duplicate nullifier rejection.
- [ ] Confirm old-root rejection.
- [ ] Pause the vault, advance time, unpause and confirm deadlines extended.
- [ ] Verify encrypted FCE snapshot recovery.

## Never do this

- Do not set the TEE signer from an unverified chat message.
- Do not use an EOA with a single private key as permanent protocol admin.
- Do not grant `RELAYER_ROLE` to public users.
- Do not use fee-on-transfer or rebasing tokens.
- Do not deploy while any test is failing.
