# Pre-deployment commands

From PowerShell in the project directory:

```powershell
npm install
npm run predeploy:local
```

Expected outcome:

- Solidity compilation succeeds with `evm target: cancun`.
- Every test passes.
- No failing or pending tests remain.

Run one component at a time when diagnosing a failure:

```powershell
npm run test:deployment
npm run test:roles
npm run test:lifecycle
npm run test:gateway
npm run test:withdrawals
npm run test:operations
npm run test:invariants
npm run test:abi
npm run test:smoke
```

Validate live Coston2 inputs after the local suite passes:

```powershell
npm run validate:env:coston2
```

Do not deploy if any command fails. Preserve the terminal output as part of the hackathon technical evidence.
