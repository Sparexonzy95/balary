from __future__ import annotations

import json
import os
import re
import subprocess
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from eth_abi import decode, encode
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak, to_checksum_address
from web3.exceptions import TimeExhausted, TransactionNotFound
from web3.logs import DISCARD

from apps.chains.services import ensure_coston2_config, get_coston2_web3

from .models import FccInstruction


class FccEncryptionError(ValueError):
    pass


class FccFlowError(ValueError):
    pass


@dataclass(frozen=True)
class EncryptedPayload:
    ciphertext: str
    ciphertext_hash: str
    tee_id: str
    endpoint: str


_HEX_RE = re.compile(r"^0x[0-9a-fA-F]+$")
_BYTES32_RE = re.compile(r"^0x[0-9a-fA-F]{64}$")


def _normalize_hex(value: str, *, even: bool = True) -> str:
    if not isinstance(value, str) or not _HEX_RE.fullmatch(value):
        raise FccFlowError("Malformed hexadecimal value")
    body = value[2:]
    if even and len(body) % 2:
        raise FccFlowError("Malformed hexadecimal length")
    return "0x" + body.lower()


def _validate_ciphertext(value: str) -> str:
    ciphertext = value.strip()
    if not _HEX_RE.fullmatch(ciphertext):
        raise FccEncryptionError("Encryptor returned malformed ciphertext")
    raw = bytes.fromhex(ciphertext[2:])
    if len(raw) < 80:
        raise FccEncryptionError("Encryptor returned ciphertext that is too short")
    if len(raw) > settings.ZALARY_PAYROLL_UPLOAD_MAX_BYTES * 2:
        raise FccEncryptionError("Encryptor returned ciphertext that is too large")
    return "0x" + raw.hex()


def encrypt_for_registered_tee(plaintext: bytes) -> EncryptedPayload:
    command = settings.ZALARY_ENCRYPTOR_COMMAND.strip()
    if not command:
        raise FccEncryptionError("ZALARY_ENCRYPTOR_COMMAND is not configured")
    if not plaintext or not plaintext.strip():
        raise FccEncryptionError("Private payload is empty")

    from apps.fcc.tee_authorization import (
        TeeAuthorizationError,
        resolve_live_authorized_tee,
    )

    try:
        authorized_tee = resolve_live_authorized_tee()
    except TeeAuthorizationError as exc:
        raise FccEncryptionError(str(exc)) from exc

    env = os.environ.copy()
    env["EXT_PROXY_URL"] = settings.ZALARY_FCC_PROXY_URL
    env["TEE_ID"] = authorized_tee.tee_id

    try:
        completed = subprocess.run(
            [command],
            input=plaintext,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
            timeout=settings.ZALARY_ENCRYPTOR_TIMEOUT_SECONDS,
            env=env,
        )
    except FileNotFoundError as exc:
        raise FccEncryptionError("Configured Zalary encryptor executable was not found") from exc
    except subprocess.TimeoutExpired as exc:
        raise FccEncryptionError("TEE encryption request timed out") from exc
    except OSError as exc:
        raise FccEncryptionError("TEE encryption process could not start") from exc

    if completed.returncode != 0:
        error_text = completed.stderr.decode("utf-8", errors="replace").strip()
        if "TEE identity mismatch" in error_text:
            raise FccEncryptionError("TEE identity verification failed")
        raise FccEncryptionError("TEE encryption failed")

    try:
        output = completed.stdout.decode("ascii", errors="strict")
    except UnicodeDecodeError as exc:
        raise FccEncryptionError("Encryptor returned malformed ciphertext") from exc
    ciphertext = _validate_ciphertext(output)
    digest = "0x" + keccak(bytes.fromhex(ciphertext[2:])).hex()
    return EncryptedPayload(
        ciphertext=ciphertext,
        ciphertext_hash=digest,
        tee_id=authorized_tee.tee_id,
        endpoint=settings.ZALARY_FCC_PROXY_URL,
    )


def _normalize_tee_signature(signature: str) -> str:
    signature = _normalize_hex(signature)
    raw = bytearray.fromhex(signature[2:])
    if len(raw) != 65:
        raise FccFlowError("TEE signature must be 65 bytes")
    if raw[64] in (0, 1):
        raw[64] += 27
    if raw[64] not in (27, 28):
        raise FccFlowError("TEE signature has an unsupported recovery value")
    return "0x" + raw.hex()


def recover_action_signer(*, result_data: str, action_id: str, submission_tag: str, status: int, signature: str) -> str:
    result_data = _normalize_hex(result_data)
    action_id = action_id.lower()
    if not _BYTES32_RE.fullmatch(action_id):
        raise FccFlowError("Action ID must be bytes32")
    if status not in (0, 1):
        raise FccFlowError("TEE action status must be 0 or 1")
    normalized_signature = _normalize_tee_signature(signature)

    result_hash = keccak(
        keccak(bytes.fromhex(result_data[2:]))
        + bytes.fromhex(action_id[2:])
        + keccak(submission_tag.encode("utf-8"))
        + bytes([status])
    )
    prefix = b"TEE_ACTION_RESULT".ljust(32, b"\x00")
    payload_hash = keccak(encode(["bytes32", "uint256", "bytes32"], [prefix, settings.COSTON2_CHAIN_ID, result_hash]))
    return to_checksum_address(
        Account.recover_message(encode_defunct(primitive=payload_hash), signature=normalized_signature)
    )


def fetch_action_result(instruction_id: str) -> dict | None:
    instruction_id = instruction_id.lower()
    if not _BYTES32_RE.fullmatch(instruction_id):
        raise FccFlowError("Instruction ID must be bytes32")
    url = f"{settings.ZALARY_FCC_PROXY_URL.rstrip('/')}/action/result/{instruction_id}"
    request = urllib.request.Request(
        url,
        headers={"ngrok-skip-browser-warning": "true", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=settings.ZALARY_FCC_HTTP_TIMEOUT_SECONDS) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code in (404, 204):
            return None
        raise FccFlowError(f"FCC proxy returned HTTP {exc.code}") from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise FccFlowError("FCC proxy could not be read") from exc

    result = body.get("result") if isinstance(body, dict) else None
    if not isinstance(result, dict):
        raise FccFlowError("FCC proxy returned a malformed ActionResult")
    result_id = str(result.get("id", "")).lower()
    if result_id != instruction_id:
        raise FccFlowError("FCC proxy returned a different instruction ID")
    status_value = result.get("status")
    if isinstance(status_value, str) and status_value.isdigit():
        status_value = int(status_value)
    if status_value not in (0, 1):
        raise FccFlowError("FCC proxy returned an unsupported action status")
    result_data = _normalize_hex(str(result.get("data", "")))
    submission_tag = result.get("submissionTag")
    if not isinstance(submission_tag, str) or not submission_tag:
        raise FccFlowError("FCC proxy omitted the submission tag")
    signature = body.get("signature")
    if not isinstance(signature, str) or signature == "0x":
        raise FccFlowError("FCC proxy omitted the TEE signature")
    normalized_signature = _normalize_tee_signature(signature)
    recovered = recover_action_signer(
        result_data=result_data,
        action_id=result_id,
        submission_tag=submission_tag,
        status=status_value,
        signature=normalized_signature,
    )
    return {
        "result_data": result_data,
        "submission_tag": submission_tag,
        "status": status_value,
        "log": str(result.get("log", ""))[:2000],
        "signature": normalized_signature,
        "recovered_signer": recovered,
    }


def _field(data, name: str, index: int):
    if hasattr(data, name):
        return getattr(data, name)
    if hasattr(data, "get") and data.get(name) is not None:
        return data.get(name)
    return data[index]


def _hex_value(value) -> str:
    if isinstance(value, str):
        return value.lower()
    if isinstance(value, (bytes, bytearray)):
        return "0x" + bytes(value).hex()
    if hasattr(value, "hex"):
        text = value.hex()
        return text.lower() if text.startswith("0x") else "0x" + text.lower()
    return str(value).lower()


def _decode_and_validate_payroll_result(instruction: FccInstruction, result_data: str, web3_client) -> dict:
    payroll = instruction.payroll_run
    _, vault_deployment, gateway_deployment, token = ensure_coston2_config()
    gateway = web3_client.eth.contract(address=gateway_deployment.address, abi=gateway_deployment.abi_json)
    types = [
        "bytes32", "address", "address", "uint256", "uint256", "address", "uint64",
        "uint256", "address", "bytes32", "address", "uint8", "bytes32", "bytes32",
        "uint256", "uint256", "uint256", "uint256", "uint64", "uint64",
    ]
    try:
        values = decode(types, bytes.fromhex(result_data[2:]))
    except Exception as exc:
        raise FccFlowError("TEE payroll result could not be ABI-decoded") from exc

    expected_domain = _hex_value(gateway.functions.PAYROLL_RESULT_DOMAIN().call())
    extension_id = int(gateway.functions.extensionId().call())
    checks = {
        "domain": _hex_value(values[0]) == expected_domain,
        "gateway": to_checksum_address(values[1]) == gateway_deployment.address,
        "vault": to_checksum_address(values[2]) == vault_deployment.address,
        "chain": int(values[3]) == settings.COSTON2_CHAIN_ID,
        "extension": int(values[4]) == extension_id,
        "tee": to_checksum_address(values[5]) == to_checksum_address(instruction.selected_tee_id),
        "epoch": int(values[6]) == instruction.tee_signer_epoch,
        "payroll": int(values[7]) == payroll.payroll_id,
        "institution": to_checksum_address(values[8]) == payroll.institution.institution_address,
        "metadata": _hex_value(values[9]) == payroll.metadata_hash.lower(),
        "stablecoin": to_checksum_address(values[10]) == token.address,
        "decimals": int(values[11]) == token.decimals,
        "ciphertext": _hex_value(values[12]) == payroll.ciphertext_hash.lower(),
        "root": int.from_bytes(values[13], "big") != 0,
        "employee_count": int(values[14]) == payroll.employee_count,
        "net_total": int(values[15]) == int(payroll.employee_net_total),
        "tax_total": int(values[16]) == int(payroll.aggregate_tax_total),
        "total_required": int(values[17]) == int(payroll.total_required),
        "requested_at": int(values[18]) == int(instruction.requested_at.timestamp()),
    }
    if not all(checks.values()):
        failed = ", ".join(name for name, valid in checks.items() if not valid)
        raise FccFlowError(f"TEE payroll result binding failed: {failed}")
    valid_until = int(values[19])
    if valid_until > int(instruction.requested_at.timestamp()) + settings.ZALARY_FCC_REQUEST_TTL_SECONDS:
        raise FccFlowError("TEE payroll result validity exceeds the contract limit")
    if valid_until < int(timezone.now().timestamp()):
        raise FccFlowError("TEE payroll result has expired")
    return {
        "private_ledger_root": _hex_value(values[13]),
        "employee_count": int(values[14]),
        "employee_net_total": int(values[15]),
        "aggregate_tax_total": int(values[16]),
        "total_required": int(values[17]),
        "valid_until": valid_until,
    }



def _decode_and_validate_withdrawal_result(instruction: FccInstruction, result_data: str, web3_client) -> dict:
    from apps.withdrawals.models import WithdrawalRequest

    try:
        withdrawal = WithdrawalRequest.objects.select_related("employee", "payroll_run__institution").get(
            instruction=instruction
        )
    except WithdrawalRequest.DoesNotExist as exc:
        raise FccFlowError("Withdrawal instruction has no local withdrawal request") from exc

    payroll = instruction.payroll_run
    _, vault_deployment, gateway_deployment, token = ensure_coston2_config()
    gateway = web3_client.eth.contract(address=gateway_deployment.address, abi=gateway_deployment.abi_json)
    types = [
        "bytes32", "address", "address", "uint256", "uint256", "address", "uint64",
        "uint256", "address", "address", "uint8", "bytes32", "bytes32", "bytes32",
        "address", "uint256", "bytes32", "uint64", "uint64",
    ]
    try:
        values = decode(types, bytes.fromhex(result_data[2:]))
    except Exception as exc:
        raise FccFlowError("TEE withdrawal result could not be ABI-decoded") from exc

    expected_domain = _hex_value(gateway.functions.WITHDRAWAL_RESULT_DOMAIN().call())
    extension_id = int(gateway.functions.extensionId().call())
    checks = {
        "domain": _hex_value(values[0]) == expected_domain,
        "gateway": to_checksum_address(values[1]) == gateway_deployment.address,
        "vault": to_checksum_address(values[2]) == vault_deployment.address,
        "chain": int(values[3]) == settings.COSTON2_CHAIN_ID,
        "extension": int(values[4]) == extension_id,
        "tee": to_checksum_address(values[5]) == to_checksum_address(instruction.selected_tee_id),
        "epoch": int(values[6]) == instruction.tee_signer_epoch,
        "payroll": int(values[7]) == payroll.payroll_id,
        "institution": to_checksum_address(values[8]) == payroll.institution.institution_address,
        "stablecoin": to_checksum_address(values[9]) == token.address,
        "decimals": int(values[10]) == token.decimals,
        "ciphertext": _hex_value(values[11]) == instruction.ciphertext_hash.lower(),
        "old_root": _hex_value(values[12]) == withdrawal.old_ledger_root.lower(),
        "new_root": int.from_bytes(values[13], "big") != 0 and _hex_value(values[13]) != withdrawal.old_ledger_root.lower(),
        "destination": to_checksum_address(values[14]) == withdrawal.destination,
        "amount": int(values[15]) == int(withdrawal.amount),
        "nullifier": int.from_bytes(values[16], "big") != 0,
        "requested_at": int(values[17]) == int(instruction.requested_at.timestamp()),
    }
    if not all(checks.values()):
        failed = ", ".join(name for name, valid in checks.items() if not valid)
        raise FccFlowError(f"TEE withdrawal result binding failed: {failed}")
    valid_until = int(values[18])
    if valid_until > int(instruction.requested_at.timestamp()) + settings.ZALARY_FCC_REQUEST_TTL_SECONDS:
        raise FccFlowError("TEE withdrawal result validity exceeds the contract limit")
    if valid_until < int(timezone.now().timestamp()):
        raise FccFlowError("TEE withdrawal result has expired")
    return {
        "new_ledger_root": _hex_value(values[13]),
        "destination": to_checksum_address(values[14]),
        "amount": int(values[15]),
        "withdrawal_nullifier": _hex_value(values[16]),
        "requested_at": int(values[17]),
        "valid_until": valid_until,
    }

def _relayer_account():
    key = settings.ZALARY_RELAYER_PRIVATE_KEY.strip()
    if not key:
        raise FccFlowError("ZALARY_RELAYER_PRIVATE_KEY is not configured")
    try:
        return Account.from_key(key)
    except Exception as exc:
        raise FccFlowError("Configured relayer private key is invalid") from exc


def _send_contract_call(function_call, *, web3_client, value_wei: int = 0) -> str:
    account = _relayer_account()
    sender = to_checksum_address(account.address)
    if web3_client.eth.get_balance(sender) <= 0:
        raise FccFlowError("Relayer wallet has no C2FLR for gas")
    try:
        call_context = {"from": sender, "value": int(value_wei)}
        function_call.call(call_context)
        estimate = int(function_call.estimate_gas(call_context))
        tx = function_call.build_transaction(
            {
                "from": sender,
                "nonce": web3_client.eth.get_transaction_count(sender, "pending"),
                "chainId": settings.COSTON2_CHAIN_ID,
                "gas": max(100000, int(estimate * 12 // 10)),
                "gasPrice": int(web3_client.eth.gas_price),
                "value": int(value_wei),
            }
        )
        signed = account.sign_transaction(tx)
        raw = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction")
        tx_hash = web3_client.eth.send_raw_transaction(raw)
    except Exception as exc:
        raise FccFlowError("Relayer transaction could not be broadcast") from exc
    return "0x" + bytes(tx_hash).hex()


def _wait_for_receipt(tx_hash: str, *, web3_client):
    try:
        return web3_client.eth.wait_for_transaction_receipt(
            tx_hash,
            timeout=settings.ZALARY_RELAYER_RECEIPT_TIMEOUT_SECONDS,
        )
    except (TimeExhausted, TransactionNotFound) as exc:
        raise FccFlowError(
            f"Relayer transaction {tx_hash} was submitted and is still pending"
        ) from exc


def _event_found(contract, event_name: str, receipt, expected_instruction: str) -> dict:
    logs = getattr(contract.events, event_name)().process_receipt(receipt, errors=DISCARD)
    for log in logs:
        if _hex_value(log["args"]["instructionId"]) == expected_instruction.lower():
            return log
    raise FccFlowError(f"Expected {event_name} event was not found")


@transaction.atomic
def store_action_result(instruction: FccInstruction, action: dict, *, web3_client=None) -> FccInstruction:
    instruction = FccInstruction.objects.select_for_update().select_related(
        "payroll_run", "payroll_run__institution"
    ).get(pk=instruction.pk)
    if instruction.status == FccInstruction.Status.FINALIZED:
        return instruction
    if to_checksum_address(action["recovered_signer"]) != to_checksum_address(instruction.tee_signer):
        raise FccFlowError("ActionResult signer does not match the request TEE binding")
    web3_client = web3_client or get_coston2_web3()
    if action["status"] == 1 and instruction.request_type == FccInstruction.RequestType.PROCESS_PAYROLL:
        _decode_and_validate_payroll_result(instruction, action["result_data"], web3_client)
        next_status = FccInstruction.Status.TEE_SUCCESS
    elif action["status"] == 1 and instruction.request_type == FccInstruction.RequestType.AUTHORIZE_WITHDRAWAL:
        _decode_and_validate_withdrawal_result(instruction, action["result_data"], web3_client)
        next_status = FccInstruction.Status.TEE_SUCCESS
    elif action["status"] == 0:
        next_status = FccInstruction.Status.TEE_FAILURE
    else:
        raise FccFlowError("Unsupported FCC result for this instruction type")

    instruction.action_result_data = action["result_data"]
    instruction.submission_tag = action["submission_tag"]
    instruction.action_status = action["status"]
    instruction.action_log = action["log"]
    instruction.tee_signature = action["signature"]
    instruction.recovered_signer = action["recovered_signer"]
    instruction.action_received_at = timezone.now()
    instruction.status = next_status
    instruction.error_message = ""
    instruction.save()

    payroll = instruction.payroll_run
    payroll.tee_result_status = action["status"]
    payroll.tee_result_log = action["log"]
    payroll.save(update_fields=["tee_result_status", "tee_result_log", "updated_at"])
    if instruction.request_type == FccInstruction.RequestType.AUTHORIZE_WITHDRAWAL:
        from apps.withdrawals.models import WithdrawalRequest
        WithdrawalRequest.objects.filter(instruction=instruction).update(
            status=(
                WithdrawalRequest.Status.TEE_SUCCESS
                if action["status"] == 1
                else WithdrawalRequest.Status.TEE_FAILURE
            ),
            error_message=("" if action["status"] == 1 else action["log"][:2000]),
            updated_at=timezone.now(),
        )
    return instruction


def finalize_instruction(instruction: FccInstruction, *, web3_client=None) -> FccInstruction:
    instruction = FccInstruction.objects.select_related(
        "payroll_run", "payroll_run__institution"
    ).get(pk=instruction.pk)
    if instruction.status == FccInstruction.Status.FINALIZED:
        return instruction
    if instruction.action_status not in (0, 1) or not instruction.action_result_data or not instruction.tee_signature:
        raise FccFlowError("Instruction does not have a complete signed ActionResult")

    web3_client = web3_client or get_coston2_web3()
    _, vault_deployment, gateway_deployment, _ = ensure_coston2_config()
    gateway = web3_client.eth.contract(address=gateway_deployment.address, abi=gateway_deployment.abi_json)
    args = [
        bytes.fromhex(instruction.action_result_data[2:]),
        instruction.instruction_id,
        instruction.submission_tag,
        instruction.action_status,
        bytes.fromhex(instruction.tee_signature[2:]),
    ]
    if instruction.action_status == 0:
        function_call = gateway.functions.finalizeFailedRequest(*args)
        event_name = "ConfidentialRequestFailed"
    elif instruction.request_type == FccInstruction.RequestType.PROCESS_PAYROLL:
        function_call = gateway.functions.finalizePayrollComputation(*args)
        event_name = "PayrollComputationFinalized"
    elif instruction.request_type == FccInstruction.RequestType.AUTHORIZE_WITHDRAWAL:
        function_call = gateway.functions.finalizePrivateWithdrawal(*args)
        event_name = "PrivateWithdrawalFinalized"
    else:
        raise FccFlowError("Unsupported FCC instruction type")

    with transaction.atomic():
        locked = FccInstruction.objects.select_for_update().get(pk=instruction.pk)
        if locked.status == FccInstruction.Status.FINALIZED:
            return locked
        locked.status = FccInstruction.Status.FINALIZATION_PENDING
        locked.save(update_fields=["status", "updated_at"])
        tx_hash = locked.finalization_tx_hash
        if instruction.request_type == FccInstruction.RequestType.AUTHORIZE_WITHDRAWAL:
            from apps.withdrawals.models import WithdrawalRequest
            WithdrawalRequest.objects.filter(instruction=locked).update(
                status=WithdrawalRequest.Status.FINALIZATION_PENDING,
                updated_at=timezone.now(),
            )

    if not tx_hash:
        tx_hash = _send_contract_call(function_call, web3_client=web3_client)
        FccInstruction.objects.filter(pk=instruction.pk).update(
            finalization_tx_hash=tx_hash,
            error_message="",
            updated_at=timezone.now(),
        )
        if instruction.request_type == FccInstruction.RequestType.AUTHORIZE_WITHDRAWAL:
            from apps.withdrawals.models import WithdrawalRequest
            WithdrawalRequest.objects.filter(instruction=instruction).update(
                finalization_tx_hash=tx_hash,
                updated_at=timezone.now(),
            )

    receipt = _wait_for_receipt(tx_hash, web3_client=web3_client)
    if int(receipt.get("status", 0)) != 1:
        reset_status = (
            FccInstruction.Status.TEE_SUCCESS
            if instruction.action_status == 1
            else FccInstruction.Status.TEE_FAILURE
        )
        FccInstruction.objects.filter(pk=instruction.pk).update(
            finalization_tx_hash="",
            status=reset_status,
            error_message="Relayer finalization transaction reverted on-chain",
            updated_at=timezone.now(),
        )
        if instruction.request_type == FccInstruction.RequestType.AUTHORIZE_WITHDRAWAL:
            from apps.withdrawals.models import WithdrawalRequest
            WithdrawalRequest.objects.filter(instruction=instruction).update(
                finalization_tx_hash="",
                status=(
                    WithdrawalRequest.Status.TEE_SUCCESS
                    if instruction.action_status == 1
                    else WithdrawalRequest.Status.TEE_FAILURE
                ),
                error_message="Relayer finalization transaction reverted on-chain",
                updated_at=timezone.now(),
            )
        raise FccFlowError("Relayer finalization transaction reverted on-chain")

    verification_error = ""
    onchain = None
    onchain_status = None
    decoded_withdrawal = None
    try:
        _event_found(gateway, event_name, receipt, instruction.instruction_id)
        vault = web3_client.eth.contract(address=vault_deployment.address, abi=vault_deployment.abi_json)
        onchain = vault.functions.getPayroll(instruction.payroll_run.payroll_id).call()
        onchain_status = int(_field(onchain, "status", 25))
        if instruction.request_type == FccInstruction.RequestType.PROCESS_PAYROLL:
            expected_status = 3 if instruction.action_status == 1 else 1
            if onchain_status != expected_status:
                verification_error = (
                    f"Finalization transaction confirmed but payroll status is {onchain_status}, "
                    f"expected {expected_status}"
                )
        else:
            if instruction.action_status == 1:
                decoded_withdrawal = _decode_and_validate_withdrawal_result(
                    instruction, instruction.action_result_data, web3_client
                )
                if onchain_status not in (5, 6):
                    verification_error = "Withdrawal finalized but payroll is neither Active nor Closed"
                elif _hex_value(_field(onchain, "privateLedgerRoot", 6)) != decoded_withdrawal["new_ledger_root"]:
                    verification_error = "Withdrawal finalized but private ledger root does not match"
                else:
                    vault_logs = vault.events.PrivateWithdrawalExecuted().process_receipt(receipt, errors=DISCARD)
                    if not any(
                        _hex_value(log["args"]["instructionId"]) == instruction.instruction_id.lower()
                        and _hex_value(log["args"]["withdrawalNullifier"]) == decoded_withdrawal["withdrawal_nullifier"]
                        for log in vault_logs
                    ):
                        verification_error = "PrivateWithdrawalExecuted event was not found"
            elif onchain_status != 5:
                verification_error = "Failed withdrawal closed but payroll is not Active"
    except Exception as exc:
        verification_error = f"Finalization confirmed but local state verification failed: {exc}"

    with transaction.atomic():
        locked = FccInstruction.objects.select_for_update().select_related("payroll_run").get(pk=instruction.pk)
        payroll = locked.payroll_run
        locked.finalization_tx_hash = tx_hash
        locked.finalization_block_number = int(receipt.get("blockNumber", 0))
        locked.status = FccInstruction.Status.FINALIZED
        locked.closed_at = timezone.now()
        locked.error_message = verification_error[:2000]
        locked.save()

        if instruction.request_type == FccInstruction.RequestType.PROCESS_PAYROLL:
            payroll.finalization_tx_hash = tx_hash
            payroll.finalized_at = timezone.now()
            payroll.onchain_status = onchain_status
            if verification_error or onchain is None:
                payroll.status = payroll.Status.FAILED
            elif instruction.action_status == 1:
                payroll.private_ledger_root = _hex_value(_field(onchain, "privateLedgerRoot", 6))
                payroll.employee_count = int(_field(onchain, "employeeCount", 7))
                payroll.employee_net_total = str(int(_field(onchain, "employeeNetTotal", 8)))
                payroll.aggregate_tax_total = str(int(_field(onchain, "aggregateTaxTotal", 9)))
                payroll.total_required = str(int(_field(onchain, "totalRequired", 10)))
                payroll.status = payroll.Status.COMPUTED
            else:
                payroll.status = payroll.Status.DRAFT_ONCHAIN
                payroll.instruction_id = ""
            payroll.save()
            return locked

        from apps.withdrawals.models import WithdrawalRequest
        withdrawal = WithdrawalRequest.objects.select_for_update().get(instruction=locked)
        withdrawal.finalization_tx_hash = tx_hash
        withdrawal.completed_at = timezone.now()
        payroll.onchain_status = onchain_status
        if verification_error or onchain is None:
            withdrawal.status = WithdrawalRequest.Status.FAILED
            withdrawal.error_message = verification_error[:2000]
        elif instruction.action_status == 1 and decoded_withdrawal:
            withdrawal.status = WithdrawalRequest.Status.FINALIZED
            withdrawal.error_message = ""
            withdrawal.new_ledger_root = decoded_withdrawal["new_ledger_root"]
            withdrawal.withdrawal_nullifier = decoded_withdrawal["withdrawal_nullifier"]
            payroll.private_ledger_root = decoded_withdrawal["new_ledger_root"]
            payroll.net_withdrawn_amount = str(int(_field(onchain, "netWithdrawnAmount", 12)))
            payroll.status = payroll.Status.CLOSED if onchain_status == 6 else payroll.Status.ACTIVE
        else:
            withdrawal.status = WithdrawalRequest.Status.TEE_FAILURE
            withdrawal.error_message = instruction.action_log[:2000]
            payroll.status = payroll.Status.ACTIVE
        withdrawal.save()
        payroll.save()
        return locked

def expire_instruction(instruction: FccInstruction, *, web3_client=None) -> FccInstruction:
    instruction = FccInstruction.objects.select_related("payroll_run").get(pk=instruction.pk)
    if instruction.status in [FccInstruction.Status.FINALIZED, FccInstruction.Status.EXPIRED]:
        return instruction
    stale_at = instruction.requested_at + timedelta(seconds=settings.ZALARY_FCC_REQUEST_TTL_SECONDS)
    if timezone.now() <= stale_at:
        raise FccFlowError("FCC instruction is not stale")
    web3_client = web3_client or get_coston2_web3()
    _, _, gateway_deployment, _ = ensure_coston2_config()
    gateway = web3_client.eth.contract(address=gateway_deployment.address, abi=gateway_deployment.abi_json)

    with transaction.atomic():
        locked = FccInstruction.objects.select_for_update().get(pk=instruction.pk)
        tx_hash = locked.finalization_tx_hash
        locked.status = FccInstruction.Status.FINALIZATION_PENDING
        locked.save(update_fields=["status", "updated_at"])

    if not tx_hash:
        tx_hash = _send_contract_call(
            gateway.functions.expireStaleRequest(instruction.instruction_id),
            web3_client=web3_client,
        )
        FccInstruction.objects.filter(pk=instruction.pk).update(
            finalization_tx_hash=tx_hash,
            error_message="",
            updated_at=timezone.now(),
        )

    receipt = _wait_for_receipt(tx_hash, web3_client=web3_client)
    if int(receipt.get("status", 0)) != 1:
        FccInstruction.objects.filter(pk=instruction.pk).update(
            finalization_tx_hash="",
            status=FccInstruction.Status.TEE_PENDING,
            error_message="Stale-request expiration transaction reverted on-chain",
            updated_at=timezone.now(),
        )
        if instruction.request_type == FccInstruction.RequestType.AUTHORIZE_WITHDRAWAL:
            from apps.withdrawals.models import WithdrawalRequest
            WithdrawalRequest.objects.filter(instruction=instruction).update(
                finalization_tx_hash="",
                status=WithdrawalRequest.Status.TEE_PENDING,
                error_message="Stale-request expiration transaction reverted on-chain",
                updated_at=timezone.now(),
            )
        raise FccFlowError("Stale-request expiration transaction reverted on-chain")

    verification_error = ""
    try:
        _event_found(gateway, "StaleRequestExpired", receipt, instruction.instruction_id)
    except Exception as exc:
        verification_error = f"Expiration confirmed but event verification failed: {exc}"

    with transaction.atomic():
        locked = FccInstruction.objects.select_for_update().select_related("payroll_run").get(pk=instruction.pk)
        locked.status = FccInstruction.Status.EXPIRED
        locked.finalization_tx_hash = tx_hash
        locked.finalization_block_number = int(receipt.get("blockNumber", 0))
        locked.closed_at = timezone.now()
        locked.error_message = verification_error[:2000]
        locked.save()
        payroll = locked.payroll_run
        if locked.request_type == FccInstruction.RequestType.PROCESS_PAYROLL:
            payroll.status = payroll.Status.DRAFT_ONCHAIN if not verification_error else payroll.Status.FAILED
            payroll.onchain_status = 1 if not verification_error else payroll.onchain_status
            payroll.instruction_id = ""
            payroll.save(update_fields=["status", "onchain_status", "instruction_id", "updated_at"])
        else:
            from apps.withdrawals.models import WithdrawalRequest
            withdrawal = WithdrawalRequest.objects.select_for_update().get(instruction=locked)
            withdrawal.status = (
                WithdrawalRequest.Status.EXPIRED
                if not verification_error
                else WithdrawalRequest.Status.FAILED
            )
            withdrawal.finalization_tx_hash = tx_hash
            withdrawal.completed_at = timezone.now()
            withdrawal.error_message = verification_error[:2000]
            withdrawal.save()
            if not verification_error:
                payroll.status = payroll.Status.ACTIVE
                payroll.onchain_status = 5
                payroll.save(update_fields=["status", "onchain_status", "updated_at"])
        return locked


def process_instruction(instruction: FccInstruction, *, auto_finalize: bool = True) -> FccInstruction:
    instruction = FccInstruction.objects.get(pk=instruction.pk)
    if instruction.status in [FccInstruction.Status.FINALIZED, FccInstruction.Status.EXPIRED]:
        return instruction
    if instruction.status == FccInstruction.Status.TEE_PENDING:
        if timezone.now() > instruction.requested_at + timedelta(seconds=settings.ZALARY_FCC_REQUEST_TTL_SECONDS):
            if settings.ZALARY_RELAYER_PRIVATE_KEY.strip():
                return expire_instruction(instruction)
            return instruction
        action = fetch_action_result(instruction.instruction_id)
        FccInstruction.objects.filter(pk=instruction.pk).update(
            poll_attempts=instruction.poll_attempts + 1,
            last_polled_at=timezone.now(),
        )
        if action is None:
            return FccInstruction.objects.get(pk=instruction.pk)
        instruction = store_action_result(instruction, action)
    if instruction.status in [FccInstruction.Status.TEE_SUCCESS, FccInstruction.Status.TEE_FAILURE, FccInstruction.Status.FINALIZATION_PENDING]:
        if auto_finalize and settings.ZALARY_RELAYER_PRIVATE_KEY.strip():
            return finalize_instruction(instruction)
        if instruction.status != FccInstruction.Status.FINALIZATION_PENDING:
            instruction.status = FccInstruction.Status.FINALIZATION_PENDING
            instruction.save(update_fields=["status", "updated_at"])
            if instruction.request_type == FccInstruction.RequestType.AUTHORIZE_WITHDRAWAL:
                from apps.withdrawals.models import WithdrawalRequest
                WithdrawalRequest.objects.filter(instruction=instruction).update(
                    status=WithdrawalRequest.Status.FINALIZATION_PENDING,
                    updated_at=timezone.now(),
                )
    return instruction


def process_pending_instructions(limit: int | None = None) -> dict:
    limit = limit or settings.ZALARY_FCC_POLL_BATCH_SIZE
    result = {"checked": 0, "waiting": 0, "finalized": 0, "expired": 0, "errors": 0}
    queryset = FccInstruction.objects.filter(
        status__in=[
            FccInstruction.Status.TEE_PENDING,
            FccInstruction.Status.TEE_SUCCESS,
            FccInstruction.Status.TEE_FAILURE,
            FccInstruction.Status.FINALIZATION_PENDING,
        ]
    ).order_by("requested_at")[:limit]
    for instruction in queryset:
        result["checked"] += 1
        try:
            processed = process_instruction(instruction)
            if processed.status == FccInstruction.Status.FINALIZED:
                result["finalized"] += 1
            elif processed.status == FccInstruction.Status.EXPIRED:
                result["expired"] += 1
            else:
                result["waiting"] += 1
        except FccFlowError as exc:
            FccInstruction.objects.filter(pk=instruction.pk).update(
                error_message=str(exc)[:2000],
                last_polled_at=timezone.now(),
            )
            result["errors"] += 1
    return result
