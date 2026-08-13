from __future__ import annotations

import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from eth_utils import is_address, to_checksum_address

ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"


class AccountManager(BaseUserManager):
    def create_user(self, wallet_address: str, password=None, **extra_fields):
        if not wallet_address or not is_address(wallet_address):
            raise ValueError("A valid wallet_address is required")
        normalized = to_checksum_address(wallet_address)
        if normalized == ZERO_ADDRESS:
            raise ValueError("The zero address is not allowed")
        account = self.model(wallet_address=normalized, **extra_fields)
        account.set_unusable_password()
        account.save(using=self._db)
        return account

    def create_superuser(self, wallet_address: str, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(wallet_address, password, **extra_fields)


class Account(AbstractBaseUser, PermissionsMixin):
    wallet_address = models.CharField(max_length=42, unique=True, db_index=True)
    email = models.EmailField(blank=True)
    display_name = models.CharField(max_length=160, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = AccountManager()
    USERNAME_FIELD = "wallet_address"
    REQUIRED_FIELDS: list[str] = []

    def __str__(self) -> str:
        return self.wallet_address


class WalletNonce(models.Model):
    wallet_address = models.CharField(max_length=42, db_index=True)
    chain_id = models.PositiveBigIntegerField(default=114)
    nonce = models.CharField(max_length=96, unique=True)
    message = models.TextField()
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def build(cls, wallet_address: str) -> "WalletNonce":
        now = timezone.now()
        expires_at = now + timedelta(minutes=settings.ZALARY_AUTH_NONCE_TTL_MINUTES)
        nonce = secrets.token_urlsafe(24)
        issued_text = now.isoformat().replace("+00:00", "Z")
        expiry_text = expires_at.isoformat().replace("+00:00", "Z")
        message = (
            f"{settings.ZALARY_AUTH_DOMAIN} wants you to sign in with your Ethereum account:\n"
            f"{wallet_address}\n\n"
            "Sign in to Zalary Confidential Payroll.\n\n"
            f"URI: {settings.ZALARY_AUTH_URI}\n"
            "Version: 1\n"
            f"Chain ID: {settings.COSTON2_CHAIN_ID}\n"
            f"Nonce: {nonce}\n"
            f"Issued At: {issued_text}\n"
            f"Expiration Time: {expiry_text}"
        )
        return cls(
            wallet_address=wallet_address,
            chain_id=settings.COSTON2_CHAIN_ID,
            nonce=nonce,
            message=message,
            expires_at=expires_at,
        )

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at
