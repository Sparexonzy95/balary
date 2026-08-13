from django.db import migrations, models


INTENT_CHOICES = [
    ("REGISTER_INSTITUTION", "Register institution"),
    ("SET_INSTITUTION_ADMIN", "Set institution admin"),
    ("SET_HR", "Set HR"),
    ("SET_FINANCE", "Set finance"),
    ("CREATE_PAYROLL_DRAFT", "Create payroll draft"),
    ("REQUEST_PAYROLL_COMPUTATION", "Request confidential payroll computation"),
]


class Migration(migrations.Migration):
    dependencies = [("transactions", "0001_initial")]

    operations = [
        migrations.AlterField(
            model_name="chaintransaction",
            name="intent_type",
            field=models.CharField(choices=INTENT_CHOICES, max_length=64),
        ),
        migrations.AlterField(
            model_name="preparedtransaction",
            name="intent_type",
            field=models.CharField(choices=INTENT_CHOICES, max_length=64),
        ),
    ]
