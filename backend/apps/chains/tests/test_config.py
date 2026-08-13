from rest_framework.test import APITestCase


class Coston2ConfigTests(APITestCase):
    def test_public_config_contains_proven_deployment(self):
        response = self.client.get("/api/v1/chains/coston2/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["chain"]["chain_id"], 114)
        self.assertEqual(
            response.data["contracts"]["vault"]["address"],
            "0xA5277D55a46514740b0C716C691d92b8D9E64e5E",
        )
        self.assertEqual(response.data["fcc"]["tee_signer_epoch"], 1)
