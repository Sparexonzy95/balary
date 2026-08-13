from rest_framework import serializers

from .models import EmailDelivery, Notification, NotificationPreference


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "institution",
            "recipient_wallet",
            "notification_type",
            "category",
            "title",
            "message",
            "channel",
            "metadata",
            "read",
            "read_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            "id",
            "institution",
            "email_enabled",
            "in_app_enabled",
            "institution_updates",
            "payroll_updates",
            "withdrawal_updates",
            "reminder_updates",
            "security_updates",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class EmailDeliverySerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailDelivery
        fields = [
            "id",
            "public_id",
            "notification",
            "institution",
            "payroll_run",
            "withdrawal",
            "recipient_wallet",
            "subject",
            "template_name",
            "status",
            "attempts",
            "max_attempts",
            "next_attempt_at",
            "last_attempt_at",
            "message_id",
            "provider_message_id",
            "last_error",
            "accepted_at",
            "delivered_at",
            "bounced_at",
            "sent_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
