from django.contrib import admin

from .models import InstitutionEmployee


@admin.register(InstitutionEmployee)
class InstitutionEmployeeAdmin(admin.ModelAdmin):
    list_display = ("employee_ref", "institution", "status", "created_at")
    list_filter = ("status", "institution")
    search_fields = ("employee_ref", "auth_wallet_hash")
    readonly_fields = (
        "employee_ref",
        "auth_wallet_hash",
        "auth_wallet_ciphertext",
        "name_ciphertext",
        "email_ciphertext",
        "created_at",
        "updated_at",
    )
