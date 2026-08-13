# Generated for Zalary Milestone 5.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("institutions", "0001_initial"),
        ("payroll", "0003_milestone4_funding_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="RecurringPayrollSchedule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=180)),
                ("title_template", models.CharField(default="Payroll - {period}", max_length=180)),
                ("period_label_template", models.CharField(default="{month} {year}", max_length=80)),
                ("frequency", models.CharField(choices=[("weekly", "Weekly"), ("biweekly", "Every two weeks"), ("monthly", "Monthly"), ("quarterly", "Quarterly")], max_length=16)),
                ("timezone_name", models.CharField(default="UTC", max_length=64)),
                ("anchor_day", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("next_run_at", models.DateTimeField(db_index=True)),
                ("funding_start_offset_minutes", models.PositiveIntegerField(default=10)),
                ("funding_window_hours", models.PositiveIntegerField(default=24)),
                ("minimum_withdrawal_window_seconds", models.PositiveBigIntegerField(default=86400)),
                ("settlement_grace_period_seconds", models.PositiveBigIntegerField(default=3600)),
                ("active", models.BooleanField(db_index=True, default=True)),
                ("max_runs", models.PositiveIntegerField(blank=True, null=True)),
                ("end_at", models.DateTimeField(blank=True, null=True)),
                ("run_count", models.PositiveIntegerField(default=0)),
                ("last_run_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_payroll_schedules", to=settings.AUTH_USER_MODEL)),
                ("institution", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="payroll_schedules", to="institutions.institution")),
            ],
            options={"ordering": ["next_run_at", "id"]},
        ),
        migrations.CreateModel(
            name="PayrollScheduleExecution",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("scheduled_for", models.DateTimeField()),
                ("status", models.CharField(choices=[("created", "Payroll created"), ("skipped", "Skipped"), ("failed", "Failed")], max_length=16)),
                ("message", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("payroll_run", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="schedule_execution", to="payroll.payrollrun")),
                ("schedule", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="executions", to="scheduling.recurringpayrollschedule")),
            ],
            options={"ordering": ["-scheduled_for", "-id"]},
        ),
        migrations.AddConstraint(
            model_name="recurringpayrollschedule",
            constraint=models.UniqueConstraint(fields=("institution", "name"), name="unique_payroll_schedule_name_per_institution"),
        ),
        migrations.AddConstraint(
            model_name="payrollscheduleexecution",
            constraint=models.UniqueConstraint(fields=("schedule", "scheduled_for"), name="unique_schedule_execution_time"),
        ),
        migrations.AddIndex(
            model_name="recurringpayrollschedule",
            index=models.Index(fields=["active", "next_run_at"], name="schedule_active_due_idx"),
        ),
    ]
