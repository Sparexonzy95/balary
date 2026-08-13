# Generated for Zalary Milestone 5.

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("institutions", "0001_initial"),
        ("payroll", "0003_milestone4_funding_fields"),
        ("withdrawals", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("recipient_wallet", models.CharField(blank=True, db_index=True, max_length=42)),
                ("notification_type", models.CharField(db_index=True, max_length=80)),
                ("category", models.CharField(db_index=True, max_length=32)),
                ("title", models.CharField(max_length=180)),
                ("message", models.TextField()),
                ("channel", models.CharField(choices=[("in_app", "In app"), ("email", "Email"), ("both", "In app and email")], default="in_app", max_length=16)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("dedup_key", models.CharField(max_length=190, unique=True)),
                ("read", models.BooleanField(default=False)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("account", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to=settings.AUTH_USER_MODEL)),
                ("institution", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to="institutions.institution")),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.CreateModel(
            name="NotificationPreference",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email_enabled", models.BooleanField(default=True)),
                ("in_app_enabled", models.BooleanField(default=True)),
                ("institution_updates", models.BooleanField(default=True)),
                ("payroll_updates", models.BooleanField(default=True)),
                ("withdrawal_updates", models.BooleanField(default=True)),
                ("reminder_updates", models.BooleanField(default=True)),
                ("security_updates", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("account", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notification_preferences", to=settings.AUTH_USER_MODEL)),
                ("institution", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="notification_preferences", to="institutions.institution")),
            ],
            options={"ordering": ["institution_id", "account_id"]},
        ),
        migrations.CreateModel(
            name="EmailDelivery",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("recipient_email_ciphertext", models.TextField(blank=True)),
                ("recipient_email_hash", models.CharField(blank=True, db_index=True, max_length=64)),
                ("recipient_wallet", models.CharField(blank=True, db_index=True, max_length=42)),
                ("subject", models.CharField(max_length=255)),
                ("template_name", models.CharField(max_length=120)),
                ("context_json", models.JSONField(blank=True, default=dict)),
                ("dedup_key", models.CharField(max_length=190, unique=True)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("sending", "Sending"), ("sent", "Sent"), ("failed", "Failed"), ("skipped", "Skipped")], default="pending", max_length=16)),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("max_attempts", models.PositiveSmallIntegerField(default=5)),
                ("next_attempt_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("last_attempt_at", models.DateTimeField(blank=True, null=True)),
                ("provider_message_id", models.CharField(blank=True, max_length=255)),
                ("error_message", models.TextField(blank=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("institution", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="email_deliveries", to="institutions.institution")),
                ("notification", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="email_delivery", to="notifications.notification")),
                ("payroll_run", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="email_deliveries", to="payroll.payrollrun")),
                ("withdrawal", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="email_deliveries", to="withdrawals.withdrawalrequest")),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.AddConstraint(
            model_name="notificationpreference",
            constraint=models.UniqueConstraint(condition=models.Q(institution__isnull=True), fields=("account",), name="unique_global_notification_preference"),
        ),
        migrations.AddConstraint(
            model_name="notificationpreference",
            constraint=models.UniqueConstraint(condition=models.Q(institution__isnull=False), fields=("account", "institution"), name="unique_scoped_notification_preference"),
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["recipient_wallet", "read", "created_at"], name="notif_wallet_read_idx"),
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["account", "read", "created_at"], name="notif_account_read_idx"),
        ),
        migrations.AddIndex(
            model_name="emaildelivery",
            index=models.Index(fields=["status", "next_attempt_at"], name="email_delivery_retry_idx"),
        ),
    ]
