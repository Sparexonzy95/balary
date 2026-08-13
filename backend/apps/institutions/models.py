from __future__ import annotations

from django.conf import settings
from django.db import models


class Institution(models.Model):
    class RegistrationStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING = "pending", "Pending on-chain"
        ACTIVE = "active", "Active"
        FAILED = "failed", "Failed"

    name = models.CharField(max_length=180)
    notification_email = models.EmailField(blank=True)
    institution_address = models.CharField(max_length=42, unique=True)
    admin_address = models.CharField(max_length=42)
    treasury_address = models.CharField(max_length=42)
    tax_vault_address = models.CharField(max_length=42)
    chain = models.ForeignKey("chains.Chain", on_delete=models.PROTECT, related_name="institutions")
    vault_address = models.CharField(max_length=42)
    registration_status = models.CharField(
        max_length=24,
        choices=RegistrationStatus.choices,
        default=RegistrationStatus.DRAFT,
    )
    registration_tx_hash = models.CharField(max_length=66, blank=True)
    is_registered_onchain = models.BooleanField(default=False)
    is_active_onchain = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_institutions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]

    def __str__(self) -> str:
        return f"{self.name} ({self.institution_address})"


class InstitutionMember(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        HR = "hr", "HR"
        FINANCE = "finance", "Finance"

    class Status(models.TextChoices):
        INVITED = "invited", "Invited"
        PENDING_ONCHAIN = "pending_onchain", "Pending on-chain"
        ACTIVE = "active", "Active"
        REMOVED = "removed", "Removed"
        FAILED = "failed", "Failed"

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="members")
    account = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="institution_memberships",
    )
    wallet_address = models.CharField(max_length=42, db_index=True)
    notification_email = models.EmailField(blank=True)
    role = models.CharField(max_length=16, choices=Role.choices)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.INVITED)
    approved_onchain = models.BooleanField(default=False)
    assigned_tx_hash = models.CharField(max_length=66, blank=True)
    removed_tx_hash = models.CharField(max_length=66, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["institution", "wallet_address", "role"],
                name="unique_institution_wallet_role",
            )
        ]
        ordering = ["role", "wallet_address"]

    def __str__(self) -> str:
        return f"{self.wallet_address}:{self.role}:{self.status}"
