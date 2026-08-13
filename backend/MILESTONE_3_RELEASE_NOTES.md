# Milestone 3 Release Notes

Milestone 3 connects the privacy-preserving payroll payload from Milestone 2 to the live Coston2 Vault, Gateway and FCC ActionResult lifecycle.

## Added

- payroll draft preparation and confirmation
- confidential-computation request preparation and confirmation
- FCC instruction database records
- TEE ActionResult signature recovery
- payroll-result ABI validation
- relayer finalization and signed-failure handling
- stale request expiration
- native transaction-value verification
- idempotency-key collision protection

## Safety properties

- no relayer key is packaged
- no payroll plaintext is persisted
- successful TEE results are stored before broadcast so finalization can be resumed
- result finalization uses the original instruction ID, data, submission tag, status and signature
- status-0 results are finalized instead of silently retried
- local state is not advanced from a transaction hash alone

## Expected verification

```text
No changes detected
System check identified no issues
Found 20 test(s)
20 tests pass
```
