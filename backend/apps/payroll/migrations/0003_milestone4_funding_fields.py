from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("payroll", "0002_payrollrun_onchain_fcc_fields")]

    operations = [
        migrations.AddField(model_name="payrollrun", name="open_funding_tx_hash", field=models.CharField(blank=True, max_length=66)),
        migrations.AddField(model_name="payrollrun", name="approval_tx_hash", field=models.CharField(blank=True, max_length=66)),
        migrations.AddField(model_name="payrollrun", name="funding_tx_hash", field=models.CharField(blank=True, max_length=66)),
        migrations.AddField(model_name="payrollrun", name="funded_amount", field=models.CharField(default="0", max_length=80)),
        migrations.AddField(model_name="payrollrun", name="net_withdrawn_amount", field=models.CharField(default="0", max_length=80)),
        migrations.AddField(model_name="payrollrun", name="tax_paid_amount", field=models.CharField(default="0", max_length=80)),
        migrations.AddField(model_name="payrollrun", name="minimum_withdrawal_amount", field=models.CharField(default="0", max_length=80)),
        migrations.AddField(model_name="payrollrun", name="activated_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="payrollrun", name="withdrawal_deadline", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="payrollrun", name="settlement_deadline", field=models.DateTimeField(blank=True, null=True)),
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
                    ("open_funding_tx_pending", "Open funding transaction pending"),
                    ("funding_ready", "Funding ready"),
                    ("approval_tx_pending", "Token approval pending"),
                    ("funding_tx_pending", "Funding transaction pending"),
                    ("active", "Active"),
                    ("closed", "Closed"),
                    ("failed", "Failed"),
                ],
                default="draft",
                max_length=40,
            ),
        ),
    ]
