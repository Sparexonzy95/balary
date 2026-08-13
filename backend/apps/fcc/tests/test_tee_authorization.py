from unittest.mock import patch

from django.test import SimpleTestCase, override_settings
from eth_abi import encode

from apps.fcc.tee_authorization import TeeAuthorizationError, read_gateway_binding


TEE_ID = "0x7748CB088399CB4223375298F7404394A1680D2D"
OTHER_TEE_ID = "0x59268355660DCb868507E538b967fc0eB05A394C"
REGISTRY = "0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE"


def _address_word(address: str) -> str:
    return "0x" + (bytes(12) + bytes.fromhex(address[2:])).hex()


def _binding_word(signer: str, epoch: int = 1, active: bool = True) -> str:
    return "0x" + (
        bytes(12)
        + bytes.fromhex(signer[2:])
        + epoch.to_bytes(32, "big")
        + int(active).to_bytes(32, "big")
    ).hex()


def _uint_word(value: int) -> str:
    return "0x" + value.to_bytes(32, "big").hex()


def _active_machines(*tee_ids: str) -> str:
    return "0x" + encode(
        ["address[]", "string[]"],
        [list(tee_ids), ["https://proxy.invalid"] * len(tee_ids)],
    ).hex()


@override_settings(
    ZALARY_GATEWAY_ADDRESS="0xFE9A84346A614599C9A0b5a1F444bd816a6C100A",
    ZALARY_CHAIN_RPC_URL="https://example.invalid",
)
class TeeRoutingAuthorizationTests(SimpleTestCase):
    @patch("apps.fcc.tee_authorization._json_rpc")
    def test_accepts_live_proxy_tee_when_it_is_the_only_active_machine(self, rpc):
        rpc.side_effect = [
            {"result": _binding_word(TEE_ID)},
            {"result": _address_word(REGISTRY)},
            {"result": _uint_word(65828)},
            {"result": _active_machines(TEE_ID)},
        ]
        authorized = read_gateway_binding(TEE_ID)
        self.assertEqual(authorized.tee_id, TEE_ID)
        self.assertEqual(authorized.signer, TEE_ID)
        self.assertEqual(authorized.epoch, 1)

    @patch("apps.fcc.tee_authorization._json_rpc")
    def test_rejects_extension_with_active_legacy_machine(self, rpc):
        rpc.side_effect = [
            {"result": _binding_word(TEE_ID)},
            {"result": _address_word(REGISTRY)},
            {"result": _uint_word(65828)},
            {"result": _active_machines(OTHER_TEE_ID, TEE_ID)},
        ]
        with self.assertRaisesMessage(TeeAuthorizationError, "only active machine"):
            read_gateway_binding(TEE_ID)
