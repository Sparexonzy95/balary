from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import time
from dataclasses import dataclass

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import EmailDelivery, EmailWebhookEvent


class InvalidWebhookSignature(ValueError):
    pass


def _resend_signing_key() -> bytes:
    secret = settings.ZALARY_RESEND_WEBHOOK_SECRET.strip()
    if not secret:
        raise InvalidWebhookSignature("Webhook verification is not configured")
    encoded = secret[6:] if secret.startswith("whsec_") else secret
    try:
        return base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise InvalidWebhookSignature("Webhook verification is not configured") from exc


def verify_resend_signature(*, body: bytes, event_id: str, timestamp: str, signature: str) -> None:
    if not event_id or not timestamp or not signature:
        raise InvalidWebhookSignature("Missing webhook signature")
    try:
        timestamp_number = int(timestamp)
    except ValueError as exc:
        raise InvalidWebhookSignature("Invalid webhook timestamp") from exc
    if abs(int(time.time()) - timestamp_number) > settings.ZALARY_EMAIL_WEBHOOK_TOLERANCE_SECONDS:
        raise InvalidWebhookSignature("Webhook timestamp outside replay window")
    signed = event_id.encode("utf-8") + b"." + timestamp.encode("ascii") + b"." + body
    expected = base64.b64encode(hmac.new(_resend_signing_key(), signed, hashlib.sha256).digest()).decode("ascii")
    candidates = []
    for token in signature.split():
        candidates.append(token.split(",", 1)[1] if token.startswith("v1,") else token)
    if not any(hmac.compare_digest(expected, candidate) for candidate in candidates):
        raise InvalidWebhookSignature("Invalid webhook signature")


EVENT_STATUS = {
    "email.sent": EmailDelivery.Status.ACCEPTED,
    "email.delivered": EmailDelivery.Status.DELIVERED,
    "email.bounced": EmailDelivery.Status.BOUNCED,
    "email.delivery_delayed": EmailDelivery.Status.DEFERRED,
    "email.complained": EmailDelivery.Status.COMPLAINED,
    "email.failed": EmailDelivery.Status.REJECTED,
    "email.rejected": EmailDelivery.Status.REJECTED,
    "email.suppressed": EmailDelivery.Status.REJECTED,
}

# Provider events can arrive out of order. A late low-confidence event must
# not erase stronger terminal evidence already recorded.
TERMINAL_STATUSES = {
    EmailDelivery.Status.DELIVERED,
    EmailDelivery.Status.BOUNCED,
    EmailDelivery.Status.COMPLAINED,
    EmailDelivery.Status.REJECTED,
}


def _message_id(data: dict) -> str:
    direct = data.get("message_id")
    if isinstance(direct, str):
        return direct[:255]
    headers = data.get("headers")
    if isinstance(headers, dict):
        value = headers.get("message-id") or headers.get("Message-ID")
        return str(value)[:255] if value else ""
    return ""


def _sanitized_payload(payload: dict) -> dict:
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    sanitized = {
        "type": str(payload.get("type", ""))[:80],
        "created_at": str(payload.get("created_at", ""))[:80],
        "provider_message_id": str(data.get("email_id", ""))[:255],
    }
    bounce = data.get("bounce")
    if isinstance(bounce, dict) and bounce.get("type"):
        sanitized["bounce_type"] = str(bounce["type"])[:80]
    return sanitized


@dataclass(frozen=True)
class WebhookProcessingResult:
    duplicate: bool
    matched: bool
    status: str


@transaction.atomic
def process_resend_event(*, event_id: str, payload: dict) -> WebhookProcessingResult:
    event_type = str(payload.get("type", ""))[:80]
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    provider_id = str(data.get("email_id", ""))[:255]
    message_id = _message_id(data)
    delivery = None
    if provider_id:
        delivery = EmailDelivery.objects.select_for_update().filter(provider_message_id=provider_id).first()
    if delivery is None and message_id:
        delivery = EmailDelivery.objects.select_for_update().filter(message_id=message_id).first()

    event, created = EmailWebhookEvent.objects.get_or_create(
        event_id=event_id,
        defaults={
            "provider": "resend",
            "event_type": event_type,
            "delivery": delivery,
            "payload_sanitized": _sanitized_payload(payload),
        },
    )
    if not created:
        return WebhookProcessingResult(True, bool(event.delivery_id), event.event_type)
    new_status = EVENT_STATUS.get(event_type)
    if delivery is None or new_status is None:
        return WebhookProcessingResult(False, delivery is not None, event_type)

    if delivery.status in TERMINAL_STATUSES and new_status not in TERMINAL_STATUSES:
        return WebhookProcessingResult(False, True, delivery.status)

    now = timezone.now()
    update_fields = ["status", "updated_at"]
    delivery.status = new_status
    if new_status == EmailDelivery.Status.ACCEPTED and delivery.accepted_at is None:
        delivery.accepted_at = now
        delivery.sent_at = delivery.sent_at or now
        update_fields.extend(["accepted_at", "sent_at"])
    elif new_status == EmailDelivery.Status.DELIVERED:
        delivery.delivered_at = delivery.delivered_at or now
        update_fields.append("delivered_at")
    elif new_status == EmailDelivery.Status.BOUNCED:
        delivery.bounced_at = delivery.bounced_at or now
        update_fields.append("bounced_at")
    delivery.save(update_fields=update_fields)
    return WebhookProcessingResult(False, True, new_status)


def parse_webhook_json(body: bytes) -> dict:
    try:
        payload = json.loads(body.decode("utf-8"))
    except (ValueError, UnicodeError) as exc:
        raise ValueError("Invalid JSON payload") from exc
    if not isinstance(payload, dict):
        raise ValueError("Invalid JSON payload")
    return payload
