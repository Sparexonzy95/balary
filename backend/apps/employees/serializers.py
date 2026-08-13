from rest_framework import serializers

from .models import InstitutionEmployee


class EmployeeCreateSerializer(serializers.Serializer):
    institution_id = serializers.IntegerField(min_value=1)
    auth_wallet = serializers.CharField()
    name = serializers.CharField(required=False, allow_blank=True, max_length=180)
    email = serializers.EmailField(required=False, allow_blank=True)


class EmployeeStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=InstitutionEmployee.Status.choices)


class EmployeeSerializer(serializers.ModelSerializer):
    auth_wallet = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()

    class Meta:
        model = InstitutionEmployee
        fields = [
            "id",
            "institution_id",
            "employee_ref",
            "auth_wallet",
            "name",
            "email",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_auth_wallet(self, obj):
        return obj.auth_wallet

    def get_name(self, obj):
        return obj.private_name

    def get_email(self, obj):
        return obj.private_email
