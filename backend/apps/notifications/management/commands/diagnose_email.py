from __future__ import annotations

import smtplib
import ssl
import uuid
from email.message import EmailMessage
from email.utils import format_datetime, make_msgid, parseaddr

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.utils import timezone


class Command(BaseCommand):
    help = "Validate SMTP, authenticate, and optionally send one non-sensitive diagnostic message."

    def add_arguments(self, parser):
        parser.add_argument("--recipient", required=True)
        parser.add_argument("--no-send", action="store_true")

    def _configuration(self, recipient: str) -> tuple[str, str]:
        if settings.EMAIL_USE_TLS and settings.EMAIL_USE_SSL:
            raise CommandError("EMAIL_USE_TLS and EMAIL_USE_SSL cannot both be true")
        if not settings.EMAIL_HOST or not settings.EMAIL_PORT:
            raise CommandError("SMTP host and port must be configured")
        if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
            raise CommandError("SMTP authentication credentials must be configured")
        sender = parseaddr(settings.DEFAULT_FROM_EMAIL)[1]
        try:
            validate_email(sender)
            validate_email(recipient)
        except ValidationError as exc:
            raise CommandError("Sender or recipient is not a valid email address") from exc
        if (
            settings.EMAIL_HOST.lower() == "smtp.gmail.com"
            and sender.lower() != settings.EMAIL_HOST_USER.lower()
        ):
            raise CommandError("Gmail From address must match EMAIL_HOST_USER")
        return sender, recipient

    def handle(self, *args, **options):
        recipient = options["recipient"].strip()
        sender, recipient = self._configuration(recipient)
        message_id = make_msgid(domain=settings.ZALARY_EMAIL_MESSAGE_ID_DOMAIN)

        # This command is an explicit diagnostic surface, so operator-requested
        # sender/recipient output is allowed here and nowhere in worker logs.
        self.stdout.write(f"SMTP host: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}")
        self.stdout.write(f"Security: {'SSL' if settings.EMAIL_USE_SSL else 'STARTTLS' if settings.EMAIL_USE_TLS else 'plain'}")
        self.stdout.write(f"Sender: {sender}")
        self.stdout.write(f"Recipient: {recipient}")
        self.stdout.write(f"Message-ID: {message_id}")

        connection = None
        try:
            context = ssl.create_default_context()
            if settings.EMAIL_USE_SSL:
                connection = smtplib.SMTP_SSL(
                    settings.EMAIL_HOST,
                    settings.EMAIL_PORT,
                    timeout=settings.EMAIL_TIMEOUT,
                    context=context,
                )
            else:
                connection = smtplib.SMTP(
                    settings.EMAIL_HOST,
                    settings.EMAIL_PORT,
                    timeout=settings.EMAIL_TIMEOUT,
                )
                connection.ehlo()
                if settings.EMAIL_USE_TLS:
                    connection.starttls(context=context)
                    connection.ehlo()
            connection.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
            self.stdout.write(self.style.SUCCESS("SMTP authentication: succeeded"))

            if options["no_send"]:
                self.stdout.write("Send skipped (--no-send). No delivery state was claimed.")
                return

            message = EmailMessage()
            message["Subject"] = "Zalary SMTP diagnostic"
            message["From"] = settings.DEFAULT_FROM_EMAIL
            message["To"] = recipient
            message["Date"] = format_datetime(timezone.now())
            message["Message-ID"] = message_id
            message["Reply-To"] = settings.ZALARY_EMAIL_REPLY_TO
            message["Auto-Submitted"] = "auto-generated"
            message["X-Zalary-Notification-ID"] = "diagnostic"
            message["X-Zalary-Delivery-ID"] = str(uuid.uuid4())
            message.set_content(
                "This is a plain-text Zalary SMTP diagnostic. No payroll, wallet, or salary data is included."
            )
            refused = connection.send_message(message)
            if refused:
                raise CommandError("SMTP server rejected one or more recipients")
            self.stdout.write(self.style.SUCCESS("SMTP acceptance: accepted"))
            self.stdout.write("Mailbox delivery: not proven by SMTP acceptance")
        except CommandError:
            raise
        except Exception as exc:
            raise CommandError(f"SMTP diagnostic failed ({exc.__class__.__name__}); details were sanitized") from exc
        finally:
            if connection is not None:
                try:
                    connection.quit()
                except Exception:
                    connection.close()
