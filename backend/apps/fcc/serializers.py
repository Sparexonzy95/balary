from rest_framework import serializers

from .models import FccInstruction


class FccInstructionSerializer(serializers.ModelSerializer):
    payroll_run_id = serializers.IntegerField(read_only=True)
    payroll_id = serializers.CharField(source="payroll_run.payroll_id", read_only=True)
    action_result_available = serializers.SerializerMethodField()
    signature_verified = serializers.SerializerMethodField()

    class Meta:
        model = FccInstruction
        fields = [
            "id",
            "instruction_id",
            "request_type",
            "payroll_run_id",
            "payroll_id",
            "ciphertext_hash",
            "selected_tee_id",
            "tee_signer",
            "tee_signer_epoch",
            "requested_at",
            "request_tx_hash",
            "status",
            "action_status",
            "action_log",
            "action_result_available",
            "signature_verified",
            "action_received_at",
            "finalization_tx_hash",
            "finalization_block_number",
            "closed_at",
            "error_message",
            "poll_attempts",
            "last_polled_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_action_result_available(self, obj):
        return bool(obj.action_result_data and obj.tee_signature)

    def get_signature_verified(self, obj):
        return bool(obj.recovered_signer) and obj.recovered_signer.lower() == obj.tee_signer.lower()
