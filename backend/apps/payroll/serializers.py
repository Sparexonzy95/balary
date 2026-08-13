from rest_framework import serializers

from .models import PayrollImportBatch, PayrollRun


class PayrollCreateSerializer(serializers.Serializer):
    institution_id = serializers.IntegerField(min_value=1)
    title = serializers.CharField(max_length=180)
    period_label = serializers.CharField(max_length=80)
    funding_starts_at = serializers.DateTimeField()
    funding_deadline = serializers.DateTimeField()
    minimum_withdrawal_window_seconds = serializers.IntegerField(min_value=1)
    settlement_grace_period_seconds = serializers.IntegerField(min_value=1)


class PayrollFileSerializer(serializers.Serializer):
    file = serializers.FileField()


class PreparedTransactionSubmitSerializer(serializers.Serializer):
    prepared_transaction_id = serializers.UUIDField()
    tx_hash = serializers.CharField()


class PayrollImportBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollImportBatch
        fields = [
            "id",
            "original_filename",
            "file_checksum",
            "row_count",
            "is_valid",
            "validation_errors",
            "employee_net_total",
            "aggregate_tax_total",
            "total_required",
            "payload_hash",
            "created_at",
        ]
        read_only_fields = fields


class PayrollRunSerializer(serializers.ModelSerializer):
    payroll_id = serializers.CharField(read_only=True)
    latest_import = serializers.SerializerMethodField()
    ciphertext_available = serializers.SerializerMethodField()

    class Meta:
        model = PayrollRun
        fields = [
            "id",
            "institution_id",
            "chain_id",
            "payroll_id",
            "title",
            "period_label",
            "funding_starts_at",
            "funding_deadline",
            "minimum_withdrawal_window_seconds",
            "settlement_grace_period_seconds",
            "metadata_hash",
            "metadata_json",
            "source_checksum",
            "employee_count",
            "employee_net_total",
            "aggregate_tax_total",
            "total_required",
            "ciphertext_hash",
            "ciphertext_available",
            "selected_tee_id",
            "encryption_endpoint",
            "encrypted_at",
            "draft_tx_hash",
            "computation_request_tx_hash",
            "instruction_id",
            "private_ledger_root",
            "onchain_status",
            "tee_result_status",
            "tee_result_log",
            "finalization_tx_hash",
            "open_funding_tx_hash",
            "approval_tx_hash",
            "funding_tx_hash",
            "funded_amount",
            "net_withdrawn_amount",
            "tax_paid_amount",
            "minimum_withdrawal_amount",
            "activated_at",
            "withdrawal_deadline",
            "settlement_deadline",
            "finalized_at",
            "status",
            "latest_import",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_ciphertext_available(self, obj):
        return bool(obj.ciphertext)

    def get_latest_import(self, obj):
        batch = obj.import_batches.first()
        return PayrollImportBatchSerializer(batch).data if batch else None
