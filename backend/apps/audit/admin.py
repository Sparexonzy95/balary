from django.contrib import admin

from .models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ["created_at", "institution", "action", "target_type", "target_id", "actor_wallet"]
    list_filter = ["action", "target_type", "source"]
    search_fields = ["actor_wallet", "target_id", "dedup_key"]
    readonly_fields = [
        "institution",
        "actor",
        "actor_wallet",
        "action",
        "target_type",
        "target_id",
        "metadata",
        "request_id",
        "source",
        "dedup_key",
        "created_at",
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
