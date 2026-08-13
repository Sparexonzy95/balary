from rest_framework import serializers

from .models import Account


class NonceRequestSerializer(serializers.Serializer):
    wallet_address = serializers.CharField()


class VerifyRequestSerializer(serializers.Serializer):
    wallet_address = serializers.CharField()
    nonce = serializers.CharField()
    signature = serializers.CharField()


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ["id", "wallet_address", "email", "display_name", "created_at", "updated_at"]
        read_only_fields = ["id", "wallet_address", "created_at", "updated_at"]
