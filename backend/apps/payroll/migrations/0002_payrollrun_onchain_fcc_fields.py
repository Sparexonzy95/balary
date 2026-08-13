from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("payroll", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="payrollrun",
            name="computation_request_tx_hash",
            field=models.CharField(blank=True, max_length=66),
        ),
        migrations.AddField(
            model_name="payrollrun",
            name="draft_tx_hash",
            field=models.CharField(blank=True, max_length=66),
        ),
        migrations.AddField(
            model_name="payrollrun",
            name="finalization_tx_hash",
            field=models.CharField(blank=True, max_length=66),
        ),
        migrations.AddField(
            model_name="payrollrun",
            name="finalized_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="payrollrun",
            name="instruction_id",
            field=models.CharField(blank=True, db_index=True, max_length=66),
        ),
        migrations.AddField(
            model_name="payrollrun",
            name="onchain_status",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="payrollrun",
            name="private_ledger_root",
            field=models.CharField(blank=True, max_length=66),
        ),
        migrations.AddField(
            model_name="payrollrun",
            name="tee_result_log",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="payrollrun",
            name="tee_result_status",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="payrollrun",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("validated", "Validated"),
                    ("encrypted_ready", "Encrypted and ready"),
                    ("draft_tx_pending", "Draft transaction pending"),
                    ("draft_onchain", "Draft confirmed on-chain"),
                    ("computation_tx_pending", "Computation request pending"),
                    ("tee_processing", "TEE processing"),
                    ("computed", "Confidential payroll computed"),
                    ("failed", "Failed"),
                ],
                default="draft",
                max_length=40,
            ),
        ),
    ]
