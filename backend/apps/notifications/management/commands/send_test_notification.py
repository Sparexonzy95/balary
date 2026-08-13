from __future__ import annotations

import time
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email

from apps.common.crypto import stable_private_hash
from apps.notifications.models import EmailDelivery
from apps.notifications.services import emit_notification


class Command(BaseCommand):
    help = "Queue one plain-text test through Zalary's normal Celery notification path."

    def add_arguments(self, parser):
        parser.add_argument("--recipient", required=True)
        parser.add_argument("--timeout", type=int, default=60)

    def handle(self, *args, **options):
        recipient = options["recipient"].strip().lower()
        timeout = max(5, min(int(options["timeout"]), 300))
        try:
            validate_email(recipient)
        except ValidationError as exc:
            raise CommandError("A valid recipient email is required") from exc

        notification = emit_notification(
            notification_type="operational_test_email",
            category="security",
            title="Zalary notification test",
            message=(
                "This is a plain-text test sent through Zalary's normal "
                "Django EmailMessage and Celery notification path."
            ),
            dedup_key=(
                f"ops-test-email:{stable_private_hash(recipient)}:{uuid.uuid4().hex}"
            ),
            recipient_email=recipient,
            template_name="notification",
            context={},
            metadata={"source": "send_test_notification"},
        )
        delivery = EmailDelivery.objects.get(notification=notification)
        if (
            delivery.status == EmailDelivery.Status.PENDING
            and (settings.ZALARY_NOTIFICATIONS_INLINE or settings.CELERY_TASK_ALWAYS_EAGER)
        ):
            from apps.notifications.tasks import send_email_notification

            send_email_notification(delivery.id)

        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            delivery.refresh_from_db()
            if delivery.status in {
                EmailDelivery.Status.ACCEPTED,
                EmailDelivery.Status.FAILED,
                EmailDelivery.Status.SKIPPED,
            }:
                break
            time.sleep(1)

        delivery.refresh_from_db()
        if delivery.status != EmailDelivery.Status.ACCEPTED or delivery.sent_at is None:
            raise CommandError(
                f"Notification send failed or timed out: status={delivery.status}; "
                f"error={delivery.last_error or 'none'}"
            )

        self.stdout.write(self.style.SUCCESS("Django email send completed: True"))
        self.stdout.write(self.style.SUCCESS("Celery task completed: True"))
        self.stdout.write(self.style.SUCCESS("Notification sent_at recorded: True"))
        self.stdout.write("Inbox delivery must be confirmed manually.")
        self.stdout.write("Blockchain transactions broadcast: 0")
        self.stdout.write("Tokens moved: 0")
