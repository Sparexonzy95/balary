from django.test import TestCase

from apps.accounts.models import Account
from apps.chains.services import ensure_coston2_config
from apps.institutions.models import Institution, InstitutionMember

from apps.employees.services import EmployeeFlowError, create_employee


class EmployeePrivacyTests(TestCase):
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

    def test_sensitive_employee_fields_are_encrypted_at_rest(self):
        employee = create_employee(
            actor=self.account,
            institution=self.institution,
            auth_wallet="0x3333333333333333333333333333333333333333",
            name="Private Person",
            email="private@example.com",
        )
        self.assertNotIn("3333333333", employee.auth_wallet_ciphertext)
        self.assertNotIn("Private Person", employee.name_ciphertext)
        self.assertNotIn("private@example.com", employee.email_ciphertext)
        self.assertEqual(employee.auth_wallet, "0x3333333333333333333333333333333333333333")
        self.assertEqual(employee.private_name, "Private Person")
        self.assertEqual(employee.private_email, "private@example.com")

    def test_duplicate_employee_wallet_is_rejected(self):
        kwargs = {
            "actor": self.account,
            "institution": self.institution,
            "auth_wallet": "0x3333333333333333333333333333333333333333",
        }
        create_employee(**kwargs)
        with self.assertRaisesMessage(EmployeeFlowError, "already registered"):
            create_employee(**kwargs)
