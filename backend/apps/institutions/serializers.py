from rest_framework import serializers

from apps.transactions.serializers import ChainTransactionSerializer, PreparedTransactionSerializer

from .models import Institution, InstitutionMember


class InstitutionCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=180)
    notification_email = serializers.EmailField(required=False, allow_blank=True, default="")
    treasury_address = serializers.CharField()
    tax_vault_address = serializers.CharField()


class InstitutionMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstitutionMember
        fields = [
            "id",
            "wallet_address",
            "notification_email",
            "role",
            "status",
            "approved_onchain",
            "assigned_tx_hash",
            "removed_tx_hash",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class InstitutionSerializer(serializers.ModelSerializer):
    members = InstitutionMemberSerializer(many=True, read_only=True)
    can_manage = serializers.SerializerMethodField()

    class Meta:
        model = Institution
        fields = [
            "id",
            "name",
            "notification_email",
            "institution_address",
            "admin_address",
            "treasury_address",
            "tax_vault_address",
            "chain_id",
            "vault_address",
            "registration_status",
            "registration_tx_hash",
            "is_registered_onchain",
            "is_active_onchain",
            "can_manage",
            "members",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_can_manage(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.members.filter(
            wallet_address=request.user.wallet_address,
            role=InstitutionMember.Role.ADMIN,
            status=InstitutionMember.Status.ACTIVE,
        ).exists()


class PrepareResponseSerializer(serializers.Serializer):
    prepared_transaction = PreparedTransactionSerializer()


class SubmitPreparedTransactionSerializer(serializers.Serializer):
    prepared_transaction_id = serializers.UUIDField()
    tx_hash = serializers.CharField()


class RolePrepareSerializer(serializers.Serializer):
    wallet_address = serializers.CharField()
    notification_email = serializers.EmailField(required=False, allow_blank=True)
    approved = serializers.BooleanField(default=True)
