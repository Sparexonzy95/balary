from __future__ import annotations

import secrets

from django.conf import settings
from django.db import models

from apps.common.crypto import decrypt_private_text, encrypt_private_text


def generate_payroll_id() -> int:
    # Positive 62-bit ID: database-friendly and effectively collision resistant.
    return secrets.randbelow((1 << 62) - 1) + 1


class PayrollRun(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        VALIDATED = "validated", "Validated"
        ENCRYPTED_READY = "encrypted_ready", "Encrypted and ready"
        DRAFT_TX_PENDING = "draft_tx_pending", "Draft transaction pending"
        DRAFT_ONCHAIN = "draft_onchain", "Draft confirmed on-chain"
        COMPUTATION_TX_PENDING = "computation_tx_pending", "Computation request pending"
        TEE_PROCESSING = "tee_processing", "TEE processing"
        COMPUTED = "computed", "Confidential payroll computed"
        OPEN_FUNDING_TX_PENDING = "open_funding_tx_pending", "Open funding transaction pending"
        FUNDING_READY = "funding_ready", "Funding ready"
        APPROVAL_TX_PENDING = "approval_tx_pending", "Token approval pending"
        FUNDING_TX_PENDING = "funding_tx_pending", "Funding transaction pending"
        ACTIVE = "active", "Active"
        CLOSED = "closed", "Closed"
        FAILED = "failed", "Failed"

    institution = models.ForeignKey(
        "institutions.Institution",
        on_delete=models.CASCADE,
        related_name="payroll_runs",
    )
    chain = models.ForeignKey("chains.Chain", on_delete=models.PROTECT, related_name="payroll_runs")
    payroll_id = models.PositiveBigIntegerField(default=generate_payroll_id, unique=True)
    title = models.CharField(max_length=180)
    period_label = models.CharField(max_length=80)
    funding_starts_at = models.DateTimeField()
    funding_deadline = models.DateTimeField()
    minimum_withdrawal_window_seconds = models.PositiveBigIntegerField()
    settlement_grace_period_seconds = models.PositiveBigIntegerField()
    metadata_hash = models.CharField(max_length=66, blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    source_checksum = models.CharField(max_length=66, blank=True)
    employee_count = models.PositiveIntegerField(default=0)
    employee_net_total = models.CharField(max_length=80, default="0")
    aggregate_tax_total = models.CharField(max_length=80, default="0")
    total_required = models.CharField(max_length=80, default="0")
    ciphertext = models.TextField(blank=True)
    ciphertext_hash = models.CharField(max_length=66, blank=True)
    selected_tee_id = models.CharField(max_length=42, blank=True)
    encryption_endpoint = models.URLField(blank=True)
    encrypted_at = models.DateTimeField(null=True, blank=True)
    draft_tx_hash = models.CharField(max_length=66, blank=True)
    computation_request_tx_hash = models.CharField(max_length=66, blank=True)
    instruction_id = models.CharField(max_length=66, blank=True, db_index=True)
    private_ledger_root = models.CharField(max_length=66, blank=True)
    onchain_status = models.PositiveSmallIntegerField(null=True, blank=True)
    tee_result_status = models.PositiveSmallIntegerField(null=True, blank=True)
    tee_result_log = models.TextField(blank=True)
    finalization_tx_hash = models.CharField(max_length=66, blank=True)
    open_funding_tx_hash = models.CharField(max_length=66, blank=True)
    approval_tx_hash = models.CharField(max_length=66, blank=True)
    funding_tx_hash = models.CharField(max_length=66, blank=True)
    funded_amount = models.CharField(max_length=80, default="0")
    net_withdrawn_amount = models.CharField(max_length=80, default="0")
    tax_paid_amount = models.CharField(max_length=80, default="0")
    minimum_withdrawal_amount = models.CharField(max_length=80, default="0")
    activated_at = models.DateTimeField(null=True, blank=True)
    withdrawal_deadline = models.DateTimeField(null=True, blank=True)
    settlement_deadline = models.DateTimeField(null=True, blank=True)
    finalized_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=40, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_payroll_runs",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.title}:{self.payroll_id}"


class PayrollImportBatch(models.Model):
    payroll_run = models.ForeignKey(PayrollRun, on_delete=models.CASCADE, related_name="import_batches")
    original_filename = models.CharField(max_length=255)
    file_checksum = models.CharField(max_length=66)
    row_count = models.PositiveIntegerField(default=0)
    is_valid = models.BooleanField(default=False)
    validation_errors = models.JSONField(default=list, blank=True)
    employee_net_total = models.CharField(max_length=80, default="0")
    aggregate_tax_total = models.CharField(max_length=80, default="0")
    total_required = models.CharField(max_length=80, default="0")
    payload_hash = models.CharField(max_length=66, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class PayrollEmployeeAllocation(models.Model):
    """Backend-authorized employee amount, encrypted at rest.

    The plaintext payroll row remains transient. This narrowly retained value
    lets an authenticated employee request their complete allocation without
    choosing an amount in an untrusted client.
    """

    payroll_run = models.ForeignKey(
        PayrollRun,
        on_delete=models.CASCADE,
        related_name="employee_allocations",
    )
    employee = models.ForeignKey(
        "employees.InstitutionEmployee",
        on_delete=models.PROTECT,
        related_name="payroll_allocations",
    )
    amount_ciphertext = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["payroll_run", "employee"],
                name="unique_employee_allocation_per_payroll",
            )
        ]

    @property
    def authorized_amount(self) -> int:
        value = decrypt_private_text(self.amount_ciphertext)
        if not value.isdecimal() or int(value) <= 0:
            raise ValueError("Encrypted payroll allocation is invalid")
        return int(value)

    def set_authorized_amount(self, value: int) -> None:
        if int(value) <= 0:
            raise ValueError("Payroll allocation must be positive")
        self.amount_ciphertext = encrypt_private_text(str(int(value)))
