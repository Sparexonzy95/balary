from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.core.exceptions import ValidationError


class Command(BaseCommand):
    help = "Compatibility alias for send_test_notification."

    def add_arguments(self, parser):
        parser.add_argument("email")

    def handle(self, *args, **options):
        recipient = options["email"].strip().lower()
        try:
            validate_email(recipient)
        except ValidationError as exc:
            raise CommandError("A valid email address is required") from exc
        call_command(
            "send_test_notification",
            recipient=recipient,
            stdout=self.stdout,
            stderr=self.stderr,
        )
