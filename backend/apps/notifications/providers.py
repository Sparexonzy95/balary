from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Protocol

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger(__name__)


class EmailProviderError(RuntimeError):
    """A deliberately non-sensitive provider failure."""


@dataclass(frozen=True)
class OutgoingEmail:
    subject: str
    text_body: str
    html_body: str
    from_email: str
    to_email: str
    reply_to: str
    headers: dict[str, str]
    delivery_key: str


@dataclass(frozen=True)
class ProviderResult:
    accepted: bool
    provider_message_id: str = ""
    response: str = ""


class EmailProvider(Protocol):
    name: str

    def send(self, outgoing: OutgoingEmail) -> ProviderResult: ...


class SMTPProvider:
    name = "smtp"

    def send(self, outgoing: OutgoingEmail) -> ProviderResult:
        message = EmailMultiAlternatives(
            subject=outgoing.subject,
            body=outgoing.text_body,
            from_email=outgoing.from_email,
            to=[outgoing.to_email],
            reply_to=[outgoing.reply_to],
            headers=outgoing.headers,
        )
        message.attach_alternative(outgoing.html_body, "text/html")
        accepted_count = message.send(fail_silently=False)
        if accepted_count != 1:
            raise EmailProviderError("SMTP server did not accept the message")
        # Django's integer count is intentionally neither returned nor stored as an ID.
        return ProviderResult(accepted=True, response="smtp_accepted")


class ResendProvider:
    name = "resend"
    endpoint = "https://api.resend.com/emails"

    def send(self, outgoing: OutgoingEmail) -> ProviderResult:
        api_key = settings.ZALARY_RESEND_API_KEY.strip()
        if not api_key:
            raise EmailProviderError("Resend API key is not configured")
        payload = json.dumps(
            {
                "from": outgoing.from_email,
                "to": [outgoing.to_email],
                "reply_to": outgoing.reply_to,
                "subject": outgoing.subject,
                "text": outgoing.text_body,
                "html": outgoing.html_body,
                "headers": outgoing.headers,
            }
        ).encode("utf-8")
        request = urllib.request.Request(
            self.endpoint,
            data=payload,
            method="POST",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Idempotency-Key": outgoing.delivery_key,
                "User-Agent": "Zalary-Email/5.1",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=settings.EMAIL_TIMEOUT) as response:
                response_body = response.read(16_384)
        except urllib.error.HTTPError as exc:
            # Never include response bodies: providers may echo addresses or content.
            raise EmailProviderError(f"Resend request failed with HTTP {exc.code}") from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            raise EmailProviderError("Resend request failed") from exc
        try:
            provider_id = str(json.loads(response_body.decode("utf-8"))["id"])
        except (KeyError, TypeError, ValueError, UnicodeError) as exc:
            raise EmailProviderError("Resend returned an invalid response") from exc
        return ProviderResult(
            accepted=True,
            provider_message_id=provider_id[:255],
            response="resend_accepted",
        )


def get_email_provider(name: str | None = None) -> EmailProvider:
    provider_name = (name or settings.ZALARY_EMAIL_PROVIDER).strip().lower()
    providers: dict[str, EmailProvider] = {
        "smtp": SMTPProvider(),
        "resend": ResendProvider(),
    }
    if provider_name in {"postmark", "brevo", "mailgun", "amazon_ses"}:
        raise EmailProviderError(f"Email provider '{provider_name}' is recognized but not implemented")
    try:
        return providers[provider_name]
    except KeyError as exc:
        raise EmailProviderError(f"Unsupported email provider '{provider_name}'") from exc
