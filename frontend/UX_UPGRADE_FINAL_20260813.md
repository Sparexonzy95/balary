# Balary frontend UX upgrade final pass

This source is based on the Codex-modified frontend uploaded on 2026-08-13 and includes the final handoff fixes.

## Final fixes completed

- User-facing Balary branding retained while internal compatibility identifiers remain unchanged.
- Institution registration cache is updated immediately after confirmation and institution queries are invalidated/refetched without a page reload.
- Role access gate keeps loading and access-denied states distinct.
- Transaction sender exposes wallet/network/confirmation phases so transaction buttons can remain visible with useful progress text.
- Funding and claim actions surface the live wallet transaction phase instead of appearing inert while disabled.
- Payroll creation keeps its Create On-chain action visible while processing.
- Withdrawal creation keeps its action visible and reports Preparing, wallet confirmation, and TEE processing phases.
- Withdrawal detail transaction proof now follows Activity / Status / Action for payroll computation, withdrawal request, and final settlement separately.
- Optional account email and display-name rows are omitted when the backend does not provide values. No "not set" or "not provided" placeholders are shown.
- Shared Vitest DOM bootstrap includes matchMedia, ResizeObserver, IntersectionObserver, scrollIntoView, and pointer-capture browser API shims used by responsive/Radix components.
- Existing responsive styles were preserved and audited for the dashboard, profile, payroll, claims, transaction activity, navigation/sidebar, and smaller screen breakpoints.

## Validation

- TypeScript project build/typecheck: PASS (`tsc -b`).
- User-facing placeholder/legacy-brand scan: PASS for `Zalary`, `Email not set/provided`, and `Name not set/provided`.
- Vitest/Vite execution could not be completed in the packaging Linux sandbox because the available dependency tree came from a Windows install and lacks Rollup's Linux optional native package. The project lockfile includes both Windows and Linux Rollup optional packages, so a clean `npm ci` on the target machine/CI restores the correct platform package.

Recommended local verification on Windows before push:

```powershell
Remove-Item node_modules -Recurse -Force
npm ci
npm run typecheck
npm test
npm run build
```
