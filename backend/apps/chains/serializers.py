from rest_framework import serializers

from .models import Chain, ContractDeployment, SupportedToken


class ChainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chain
        fields = ["name", "chain_id", "rpc_url", "explorer_url", "is_active"]


class ContractDeploymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractDeployment
        fields = ["name", "address", "is_active"]


class SupportedTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportedToken
        fields = ["symbol", "address", "decimals", "is_active"]
