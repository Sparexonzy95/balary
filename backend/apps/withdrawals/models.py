from __future__ import annotations

import uuid

from django.db import models


class WithdrawalRequest(models.Model):
    class Status(models.TextChoices):
        SIGNATURE_PENDING = "signature_pending", "Waiting for employee signature"
        AUTHORIZED = "authorized", "Employee authorization verified"
        ENCRYPTED = "encrypted", "Encrypted for TEE"
        REQUEST_PENDING = "request_pending", "Relayer request pending"
        TEE_PENDING = "tee_pending", "Waiting for TEE"
        TEE_SUCCESS = "tee_success", "TEE authorization received"
        TEE_FAILURE = "tee_failure", "TEE rejected withdrawal"
        FINALIZATION_PENDING = "finalization_pending", "Finalization pending"
        FINALIZED = "finalized", "Withdrawal finalized"
        EXPIRED = "expired", "Expired"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payroll_run = models.ForeignKey(
        "payroll.PayrollRun",
        on_delete=models.PROTECT,
        related_name="withdrawal_requests",
    )
    employee = models.ForeignKey(
        "employees.InstitutionEmployee",
        on_delete=models.PROTECT,
        related_name="withdrawal_requests",
    )
    instruction = models.OneToOneField(
        "fcc.FccInstruction",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="withdrawal_request",
    )
    destination = models.CharField(max_length=42)
    amount = models.CharField(max_length=80)
    nonce = models.PositiveBigIntegerField()
    expires_at = models.DateTimeField()
    auth_digest = models.CharField(max_length=66)
    auth_signature = models.TextField(blank=True)
    ciphertext = models.TextField(blank=True)
    ciphertext_hash = models.CharField(max_length=66, blank=True)
    selected_tee_id = models.CharField(max_length=42, blank=True)
    old_ledger_root = models.CharField(max_length=66)
    new_ledger_root = models.CharField(max_length=66, blank=True)
    withdrawal_nullifier = models.CharField(max_length=66, blank=True, unique=True, null=True)
    request_tx_hash = models.CharField(max_length=66, blank=True)
    finalization_tx_hash = models.CharField(max_length=66, blank=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.SIGNATURE_PENDING)
    error_message = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["payroll_run", "employee", "nonce"],
                name="unique_employee_withdrawal_nonce",
            )
        ]
        indexes = [
            models.Index(fields=["status", "created_at"], name="withdrawal_status_created_idx"),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.payroll_run.payroll_id}:{self.employee.employee_ref}:{self.nonce}"
