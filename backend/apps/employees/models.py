from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.common.crypto import decrypt_private_text


class InstitutionEmployee(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"

    institution = models.ForeignKey(
        "institutions.Institution",
        on_delete=models.CASCADE,
        related_name="employees",
    )
    employee_ref = models.UUIDField(default=uuid.uuid4, editable=False)
    auth_wallet_ciphertext = models.TextField()
    auth_wallet_hash = models.CharField(max_length=64)
    name_ciphertext = models.TextField(blank=True)
    email_ciphertext = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_employee_records",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["institution", "employee_ref"],
                name="unique_employee_ref_per_institution",
            ),
            models.UniqueConstraint(
                fields=["institution", "auth_wallet_hash"],
                name="unique_employee_wallet_per_institution",
            ),
        ]
        ordering = ["created_at", "id"]

    @property
    def auth_wallet(self) -> str:
        return decrypt_private_text(self.auth_wallet_ciphertext)

    @property
    def private_name(self) -> str:
        return decrypt_private_text(self.name_ciphertext)

    @property
    def private_email(self) -> str:
        return decrypt_private_text(self.email_ciphertext)

    def __str__(self) -> str:
        return f"{self.institution_id}:{self.employee_ref}"
