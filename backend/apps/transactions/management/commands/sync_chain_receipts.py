from django.core.management.base import BaseCommand

from apps.transactions.services import sync_pending_transactions


class Command(BaseCommand):
    help = "Verify pending Coston2 transactions and apply confirmed institution state."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        result = sync_pending_transactions(limit=options["limit"])
        self.stdout.write(self.style.SUCCESS(str(result)))
