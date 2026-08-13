from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.crypto import decrypt_private_text


class Notification(models.Model):
    class Channel(models.TextChoices):
        IN_APP = "in_app", "In app"
        EMAIL = "email", "Email"
        BOTH = "both", "In app and email"

    account = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    institution = models.ForeignKey(
        "institutions.Institution",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    recipient_wallet = models.CharField(max_length=42, blank=True, db_index=True)
    notification_type = models.CharField(max_length=80, db_index=True)
    category = models.CharField(max_length=32, db_index=True)
    title = models.CharField(max_length=180)
    message = models.TextField()
    channel = models.CharField(max_length=16, choices=Channel.choices, default=Channel.IN_APP)
    metadata = models.JSONField(default=dict, blank=True)
    dedup_key = models.CharField(max_length=190, unique=True)
    read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["recipient_wallet", "read", "created_at"], name="notif_wallet_read_idx"),
            models.Index(fields=["account", "read", "created_at"], name="notif_account_read_idx"),
        ]

    def mark_read(self) -> None:
        if self.read:
            return
        self.read = True
        self.read_at = timezone.now()
        self.save(update_fields=["read", "read_at", "updated_at"])

    def __str__(self) -> str:
        return f"{self.notification_type}:{self.dedup_key}"


class NotificationPreference(models.Model):
    account = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    institution = models.ForeignKey(
        "institutions.Institution",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    email_enabled = models.BooleanField(default=True)
    in_app_enabled = models.BooleanField(default=True)
    institution_updates = models.BooleanField(default=True)
    payroll_updates = models.BooleanField(default=True)
    withdrawal_updates = models.BooleanField(default=True)
    reminder_updates = models.BooleanField(default=True)
    security_updates = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["account"],
                condition=models.Q(institution__isnull=True),
                name="unique_global_notification_preference",
            ),
            models.UniqueConstraint(
                fields=["account", "institution"],
                condition=models.Q(institution__isnull=False),
                name="unique_scoped_notification_preference",
            ),
        ]
        ordering = ["institution_id", "account_id"]

    def __str__(self) -> str:
        return f"{self.account_id}:{self.institution_id or 'global'}"


class EmailDelivery(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENDING = "sending", "Sending"
        ACCEPTED = "accepted", "Accepted by provider"
        DELIVERED = "delivered", "Delivered"
        FAILED = "failed", "Failed"
        BOUNCED = "bounced", "Bounced"
        DEFERRED = "deferred", "Deferred"
        COMPLAINED = "complained", "Complained"
        REJECTED = "rejected", "Rejected"
        SKIPPED = "skipped", "Skipped"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    notification = models.OneToOneField(
        Notification,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="email_delivery",
    )
    institution = models.ForeignKey(
        "institutions.Institution",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="email_deliveries",
    )
    payroll_run = models.ForeignKey(
        "payroll.PayrollRun",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="email_deliveries",
    )
    withdrawal = models.ForeignKey(
        "withdrawals.WithdrawalRequest",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="email_deliveries",
    )
    recipient_email_ciphertext = models.TextField(blank=True)
    recipient_email_hash = models.CharField(max_length=64, blank=True, db_index=True)
    recipient_wallet = models.CharField(max_length=42, blank=True, db_index=True)
    subject = models.CharField(max_length=255)
    template_name = models.CharField(max_length=120)
    context_json = models.JSONField(default=dict, blank=True)
    dedup_key = models.CharField(max_length=190, unique=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)
    next_attempt_at = models.DateTimeField(default=timezone.now)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    message_id = models.CharField(max_length=255, blank=True, db_index=True)
    provider_message_id = models.CharField(max_length=255, blank=True, db_index=True)
    provider_response = models.TextField(blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    bounced_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    # Retained as compatibility aliases for pre-5.1 database/API consumers.
    error_message = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["status", "next_attempt_at"], name="email_delivery_retry_idx"),
        ]

    @property
    def recipient_email(self) -> str:
        return decrypt_private_text(self.recipient_email_ciphertext)

    def __str__(self) -> str:
        return f"{self.dedup_key}:{self.status}"


class EmailWebhookEvent(models.Model):
    provider = models.CharField(max_length=32)
    event_id = models.CharField(max_length=255, unique=True)
    event_type = models.CharField(max_length=80)
    delivery = models.ForeignKey(
        EmailDelivery,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="webhook_events",
    )
    payload_sanitized = models.JSONField(default=dict, blank=True)
    processed_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.provider}:{self.event_id}:{self.event_type}"
