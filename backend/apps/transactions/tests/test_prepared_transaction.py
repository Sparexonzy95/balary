from eth_account import Account as EthAccount
from rest_framework.test import APITestCase

from apps.accounts.models import Account
from apps.institutions.models import Institution


class PreparedTransactionSecurityTests(APITestCase):
    def test_another_wallet_cannot_confirm_prepared_registration(self):
        owner = Account.objects.create_user(wallet_address=EthAccount.create().address)
        attacker = Account.objects.create_user(wallet_address=EthAccount.create().address)
        self.client.force_authenticate(owner)
        create_response = self.client.post(
            "/api/v1/institutions/",
            {
                "name": "Secure Org",
                "treasury_address": EthAccount.create().address,
                "tax_vault_address": EthAccount.create().address,
            },
            format="json",
        )
        institution = Institution.objects.get(id=create_response.data["id"])
        prepared = self.client.post(
            f"/api/v1/institutions/{institution.id}/registration/prepare/",
            format="json",
        ).data["prepared_transaction"]

        self.client.force_authenticate(attacker)
        response = self.client.post(
            f"/api/v1/institutions/{institution.id}/registration/confirm/",
            {
                "prepared_transaction_id": prepared["id"],
                "tx_hash": "0x" + "34" * 32,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 404)
