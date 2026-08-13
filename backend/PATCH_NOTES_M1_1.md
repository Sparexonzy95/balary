# Milestone 1.1 patch

Fixes two runtime interface mismatches found by the local Django test suite:

- Maps the API field `nonce` to the wallet-auth service parameter `nonce_value`.
- Supplies an empty default for optional institution `notification_email`.

No database migration is required.
