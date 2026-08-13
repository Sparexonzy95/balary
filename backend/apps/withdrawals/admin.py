from django.contrib import admin

from .models import WithdrawalRequest


@admin.register(WithdrawalRequest)
class WithdrawalRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "payroll_run",
        "employee",
        "amount",
        "nonce",
        "status",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("id", "request_tx_hash", "withdrawal_nullifier", "destination")
    readonly_fields = (
        "auth_digest",
        "ciphertext_hash",
        "request_tx_hash",
        "finalization_tx_hash",
        "created_at",
        "updated_at",
    )
