from django.contrib import admin

from .models import EmailDelivery, EmailWebhookEvent, Notification, NotificationPreference


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["notification_type", "category", "recipient_wallet", "channel", "read", "created_at"]
    list_filter = ["category", "notification_type", "channel", "read"]
    search_fields = ["title", "message", "recipient_wallet", "dedup_key"]
    readonly_fields = ["dedup_key", "created_at", "updated_at"]


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ["account", "institution", "email_enabled", "in_app_enabled", "updated_at"]
    list_filter = ["email_enabled", "in_app_enabled"]


@admin.register(EmailDelivery)
class EmailDeliveryAdmin(admin.ModelAdmin):
    list_display = ["subject", "recipient_wallet", "status", "attempts", "accepted_at", "delivered_at", "created_at"]
    list_filter = ["status", "template_name"]
    search_fields = ["subject", "recipient_wallet", "dedup_key", "error_message"]
    readonly_fields = ["recipient_email_ciphertext", "recipient_email_hash", "dedup_key", "created_at", "updated_at"]


@admin.register(EmailWebhookEvent)
class EmailWebhookEventAdmin(admin.ModelAdmin):
    list_display = ["provider", "event_type", "delivery", "processed_at"]
    list_filter = ["provider", "event_type"]
    search_fields = ["event_id"]
    readonly_fields = ["provider", "event_id", "event_type", "delivery", "payload_sanitized", "processed_at", "created_at"]
