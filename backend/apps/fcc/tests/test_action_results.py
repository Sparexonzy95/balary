from eth_abi import encode
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak
from django.test import SimpleTestCase, override_settings

from apps.fcc.services import recover_action_signer


@override_settings(COSTON2_CHAIN_ID=114)
class ActionResultSignatureTests(SimpleTestCase):
    def test_recovers_tee_signature_with_zero_one_recovery_value(self):
        signer = Account.from_key("0x" + "11" * 32)
        result_data = "0x" + "22" * 96
        action_id = "0x" + "33" * 32
        submission_tag = "zalary-test"
        status = 1
        result_hash = keccak(
            keccak(bytes.fromhex(result_data[2:]))
            + bytes.fromhex(action_id[2:])
            + keccak(submission_tag.encode())
            + bytes([status])
        )
        prefix = b"TEE_ACTION_RESULT".ljust(32, b"\x00")
        payload_hash = keccak(encode(["bytes32", "uint256", "bytes32"], [prefix, 114, result_hash]))
        signed = signer.sign_message(encode_defunct(primitive=payload_hash))
        signature = bytearray(signed.signature)
        signature[64] -= 27
        recovered = recover_action_signer(
            result_data=result_data,
            action_id=action_id,
            submission_tag=submission_tag,
            status=status,
            signature="0x" + signature.hex(),
        )
        self.assertEqual(recovered, signer.address)
