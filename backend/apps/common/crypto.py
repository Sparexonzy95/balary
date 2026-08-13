from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


class PrivateFieldError(ValueError):
    pass


def _fernet() -> Fernet:
    configured = settings.ZALARY_FIELD_ENCRYPTION_KEY.strip()
    if configured:
        try:
            return Fernet(configured.encode("ascii"))
        except (ValueError, TypeError) as exc:
            raise ImproperlyConfigured("ZALARY_FIELD_ENCRYPTION_KEY is not a valid Fernet key") from exc

    if not settings.DEBUG:
        raise ImproperlyConfigured("ZALARY_FIELD_ENCRYPTION_KEY is required outside DEBUG mode")

    # Development/test fallback only. Production must provide an independent key.
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_private_text(value: str) -> str:
    if not value:
        return ""
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_private_text(value: str) -> str:
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeError) as exc:
        raise PrivateFieldError("Encrypted private field could not be decrypted") from exc


def stable_private_hash(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode("utf-8")).hexdigest()
