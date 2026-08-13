from rest_framework import serializers

from .models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    institution_name = serializers.CharField(source="institution.name", read_only=True)
    actor_wallet_display = serializers.SerializerMethodField()

    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "institution",
            "institution_name",
            "actor",
            "actor_wallet",
            "actor_wallet_display",
            "action",
            "target_type",
            "target_id",
            "metadata",
            "request_id",
            "source",
            "created_at",
        ]
        read_only_fields = fields

    def get_actor_wallet_display(self, obj):
        return obj.actor_wallet or (obj.actor.wallet_address if obj.actor else "")
