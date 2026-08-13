from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL), ("chains", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="Institution",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=180)),
                ("notification_email", models.EmailField(blank=True, max_length=254)),
                ("institution_address", models.CharField(max_length=42, unique=True)),
                ("admin_address", models.CharField(max_length=42)),
                ("treasury_address", models.CharField(max_length=42)),
                ("tax_vault_address", models.CharField(max_length=42)),
                ("vault_address", models.CharField(max_length=42)),
                ("registration_status", models.CharField(choices=[("draft", "Draft"), ("pending", "Pending on-chain"), ("active", "Active"), ("failed", "Failed")], default="draft", max_length=24)),
                ("registration_tx_hash", models.CharField(blank=True, max_length=66)),
                ("is_registered_onchain", models.BooleanField(default=False)),
                ("is_active_onchain", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("chain", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="institutions", to="chains.chain")),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_institutions", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["name", "id"]},
        ),
        migrations.CreateModel(
            name="InstitutionMember",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("wallet_address", models.CharField(db_index=True, max_length=42)),
                ("notification_email", models.EmailField(blank=True, max_length=254)),
                ("role", models.CharField(choices=[("admin", "Admin"), ("hr", "HR"), ("finance", "Finance")], max_length=16)),
                ("status", models.CharField(choices=[("invited", "Invited"), ("pending_onchain", "Pending on-chain"), ("active", "Active"), ("removed", "Removed"), ("failed", "Failed")], default="invited", max_length=24)),
                ("approved_onchain", models.BooleanField(default=False)),
                ("assigned_tx_hash", models.CharField(blank=True, max_length=66)),
                ("removed_tx_hash", models.CharField(blank=True, max_length=66)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("account", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="institution_memberships", to=settings.AUTH_USER_MODEL)),
                ("institution", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="members", to="institutions.institution")),
            ],
            options={"ordering": ["role", "wallet_address"]},
        ),
        migrations.AddConstraint(
            model_name="institutionmember",
            constraint=models.UniqueConstraint(fields=("institution", "wallet_address", "role"), name="unique_institution_wallet_role"),
        ),
    ]
