from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


class RecurringPayrollSchedule(models.Model):
    class Frequency(models.TextChoices):
        WEEKLY = "weekly", "Weekly"
        BIWEEKLY = "biweekly", "Every two weeks"
        MONTHLY = "monthly", "Monthly"
        QUARTERLY = "quarterly", "Quarterly"

    institution = models.ForeignKey(
        "institutions.Institution",
        on_delete=models.CASCADE,
        related_name="payroll_schedules",
    )
    name = models.CharField(max_length=180)
    title_template = models.CharField(max_length=180, default="Payroll - {period}")
    period_label_template = models.CharField(max_length=80, default="{month} {year}")
    frequency = models.CharField(max_length=16, choices=Frequency.choices)
    timezone_name = models.CharField(max_length=64, default="UTC")
    anchor_day = models.PositiveSmallIntegerField(null=True, blank=True)
    next_run_at = models.DateTimeField(db_index=True)
    funding_start_offset_minutes = models.PositiveIntegerField(default=10)
    funding_window_hours = models.PositiveIntegerField(default=24)
    minimum_withdrawal_window_seconds = models.PositiveBigIntegerField(default=86400)
    settlement_grace_period_seconds = models.PositiveBigIntegerField(default=3600)
    active = models.BooleanField(default=True, db_index=True)
    max_runs = models.PositiveIntegerField(null=True, blank=True)
    end_at = models.DateTimeField(null=True, blank=True)
    run_count = models.PositiveIntegerField(default=0)
    last_run_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_payroll_schedules",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["next_run_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["institution", "name"],
                name="unique_payroll_schedule_name_per_institution",
            )
        ]
        indexes = [
            models.Index(fields=["active", "next_run_at"], name="schedule_active_due_idx"),
        ]

    def clean(self):
        try:
            ZoneInfo(self.timezone_name)
        except ZoneInfoNotFoundError as exc:
            raise ValidationError({"timezone_name": "Unknown IANA timezone"}) from exc
        if self.funding_window_hours < 1:
            raise ValidationError({"funding_window_hours": "Must be at least one hour"})
        if self.end_at and self.next_run_at and self.end_at < self.next_run_at:
            raise ValidationError({"end_at": "End date cannot be earlier than the next run"})

    def save(self, *args, **kwargs):
        if self.anchor_day is None and self.next_run_at and self.frequency in {self.Frequency.MONTHLY, self.Frequency.QUARTERLY}:
            self.anchor_day = self.next_run_at.astimezone(ZoneInfo(self.timezone_name)).day
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.institution_id}:{self.name}:{self.frequency}"


class PayrollScheduleExecution(models.Model):
    class Status(models.TextChoices):
        CREATED = "created", "Payroll created"
        SKIPPED = "skipped", "Skipped"
        FAILED = "failed", "Failed"

    schedule = models.ForeignKey(
        RecurringPayrollSchedule,
        on_delete=models.CASCADE,
        related_name="executions",
    )
    scheduled_for = models.DateTimeField()
    payroll_run = models.OneToOneField(
        "payroll.PayrollRun",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="schedule_execution",
    )
    status = models.CharField(max_length=16, choices=Status.choices)
    message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-scheduled_for", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["schedule", "scheduled_for"],
                name="unique_schedule_execution_time",
            )
        ]

    def __str__(self) -> str:
        return f"{self.schedule_id}:{self.scheduled_for}:{self.status}"
