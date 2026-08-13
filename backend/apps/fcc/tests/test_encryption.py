from unittest.mock import Mock, patch

from django.test import SimpleTestCase, override_settings

from apps.fcc.services import FccEncryptionError, encrypt_for_registered_tee


@override_settings(
    ZALARY_ENCRYPTOR_COMMAND="zalary-encrypt.exe",
    ZALARY_FCC_PROXY_URL="https://example.invalid",
    ZALARY_TEE_ID="0x7748CB088399CB4223375298F7404394A1680D2D",
    ZALARY_TEE_SIGNER_EPOCH=2,
    ZALARY_TEE_AUTH_MODE="static",
)
class FccEncryptionTests(SimpleTestCase):
    @patch("apps.fcc.services.subprocess.run")
    def test_encryptor_output_is_hashed_and_returned(self, run_mock):
        run_mock.return_value = Mock(
            returncode=0,
            stdout=("0x" + "11" * 100).encode("ascii"),
            stderr=b"",
        )
        result = encrypt_for_registered_tee(b'{"version":"1"}')
        self.assertEqual(result.ciphertext, "0x" + "11" * 100)
        self.assertEqual(len(result.ciphertext_hash), 66)
        called_env = run_mock.call_args.kwargs["env"]
        self.assertEqual(called_env["TEE_ID"], "0x7748CB088399CB4223375298F7404394A1680D2D")

    @patch("apps.fcc.services.subprocess.run")
    def test_tee_identity_mismatch_is_not_exposed_as_raw_process_output(self, run_mock):
        run_mock.return_value = Mock(
            returncode=1,
            stdout=b"",
            stderr=b"TEE identity mismatch: endpoint=x expected=y",
        )
        with self.assertRaisesMessage(FccEncryptionError, "TEE identity verification failed"):
            encrypt_for_registered_tee(b"secret")
