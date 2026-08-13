from django.contrib import admin

from .models import PayrollImportBatch, PayrollRun


@admin.register(PayrollRun)
class PayrollRunAdmin(admin.ModelAdmin):
    list_display = ("payroll_id", "institution", "period_label", "employee_count", "status", "updated_at")
    list_filter = ("status", "institution")
    search_fields = ("payroll_id", "title", "period_label", "metadata_hash", "ciphertext_hash")
    exclude = ("ciphertext",)


@admin.register(PayrollImportBatch)
class PayrollImportBatchAdmin(admin.ModelAdmin):
    list_display = ("payroll_run", "original_filename", "row_count", "is_valid", "created_at")
    list_filter = ("is_valid",)
    readonly_fields = ("validation_errors",)
