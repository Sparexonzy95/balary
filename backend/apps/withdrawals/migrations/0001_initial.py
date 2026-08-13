import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("employees", "0001_initial"),
        ("payroll", "0003_milestone4_funding_fields"),
        ("fcc", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="WithdrawalRequest",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("destination", models.CharField(max_length=42)),
                ("amount", models.CharField(max_length=80)),
                ("nonce", models.PositiveBigIntegerField()),
                ("expires_at", models.DateTimeField()),
                ("auth_digest", models.CharField(max_length=66)),
                ("auth_signature", models.TextField(blank=True)),
                ("ciphertext", models.TextField(blank=True)),
                ("ciphertext_hash", models.CharField(blank=True, max_length=66)),
                ("selected_tee_id", models.CharField(blank=True, max_length=42)),
                ("old_ledger_root", models.CharField(max_length=66)),
                ("new_ledger_root", models.CharField(blank=True, max_length=66)),
                ("withdrawal_nullifier", models.CharField(blank=True, max_length=66, null=True, unique=True)),
                ("request_tx_hash", models.CharField(blank=True, max_length=66)),
                ("finalization_tx_hash", models.CharField(blank=True, max_length=66)),
                ("status", models.CharField(choices=[("signature_pending", "Waiting for employee signature"), ("authorized", "Employee authorization verified"), ("encrypted", "Encrypted for TEE"), ("request_pending", "Relayer request pending"), ("tee_pending", "Waiting for TEE"), ("tee_success", "TEE authorization received"), ("tee_failure", "TEE rejected withdrawal"), ("finalization_pending", "Finalization pending"), ("finalized", "Withdrawal finalized"), ("expired", "Expired"), ("failed", "Failed")], default="signature_pending", max_length=32)),
                ("error_message", models.TextField(blank=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="withdrawal_requests", to="employees.institutionemployee")),
                ("instruction", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="withdrawal_request", to="fcc.fccinstruction")),
                ("payroll_run", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="withdrawal_requests", to="payroll.payrollrun")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="withdrawalrequest",
            constraint=models.UniqueConstraint(fields=("payroll_run", "employee", "nonce"), name="unique_employee_withdrawal_nonce"),
        ),
        migrations.AddIndex(
            model_name="withdrawalrequest",
            index=models.Index(fields=["status", "created_at"], name="withdrawal_status_created_idx"),
        ),
    ]
