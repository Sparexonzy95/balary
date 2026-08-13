from django.db import migrations, models

import apps.accounts.models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]

    operations = [
        migrations.AlterModelManagers(
            name="account",
            managers=[("objects", apps.accounts.models.AccountManager())],
        ),
        migrations.AlterField(
            model_name="account",
            name="groups",
            field=models.ManyToManyField(
                blank=True,
                help_text="The groups this user belongs to. A user will get all permissions granted to each of their groups.",
                related_name="user_set",
                related_query_name="user",
                to="auth.group",
                verbose_name="groups",
            ),
        ),
    ]
