from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Account
from apps.chains.services import ensure_coston2_config
from apps.employees.services import create_employee
from apps.fcc.services import EncryptedPayload
from apps.institutions.models import Institution, InstitutionMember

from apps.payroll.models import PayrollEmployeeAllocation, PayrollImportBatch, PayrollRun
from apps.payroll.services import PayrollFlowError, create_payroll, encrypt_upload, validate_upload


class PrivatePayrollTests(TestCase):
    def setUp(self):
        self.account = Account.objects.create_user("0x0EdBC6F8506e72478CE78a4AE934C7b21cb7050A")
        chain, vault, _, _ = ensure_coston2_config()
        self.institution = Institution.objects.create(
            name="Private Co",
            notification_email="",
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
            role=InstitutionMember.Role.HR,
            status=InstitutionMember.Status.ACTIVE,
            approved_onchain=True,
        )
        self.employee = create_employee(
            actor=self.account,
            institution=self.institution,
            auth_wallet="0x3333333333333333333333333333333333333333",
            name="Private Person",
            email="private@example.com",
        )
        now = timezone.now() + timedelta(minutes=5)
        self.payroll = create_payroll(
            actor=self.account,
            institution=self.institution,
            title="July Payroll",
            period_label="2026-07",
            funding_starts_at=now,
            funding_deadline=now + timedelta(days=2),
            minimum_withdrawal_window_seconds=86400,
            settlement_grace_period_seconds=86400,
        )

    def csv(self, *, duplicate=False):
        header = "employee_ref,auth_address,gross_amount,bonus_amount,deductions_amount,tax_amount\n"
        row = f"{self.employee.employee_ref},{self.employee.auth_wallet},10,1,2,1\n"
        return (header + row + (row if duplicate else "")).encode("utf-8")

    def test_csv_retains_only_the_encrypted_employee_allocation(self):
        result = validate_upload(
            actor=self.account,
            payroll=self.payroll,
            raw=self.csv(),
            filename="july.csv",
        )
        self.payroll.refresh_from_db()
        self.assertTrue(result.valid)
        self.assertEqual(result.employee_net_total, 8_000_000)
        self.assertEqual(result.aggregate_tax_total, 1_000_000)
        self.assertEqual(result.total_required, 9_000_000)
        self.assertEqual(self.payroll.status, PayrollRun.Status.VALIDATED)
        self.assertEqual(PayrollImportBatch.objects.count(), 1)
        self.assertFalse(hasattr(self.payroll, "payments"))
        self.assertNotIn("Private Person", self.payroll.metadata_json.__str__())
        self.assertNotIn("private@example.com", self.payroll.metadata_json.__str__())
        allocation = PayrollEmployeeAllocation.objects.get(
            payroll_run=self.payroll,
            employee=self.employee,
        )
        self.assertEqual(allocation.authorized_amount, 8_000_000)
        self.assertNotEqual(allocation.amount_ciphertext, "8000000")
        self.assertNotIn("8000000", allocation.amount_ciphertext)

    def test_duplicate_employee_reference_is_rejected(self):
        with self.assertRaises(PayrollFlowError) as context:
            validate_upload(
                actor=self.account,
                payroll=self.payroll,
                raw=self.csv(duplicate=True),
                filename="duplicate.csv",
            )
        self.assertTrue(any(item["field"] == "employee_ref" for item in context.exception.errors))
        self.assertFalse(PayrollImportBatch.objects.latest("id").is_valid)

    @patch("apps.payroll.services.encrypt_for_registered_tee")
    def test_valid_payload_is_handed_to_encryptor_and_only_ciphertext_is_persisted(self, encrypt_mock):
        encrypt_mock.return_value = EncryptedPayload(
            ciphertext="0x" + "ab" * 100,
            ciphertext_hash="0x" + "cd" * 32,
            tee_id="0x7748CB088399CB4223375298F7404394A1680D2D",
            endpoint="https://example.invalid",
        )
        encrypt_upload(
            actor=self.account,
            payroll=self.payroll,
            raw=self.csv(),
            filename="july.csv",
        )
        self.payroll.refresh_from_db()
        private_payload = encrypt_mock.call_args.args[0].decode("utf-8")
        self.assertIn(str(self.employee.employee_ref), private_payload)
        self.assertIn("grossAmount", private_payload)
        self.assertNotIn("Private Person", private_payload)
        self.assertNotIn("private@example.com", private_payload)
        self.assertEqual(self.payroll.status, PayrollRun.Status.ENCRYPTED_READY)
        self.assertEqual(self.payroll.ciphertext_hash, "0x" + "cd" * 32)
        self.assertNotIn(str(self.employee.employee_ref), self.payroll.ciphertext)
