from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class TransactionIntent(models.TextChoices):
    REGISTER_INSTITUTION = "REGISTER_INSTITUTION", "Register institution"
    SET_INSTITUTION_ADMIN = "SET_INSTITUTION_ADMIN", "Set institution admin"
    SET_HR = "SET_HR", "Set HR"
    SET_FINANCE = "SET_FINANCE", "Set finance"
    CREATE_PAYROLL_DRAFT = "CREATE_PAYROLL_DRAFT", "Create payroll draft"
    REQUEST_PAYROLL_COMPUTATION = "REQUEST_PAYROLL_COMPUTATION", "Request confidential payroll computation"
    OPEN_PAYROLL_FUNDING = "OPEN_PAYROLL_FUNDING", "Open payroll funding"
    APPROVE_PAYROLL_FUNDING = "APPROVE_PAYROLL_FUNDING", "Approve payroll funding"
    FUND_PAYROLL = "FUND_PAYROLL", "Fund payroll"


class PreparedTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="prepared_transactions",
    )
    chain = models.ForeignKey("chains.Chain", on_delete=models.PROTECT)
    intent_type = models.CharField(max_length=64, choices=TransactionIntent.choices)
    sender_address = models.CharField(max_length=42)
    contract_address = models.CharField(max_length=42)
    calldata = models.TextField()
    calldata_hash = models.CharField(max_length=66)
    value_wei = models.CharField(max_length=80, default="0")
    expected_event = models.CharField(max_length=120)
    related_model = models.CharField(max_length=120)
    related_id = models.CharField(max_length=64)
    metadata = models.JSONField(default=dict, blank=True)
    idempotency_key = models.CharField(max_length=96, null=True, blank=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["created_by", "idempotency_key"],
                condition=models.Q(idempotency_key__isnull=False),
                name="unique_prepared_idempotency_per_account",
            )
        ]
        ordering = ["-created_at"]

    @property
    def is_consumed(self) -> bool:
        return self.consumed_at is not None


class ChainTransaction(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        FAILED = "failed", "Failed"
        EVENT_MISMATCH = "event_mismatch", "Event mismatch"

    prepared = models.ForeignKey(
        PreparedTransaction,
        on_delete=models.PROTECT,
        related_name="submissions",
    )
    chain = models.ForeignKey("chains.Chain", on_delete=models.PROTECT)
    tx_hash = models.CharField(max_length=66, unique=True)
    sender_address = models.CharField(max_length=42)
    contract_address = models.CharField(max_length=42)
    calldata_hash = models.CharField(max_length=66)
    intent_type = models.CharField(max_length=64, choices=TransactionIntent.choices)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING)
    block_number = models.PositiveBigIntegerField(null=True, blank=True)
    gas_used = models.PositiveBigIntegerField(null=True, blank=True)
    confirmations = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.intent_type}:{self.tx_hash}"
