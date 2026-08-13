from rest_framework import serializers

from .models import ChainTransaction, PreparedTransaction


class PreparedTransactionSerializer(serializers.ModelSerializer):
    chain_id = serializers.IntegerField(source="chain.chain_id", read_only=True)
    from_address = serializers.CharField(source="sender_address", read_only=True)
    to = serializers.CharField(source="contract_address", read_only=True)
    data = serializers.CharField(source="calldata", read_only=True)
    value = serializers.CharField(source="value_wei", read_only=True)

    class Meta:
        model = PreparedTransaction
        fields = [
            "id",
            "chain_id",
            "intent_type",
            "from_address",
            "to",
            "data",
            "value",
            "expected_event",
            "expires_at",
        ]


class SubmitTransactionSerializer(serializers.Serializer):
    prepared_transaction_id = serializers.UUIDField()
    tx_hash = serializers.CharField()


class ChainTransactionSerializer(serializers.ModelSerializer):
    prepared_transaction_id = serializers.UUIDField(source="prepared_id", read_only=True)
    explorer_url = serializers.SerializerMethodField()

    class Meta:
        model = ChainTransaction
        fields = [
            "id",
            "prepared_transaction_id",
            "intent_type",
            "tx_hash",
            "status",
            "sender_address",
            "contract_address",
            "block_number",
            "gas_used",
            "confirmations",
            "error_message",
            "explorer_url",
            "created_at",
            "updated_at",
        ]

    def get_explorer_url(self, obj):
        base = obj.chain.explorer_url.rstrip("/")
        return f"{base}/tx/{obj.tx_hash}" if base else ""
