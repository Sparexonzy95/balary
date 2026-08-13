from datetime import timedelta

from celery import shared_task
from django.db import models
from django.db.models import Q
from django.utils import timezone

from .models import EmailDelivery
from .services import send_email_delivery


def _send_email_notification(delivery_id: int):
    delivery = EmailDelivery.objects.filter(id=delivery_id).first()
    if delivery is None:
        return {"missing": 1, "accepted": 0}
    delivery = send_email_delivery(delivery)
    return {"status": delivery.status, "attempts": delivery.attempts}


@shared_task
def send_email_notification(delivery_id: int):
    """Canonical sample-backend-style Celery email task."""
    return _send_email_notification(delivery_id)


@shared_task
def send_email_delivery_task(delivery_id: int):
    """Backward-compatible task name retained for queued legacy jobs."""
    return _send_email_notification(delivery_id)


@shared_task
def retry_failed_email_deliveries(limit: int = 100):
    now = timezone.now()
    stale_sending = Q(
        status=EmailDelivery.Status.SENDING,
        last_attempt_at__lte=now - timedelta(minutes=10),
    )
    deliveries = EmailDelivery.objects.filter(
        Q(status=EmailDelivery.Status.PENDING)
        | Q(status=EmailDelivery.Status.FAILED)
        | stale_sending,
        next_attempt_at__lte=now,
        attempts__lt=models.F("max_attempts"),
    ).order_by("next_attempt_at")[:limit]
    processed = 0
    accepted = 0
    for delivery in deliveries:
        processed += 1
        result = send_email_delivery(delivery)
        accepted += int(result.status == EmailDelivery.Status.ACCEPTED)
    return {"processed": processed, "accepted": accepted}
