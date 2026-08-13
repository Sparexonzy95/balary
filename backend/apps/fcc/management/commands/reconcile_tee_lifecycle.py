from __future__ import annotations

import json
from urllib import request as urllib_request

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from eth_account import Account
from web3 import Web3

from apps.fcc.tee_authorization import _derive_tee_id, TeeAuthorizationError

ZERO = "0x0000000000000000000000000000000000000000"

GATEWAY_ABI = [
    {"inputs": [], "name": "TEE_MACHINE_REGISTRY", "outputs": [{"type": "address"}], "stateMutability": "view", "type": "function"},
    {"inputs": [], "name": "extensionId", "outputs": [{"type": "uint256"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"type": "address"}], "name": "teeBindings", "outputs": [{"name": "signer", "type": "address"}, {"name": "epoch", "type": "uint64"}, {"name": "active", "type": "bool"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"type": "address"}], "name": "pendingTeeSignerProposals", "outputs": [{"name": "signer", "type": "address"}, {"name": "executableAt", "type": "uint64"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "teeId", "type": "address"}, {"name": "signer", "type": "address"}], "name": "proposeTeeSigner", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
    {"inputs": [{"name": "teeId", "type": "address"}], "name": "activateTeeSigner", "outputs": [], "stateMutability": "nonpayable", "type": "function"},
]

MANAGER_ABI = [
    {"inputs": [{"name": "extensionId", "type": "uint256"}], "name": "getActiveTeeMachines", "outputs": [{"name": "teeIds", "type": "address[]"}, {"name": "urls", "type": "string[]"}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "teeId", "type": "address"}], "name": "getTeeMachine", "outputs": [{"name": "", "type": "tuple", "components": [{"name": "teeId", "type": "address"}, {"name": "teeProxyId", "type": "address"}, {"name": "url", "type": "string"}]}], "stateMutability": "view", "type": "function"},
    {"inputs": [{"name": "teeId", "type": "address"}], "name": "getTeeMachineStatus", "outputs": [{"type": "uint8"}], "stateMutability": "view", "type": "function"},
]


def send_tx(w3: Web3, account, fn) -> str:
    tx = fn.build_transaction({
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address, "pending"),
        "chainId": w3.eth.chain_id,
        "gasPrice": w3.eth.gas_price,
    })
    tx["gas"] = int(w3.eth.estimate_gas(tx) * 1.25)
    signed = account.sign_transaction(tx)
    raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
    tx_hash = w3.eth.send_raw_transaction(raw)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt.status != 1:
        raise RuntimeError(f"Lifecycle transaction failed: {tx_hash.hex()}")
    return tx_hash.hex()


def read_live_info() -> dict:
    url = settings.ZALARY_FCC_PROXY_URL.rstrip("/") + "/info"
    try:
        req = urllib_request.Request(url, headers={"Accept": "application/json"})
        with urllib_request.urlopen(req, timeout=15) as response:
            return json.load(response)
    except Exception as exc:
        raise CommandError(f"Could not read live FCC proxy /info: {exc}") from exc


class Command(BaseCommand):
    help = "Reconcile the live FCC TEE with the payroll Gateway."

    def handle(self, *args, **options):
        if not settings.ZALARY_TEE_LIFECYCLE_ENABLED:
            self.stdout.write("TEE lifecycle reconciliation is disabled")
            return
        if settings.ZALARY_TEE_AUTH_MODE.strip().lower() != "onchain":
            raise CommandError("ZALARY_TEE_AUTH_MODE must be onchain")

        info = read_live_info()
        try:
            live_tee = Web3.to_checksum_address(_derive_tee_id(info))
            live_chain = int(info["teeInfo"]["chainId"])
            info_extension = int(info["machineData"]["extensionId"], 16)
        except (TeeAuthorizationError, KeyError, TypeError, ValueError) as exc:
            raise CommandError(f"Invalid FCC /info identity payload: {exc}") from exc

        if live_chain != 114:
            raise CommandError(f"Live TEE reports chain {live_chain}, expected Coston2 114")

        w3 = Web3(Web3.HTTPProvider(settings.ZALARY_CHAIN_RPC_URL))
        if not w3.is_connected() or w3.eth.chain_id != 114:
            raise CommandError("Could not connect to Coston2 chain 114")

        gateway = w3.eth.contract(address=Web3.to_checksum_address(settings.ZALARY_GATEWAY_ADDRESS), abi=GATEWAY_ABI)
        extension_id = int(gateway.functions.extensionId().call())
        if extension_id != info_extension or extension_id != int(settings.ZALARY_FCC_EXTENSION_ID):
            raise CommandError("TEE, Gateway and configured extension IDs do not agree")

        registry_address = Web3.to_checksum_address(gateway.functions.TEE_MACHINE_REGISTRY().call())
        manager = w3.eth.contract(address=registry_address, abi=MANAGER_ABI)
        active_ids, _ = manager.functions.getActiveTeeMachines(extension_id).call()
        active_ids = [Web3.to_checksum_address(v) for v in active_ids]
        if len(active_ids) != 1:
            raise CommandError(f"Lifecycle fail-closed: expected exactly one active TEE, found {len(active_ids)}")
        if active_ids[0] != live_tee:
            raise CommandError(f"Lifecycle fail-closed: proxy TEE {live_tee} is not sole active TEE {active_ids[0]}")

        registered_tee, proxy_signer, registered_url = manager.functions.getTeeMachine(live_tee).call()
        registered_tee = Web3.to_checksum_address(registered_tee)
        proxy_signer = Web3.to_checksum_address(proxy_signer)
        if registered_tee != live_tee or proxy_signer.lower() == ZERO.lower():
            raise CommandError("FCC registry returned an invalid TEE machine binding")
        if int(manager.functions.getTeeMachineStatus(live_tee).call()) != 2:
            raise CommandError("Live TEE is not in active/production registry status")
        if registered_url.rstrip("/") != settings.ZALARY_FCC_PROXY_URL.rstrip("/"):
            raise CommandError("FCC registry URL does not match configured proxy URL")

        signer, epoch, active = gateway.functions.teeBindings(live_tee).call()
        signer = Web3.to_checksum_address(signer)
        self.stdout.write(f"Live TEE: {live_tee}")
        self.stdout.write(f"FCC signer: {proxy_signer}")
        self.stdout.write(f"Gateway signer: {signer}")
        self.stdout.write(f"Gateway epoch: {epoch}")
        self.stdout.write(f"Gateway active: {active}")

        if active and signer == proxy_signer and int(epoch) > 0:
            self.stdout.write(self.style.SUCCESS("TEE lifecycle already reconciled"))
            return

        private_key = settings.ZALARY_RELAYER_PRIVATE_KEY
        if not private_key:
            raise CommandError("ZALARY_RELAYER_PRIVATE_KEY is not configured")
        account = Account.from_key(private_key)

        pending_signer, executable_at = gateway.functions.pendingTeeSignerProposals(live_tee).call()
        pending_signer = Web3.to_checksum_address(pending_signer)
        if pending_signer.lower() == ZERO.lower():
            self.stdout.write(f"TEE signer proposal tx: {send_tx(w3, account, gateway.functions.proposeTeeSigner(live_tee, proxy_signer))}")
            pending_signer, executable_at = gateway.functions.pendingTeeSignerProposals(live_tee).call()
            pending_signer = Web3.to_checksum_address(pending_signer)
        if pending_signer != proxy_signer:
            raise CommandError("A different pending signer proposal exists; refusing automatic overwrite")

        now = int(w3.eth.get_block("latest")["timestamp"])
        if now < int(executable_at):
            raise CommandError(f"TEE signer proposal not ready until {executable_at}")

        self.stdout.write(f"TEE signer activation tx: {send_tx(w3, account, gateway.functions.activateTeeSigner(live_tee))}")
        signer, epoch, active = gateway.functions.teeBindings(live_tee).call()
        signer = Web3.to_checksum_address(signer)
        if not active or signer != proxy_signer or int(epoch) <= 0:
            raise CommandError("TEE binding verification failed after reconciliation")
        self.stdout.write(self.style.SUCCESS(f"TEE lifecycle reconciled automatically: tee={live_tee} signer={signer} epoch={epoch}"))
