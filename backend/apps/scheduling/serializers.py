from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from rest_framework import serializers

from apps.institutions.services import accessible_institutions

from .models import PayrollScheduleExecution, RecurringPayrollSchedule


class PayrollScheduleExecutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollScheduleExecution
        fields = ["id", "scheduled_for", "payroll_run", "status", "message", "created_at"]
        read_only_fields = fields


class RecurringPayrollScheduleSerializer(serializers.ModelSerializer):
    executions = PayrollScheduleExecutionSerializer(many=True, read_only=True)

    class Meta:
        model = RecurringPayrollSchedule
        fields = [
            "id",
            "institution",
            "name",
            "title_template",
            "period_label_template",
            "frequency",
            "timezone_name",
            "anchor_day",
            "next_run_at",
            "funding_start_offset_minutes",
            "funding_window_hours",
            "minimum_withdrawal_window_seconds",
            "settlement_grace_period_seconds",
            "active",
            "max_runs",
            "end_at",
            "run_count",
            "last_run_at",
            "executions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "anchor_day", "run_count", "last_run_at", "executions", "created_at", "updated_at"]

    def validate_timezone_name(self, value):
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise serializers.ValidationError("Unknown IANA timezone") from exc
        return value


    def validate_funding_window_hours(self, value):
        if value < 1:
            raise serializers.ValidationError("Must be at least one hour")
        return value

    def validate(self, attrs):
        next_run_at = attrs.get("next_run_at", getattr(self.instance, "next_run_at", None))
        end_at = attrs.get("end_at", getattr(self.instance, "end_at", None))
        if end_at and next_run_at and end_at < next_run_at:
            raise serializers.ValidationError({"end_at": "End date cannot be earlier than the next run"})
        return attrs

    def validate_institution(self, institution):
        request = self.context["request"]
        if not accessible_institutions(request.user).filter(pk=institution.pk).exists():
            raise serializers.ValidationError("Institution is not accessible")
        return institution

    def create(self, validated_data):
        return RecurringPayrollSchedule.objects.create(
            created_by=self.context["request"].user,
            **validated_data,
        )
