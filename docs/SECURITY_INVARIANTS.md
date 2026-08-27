# Balary Security Invariants

1. **1:1 reserve:** recorded locked USDM equals outstanding zUSDM.
2. **No unbacked mint:** zUSDM is minted only after the configured USDM is received.
3. **Correct public asset:** the Gateway accepts only its immutable configured USDM color.
4. **Correct payroll token:** the Payroll Vault accepts only zUSDM derived from the configured Gateway and Balary token domain.
5. **Institution binding:** every Payroll Vault belongs to one immutable institution identifier and one payroll identifier.
6. **Role-secret confidentiality:** Admin, HR, and Finance secrets are never stored directly in ledger state.
7. **No `ownPublicKey()` role authentication:** institutional authorization is secret-derived; `ownPublicKey()` is used only as a shielded destination after authorization.
8. **Admin separation:** Admin can rotate institutional authority and cancel only a funding payroll, but does not define salary amounts or fund allocations.
9. **HR separation:** HR approves salary instructions but cannot move payroll funds through the Finance funding circuit.
10. **Finance separation:** Finance can fund only exact HR-approved salary instructions and cannot invent or modify a salary.
11. **Approval uniqueness:** the same HR salary-intent commitment cannot be approved twice.
12. **Funding uniqueness:** the same HR-approved salary intent cannot be funded twice.
13. **No partial active payroll:** a payroll becomes `ACTIVE` only when all expected allocations are approved and funded.
14. **Salary confidentiality:** salary amount and employee key are never written directly to ordinary ledger state.
15. **Guess resistance:** salary intents and salary allocations use `persistentCommit` with private blinding randomness.
16. **Claim authorization:** employee secret must derive the employee key embedded in the funded allocation.
17. **Allocation binding:** the claim Merkle path leaf must equal the commitment recomputed from the supplied private allocation data.
18. **Single claim:** a domain-separated claim nullifier cannot be reused.
19. **Coin-level double-spend:** a claimed shielded salary coin is consumed by Zswap and cannot be spent again.
20. **No institution rug after activation:** Admin cancellation is allowed only during `FUNDING`.
21. **Cancelled recovery authorization:** only Finance can recover funded allocations after Admin cancellation.
22. **Expiry recovery only:** active payroll allocations can be recovered only after the claim deadline.
23. **Claimed funds cannot be recovered:** already-spent salary coins fail at the shielded coin layer.
24. **Recovery uniqueness survives Finance rotation:** recovery nullifiers do not depend on the current Finance secret.
25. **Role rotation continuity:** Admin can rotate role authority without rewriting existing salary commitments or funded allocations.
26. **Domain separation:** Admin, HR, Finance, employee identity, claim nullifiers, recovery nullifiers, salary intents, and zUSDM token identity use distinct domains where applicable.
27. **Frozen funded allocation set:** no new salary allocation can be inserted after the payroll leaves `FUNDING`.
28. **Whole salary coins:** claims spend exact dedicated salary coins to avoid shared change accounting and claim contention.
29. **Public exit boundary:** USDM redemption intentionally becomes public when unshielded USDM is released.
30. **Gateway independence:** institutional HR/Admin/Finance roles do not control Gateway minting rules or allow unbacked zUSDM issuance.
