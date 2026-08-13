import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL), ("chains", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="PreparedTransaction",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("intent_type", models.CharField(choices=[("REGISTER_INSTITUTION", "Register institution"), ("SET_INSTITUTION_ADMIN", "Set institution admin"), ("SET_HR", "Set HR"), ("SET_FINANCE", "Set finance")], max_length=64)),
                ("sender_address", models.CharField(max_length=42)),
                ("contract_address", models.CharField(max_length=42)),
                ("calldata", models.TextField()),
                ("calldata_hash", models.CharField(max_length=66)),
                ("value_wei", models.CharField(default="0", max_length=80)),
                ("expected_event", models.CharField(max_length=120)),
                ("related_model", models.CharField(max_length=120)),
                ("related_id", models.CharField(max_length=64)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("idempotency_key", models.CharField(blank=True, max_length=96, null=True)),
                ("expires_at", models.DateTimeField()),
                ("consumed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("chain", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="chains.chain")),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="prepared_transactions", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="ChainTransaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tx_hash", models.CharField(max_length=66, unique=True)),
                ("sender_address", models.CharField(max_length=42)),
                ("contract_address", models.CharField(max_length=42)),
                ("calldata_hash", models.CharField(max_length=66)),
                ("intent_type", models.CharField(choices=[("REGISTER_INSTITUTION", "Register institution"), ("SET_INSTITUTION_ADMIN", "Set institution admin"), ("SET_HR", "Set HR"), ("SET_FINANCE", "Set finance")], max_length=64)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("confirmed", "Confirmed"), ("failed", "Failed"), ("event_mismatch", "Event mismatch")], default="pending", max_length=24)),
                ("block_number", models.PositiveBigIntegerField(blank=True, null=True)),
                ("gas_used", models.PositiveBigIntegerField(blank=True, null=True)),
                ("confirmations", models.PositiveIntegerField(default=0)),
                ("error_message", models.TextField(blank=True)),
                ("confirmed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("chain", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="chains.chain")),
                ("prepared", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="submissions", to="transactions.preparedtransaction")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="preparedtransaction",
            constraint=models.UniqueConstraint(condition=models.Q(("idempotency_key__isnull", False)), fields=("created_by", "idempotency_key"), name="unique_prepared_idempotency_per_account"),
        ),
    ]
