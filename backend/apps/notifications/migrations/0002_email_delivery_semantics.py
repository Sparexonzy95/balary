import uuid

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


def migrate_legacy_deliveries(apps, schema_editor):
    EmailDelivery = apps.get_model("notifications", "EmailDelivery")
    for delivery in EmailDelivery.objects.all().iterator():
        fields = []
        if delivery.public_id is None:
            delivery.public_id = uuid.uuid4()
            fields.append("public_id")
        if delivery.status == "sent":
            delivery.status = "accepted"
            delivery.accepted_at = delivery.sent_at
            fields.extend(["status", "accepted_at"])
        if delivery.provider_message_id in {"0", "1"}:
            delivery.provider_response = "legacy_django_send_count"
            delivery.provider_message_id = ""
            fields.extend(["provider_response", "provider_message_id"])
        if delivery.error_message:
            delivery.last_error = delivery.error_message
            fields.append("last_error")
        if fields:
            delivery.save(update_fields=list(dict.fromkeys(fields)))


def reverse_legacy_status(apps, schema_editor):
    EmailDelivery = apps.get_model("notifications", "EmailDelivery")
    EmailDelivery.objects.filter(status="accepted").update(status="sent")


class Migration(migrations.Migration):
    dependencies = [("notifications", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="emaildelivery",
            name="public_id",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name="emaildelivery",
            name="message_id",
            field=models.CharField(blank=True, db_index=True, max_length=255),
        ),
        migrations.AddField(
            model_name="emaildelivery",
            name="provider_response",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="emaildelivery",
            name="accepted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="emaildelivery",
            name="delivered_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="emaildelivery",
            name="bounced_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="emaildelivery",
            name="last_error",
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name="emaildelivery",
            name="provider_message_id",
            field=models.CharField(blank=True, db_index=True, max_length=255),
        ),
        migrations.AlterField(
            model_name="emaildelivery",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("sending", "Sending"),
                    ("accepted", "Accepted by provider"),
                    ("delivered", "Delivered"),
                    ("failed", "Failed"),
                    ("bounced", "Bounced"),
                    ("deferred", "Deferred"),
                    ("complained", "Complained"),
                    ("rejected", "Rejected"),
                    ("skipped", "Skipped"),
                ],
                default="pending",
                max_length=16,
            ),
        ),
        migrations.RunPython(migrate_legacy_deliveries, reverse_legacy_status),
        migrations.AlterField(
            model_name="emaildelivery",
            name="public_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.CreateModel(
            name="EmailWebhookEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider", models.CharField(max_length=32)),
                ("event_id", models.CharField(max_length=255, unique=True)),
                ("event_type", models.CharField(max_length=80)),
                ("payload_sanitized", models.JSONField(blank=True, default=dict)),
                ("processed_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "delivery",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="webhook_events",
                        to="notifications.emaildelivery",
                    ),
                ),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
    ]
