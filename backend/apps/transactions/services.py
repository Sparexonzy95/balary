from __future__ import annotations

import re
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from eth_utils import to_checksum_address
from web3 import Web3
from web3.exceptions import TransactionNotFound

from apps.accounts.services import normalize_address
from apps.chains.models import ContractDeployment
from apps.chains.services import get_coston2_web3

from .models import ChainTransaction, PreparedTransaction

TX_HASH_RE = re.compile(r"^0x[0-9a-fA-F]{64}$")


class TransactionFlowError(ValueError):
    pass


def _value(source, key, default=None):
    if hasattr(source, key):
        return getattr(source, key)
    if hasattr(source, "get"):
        return source.get(key, default)
    return default


def prepare_contract_transaction(
    *,
    account,
    deployment: ContractDeployment,
    intent_type: str,
    sender_address: str,
    function_name: str,
    function_args: list,
    expected_event: str,
    related_model: str,
    related_id: str,
    metadata: dict,
    idempotency_key: str | None = None,
    ttl_minutes: int = 20,
    value_wei: int | str = 0,
) -> PreparedTransaction:
    sender = normalize_address(sender_address)
    clean_idempotency = idempotency_key.strip() if idempotency_key else None
    if clean_idempotency:
        existing = PreparedTransaction.objects.filter(
            created_by=account,
            idempotency_key=clean_idempotency,
        ).first()
        if existing:
            expected_contract = to_checksum_address(deployment.address)
            if (
                existing.intent_type != intent_type
                or existing.sender_address != sender
                or existing.contract_address != expected_contract
                or existing.related_model != related_model
                or existing.related_id != str(related_id)
                or existing.value_wei != str(int(value_wei))
            ):
                raise TransactionFlowError("Idempotency key was already used for another action")
            return existing

    web3_client = Web3()
    contract = web3_client.eth.contract(
        address=to_checksum_address(deployment.address),
        abi=deployment.abi_json,
    )
    try:
        calldata = getattr(contract.functions, function_name)(*function_args)._encode_transaction_data()
    except Exception as exc:
        raise TransactionFlowError(f"Could not encode {function_name}") from exc

    return PreparedTransaction.objects.create(
        created_by=account,
        chain=deployment.chain,
        intent_type=intent_type,
        sender_address=sender,
        contract_address=to_checksum_address(deployment.address),
        calldata=calldata,
        calldata_hash=Web3.keccak(hexstr=calldata).hex(),
        value_wei=str(int(value_wei)),
        expected_event=expected_event,
        related_model=related_model,
        related_id=str(related_id),
        metadata=metadata,
        idempotency_key=clean_idempotency,
        expires_at=timezone.now() + timedelta(minutes=ttl_minutes),
    )


@transaction.atomic
def record_submitted_transaction(
    *,
    prepared: PreparedTransaction,
    actor_wallet: str,
    tx_hash: str,
) -> ChainTransaction:
    actor = normalize_address(actor_wallet)
    if prepared.created_by.wallet_address != actor:
        raise TransactionFlowError("Prepared transaction belongs to another account")
    if prepared.sender_address != actor:
        raise TransactionFlowError("Connected wallet is not the prepared sender")
    if prepared.expires_at <= timezone.now():
        raise TransactionFlowError("Prepared transaction expired")
    if prepared.is_consumed:
        existing = prepared.submissions.order_by("-created_at").first()
        if existing and existing.tx_hash.lower() == tx_hash.lower():
            return existing
        raise TransactionFlowError("Prepared transaction has already been consumed")
    if not isinstance(tx_hash, str) or not TX_HASH_RE.fullmatch(tx_hash):
        raise TransactionFlowError("Invalid transaction hash")

    chain_tx = ChainTransaction.objects.create(
        prepared=prepared,
        chain=prepared.chain,
        tx_hash=tx_hash.lower(),
        sender_address=prepared.sender_address,
        contract_address=prepared.contract_address,
        calldata_hash=prepared.calldata_hash,
        intent_type=prepared.intent_type,
    )
    prepared.consumed_at = timezone.now()
    prepared.save(update_fields=["consumed_at"])
    return chain_tx


def mark_failed(chain_tx: ChainTransaction, message: str, *, event_mismatch: bool = False) -> None:
    chain_tx.status = (
        ChainTransaction.Status.EVENT_MISMATCH
        if event_mismatch
        else ChainTransaction.Status.FAILED
    )
    chain_tx.error_message = message[:2000]
    chain_tx.save(update_fields=["status", "error_message", "updated_at"])
    if chain_tx.prepared.related_model.startswith("institutions."):
        from apps.institutions.services import apply_failed_transaction
        apply_failed_transaction(chain_tx)
    elif chain_tx.prepared.related_model == "payroll.PayrollRun":
        from apps.payroll.onchain import apply_failed_transaction
        apply_failed_transaction(chain_tx)


def sync_transaction(chain_tx: ChainTransaction, web3_client: Web3 | None = None) -> str:
    if chain_tx.status != ChainTransaction.Status.PENDING:
        return chain_tx.status

    web3_client = web3_client or get_coston2_web3()
    try:
        transaction_data = web3_client.eth.get_transaction(chain_tx.tx_hash)
        receipt = web3_client.eth.get_transaction_receipt(chain_tx.tx_hash)
    except TransactionNotFound:
        return ChainTransaction.Status.PENDING
    except Exception as exc:
        chain_tx.error_message = f"RPC lookup error: {str(exc)[:500]}"
        chain_tx.save(update_fields=["error_message", "updated_at"])
        return ChainTransaction.Status.PENDING

    tx_to = _value(transaction_data, "to")
    tx_from = _value(transaction_data, "from")
    tx_input = _value(transaction_data, "input", "0x") or "0x"
    tx_value = int(_value(transaction_data, "value", 0) or 0)
    if not tx_to or to_checksum_address(tx_to) != chain_tx.contract_address:
        mark_failed(chain_tx, "Transaction target does not match the prepared contract")
        return chain_tx.status
    if not tx_from or to_checksum_address(tx_from) != chain_tx.sender_address:
        mark_failed(chain_tx, "Transaction sender does not match the prepared wallet")
        return chain_tx.status
    tx_input_hash = (
        Web3.keccak(tx_input).hex()
        if isinstance(tx_input, (bytes, bytearray))
        else Web3.keccak(hexstr=str(tx_input)).hex()
    )
    if tx_input_hash != chain_tx.calldata_hash:
        mark_failed(chain_tx, "Transaction calldata does not match the prepared action")
        return chain_tx.status
    if tx_value != int(chain_tx.prepared.value_wei):
        mark_failed(chain_tx, "Transaction value does not match the prepared action")
        return chain_tx.status

    block_number = int(_value(receipt, "blockNumber", 0) or 0)
    latest_block = int(web3_client.eth.block_number)
    confirmations = max(0, latest_block - block_number + 1)
    chain_tx.block_number = block_number
    chain_tx.gas_used = int(_value(receipt, "gasUsed", 0) or 0)
    chain_tx.confirmations = confirmations
    chain_tx.save(update_fields=["block_number", "gas_used", "confirmations", "updated_at"])

    if int(_value(receipt, "status", 0) or 0) != 1:
        mark_failed(chain_tx, "Transaction reverted on-chain")
        return chain_tx.status
    if confirmations < settings.CHAIN_MIN_CONFIRMATIONS:
        return ChainTransaction.Status.PENDING

    try:
        if chain_tx.prepared.related_model.startswith("institutions."):
            from apps.institutions.services import verify_and_apply_confirmed_transaction
            verify_and_apply_confirmed_transaction(chain_tx, receipt, web3_client)
        elif chain_tx.prepared.related_model == "payroll.PayrollRun":
            from apps.payroll.onchain import verify_and_apply_confirmed_transaction
            verify_and_apply_confirmed_transaction(chain_tx, receipt, web3_client)
        else:
            raise TransactionFlowError("No state verifier exists for this prepared transaction")
    except Exception as exc:
        mark_failed(chain_tx, f"Expected event/state verification failed: {exc}", event_mismatch=True)
        return chain_tx.status

    chain_tx.status = ChainTransaction.Status.CONFIRMED
    chain_tx.error_message = ""
    chain_tx.confirmed_at = timezone.now()
    chain_tx.save(
        update_fields=["status", "error_message", "confirmed_at", "updated_at"]
    )
    return chain_tx.status


def sync_pending_transactions(limit: int | None = None) -> dict:
    limit = limit or settings.CHAIN_RECEIPT_BATCH_SIZE
    result = {"checked": 0, "confirmed": 0, "failed": 0, "pending": 0}
    web3_client = get_coston2_web3()
    for chain_tx in ChainTransaction.objects.filter(
        status=ChainTransaction.Status.PENDING
    ).order_by("created_at")[:limit]:
        result["checked"] += 1
        status = sync_transaction(chain_tx, web3_client=web3_client)
        if status == ChainTransaction.Status.CONFIRMED:
            result["confirmed"] += 1
        elif status in [ChainTransaction.Status.FAILED, ChainTransaction.Status.EVENT_MISMATCH]:
            result["failed"] += 1
        else:
            result["pending"] += 1
    return result
