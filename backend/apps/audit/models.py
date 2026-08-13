from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class AuditEvent(models.Model):
    institution = models.ForeignKey(
        "institutions.Institution",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="audit_events",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_events",
    )
    actor_wallet = models.CharField(max_length=42, blank=True, db_index=True)
    action = models.CharField(max_length=100, db_index=True)
    target_type = models.CharField(max_length=120, db_index=True)
    target_id = models.CharField(max_length=80, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    request_id = models.CharField(max_length=64, blank=True, db_index=True)
    source = models.CharField(max_length=32, default="system")
    dedup_key = models.CharField(max_length=190, unique=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["institution", "created_at"], name="audit_institution_time_idx"),
            models.Index(fields=["action", "created_at"], name="audit_action_time_idx"),
        ]

    def save(self, *args, **kwargs):
        if self.pk and AuditEvent.objects.filter(pk=self.pk).exists():
            raise ValidationError("Audit events are append-only")
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.action}:{self.target_type}:{self.target_id}"
