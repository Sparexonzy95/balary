from django.conf import settings
from django.core.checks import run_checks
from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = "Validate the operational Milestone 5 configuration without broadcasting blockchain transactions."

    def handle(self, *args, **options):
        errors = []
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        self.stdout.write(self.style.SUCCESS("Database: OK"))

        check_messages = run_checks(include_deployment_checks=not settings.DEBUG)
        for message in check_messages:
            self.stdout.write(str(message))
            if getattr(message, "level", 0) >= 40:
                errors.append(str(message))

        self.stdout.write(f"Email backend: {settings.EMAIL_BACKEND}")
        self.stdout.write(f"Celery mode: {'eager' if settings.CELERY_TASK_ALWAYS_EAGER else 'worker'}")
        self.stdout.write(f"FCC endpoint configured: {bool(settings.ZALARY_FCC_PROXY_URL)}")
        self.stdout.write(f"Field encryption configured: {bool(settings.ZALARY_FIELD_ENCRYPTION_KEY or settings.DEBUG)}")
        self.stdout.write("Blockchain transactions broadcast: 0")
        self.stdout.write("Tokens moved: 0")
        if errors:
            raise CommandError("Operational preflight failed")
        self.stdout.write(self.style.SUCCESS("Milestone 5 operational preflight passed."))
