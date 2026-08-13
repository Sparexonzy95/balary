from django.core.management.base import BaseCommand

from apps.scheduling.services import process_due_schedules


class Command(BaseCommand):
    help = "Process due recurring payroll schedules once."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        result = process_due_schedules(limit=options["limit"])
        self.stdout.write(self.style.SUCCESS(str(result)))
