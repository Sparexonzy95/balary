import base64
import hashlib
import hmac
import json
import smtplib
import time
from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Account
from apps.chains.services import ensure_coston2_config
from apps.institutions.models import Institution, InstitutionMember

from apps.notifications.models import EmailDelivery, EmailWebhookEvent, Notification, NotificationPreference
from apps.notifications.serializers import EmailDeliverySerializer
from apps.notifications.services import emit_notification, send_email_delivery
from apps.notifications.tasks import retry_failed_email_deliveries
from apps.notifications.providers import OutgoingEmail, ResendProvider


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    EMAIL_HOST="smtp.test",
    EMAIL_HOST_USER="sender@example.com",
    DEFAULT_FROM_EMAIL="Zalary <sender@example.com>",
    ZALARY_EMAIL_PROVIDER="smtp",
    ZALARY_EMAIL_REPLY_TO="support@example.com",
    ZALARY_EMAIL_MESSAGE_ID_DOMAIN="mail.example.com",
)
class NotificationTests(TestCase):
    def setUp(self):
        self.account = Account.objects.create_user(
            "0x0EdBC6F8506e72478CE78a4AE934C7b21cb7050A",
            email="admin@example.com",
        )
        chain, vault, _, _ = ensure_coston2_config()
        self.institution = Institution.objects.create(
            name="Notify Co",
            notification_email="admin@example.com",
            institution_address=self.account.wallet_address,
            admin_address=self.account.wallet_address,
            treasury_address="0x1111111111111111111111111111111111111111",
            tax_vault_address="0x2222222222222222222222222222222222222222",
            chain=chain,
            vault_address=vault.address,
            registration_status=Institution.RegistrationStatus.ACTIVE,
            is_registered_onchain=True,
            is_active_onchain=True,
            created_by=self.account,
        )
        InstitutionMember.objects.create(
            institution=self.institution,
            account=self.account,
            wallet_address=self.account.wallet_address,
            notification_email="admin@example.com",
            role=InstitutionMember.Role.ADMIN,
            status=InstitutionMember.Status.ACTIVE,
            approved_onchain=True,
        )

    def test_email_address_is_encrypted_and_delivery_is_logged(self):
        notification = emit_notification(
            notification_type="test_notice",
            category="payroll",
            title="Test notice",
            message="A safe operational message.",
            dedup_key="test:notice:1",
            account=self.account,
            institution=self.institution,
            recipient_wallet=self.account.wallet_address,
            recipient_email="admin@example.com",
        )
        delivery = EmailDelivery.objects.get(notification=notification)
        self.assertNotIn("admin@example.com", delivery.recipient_email_ciphertext)
        self.assertEqual(delivery.recipient_email, "admin@example.com")
        send_email_delivery(delivery)
        delivery.refresh_from_db()
        self.assertEqual(delivery.status, EmailDelivery.Status.ACCEPTED)
        self.assertIsNotNone(delivery.accepted_at)
        self.assertIsNone(delivery.delivered_at)
        self.assertEqual(delivery.message_id, "")
        self.assertEqual(delivery.provider_message_id, "")
        self.assertEqual(len(mail.outbox), 1)
        outgoing = mail.outbox[0]
        self.assertEqual(outgoing.subject, "Test notice")
        self.assertEqual(outgoing.from_email, "Zalary <sender@example.com>")
        self.assertEqual(outgoing.to, ["admin@example.com"])
        self.assertIn("A safe operational message.", outgoing.body)
        self.assertEqual(
            outgoing.extra_headers,
            {"X-Zalary-Notification-ID": str(notification.id)},
        )
        self.assertEqual(outgoing.reply_to, [])
        self.assertFalse(hasattr(outgoing, "alternatives"))

    def _delivery(self, suffix: str = "delivery"):
        notification = emit_notification(
            notification_type="test_notice",
            category="payroll",
            title="Test notice",
            message="A safe operational message.",
            dedup_key=f"test:{suffix}",
            account=self.account,
            institution=self.institution,
            recipient_wallet=self.account.wallet_address,
            recipient_email="admin@example.com",
        )
        return EmailDelivery.objects.get(notification=notification)

    def test_duplicate_celery_execution_does_not_send_twice(self):
        delivery = self._delivery("duplicate-task")
        send_email_delivery(delivery)
        send_email_delivery(delivery)
        self.assertEqual(len(mail.outbox), 1)

    def test_recipient_is_decrypted_only_while_sending(self):
        with patch("apps.notifications.models.decrypt_private_text", wraps=__import__(
            "apps.common.crypto", fromlist=["decrypt_private_text"]
        ).decrypt_private_text) as decrypt:
            delivery = self._delivery("decrypt-boundary")
            self.assertEqual(decrypt.call_count, 0)
            send_email_delivery(delivery)
            self.assertEqual(decrypt.call_count, 1)

    def test_authentication_failure_becomes_failed_and_schedules_retry(self):
        delivery = self._delivery("auth-failure")
        with patch(
            "django.core.mail.message.EmailMessage.send",
            side_effect=smtplib.SMTPAuthenticationError(535, b"secret provider detail"),
        ):
            send_email_delivery(delivery)
        delivery.refresh_from_db()
        self.assertEqual(delivery.status, EmailDelivery.Status.FAILED)
        self.assertGreater(delivery.next_attempt_at, delivery.last_attempt_at)
        self.assertNotIn("secret provider detail", delivery.last_error)
        self.assertEqual(delivery.attempts, 1)

    def test_retry_task_sends_due_failed_delivery(self):
        delivery = self._delivery("retry-task")
        EmailDelivery.objects.exclude(pk=delivery.pk).update(
            next_attempt_at=timezone.now() + timedelta(days=1)
        )
        delivery.status = EmailDelivery.Status.FAILED
        delivery.next_attempt_at = timezone.now()
        delivery.save(update_fields=["status", "next_attempt_at"])
        result = retry_failed_email_deliveries()
        delivery.refresh_from_db()
        self.assertEqual(result, {"processed": 1, "accepted": 1})
        self.assertEqual(delivery.status, EmailDelivery.Status.ACCEPTED)
        self.assertEqual(len(mail.outbox), 1)

    def test_public_serializer_excludes_plaintext_and_provider_response(self):
        delivery = self._delivery("serializer-privacy")
        delivery.provider_response = "private SMTP response"
        delivery.save(update_fields=["provider_response"])
        data = EmailDeliverySerializer(delivery).data
        self.assertNotIn("recipient_email", data)
        self.assertNotIn("recipient_email_ciphertext", data)
        self.assertNotIn("provider_response", data)
        self.assertNotIn("admin@example.com", json.dumps(data))

    def test_email_delivery_does_not_broadcast_blockchain_transaction(self):
        delivery = self._delivery("no-blockchain")
        with patch("apps.fcc.services._send_contract_call") as broadcast:
            send_email_delivery(delivery)
        broadcast.assert_not_called()

    def test_dedup_key_prevents_duplicate_notification_and_email(self):
        kwargs = {
            "notification_type": "test_notice",
            "category": "payroll",
            "title": "Test notice",
            "message": "A safe operational message.",
            "dedup_key": "test:dedup:1",
            "account": self.account,
            "institution": self.institution,
            "recipient_wallet": self.account.wallet_address,
            "recipient_email": "admin@example.com",
        }
        first = emit_notification(**kwargs)
        second = emit_notification(**kwargs)
        self.assertEqual(first.id, second.id)
        self.assertEqual(Notification.objects.filter(dedup_key="test:dedup:1").count(), 1)
        self.assertEqual(EmailDelivery.objects.filter(dedup_key="email:test:dedup:1").count(), 1)

    def test_preference_can_disable_payroll_email(self):
        NotificationPreference.objects.create(
            account=self.account,
            institution=self.institution,
            payroll_updates=False,
        )
        notification = emit_notification(
            notification_type="test_notice",
            category="payroll",
            title="Test notice",
            message="A safe operational message.",
            dedup_key="test:preference:1",
            account=self.account,
            institution=self.institution,
            recipient_wallet=self.account.wallet_address,
            recipient_email="admin@example.com",
        )
        self.assertEqual(notification.email_delivery.status, EmailDelivery.Status.SKIPPED)

    @override_settings(ZALARY_NOTIFICATIONS_INLINE=True)
    def test_send_test_notification_uses_normal_email_path(self):
        output = __import__("io").StringIO()
        call_command(
            "send_test_notification",
            recipient="operator@example.com",
            timeout=10,
            stdout=output,
        )
        delivery = EmailDelivery.objects.filter(
            notification__notification_type="operational_test_email"
        ).latest("created_at")
        self.assertEqual(delivery.status, EmailDelivery.Status.ACCEPTED)
        self.assertIsNotNone(delivery.sent_at)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["operator@example.com"])
        self.assertEqual(
            mail.outbox[0].extra_headers,
            {"X-Zalary-Notification-ID": str(delivery.notification_id)},
        )
        self.assertIn("Django email send completed: True", output.getvalue())
        self.assertIn("Celery task completed: True", output.getvalue())

    def test_notification_api_marks_notice_read(self):
        notification = emit_notification(
            notification_type="test_notice",
            category="payroll",
            title="Test notice",
            message="A safe operational message.",
            dedup_key="test:api:1",
            account=self.account,
            institution=self.institution,
            recipient_wallet=self.account.wallet_address,
        )
        client = APIClient()
        client.force_authenticate(self.account)
        response = client.post(f"/api/v1/notifications/{notification.id}/read/")
        self.assertEqual(response.status_code, 200)
        notification.refresh_from_db()
        self.assertTrue(notification.read)
        self.assertIsNotNone(notification.read_at)


@override_settings(
    ZALARY_RESEND_WEBHOOK_SECRET="whsec_" + base64.b64encode(b"test-webhook-secret").decode("ascii"),
    ZALARY_EMAIL_WEBHOOK_TOLERANCE_SECONDS=300,
)
class ResendWebhookTests(TestCase):
    def setUp(self):
        self.delivery = EmailDelivery.objects.create(
            recipient_email_ciphertext="",
            subject="Safe subject",
            template_name="notification",
            dedup_key="email:webhook:test",
            status=EmailDelivery.Status.ACCEPTED,
            message_id="<webhook-test@mail.example.com>",
            provider_message_id="resend-email-id",
        )

    def _post(self, event_type: str, event_id: str = "evt-1", valid: bool = True):
        payload = {
            "type": event_type,
            "created_at": "2026-07-31T12:00:00Z",
            "data": {"email_id": "resend-email-id", "to": ["must-not-be-stored@example.com"]},
        }
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        timestamp = str(int(time.time()))
        signed = event_id.encode() + b"." + timestamp.encode() + b"." + body
        signature = base64.b64encode(
            hmac.new(b"test-webhook-secret", signed, hashlib.sha256).digest()
        ).decode("ascii")
        if not valid:
            signature = "invalid"
        return APIClient().generic(
            "POST",
            "/api/v1/notifications/provider-webhooks/resend/",
            body,
            content_type="application/json",
            HTTP_SVIX_ID=event_id,
            HTTP_SVIX_TIMESTAMP=timestamp,
            HTTP_SVIX_SIGNATURE=f"v1,{signature}",
        )

    def test_delivered_webhook_updates_accepted_to_delivered(self):
        response = self._post("email.delivered")
        self.assertEqual(response.status_code, 200)
        self.delivery.refresh_from_db()
        self.assertEqual(self.delivery.status, EmailDelivery.Status.DELIVERED)
        self.assertIsNotNone(self.delivery.delivered_at)

    def test_duplicate_webhook_is_idempotent_and_payload_is_sanitized(self):
        self._post("email.delivered", event_id="evt-duplicate")
        response = self._post("email.delivered", event_id="evt-duplicate")
        self.assertTrue(response.json()["duplicate"])
        self.assertEqual(EmailWebhookEvent.objects.filter(event_id="evt-duplicate").count(), 1)
        event = EmailWebhookEvent.objects.get(event_id="evt-duplicate")
        self.assertNotIn("must-not-be-stored@example.com", json.dumps(event.payload_sanitized))

    def test_invalid_webhook_signature_is_rejected(self):
        response = self._post("email.delivered", event_id="evt-invalid", valid=False)
        self.assertEqual(response.status_code, 403)
        self.assertFalse(EmailWebhookEvent.objects.filter(event_id="evt-invalid").exists())

    def test_bounced_webhook_updates_status(self):
        response = self._post("email.bounced", event_id="evt-bounced")
        self.assertEqual(response.status_code, 200)
        self.delivery.refresh_from_db()
        self.assertEqual(self.delivery.status, EmailDelivery.Status.BOUNCED)
        self.assertIsNotNone(self.delivery.bounced_at)

    def test_late_sent_event_does_not_downgrade_delivered(self):
        self._post("email.delivered", event_id="evt-delivered-first")
        self._post("email.sent", event_id="evt-sent-late")
        self.delivery.refresh_from_db()
        self.assertEqual(self.delivery.status, EmailDelivery.Status.DELIVERED)


@override_settings(
    ZALARY_RESEND_API_KEY="test-api-key",
    EMAIL_TIMEOUT=5,
)
class ResendProviderTests(TestCase):
    def test_resend_stores_provider_id_not_acceptance_count(self):
        outgoing = OutgoingEmail(
            subject="Diagnostic",
            text_body="Safe text",
            html_body="<p>Safe text</p>",
            from_email="Zalary <sender@example.com>",
            to_email="recipient@example.com",
            reply_to="support@example.com",
            headers={"Message-ID": "<test@mail.example.com>"},
            delivery_key="delivery-key",
        )
        response = patch("urllib.request.urlopen")
        with response as urlopen:
            urlopen.return_value.__enter__.return_value.read.return_value = b'{"id":"provider-id-123"}'
            result = ResendProvider().send(outgoing)
        self.assertTrue(result.accepted)
        self.assertEqual(result.provider_message_id, "provider-id-123")
        self.assertNotIn(result.provider_message_id, {"0", "1"})


@override_settings(
    EMAIL_HOST="smtp.example.com",
    EMAIL_PORT=465,
    EMAIL_HOST_USER="sender@example.com",
    EMAIL_HOST_PASSWORD="never-print-this",
    EMAIL_USE_SSL=True,
    EMAIL_USE_TLS=False,
    DEFAULT_FROM_EMAIL="Zalary <sender@example.com>",
    ZALARY_EMAIL_MESSAGE_ID_DOMAIN="mail.example.com",
)
class DiagnoseEmailCommandTests(TestCase):
    def test_no_send_authenticates_without_sending_or_printing_password(self):
        output = __import__("io").StringIO()
        with patch("smtplib.SMTP_SSL") as smtp_ssl:
            call_command(
                "diagnose_email",
                recipient="recipient@example.com",
                no_send=True,
                stdout=output,
            )
        connection = smtp_ssl.return_value
        connection.login.assert_called_once_with("sender@example.com", "never-print-this")
        connection.send_message.assert_not_called()
        self.assertNotIn("never-print-this", output.getvalue())
        self.assertIn("SMTP authentication: succeeded", output.getvalue())
