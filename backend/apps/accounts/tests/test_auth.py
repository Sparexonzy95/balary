from eth_account import Account as EthAccount
from eth_account.messages import encode_defunct
from rest_framework.test import APITestCase


class WalletAuthenticationTests(APITestCase):
    def test_nonce_signature_login_and_nonce_reuse_rejection(self):
        wallet = EthAccount.create()
        nonce_response = self.client.post(
            "/api/v1/auth/nonce/",
            {"wallet_address": wallet.address},
            format="json",
        )
        self.assertEqual(nonce_response.status_code, 200)
        signature = EthAccount.sign_message(
            encode_defunct(text=nonce_response.data["message"]),
            private_key=wallet.key,
        ).signature.hex()

        verify_payload = {
            "wallet_address": wallet.address,
            "nonce": nonce_response.data["nonce"],
            "signature": signature,
        }
        verify_response = self.client.post("/api/v1/auth/verify/", verify_payload, format="json")
        self.assertEqual(verify_response.status_code, 200)
        self.assertIn("access", verify_response.data)
        self.assertEqual(verify_response.data["account"]["wallet_address"], wallet.address)

        reuse_response = self.client.post("/api/v1/auth/verify/", verify_payload, format="json")
        self.assertEqual(reuse_response.status_code, 400)

    def test_invalid_wallet_is_rejected(self):
        response = self.client.post(
            "/api/v1/auth/nonce/",
            {"wallet_address": "not-a-wallet"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
