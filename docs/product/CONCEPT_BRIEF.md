# Balary concept brief

## Product thesis

Institutions should be able to settle payroll with public USDM without publishing employee salaries and relationships. Balary creates a shielded execution layer backed 1:1 by USDM and enforces institutional separation of duties.

## Users and pain

- **Institutions:** need stablecoin settlement, payroll confidentiality, bounded authority, and recoverable unclaimed allocations.
- **HR:** needs to approve exact private salary instructions without moving money.
- **Finance:** needs to fund approved instructions without gaining salary-setting power.
- **Employees:** need to claim only their own entitlement without a public salary map.

Public transfers expose workforce financial data. A single privileged wallet also fails ordinary internal-control expectations.

## Promise and workflow

Public USDM is locked ? equal shielded zUSDM is minted ? HR approves blinded intent ? Finance funds exact intent ? employee proves entitlement ? employee may burn zUSDM for equal public USDM.

The anchor is `locked USDM = outstanding redeemable zUSDM`. zUSDM is not an independent stablecoin, oracle product, AMM asset, or swap dependency.

## Why Midnight, USDM, and zUSDM

Midnight supplies shielded asset operations and zero-knowledge enforcement for private inputs. USDM remains the public entry/exit asset. zUSDM exists only to make payroll value shielded while retaining direct reserve accounting.

## Differentiation

Balary combines shielded payments with HR/Finance separation, secret-derived authority, randomized salary commitments, Merkle entitlement proofs, nullifiers, immutable active-run configuration, and explicit public settlement.

## Non-goals

The current protocol is not a bank, independent currency, exchange, oracle, institution registry, payroll UI, custody product, mainnet deployment, or audited production system.

## Proof and limitations

Preview proves deposit, mint, HR approval, Finance funding, claim, redemption, and the final invariant. Local integration additionally proves separate employer/employee wallets. The final Preview claim shared one wallet due to tDUST timing. Provers may observe witnesses; counts leak metadata; redemption is public; no external audit exists.

## Near-term roadmap

Separate-wallet Preview proof, sponsored fees, institution onboarding, dashboards, batch payroll, metadata hardening, security review, and a mainnet path.
