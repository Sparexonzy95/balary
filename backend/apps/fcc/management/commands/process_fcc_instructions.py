from django.core.management.base import BaseCommand

from apps.fcc.services import process_pending_instructions


class Command(BaseCommand):
    help = "Poll pending FCC ActionResults and finalize or expire them safely."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=25)

    def handle(self, *args, **options):
        result = process_pending_instructions(limit=options["limit"])
        self.stdout.write(self.style.SUCCESS(str(result)))
