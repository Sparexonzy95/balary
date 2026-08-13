# Generated for Zalary Backend Milestone 2.
import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("institutions", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="InstitutionEmployee",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("employee_ref", models.UUIDField(default=uuid.uuid4, editable=False)),
                ("auth_wallet_ciphertext", models.TextField()),
                ("auth_wallet_hash", models.CharField(max_length=64)),
                ("name_ciphertext", models.TextField(blank=True)),
                ("email_ciphertext", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("active", "Active"), ("inactive", "Inactive")], default="active", max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_employee_records", to=settings.AUTH_USER_MODEL)),
                ("institution", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="employees", to="institutions.institution")),
            ],
            options={"ordering": ["created_at", "id"]},
        ),
        migrations.AddConstraint(
            model_name="institutionemployee",
            constraint=models.UniqueConstraint(fields=("institution", "employee_ref"), name="unique_employee_ref_per_institution"),
        ),
        migrations.AddConstraint(
            model_name="institutionemployee",
            constraint=models.UniqueConstraint(fields=("institution", "auth_wallet_hash"), name="unique_employee_wallet_per_institution"),
        ),
    ]
