from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from django.conf import settings
from eth_utils import to_checksum_address
from web3 import Web3

from .models import Chain, ContractDeployment, SupportedToken

ABI_DIR = Path(settings.BASE_DIR) / "contracts" / "abis"


@dataclass(frozen=True)
class ContractTarget:
    """Lightweight contract descriptor for transaction preparation."""

    chain: Chain
    address: str
    abi_json: list[dict]


@lru_cache(maxsize=8)
def load_abi(filename: str) -> list[dict]:
    return json.loads((ABI_DIR / filename).read_text(encoding="utf-8"))


def ensure_coston2_config():
    chain, _ = Chain.objects.update_or_create(
        chain_id=settings.COSTON2_CHAIN_ID,
        defaults={
            "name": "Flare Coston2",
            "rpc_url": settings.COSTON2_RPC_URL,
            "explorer_url": settings.COSTON2_EXPLORER_URL,
            "is_active": True,
        },
    )
    vault, _ = ContractDeployment.objects.update_or_create(
        chain=chain,
        name=ContractDeployment.ContractName.VAULT,
        defaults={
            "address": to_checksum_address(settings.ZALARY_VAULT_ADDRESS),
            "abi_json": load_abi("zalary_vault.json"),
            "is_active": True,
        },
    )
    gateway, _ = ContractDeployment.objects.update_or_create(
        chain=chain,
        name=ContractDeployment.ContractName.GATEWAY,
        defaults={
            "address": to_checksum_address(settings.ZALARY_GATEWAY_ADDRESS),
            "abi_json": load_abi("zalary_gateway.json"),
            "is_active": True,
        },
    )
    token, _ = SupportedToken.objects.update_or_create(
        chain=chain,
        address=to_checksum_address(settings.ZALARY_STABLECOIN_ADDRESS),
        defaults={
            "symbol": settings.ZALARY_STABLECOIN_SYMBOL,
            "decimals": settings.ZALARY_STABLECOIN_DECIMALS,
            "is_active": True,
        },
    )
    return chain, vault, gateway, token


def get_stablecoin_target() -> ContractTarget:
    chain, _, _, token = ensure_coston2_config()
    return ContractTarget(
        chain=chain,
        address=token.address,
        abi_json=load_abi("erc20.json"),
    )


def get_coston2_web3() -> Web3:
    chain, _, _, _ = ensure_coston2_config()
    return Web3(Web3.HTTPProvider(chain.rpc_url, request_kwargs={"timeout": 15}))


def get_vault_contract(web3_client: Web3 | None = None):
    _, vault, _, _ = ensure_coston2_config()
    web3_client = web3_client or get_coston2_web3()
    return web3_client.eth.contract(address=vault.address, abi=vault.abi_json)


def get_gateway_contract(web3_client: Web3 | None = None):
    _, _, gateway, _ = ensure_coston2_config()
    web3_client = web3_client or get_coston2_web3()
    return web3_client.eth.contract(address=gateway.address, abi=gateway.abi_json)
