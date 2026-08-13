from eth_account import Account as EthAccount
from web3 import Web3
from rest_framework.test import APITestCase

from apps.accounts.models import Account
from apps.institutions.models import Institution, InstitutionMember


class InstitutionOnboardingTests(APITestCase):
    def setUp(self):
        self.owner_wallet = EthAccount.create().address
        self.owner = Account.objects.create_user(wallet_address=self.owner_wallet)
        self.client.force_authenticate(self.owner)

    def _create_institution(self):
        response = self.client.post(
            "/api/v1/institutions/",
            {
                "name": "Acme Payroll",
                "notification_email": "ops@example.com",
                "treasury_address": EthAccount.create().address,
                "tax_vault_address": EthAccount.create().address,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        return Institution.objects.get(id=response.data["id"])

    def test_prepare_registration_targets_live_vault_and_correct_selector(self):
        institution = self._create_institution()
        response = self.client.post(
            f"/api/v1/institutions/{institution.id}/registration/prepare/",
            format="json",
            HTTP_IDEMPOTENCY_KEY="register-acme-1",
        )
        self.assertEqual(response.status_code, 200)
        prepared = response.data["prepared_transaction"]
        selector = Web3.keccak(text="registerMyInstitution(address,address)")[:4].hex()
        self.assertEqual(prepared["chain_id"], 114)
        self.assertEqual(prepared["from_address"], self.owner_wallet)
        self.assertEqual(prepared["to"], "0xA5277D55a46514740b0C716C691d92b8D9E64e5E")
        self.assertTrue(prepared["data"].startswith(selector))
        self.assertEqual(prepared["expected_event"], "InstitutionRegistered")

    def test_confirm_registration_records_pending_transaction(self):
        institution = self._create_institution()
        prepared = self.client.post(
            f"/api/v1/institutions/{institution.id}/registration/prepare/",
            format="json",
        ).data["prepared_transaction"]
        response = self.client.post(
            f"/api/v1/institutions/{institution.id}/registration/confirm/",
            {
                "prepared_transaction_id": prepared["id"],
                "tx_hash": "0x" + "12" * 32,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 202)
        institution.refresh_from_db()
        self.assertEqual(institution.registration_status, Institution.RegistrationStatus.PENDING)

    def test_active_admin_can_prepare_hr_assignment(self):
        institution = self._create_institution()
        institution.registration_status = Institution.RegistrationStatus.ACTIVE
        institution.is_registered_onchain = True
        institution.is_active_onchain = True
        institution.save()
        admin = institution.members.get(role=InstitutionMember.Role.ADMIN)
        admin.status = InstitutionMember.Status.ACTIVE
        admin.approved_onchain = True
        admin.save()

        hr_wallet = EthAccount.create().address
        response = self.client.post(
            f"/api/v1/institutions/{institution.id}/roles/hr/prepare/",
            {"wallet_address": hr_wallet, "approved": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        selector = Web3.keccak(text="setInstitutionHR(address,address,bool)")[:4].hex()
        self.assertTrue(response.data["prepared_transaction"]["data"].startswith(selector))
