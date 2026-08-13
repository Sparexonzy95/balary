from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Chain",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("chain_id", models.PositiveBigIntegerField(unique=True)),
                ("rpc_url", models.URLField()),
                ("explorer_url", models.URLField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="ContractDeployment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(choices=[("ZALARY_VAULT", "Zalary Payroll Vault"), ("ZALARY_GATEWAY", "Zalary Confidential Gateway")], max_length=64)),
                ("address", models.CharField(max_length=42)),
                ("abi_json", models.JSONField(default=list)),
                ("is_active", models.BooleanField(default=True)),
                ("deployed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("chain", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="contracts", to="chains.chain")),
            ],
        ),
        migrations.CreateModel(
            name="SupportedToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("symbol", models.CharField(max_length=32)),
                ("address", models.CharField(max_length=42)),
                ("decimals", models.PositiveSmallIntegerField()),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("chain", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="tokens", to="chains.chain")),
            ],
        ),
        migrations.AddConstraint(
            model_name="contractdeployment",
            constraint=models.UniqueConstraint(fields=("chain", "name"), name="unique_active_contract_name_per_chain"),
        ),
        migrations.AddConstraint(
            model_name="supportedtoken",
            constraint=models.UniqueConstraint(fields=("chain", "address"), name="unique_token_address_per_chain"),
        ),
    ]
