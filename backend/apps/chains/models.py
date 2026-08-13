from django.db import models


class Chain(models.Model):
    name = models.CharField(max_length=120)
    chain_id = models.PositiveBigIntegerField(unique=True)
    rpc_url = models.URLField()
    explorer_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.name} ({self.chain_id})"


class ContractDeployment(models.Model):
    class ContractName(models.TextChoices):
        VAULT = "ZALARY_VAULT", "Zalary Payroll Vault"
        GATEWAY = "ZALARY_GATEWAY", "Zalary Confidential Gateway"

    chain = models.ForeignKey(Chain, on_delete=models.CASCADE, related_name="contracts")
    name = models.CharField(max_length=64, choices=ContractName.choices)
    address = models.CharField(max_length=42)
    abi_json = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    deployed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["chain", "name"], name="unique_active_contract_name_per_chain")
        ]

    def __str__(self) -> str:
        return f"{self.name}@{self.address}"


class SupportedToken(models.Model):
    chain = models.ForeignKey(Chain, on_delete=models.CASCADE, related_name="tokens")
    symbol = models.CharField(max_length=32)
    address = models.CharField(max_length=42)
    decimals = models.PositiveSmallIntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["chain", "address"], name="unique_token_address_per_chain")
        ]

    def __str__(self) -> str:
        return f"{self.symbol}@{self.chain.chain_id}"
