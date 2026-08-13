from django.core.management.base import BaseCommand

from apps.chains.services import ensure_coston2_config


class Command(BaseCommand):
    help = "Create or update the proven Coston2 Zalary deployment records."

    def handle(self, *args, **options):
        chain, vault, gateway, token = ensure_coston2_config()
        self.stdout.write(self.style.SUCCESS(f"Configured {chain}"))
        self.stdout.write(f"Vault: {vault.address}")
        self.stdout.write(f"Gateway: {gateway.address}")
        self.stdout.write(f"Token: {token.symbol} {token.address}")
