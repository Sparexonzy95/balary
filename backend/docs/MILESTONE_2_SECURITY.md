# Milestone 2 Security Notes

## Data stored

- Opaque employee UUID
- Fernet-encrypted employee wallet, name and email
- Stable hash of employee wallet for per-institution uniqueness
- Payroll checksum, canonical payload hash and aggregate totals
- ECIES ciphertext and ciphertext hash
- Public TEE identity and endpoint

## Data not stored

- Uploaded CSV bytes
- Decrypted payroll payload
- Per-employee salary rows
- TEE private state
- Employer, employee or relayer private keys
- Application field-encryption key in source control

## Process boundary

The Django process validates and canonicalizes the payload, then pipes it through standard input to the Go helper. The helper verifies `/info` against the configured TEE identity before encryption. Standard error is reduced to safe application errors; raw helper diagnostics are not returned to API clients.

## Production requirements

- Set a unique `ZALARY_FIELD_ENCRYPTION_KEY` in a secret manager.
- Run encryption work in an isolated worker.
- Disable request-body and subprocess-input logging.
- Use TLS between frontend, backend and any hosted internal services.
- Restrict outbound traffic from the encryption worker to the approved FCC endpoint.
- Rotate the field-encryption key through a controlled migration, never by simply replacing it.
