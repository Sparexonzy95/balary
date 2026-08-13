from rest_framework import serializers

from .models import WithdrawalRequest


class WithdrawalPrepareSerializer(serializers.Serializer):
    payroll_id = serializers.IntegerField(min_value=1)

    def to_internal_value(self, data):
        unexpected = set(data.keys()) - {"payroll_id"}
        if unexpected:
            raise serializers.ValidationError(
                {key: "This field is server-authorized and must not be submitted." for key in sorted(unexpected)}
            )
        return super().to_internal_value(data)


class WithdrawalSubmitSerializer(serializers.Serializer):
    signature = serializers.CharField(max_length=200)

    def to_internal_value(self, data):
        unexpected = set(data.keys()) - {"signature"}
        if unexpected:
            raise serializers.ValidationError(
                {key: "Withdrawal authorization fields cannot be altered after preparation." for key in sorted(unexpected)}
            )
        return super().to_internal_value(data)


class WithdrawalRequestSerializer(serializers.ModelSerializer):
    employee_ref = serializers.UUIDField(source="employee.employee_ref", read_only=True)
    payroll_id = serializers.CharField(source="payroll_run.payroll_id", read_only=True)
    instruction_id = serializers.CharField(source="instruction.instruction_id", read_only=True, allow_null=True)
    payroll_processing_tx_hash = serializers.CharField(
        source="payroll_run.finalization_tx_hash", read_only=True
    )

    class Meta:
        model = WithdrawalRequest
        fields = [
            "id",
            "payroll_run_id",
            "payroll_id",
            "employee_ref",
            "destination",
            "amount",
            "nonce",
            "expires_at",
            "auth_digest",
            "instruction_id",
            "ciphertext_hash",
            "old_ledger_root",
            "new_ledger_root",
            "withdrawal_nullifier",
            "request_tx_hash",
            "finalization_tx_hash",
            "payroll_processing_tx_hash",
            "status",
            "error_message",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
