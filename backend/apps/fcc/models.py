from __future__ import annotations

from django.db import models


class FccInstruction(models.Model):
    class RequestType(models.TextChoices):
        PROCESS_PAYROLL = "PROCESS_PAYROLL", "Process payroll"
        AUTHORIZE_WITHDRAWAL = "AUTHORIZE_WITHDRAWAL", "Authorize withdrawal"

    class Status(models.TextChoices):
        TEE_PENDING = "tee_pending", "Waiting for TEE"
        TEE_SUCCESS = "tee_success", "TEE success received"
        TEE_FAILURE = "tee_failure", "TEE failure received"
        FINALIZATION_PENDING = "finalization_pending", "Finalization pending"
        FINALIZED = "finalized", "Finalized on-chain"
        EXPIRED = "expired", "Expired"
        FAILED = "failed", "Failed"

    instruction_id = models.CharField(max_length=66, unique=True)
    request_type = models.CharField(max_length=32, choices=RequestType.choices)
    payroll_run = models.ForeignKey(
        "payroll.PayrollRun",
        on_delete=models.PROTECT,
        related_name="fcc_instructions",
    )
    ciphertext_hash = models.CharField(max_length=66)
    selected_tee_id = models.CharField(max_length=42)
    tee_signer = models.CharField(max_length=42)
    tee_signer_epoch = models.PositiveBigIntegerField()
    requested_at = models.DateTimeField()
    request_tx_hash = models.CharField(max_length=66)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.TEE_PENDING)

    action_result_data = models.TextField(blank=True)
    submission_tag = models.CharField(max_length=255, blank=True)
    action_status = models.PositiveSmallIntegerField(null=True, blank=True)
    action_log = models.TextField(blank=True)
    tee_signature = models.TextField(blank=True)
    recovered_signer = models.CharField(max_length=42, blank=True)
    action_received_at = models.DateTimeField(null=True, blank=True)

    finalization_tx_hash = models.CharField(max_length=66, blank=True)
    finalization_block_number = models.PositiveBigIntegerField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    poll_attempts = models.PositiveIntegerField(default=0)
    last_polled_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["status", "requested_at"], name="fcc_status_requested_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.request_type}:{self.instruction_id}"
