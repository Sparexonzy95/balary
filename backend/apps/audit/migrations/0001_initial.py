# Generated for Zalary Milestone 5.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("institutions", "0001_initial"),
        ("notifications", "0001_initial"),
        ("scheduling", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="AuditEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("actor_wallet", models.CharField(blank=True, db_index=True, max_length=42)),
                ("action", models.CharField(db_index=True, max_length=100)),
                ("target_type", models.CharField(db_index=True, max_length=120)),
                ("target_id", models.CharField(db_index=True, max_length=80)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("request_id", models.CharField(blank=True, db_index=True, max_length=64)),
                ("source", models.CharField(default="system", max_length=32)),
                ("dedup_key", models.CharField(max_length=190, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="audit_events", to=settings.AUTH_USER_MODEL)),
                ("institution", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="audit_events", to="institutions.institution")),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.AddIndex(
            model_name="auditevent",
            index=models.Index(fields=["institution", "created_at"], name="audit_institution_time_idx"),
        ),
        migrations.AddIndex(
            model_name="auditevent",
            index=models.Index(fields=["action", "created_at"], name="audit_action_time_idx"),
        ),
    ]
