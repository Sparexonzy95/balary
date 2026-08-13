# Generated for Zalary Backend Milestone 2.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import apps.payroll.models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("chains", "0001_initial"),
        ("institutions", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="PayrollRun",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("payroll_id", models.PositiveBigIntegerField(default=apps.payroll.models.generate_payroll_id, unique=True)),
                ("title", models.CharField(max_length=180)),
                ("period_label", models.CharField(max_length=80)),
                ("funding_starts_at", models.DateTimeField()),
                ("funding_deadline", models.DateTimeField()),
                ("minimum_withdrawal_window_seconds", models.PositiveBigIntegerField()),
                ("settlement_grace_period_seconds", models.PositiveBigIntegerField()),
                ("metadata_hash", models.CharField(blank=True, max_length=66)),
                ("metadata_json", models.JSONField(blank=True, default=dict)),
                ("source_checksum", models.CharField(blank=True, max_length=66)),
                ("employee_count", models.PositiveIntegerField(default=0)),
                ("employee_net_total", models.CharField(default="0", max_length=80)),
                ("aggregate_tax_total", models.CharField(default="0", max_length=80)),
                ("total_required", models.CharField(default="0", max_length=80)),
                ("ciphertext", models.TextField(blank=True)),
                ("ciphertext_hash", models.CharField(blank=True, max_length=66)),
                ("selected_tee_id", models.CharField(blank=True, max_length=42)),
                ("encryption_endpoint", models.URLField(blank=True)),
                ("encrypted_at", models.DateTimeField(blank=True, null=True)),
                ("status", models.CharField(choices=[("draft", "Draft"), ("validated", "Validated"), ("encrypted_ready", "Encrypted and ready"), ("failed", "Failed")], default="draft", max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("chain", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="payroll_runs", to="chains.chain")),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_payroll_runs", to=settings.AUTH_USER_MODEL)),
                ("institution", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="payroll_runs", to="institutions.institution")),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.CreateModel(
            name="PayrollImportBatch",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("original_filename", models.CharField(max_length=255)),
                ("file_checksum", models.CharField(max_length=66)),
                ("row_count", models.PositiveIntegerField(default=0)),
                ("is_valid", models.BooleanField(default=False)),
                ("validation_errors", models.JSONField(blank=True, default=list)),
                ("employee_net_total", models.CharField(default="0", max_length=80)),
                ("aggregate_tax_total", models.CharField(default="0", max_length=80)),
                ("total_required", models.CharField(default="0", max_length=80)),
                ("payload_hash", models.CharField(blank=True, max_length=66)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("payroll_run", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="import_batches", to="payroll.payrollrun")),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
    ]
