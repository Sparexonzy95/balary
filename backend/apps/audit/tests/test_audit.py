from datetime import timedelta

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Account
from apps.chains.services import ensure_coston2_config
from apps.institutions.models import Institution, InstitutionMember
from apps.payroll.models import PayrollRun

from apps.audit.models import AuditEvent


class AuditAndReportTests(TestCase):
    def setUp(self):
        self.account = Account.objects.create_user(
            "0x0EdBC6F8506e72478CE78a4AE934C7b21cb7050A"
        )
        chain, vault, _, _ = ensure_coston2_config()
        self.institution = Institution.objects.create(
            name="Audit Co",
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
            role=InstitutionMember.Role.ADMIN,
            status=InstitutionMember.Status.ACTIVE,
            approved_onchain=True,
        )
        now = timezone.now()
        self.payroll = PayrollRun.objects.create(
            institution=self.institution,
            chain=chain,
            title="Audit Payroll",
            period_label="July 2026",
            funding_starts_at=now + timedelta(minutes=10),
            funding_deadline=now + timedelta(days=1),
            minimum_withdrawal_window_seconds=86400,
            settlement_grace_period_seconds=3600,
            created_by=self.account,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.account)

    def test_model_signals_create_audit_events(self):
        self.assertTrue(
            AuditEvent.objects.filter(
                target_type="payroll.PayrollRun",
                target_id=str(self.payroll.id),
                action="payroll_created",
            ).exists()
        )

    def test_audit_events_are_append_only(self):
        event = AuditEvent.objects.filter(institution=self.institution).first()
        event.action = "tampered"
        with self.assertRaises(ValidationError):
            event.save()

    def test_payroll_report_excludes_ciphertext_and_private_rows(self):
        response = self.client.get(f"/api/v1/audit/payrolls/{self.payroll.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("ciphertext", response.data)
        self.assertNotIn("salary_rows", response.data)
        self.assertEqual(response.data["payroll_id"], self.payroll.payroll_id)

    def test_audit_csv_export(self):
        response = self.client.get(f"/api/v1/audit/events.csv?institution_id={self.institution.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv")
        self.assertIn(b"payroll_created", response.content)
