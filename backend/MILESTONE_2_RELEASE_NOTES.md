# Milestone 2 Release Notes

## Scope

This snapshot extends the verified Milestone 1 onboarding backend with private employee records, confidential payroll intake and the official Go ECIES encryption bridge.

## Expected verification

```powershell
python manage.py migrate
python manage.py seed_coston2
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Expected test discovery: 14 tests.

The two FCC encryption tests mock process execution. They verify command wiring, ciphertext hashing and safe TEE-identity error handling without transmitting payroll data.

## Live encryption prerequisite

The real `/payrolls/{id}/encrypt/` endpoint requires the already-built helper:

```text
C:\Users\cashkink\extension-examples\extension-scaffold\go\bin\zalary-encrypt.exe
```

The confidential engine and proxy must be running. The helper itself checks that `/info` resolves to the configured TEE identity before encrypting.
