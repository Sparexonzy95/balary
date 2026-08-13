from django.contrib import admin

from .models import FccInstruction


@admin.register(FccInstruction)
class FccInstructionAdmin(admin.ModelAdmin):
    list_display = (
        "instruction_id",
        "request_type",
        "payroll_run",
        "status",
        "tee_signer_epoch",
        "requested_at",
        "updated_at",
    )
    search_fields = ("instruction_id", "request_tx_hash", "finalization_tx_hash")
    list_filter = ("request_type", "status")
