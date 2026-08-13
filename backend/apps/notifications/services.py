from __future__ import annotations

import logging
from datetime import timedelta
from email.utils import parseaddr
from typing import Any

from django.conf import settings
from django.core.mail import EmailMessage
from django.db import models, transaction
from django.template.loader import render_to_string
from django.utils import timezone

from apps.accounts.models import Account
from apps.accounts.services import normalize_address
from apps.common.crypto import encrypt_private_text, stable_private_hash

from .models import EmailDelivery, Notification, NotificationPreference

logger = logging.getLogger(__name__)

CATEGORY_FIELDS = {
    "institution": "institution_updates",
    "payroll": "payroll_updates",
    "withdrawal": "withdrawal_updates",
    "reminder": "reminder_updates",
    "security": "security_updates",
}


def json_safe(value: Any):
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [json_safe(item) for item in value]
    if isinstance(value, models.Model):
        return {"id": str(value.pk)}
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def account_for_wallet(wallet: str) -> Account | None:
    if not wallet:
        return None
    return Account.objects.filter(wallet_address__iexact=wallet).first()


def get_preference(*, account: Account, institution=None) -> NotificationPreference:
    preference = NotificationPreference.objects.filter(
        account=account,
        institution=institution,
    ).first()
    if preference is not None:
        return preference
    if institution is not None:
        preference = NotificationPreference.objects.filter(
            account=account,
            institution__isnull=True,
        ).first()
        if preference is not None:
            return preference
    preference, _ = NotificationPreference.objects.get_or_create(
        account=account,
        institution=None,
    )
    return preference


def channel_allowed(*, account: Account | None, institution, category: str, channel: str) -> bool:
    if account is None:
        return True
    preference = get_preference(account=account, institution=institution)
    if channel == "email" and not preference.email_enabled:
        return False
    if channel == "in_app" and not preference.in_app_enabled:
        return False
    field_name = CATEGORY_FIELDS.get(category)
    return bool(getattr(preference, field_name, True)) if field_name else True


def _delivery_delay(attempts: int) -> timedelta:
    minutes = min(60, 2 ** max(0, attempts - 1))
    return timedelta(minutes=minutes)


def _safe_failure(exc: Exception) -> str:
    # Preserve useful failure classification without leaking SMTP responses,
    # credentials, recipient addresses, or message contents into logs/database.
    return f"Email send failure ({exc.__class__.__name__})"


def _validated_sender() -> str:
    from_email = settings.DEFAULT_FROM_EMAIL.strip()
    sender_address = parseaddr(from_email)[1].strip().lower()
    authenticated_address = settings.EMAIL_HOST_USER.strip().lower()
    if (
        settings.EMAIL_HOST.strip().lower() == "smtp.gmail.com"
        and authenticated_address
        and sender_address != authenticated_address
    ):
        raise ValueError("Gmail From address must match the authenticated SMTP identity")
    if not sender_address:
        raise ValueError("DEFAULT_FROM_EMAIL is invalid")
    return from_email


def send_email_delivery(delivery: EmailDelivery) -> EmailDelivery:
    """Send one encrypted-at-rest notification through Django's mail backend.

    This intentionally mirrors the sample backend's simple EmailMessage flow.
    SMTP success is recorded as ACCEPTED because inbox placement cannot be proven
    by Django or Gmail SMTP alone.
    """
    now = timezone.now()
    stale_before = now - timedelta(minutes=10)

    with transaction.atomic():
        claimed = EmailDelivery.objects.select_for_update().get(pk=delivery.pk)
        if claimed.status in {
            EmailDelivery.Status.ACCEPTED,
            EmailDelivery.Status.DELIVERED,
            EmailDelivery.Status.BOUNCED,
            EmailDelivery.Status.COMPLAINED,
            EmailDelivery.Status.REJECTED,
            EmailDelivery.Status.SKIPPED,
            "sent",
        }:
            return claimed
        if (
            claimed.status == EmailDelivery.Status.SENDING
            and claimed.last_attempt_at
            and claimed.last_attempt_at > stale_before
        ):
            return claimed
        if claimed.attempts >= claimed.max_attempts:
            claimed.status = EmailDelivery.Status.FAILED
            claimed.last_error = claimed.last_error or "Maximum delivery attempts reached"
            claimed.error_message = claimed.last_error
            claimed.save(update_fields=["status", "last_error", "error_message", "updated_at"])
            return claimed

        claimed.status = EmailDelivery.Status.SENDING
        claimed.attempts += 1
        claimed.last_attempt_at = now
        claimed.save(update_fields=["status", "attempts", "last_attempt_at", "updated_at"])

    try:
        # Decrypt only inside the send boundary. The plaintext recipient is never
        # persisted or included in normal worker logs.
        recipient = claimed.recipient_email
        if not recipient:
            claimed.status = EmailDelivery.Status.SKIPPED
            claimed.last_error = "Missing recipient email"
            claimed.error_message = claimed.last_error
            claimed.save(update_fields=["status", "last_error", "error_message", "updated_at"])
            return claimed

        context = {
            **claimed.context_json,
            "subject": claimed.subject,
            "app_name": "Zalary",
            "app_url": settings.ZALARY_APP_URL,
        }
        text_body = render_to_string(f"emails/{claimed.template_name}.txt", context)
        message = EmailMessage(
            subject=claimed.subject,
            body=text_body,
            from_email=_validated_sender(),
            to=[recipient],
            headers={
                "X-Zalary-Notification-ID": str(claimed.notification_id or "none"),
            },
        )
        sent_count = message.send(fail_silently=False)
        if sent_count != 1:
            raise RuntimeError("Django email backend did not accept the message")
    except Exception as exc:
        claimed.status = EmailDelivery.Status.FAILED
        claimed.last_error = _safe_failure(exc)
        claimed.error_message = claimed.last_error
        claimed.next_attempt_at = now + _delivery_delay(claimed.attempts)
        claimed.save(
            update_fields=[
                "status",
                "last_error",
                "error_message",
                "next_attempt_at",
                "updated_at",
            ]
        )
        logger.warning(
            "email_delivery state=failed delivery_uuid=%s notification_type=%s "
            "attempt=%s smtp_host=%s exception_class=%s",
            claimed.public_id,
            getattr(claimed.notification, "notification_type", "unknown"),
            claimed.attempts,
            settings.EMAIL_HOST,
            exc.__class__.__name__,
        )
        return claimed

    accepted_at = timezone.now()
    claimed.status = EmailDelivery.Status.ACCEPTED
    # Django/Gmail owns the RFC Message-ID. Do not inject a local-domain ID and
    # do not store Django's integer send count as a provider identifier.
    claimed.message_id = ""
    claimed.provider_message_id = ""
    claimed.provider_response = ""
    claimed.last_error = ""
    claimed.error_message = ""
    claimed.accepted_at = accepted_at
    claimed.sent_at = accepted_at
    claimed.next_attempt_at = accepted_at
    claimed.save(
        update_fields=[
            "status",
            "message_id",
            "provider_message_id",
            "provider_response",
            "last_error",
            "error_message",
            "accepted_at",
            "sent_at",
            "next_attempt_at",
            "updated_at",
        ]
    )
    logger.info(
        "email_delivery state=accepted delivery_uuid=%s notification_type=%s "
        "attempt=%s smtp_host=%s exception_class=none",
        claimed.public_id,
        getattr(claimed.notification, "notification_type", "unknown"),
        claimed.attempts,
        settings.EMAIL_HOST,
    )
    return claimed


def enqueue_email_delivery(delivery_id: int) -> None:
    from .tasks import send_email_notification

    if settings.ZALARY_NOTIFICATIONS_INLINE or settings.CELERY_TASK_ALWAYS_EAGER:
        send_email_notification(delivery_id)
        return
    try:
        send_email_notification.delay(delivery_id)
    except Exception:
        if settings.DEBUG:
            send_email_notification(delivery_id)


@transaction.atomic
def emit_notification(
    *,
    notification_type: str,
    category: str,
    title: str,
    message: str,
    dedup_key: str,
    account: Account | None = None,
    institution=None,
    recipient_wallet: str = "",
    recipient_email: str = "",
    template_name: str = "notification",
    context: dict | None = None,
    metadata: dict | None = None,
    payroll_run=None,
    withdrawal=None,
) -> Notification:
    wallet = normalize_address(recipient_wallet) if recipient_wallet else ""
    allow_in_app = channel_allowed(
        account=account,
        institution=institution,
        category=category,
        channel="in_app",
    )
    allow_email = bool(recipient_email) and channel_allowed(
        account=account,
        institution=institution,
        category=category,
        channel="email",
    )

    if allow_in_app and allow_email:
        channel = Notification.Channel.BOTH
    elif allow_email:
        channel = Notification.Channel.EMAIL
    else:
        channel = Notification.Channel.IN_APP

    notification, _ = Notification.objects.get_or_create(
        dedup_key=dedup_key,
        defaults={
            "account": account,
            "institution": institution,
            "recipient_wallet": wallet,
            "notification_type": notification_type,
            "category": category,
            "title": title,
            "message": message,
            "channel": channel,
            "metadata": json_safe(metadata or {}),
        },
    )

    email_dedup_key = f"email:{dedup_key}"
    delivery = EmailDelivery.objects.filter(dedup_key=email_dedup_key).first()
    if delivery is None:
        if not recipient_email:
            delivery = EmailDelivery.objects.create(
                notification=notification,
                institution=institution,
                payroll_run=payroll_run,
                withdrawal=withdrawal,
                recipient_wallet=wallet,
                subject=title,
                template_name=template_name,
                context_json=json_safe({"title": title, "message": message, **(context or {})}),
                dedup_key=email_dedup_key,
                status=EmailDelivery.Status.SKIPPED,
                last_error="Missing recipient email",
                error_message="Missing recipient email",
            )
        elif not allow_email:
            delivery = EmailDelivery.objects.create(
                notification=notification,
                institution=institution,
                payroll_run=payroll_run,
                withdrawal=withdrawal,
                recipient_email_ciphertext=encrypt_private_text(recipient_email.strip().lower()),
                recipient_email_hash=stable_private_hash(recipient_email),
                recipient_wallet=wallet,
                subject=title,
                template_name=template_name,
                context_json=json_safe({"title": title, "message": message, **(context or {})}),
                dedup_key=email_dedup_key,
                status=EmailDelivery.Status.SKIPPED,
                last_error="Notification preference disabled",
                error_message="Notification preference disabled",
            )
        else:
            delivery = EmailDelivery.objects.create(
                notification=notification,
                institution=institution,
                payroll_run=payroll_run,
                withdrawal=withdrawal,
                recipient_email_ciphertext=encrypt_private_text(recipient_email.strip().lower()),
                recipient_email_hash=stable_private_hash(recipient_email),
                recipient_wallet=wallet,
                subject=title,
                template_name=template_name,
                context_json=json_safe({"title": title, "message": message, **(context or {})}),
                dedup_key=email_dedup_key,
            )
        if delivery.status == EmailDelivery.Status.PENDING:
            transaction.on_commit(lambda: enqueue_email_delivery(delivery.id))

    return notification
