from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("employees", "0001_initial"),
        ("payroll", "0003_milestone4_funding_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="PayrollEmployeeAllocation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount_ciphertext", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "employee",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="payroll_allocations",
                        to="employees.institutionemployee",
                    ),
                ),
                (
                    "payroll_run",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="employee_allocations",
                        to="payroll.payrollrun",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="payrollemployeeallocation",
            constraint=models.UniqueConstraint(
                fields=("payroll_run", "employee"),
                name="unique_employee_allocation_per_payroll",
            ),
        ),
    ]
