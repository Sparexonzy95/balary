from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [("payroll", "0002_payrollrun_onchain_fcc_fields")]

    operations = [
        migrations.CreateModel(
            name="FccInstruction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("instruction_id", models.CharField(max_length=66, unique=True)),
                ("request_type", models.CharField(choices=[("PROCESS_PAYROLL", "Process payroll"), ("AUTHORIZE_WITHDRAWAL", "Authorize withdrawal")], max_length=32)),
                ("ciphertext_hash", models.CharField(max_length=66)),
                ("selected_tee_id", models.CharField(max_length=42)),
                ("tee_signer", models.CharField(max_length=42)),
                ("tee_signer_epoch", models.PositiveBigIntegerField()),
                ("requested_at", models.DateTimeField()),
                ("request_tx_hash", models.CharField(max_length=66)),
                ("status", models.CharField(choices=[("tee_pending", "Waiting for TEE"), ("tee_success", "TEE success received"), ("tee_failure", "TEE failure received"), ("finalization_pending", "Finalization pending"), ("finalized", "Finalized on-chain"), ("expired", "Expired"), ("failed", "Failed")], default="tee_pending", max_length=32)),
                ("action_result_data", models.TextField(blank=True)),
                ("submission_tag", models.CharField(blank=True, max_length=255)),
                ("action_status", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("action_log", models.TextField(blank=True)),
                ("tee_signature", models.TextField(blank=True)),
                ("recovered_signer", models.CharField(blank=True, max_length=42)),
                ("action_received_at", models.DateTimeField(blank=True, null=True)),
                ("finalization_tx_hash", models.CharField(blank=True, max_length=66)),
                ("finalization_block_number", models.PositiveBigIntegerField(blank=True, null=True)),
                ("closed_at", models.DateTimeField(blank=True, null=True)),
                ("error_message", models.TextField(blank=True)),
                ("poll_attempts", models.PositiveIntegerField(default=0)),
                ("last_polled_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("payroll_run", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="fcc_instructions", to="payroll.payrollrun")),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.AddIndex(
            model_name="fccinstruction",
            index=models.Index(fields=["status", "requested_at"], name="fcc_status_requested_idx"),
        ),
    ]
