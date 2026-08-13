from __future__ import annotations

from dataclasses import dataclass
import json
from urllib import request as urllib_request

from django.conf import settings
from eth_abi import decode, encode
from eth_abi.exceptions import DecodingError
from eth_utils import keccak, to_checksum_address


ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"


class TeeAuthorizationError(RuntimeError):
    pass


@dataclass(frozen=True)
class AuthorizedTee:
    tee_id: str
    signer: str
    epoch: int


def _json_rpc(payload: dict) -> dict:
    body = json.dumps(payload).encode("utf-8")

    request = urllib_request.Request(
        settings.ZALARY_CHAIN_RPC_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib_request.urlopen(request, timeout=15) as response:
        result = json.load(response)

    if result.get("error"):
        message = result["error"].get("message", "unknown RPC error")
        raise TeeAuthorizationError(
            f"Gateway authorization check failed: {message}"
        )

    return result


def _derive_tee_id(info: dict) -> str:
    try:
        public_key = info["teeInfo"]["publicKey"]
        x = bytes.fromhex(public_key["x"].removeprefix("0x"))
        y = bytes.fromhex(public_key["y"].removeprefix("0x"))
    except (KeyError, TypeError, ValueError) as exc:
        raise TeeAuthorizationError(
            "FCC proxy returned malformed TEE identity information"
        ) from exc

    if len(x) != 32 or len(y) != 32:
        raise TeeAuthorizationError(
            "FCC proxy returned an invalid TEE public key"
        )

    return to_checksum_address(
        "0x" + keccak(x + y)[-20:].hex()
    )


def read_gateway_binding(tee_id: str) -> AuthorizedTee:
    tee_id = to_checksum_address(tee_id)
    gateway = to_checksum_address(
        settings.ZALARY_GATEWAY_ADDRESS
    )

    selector = keccak(text="teeBindings(address)")[:4]
    encoded_address = bytes(12) + bytes.fromhex(tee_id[2:])
    calldata = "0x" + (selector + encoded_address).hex()

    response = _json_rpc(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_call",
            "params": [
                {
                    "to": gateway,
                    "data": calldata,
                },
                "latest",
            ],
        }
    )

    result = response.get("result")

    if not isinstance(result, str) or not result.startswith("0x"):
        raise TeeAuthorizationError(
            "Gateway returned a malformed TEE binding"
        )

    raw = bytes.fromhex(result[2:])

    if len(raw) < 96:
        raise TeeAuthorizationError(
            "Gateway returned an incomplete TEE binding"
        )

    signer = to_checksum_address(
        "0x" + raw[12:32].hex()
    )
    epoch = int.from_bytes(raw[32:64], "big")
    active = bool(int.from_bytes(raw[64:96], "big"))

    if signer.lower() == ZERO_ADDRESS.lower():
        raise TeeAuthorizationError(
            f"TEE {tee_id} has no gateway signer binding"
        )

    if not active:
        raise TeeAuthorizationError(
            f"TEE {tee_id} is not active in the gateway"
        )

    if epoch <= 0:
        raise TeeAuthorizationError(
            f"TEE {tee_id} has an invalid signer epoch"
        )

    registry_response = _json_rpc(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "eth_call",
            "params": [
                {
                    "to": gateway,
                    "data": "0x" + keccak(text="TEE_MACHINE_REGISTRY()")[:4].hex(),
                },
                "latest",
            ],
        }
    )
    registry_result = registry_response.get("result")
    if not isinstance(registry_result, str) or not registry_result.startswith("0x"):
        raise TeeAuthorizationError(
            "Gateway returned a malformed FCC machine registry"
        )
    try:
        registry_raw = bytes.fromhex(registry_result[2:])
    except ValueError as exc:
        raise TeeAuthorizationError(
            "Gateway returned a malformed FCC machine registry"
        ) from exc
    if len(registry_raw) < 32:
        raise TeeAuthorizationError(
            "Gateway returned an incomplete FCC machine registry"
        )
    registry = to_checksum_address("0x" + registry_raw[-20:].hex())

    extension_response = _json_rpc(
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "eth_call",
            "params": [
                {
                    "to": gateway,
                    "data": "0x" + keccak(text="extensionId()")[:4].hex(),
                },
                "latest",
            ],
        }
    )
    extension_result = extension_response.get("result")
    if not isinstance(extension_result, str) or not extension_result.startswith("0x"):
        raise TeeAuthorizationError("Gateway returned a malformed FCC extension ID")
    try:
        extension_id = int(extension_result, 16)
    except ValueError as exc:
        raise TeeAuthorizationError("Gateway returned a malformed FCC extension ID") from exc
    if extension_id <= 0:
        raise TeeAuthorizationError("Gateway returned an invalid FCC extension ID")

    active_calldata = (
        keccak(text="getActiveTeeMachines(uint256)")[:4]
        + encode(["uint256"], [extension_id])
    )
    active_response = _json_rpc(
        {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "eth_call",
            "params": [
                {"to": registry, "data": "0x" + active_calldata.hex()},
                "latest",
            ],
        }
    )
    active_result = active_response.get("result")
    if not isinstance(active_result, str) or not active_result.startswith("0x"):
        raise TeeAuthorizationError("FCC registry returned malformed active TEE data")
    try:
        active_tee_ids, active_urls = decode(
            ["address[]", "string[]"], bytes.fromhex(active_result[2:])
        )
    except (ValueError, TypeError, DecodingError) as exc:
        raise TeeAuthorizationError("FCC registry returned malformed active TEE data") from exc
    if len(active_tee_ids) != len(active_urls):
        raise TeeAuthorizationError("FCC registry returned inconsistent active TEE data")
    normalized_active = [to_checksum_address(value) for value in active_tee_ids]
    if normalized_active != [tee_id]:
        raise TeeAuthorizationError(
            "Live FCC proxy TEE must be the extension's only active machine"
        )

    return AuthorizedTee(
        tee_id=tee_id,
        signer=signer,
        epoch=epoch,
    )


def resolve_live_authorized_tee() -> AuthorizedTee:
    mode = settings.ZALARY_TEE_AUTH_MODE.strip().lower()

    if mode == "static":
        return AuthorizedTee(
            tee_id=to_checksum_address(
                settings.ZALARY_TEE_ID
            ),
            signer=to_checksum_address(
                settings.ZALARY_TEE_ID
            ),
            epoch=int(
                settings.ZALARY_TEE_SIGNER_EPOCH
            ),
        )

    if mode != "onchain":
        raise TeeAuthorizationError(
            f"Unsupported ZALARY_TEE_AUTH_MODE: {mode}"
        )

    proxy_url = (
        settings.ZALARY_FCC_PROXY_URL.rstrip("/")
        + "/info"
    )

    try:
        request = urllib_request.Request(
            proxy_url,
            headers={
                "Accept": "application/json",
                "ngrok-skip-browser-warning": "true",
            },
        )

        with urllib_request.urlopen(
            request,
            timeout=15,
        ) as response:
            info = json.load(response)

    except Exception as exc:
        raise TeeAuthorizationError(
            "Could not read the live TEE identity "
            "from the FCC proxy"
        ) from exc

    tee_id = _derive_tee_id(info)
    return read_gateway_binding(tee_id)
