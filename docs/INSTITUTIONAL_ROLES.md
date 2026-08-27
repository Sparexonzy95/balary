# Institutional Roles

Balary separates payroll responsibilities so that one institutional actor does not control the entire payroll lifecycle.

## Roles

### Institution Admin

The Admin controls institutional authority and emergency governance actions.

Responsibilities:

- rotate Admin, HR, and Finance authority commitments
- cancel a payroll only while it is still in `FUNDING`
- preserve institutional continuity through role rotation

The Admin does not approve employee salary amounts and does not fund salary allocations.

### HR

HR prepares and approves private salary instructions.

Responsibilities:

- approve the employee entitlement for a payroll run
- bind the employee key to an exact salary amount
- bind the approval to an allocation identifier and private blinding data

HR cannot move zUSDM from institutional funds and cannot fund a payroll allocation.

### Finance

Finance executes approved payroll funding and recovery operations.

Responsibilities:

- fund only salary instructions already approved by HR
- fund the exact amount approved by HR
- recover still-unclaimed funds after cancellation or expiry when allowed by payroll state

Finance cannot invent a new salary instruction or alter an HR-approved salary amount.

### Employee

Employees privately claim only their own funded entitlement.

Responsibilities:

- prove knowledge of the employee secret bound to the allocation
- prove Merkle membership of the funded allocation
- claim the exact shielded zUSDM salary coin

A claim nullifier prevents a second claim of the same entitlement.

## Separation of duties

The intended institutional flow is:

```text
Institution Admin
      |
      +---- manages role authority and pre-activation cancellation

HR
      |
      +---- privately approves salary instruction
                       |
                       v
Finance
      |
      +---- funds only the exact HR-approved instruction
                       |
                       v
Balary Payroll Vault
      |
      +---- employee privately proves entitlement
                       |
                       v
Employee receives shielded zUSDM
```

This separation prevents a Finance actor from creating or changing salaries and prevents HR from directly moving payroll funds.

## Authority model

Role secrets are never stored directly in ledger state. Each role is represented by a public commitment derived from a private secret using a domain-separated hash.

Conceptually:

```text
adminAuthority   = H("balary:institution:admin:v1", adminSecret)
hrAuthority      = H("balary:institution:hr:v1", hrSecret)
financeAuthority = H("balary:institution:finance:v1", financeSecret)
```

Privileged circuits recompute the corresponding authority commitment from the private role secret and compare it with the stored authority.

`ownPublicKey()` is not used as role authentication. It is used only as a shielded payment destination after authorization and private-claim checks succeed.

## Role rotation

The Admin can rotate Admin, HR, or Finance authority commitments. Rotation changes the authorized role secret without changing already-approved or already-funded payroll commitments.

Recovery nullifiers are intentionally independent of the current Finance secret so that rotating the Finance role cannot create a second recovery identity for the same salary coin.
