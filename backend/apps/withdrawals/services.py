from __future__ import annotations

import json
from datetime import datetime, timezone as datetime_timezone

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from eth_abi import encode
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak, to_checksum_address
from web3.logs import DISCARD

from apps.accounts.models import Account as UserAccount
from apps.accounts.services import normalize_address
from apps.chains.services import ensure_coston2_config, get_coston2_web3
from apps.common.crypto import stable_private_hash
from apps.employees.models import InstitutionEmployee
from apps.fcc.models import FccInstruction
from apps.fcc.services import (
    FccEncryptionError,
    FccFlowError,
    _send_contract_call,
    _wait_for_receipt,
    encrypt_for_registered_tee,
    process_instruction,
)
from apps.payroll.models import PayrollEmployeeAllocation, PayrollRun

from .models import WithdrawalRequest


class WithdrawalFlowError(ValueError):
    pass


def _hex(value) -> str:
    if isinstance(value, str):
        return value.lower()
    if isinstance(value, (bytes, bytearray)):
        return "0x" + bytes(value).hex()
    if hasattr(value, "hex"):
        text = value.hex()
        return text.lower() if text.startswith("0x") else "0x" + text.lower()
    return str(value).lower()


def _field(data, name: str, index: int):
    if hasattr(data, name):
        return getattr(data, name)
    if hasattr(data, "get") and data.get(name) is not None:
        return data.get(name)
    return data[index]


def _normalize_employee_signature_for_tee(signature: str) -> str:
    if not isinstance(signature, str) or not signature.startswith("0x"):
        raise WithdrawalFlowError("Employee signature must be hexadecimal")
    try:
        raw = bytearray.fromhex(signature[2:])
    except ValueError as exc:
        raise WithdrawalFlowError("Employee signature is malformed") from exc
    if len(raw) != 65:
        raise WithdrawalFlowError("Employee signature must be 65 bytes")
    if raw[64] in (27, 28):
        raw[64] -= 27
    if raw[64] not in (0, 1):
        raise WithdrawalFlowError("Employee signature has an unsupported recovery value")
    return "0x" + raw.hex()


def withdrawal_auth_digest(
    *,
    chain_id: int,
    gateway: str,
    vault: str,
    extension_id: int,
    payroll_id: int,
    employee_ref: str,
    destination: str,
    amount: int,
    nonce: int,
    old_ledger_root: str,
    expires_at: int,
) -> str:
    domain = keccak(text="ZALARY_FCC_WITHDRAWAL_AUTH_V1")
    employee_ref_hash = keccak(text=employee_ref)
    encoded = encode(
        [
            "bytes32",
            "uint256",
            "address",
            "address",
            "uint256",
            "uint256",
            "bytes32",
            "address",
            "uint256",
            "uint256",
            "bytes32",
            "uint64",
        ],
        [
            domain,
            int(chain_id),
            to_checksum_address(gateway),
            to_checksum_address(vault),
            int(extension_id),
            int(payroll_id),
            employee_ref_hash,
            to_checksum_address(destination),
            int(amount),
            int(nonce),
            bytes.fromhex(old_ledger_root[2:]),
            int(expires_at),
        ],
    )
    return "0x" + keccak(encoded).hex()


def accessible_withdrawals(actor: UserAccount):
    wallet_hash = stable_private_hash(normalize_address(actor.wallet_address))
    return WithdrawalRequest.objects.select_related(
        "payroll_run",
        "payroll_run__institution",
        "employee",
        "instruction",
    ).filter(employee__auth_wallet_hash=wallet_hash)


def eligible_withdrawal_payrolls(actor: UserAccount):
    """Return active payrolls available to the connected employee wallet.

    This endpoint intentionally exposes payroll metadata only. It never returns
    the employee's private salary balance or encrypted payroll row.
    """
    wallet_hash = stable_private_hash(normalize_address(actor.wallet_address))
    return (
        PayrollRun.objects.select_related("institution")
        .filter(
            institution__employees__auth_wallet_hash=wallet_hash,
            institution__employees__status=InstitutionEmployee.Status.ACTIVE,
            status=PayrollRun.Status.ACTIVE,
            withdrawal_deadline__gt=timezone.now(),
        )
        .distinct()
    )


def _employee_for_actor(payroll: PayrollRun, actor: UserAccount) -> InstitutionEmployee:
    wallet_hash = stable_private_hash(normalize_address(actor.wallet_address))
    employee = InstitutionEmployee.objects.filter(
        institution=payroll.institution,
        auth_wallet_hash=wallet_hash,
        status=InstitutionEmployee.Status.ACTIVE,
    ).first()
    if not employee:
        raise WithdrawalFlowError("Connected wallet is not an active employee for this institution")
    return employee


def _full_available_amount(payroll: PayrollRun, employee: InstitutionEmployee) -> int:
    if WithdrawalRequest.objects.filter(
        payroll_run=payroll,
        employee=employee,
        status=WithdrawalRequest.Status.FINALIZED,
    ).exists():
        return 0
    try:
        allocation = PayrollEmployeeAllocation.objects.get(
            payroll_run=payroll,
            employee=employee,
        )
        return allocation.authorized_amount
    except PayrollEmployeeAllocation.DoesNotExist as exc:
        raise WithdrawalFlowError(
            "Authenticated employee salary allocation is unavailable for this payroll"
        ) from exc
    except ValueError as exc:
        raise WithdrawalFlowError("Authenticated employee salary allocation is invalid") from exc


def _read_context(payroll: PayrollRun, web3_client=None) -> dict:
    web3_client = web3_client or get_coston2_web3()
    _, vault_deployment, gateway_deployment, token = ensure_coston2_config()
    vault = web3_client.eth.contract(address=vault_deployment.address, abi=vault_deployment.abi_json)
    gateway = web3_client.eth.contract(address=gateway_deployment.address, abi=gateway_deployment.abi_json)
    raw = vault.functions.getWithdrawalContext(payroll.payroll_id).call()
    context = {
        "institution": to_checksum_address(_field(raw, "institution", 0)),
        "private_ledger_root": _hex(_field(raw, "privateLedgerRoot", 1)),
        "stablecoin": to_checksum_address(_field(raw, "stablecoin", 2)),
        "stablecoin_decimals": int(_field(raw, "stablecoinDecimals", 3)),
        "status": int(_field(raw, "status", 4)),
        "withdrawal_deadline": int(_field(raw, "withdrawalDeadline", 5)),
        "settlement_deadline": int(_field(raw, "settlementDeadline", 6)),
        "pending_withdrawal_requests": int(_field(raw, "pendingWithdrawalRequests", 7)),
        "minimum_withdrawal_amount": int(_field(raw, "minimumWithdrawalAmount", 8)),
        "extension_id": int(gateway.functions.extensionId().call()),
        "gateway": gateway_deployment.address,
        "vault": vault_deployment.address,
        "token": token.address,
    }
    if context["institution"] != payroll.institution.institution_address:
        raise WithdrawalFlowError("Withdrawal context institution does not match payroll")
    if context["stablecoin"] != token.address or context["stablecoin_decimals"] != token.decimals:
        raise WithdrawalFlowError("Withdrawal context stablecoin does not match backend configuration")
    return context


def get_withdrawal_context(*, actor: UserAccount, payroll: PayrollRun, web3_client=None) -> dict:
    employee = _employee_for_actor(payroll, actor)
    context = _read_context(payroll, web3_client=web3_client)
    finalized = WithdrawalRequest.objects.filter(
        payroll_run=payroll,
        employee=employee,
        status=WithdrawalRequest.Status.FINALIZED,
    ).order_by("-nonce").first()
    next_nonce = int(finalized.nonce) + 1 if finalized else 0
    now_ts = int(timezone.now().timestamp())
    return {
        **context,
        "employee_ref": str(employee.employee_ref),
        "next_nonce": next_nonce,
        "available_withdrawal_amount": str(_full_available_amount(payroll, employee)),
        "destination_wallet": normalize_address(actor.wallet_address),
        "authorization_expires_at": min(
            now_ts + settings.ZALARY_WITHDRAWAL_AUTH_TTL_SECONDS,
            context["withdrawal_deadline"],
        ),
        "payroll_processing_tx_hash": payroll.finalization_tx_hash,
    }


@transaction.atomic
def prepare_withdrawal(
    *,
    actor: UserAccount,
    payroll: PayrollRun,
    web3_client=None,
) -> WithdrawalRequest:
    employee = _employee_for_actor(payroll, actor)
    destination_address = normalize_address(actor.wallet_address)
    amount_value = _full_available_amount(payroll, employee)
    if amount_value <= 0:
        raise WithdrawalFlowError("This employee salary allocation has already been withdrawn")

    context = _read_context(payroll, web3_client=web3_client)
    now_ts = int(timezone.now().timestamp())
    if context["status"] != 5:
        raise WithdrawalFlowError("Payroll is not active")
    if now_ts > context["withdrawal_deadline"]:
        raise WithdrawalFlowError("Payroll withdrawal deadline has passed")
    if context["pending_withdrawal_requests"] != 0:
        raise WithdrawalFlowError("This payroll already has a private withdrawal in progress")
    if amount_value < context["minimum_withdrawal_amount"]:
        raise WithdrawalFlowError("Withdrawal amount is below the contract minimum")
    if destination_address in {context["gateway"], context["vault"]}:
        raise WithdrawalFlowError("Withdrawal destination is forbidden")

    unfinished = WithdrawalRequest.objects.select_for_update().filter(
        payroll_run=payroll,
        employee=employee,
        status__in=[
            WithdrawalRequest.Status.SIGNATURE_PENDING,
            WithdrawalRequest.Status.AUTHORIZED,
            WithdrawalRequest.Status.ENCRYPTED,
            WithdrawalRequest.Status.REQUEST_PENDING,
            WithdrawalRequest.Status.TEE_PENDING,
            WithdrawalRequest.Status.TEE_SUCCESS,
            WithdrawalRequest.Status.FINALIZATION_PENDING,
        ],
    ).first()
    if unfinished:
        raise WithdrawalFlowError("Employee already has an unfinished withdrawal for this payroll")

    finalized = WithdrawalRequest.objects.filter(
        payroll_run=payroll,
        employee=employee,
        status=WithdrawalRequest.Status.FINALIZED,
    ).order_by("-nonce").first()
    nonce = int(finalized.nonce) + 1 if finalized else 0
    expires_ts = min(
        now_ts + settings.ZALARY_WITHDRAWAL_AUTH_TTL_SECONDS,
        context["withdrawal_deadline"],
    )
    digest = withdrawal_auth_digest(
        chain_id=settings.COSTON2_CHAIN_ID,
        gateway=context["gateway"],
        vault=context["vault"],
        extension_id=context["extension_id"],
        payroll_id=payroll.payroll_id,
        employee_ref=str(employee.employee_ref),
        destination=destination_address,
        amount=amount_value,
        nonce=nonce,
        old_ledger_root=context["private_ledger_root"],
        expires_at=expires_ts,
    )
    retryable = WithdrawalRequest.objects.select_for_update().filter(
        payroll_run=payroll,
        employee=employee,
        nonce=nonce,
        status__in=[
            WithdrawalRequest.Status.TEE_FAILURE,
            WithdrawalRequest.Status.EXPIRED,
            WithdrawalRequest.Status.FAILED,
        ],
    ).first()
    if retryable:
        retryable.instruction = None
        retryable.destination = destination_address
        retryable.amount = str(amount_value)
        retryable.expires_at = datetime.fromtimestamp(expires_ts, tz=datetime_timezone.utc)
        retryable.auth_digest = digest
        retryable.auth_signature = ""
        retryable.ciphertext = ""
        retryable.ciphertext_hash = ""
        retryable.selected_tee_id = ""
        retryable.old_ledger_root = context["private_ledger_root"]
        retryable.new_ledger_root = ""
        retryable.withdrawal_nullifier = None
        retryable.request_tx_hash = ""
        retryable.finalization_tx_hash = ""
        retryable.status = WithdrawalRequest.Status.SIGNATURE_PENDING
        retryable.error_message = ""
        retryable.completed_at = None
        retryable.save()
        return retryable

    return WithdrawalRequest.objects.create(
        payroll_run=payroll,
        employee=employee,
        destination=destination_address,
        amount=str(amount_value),
        nonce=nonce,
        expires_at=datetime.fromtimestamp(expires_ts, tz=datetime_timezone.utc),
        auth_digest=digest,
        old_ledger_root=context["private_ledger_root"],
    )


def _recover_employee_signer(digest: str, signature: str) -> str:
    try:
        return to_checksum_address(
            Account.recover_message(
                encode_defunct(primitive=bytes.fromhex(digest[2:])),
                signature=signature,
            )
        )
    except Exception as exc:
        raise WithdrawalFlowError("Employee authorization signature is invalid") from exc


def _event_for_instruction(contract, event_name: str, receipt, instruction_id: str):
    for log in getattr(contract.events, event_name)().process_receipt(receipt, errors=DISCARD):
        if _hex(log["args"]["instructionId"]) == instruction_id.lower():
            return log
    raise WithdrawalFlowError(f"Expected {event_name} event was not found")


def submit_withdrawal(
    *,
    actor: UserAccount,
    withdrawal: WithdrawalRequest,
    signature: str,
    web3_client=None,
) -> WithdrawalRequest:
    web3_client = web3_client or get_coston2_web3()
    with transaction.atomic():
        withdrawal = WithdrawalRequest.objects.select_for_update().select_related(
            "employee", "payroll_run", "payroll_run__institution"
        ).get(pk=withdrawal.pk)
        if withdrawal.status != WithdrawalRequest.Status.SIGNATURE_PENDING:
            raise WithdrawalFlowError("Withdrawal is not waiting for an employee signature")
        if timezone.now() >= withdrawal.expires_at:
            withdrawal.status = WithdrawalRequest.Status.EXPIRED
            withdrawal.error_message = "Employee authorization expired before submission"
            withdrawal.save(update_fields=["status", "error_message", "updated_at"])
            raise WithdrawalFlowError("Employee authorization has expired")
        employee = _employee_for_actor(withdrawal.payroll_run, actor)
        if employee.pk != withdrawal.employee_id:
            raise WithdrawalFlowError("Withdrawal belongs to another employee")
        expected_amount = _full_available_amount(withdrawal.payroll_run, employee)
        if expected_amount <= 0 or withdrawal.amount != str(expected_amount):
            raise WithdrawalFlowError("Withdrawal amount does not match the full authorized salary allocation")
        if withdrawal.destination != normalize_address(actor.wallet_address):
            raise WithdrawalFlowError("Withdrawal destination does not match the authenticated employee wallet")
        recovered = _recover_employee_signer(withdrawal.auth_digest, signature)
        if recovered != to_checksum_address(employee.auth_wallet):
            raise WithdrawalFlowError("Employee authorization signer does not match the payroll ledger wallet")

        context = _read_context(withdrawal.payroll_run, web3_client=web3_client)
        if context["status"] != 5:
            raise WithdrawalFlowError("Payroll is no longer active")
        if context["private_ledger_root"] != withdrawal.old_ledger_root.lower():
            raise WithdrawalFlowError("Private ledger root changed; prepare a fresh authorization")
        if context["pending_withdrawal_requests"] != 0:
            raise WithdrawalFlowError("This payroll already has a private withdrawal in progress")

        tee_signature = _normalize_employee_signature_for_tee(signature)
        payload = {
            "version": "1",
            "payrollId": str(withdrawal.payroll_run.payroll_id),
            "employeeRef": str(employee.employee_ref),
            "destination": withdrawal.destination,
            "amount": withdrawal.amount,
            "nonce": str(withdrawal.nonce),
            "expiresAt": str(int(withdrawal.expires_at.timestamp())),
            "authSignature": tee_signature,
        }
        payload_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        try:
            encrypted = encrypt_for_registered_tee(payload_bytes)
        except FccEncryptionError as exc:
            raise WithdrawalFlowError(str(exc)) from exc

        withdrawal.auth_signature = tee_signature
        withdrawal.ciphertext = encrypted.ciphertext
        withdrawal.ciphertext_hash = encrypted.ciphertext_hash
        withdrawal.selected_tee_id = encrypted.tee_id
        withdrawal.status = WithdrawalRequest.Status.ENCRYPTED
        withdrawal.error_message = ""
        withdrawal.save()

    _, vault_deployment, gateway_deployment, _ = ensure_coston2_config()
    gateway = web3_client.eth.contract(address=gateway_deployment.address, abi=gateway_deployment.abi_json)
    function_call = gateway.functions.requestPrivateWithdrawal(
        withdrawal.payroll_run.payroll_id,
        bytes.fromhex(withdrawal.ciphertext[2:]),
    )
    try:
        tx_hash = _send_contract_call(
            function_call,
            web3_client=web3_client,
            value_wei=settings.ZALARY_FCC_FEE_WEI,
        )
    except FccFlowError as exc:
        WithdrawalRequest.objects.filter(pk=withdrawal.pk).update(
            status=WithdrawalRequest.Status.FAILED,
            error_message=str(exc)[:2000],
            updated_at=timezone.now(),
        )
        raise WithdrawalFlowError(str(exc)) from exc

    WithdrawalRequest.objects.filter(pk=withdrawal.pk).update(
        request_tx_hash=tx_hash,
        status=WithdrawalRequest.Status.REQUEST_PENDING,
        updated_at=timezone.now(),
    )
    return confirm_submitted_withdrawal(
        WithdrawalRequest.objects.get(pk=withdrawal.pk),
        web3_client=web3_client,
    )


def confirm_submitted_withdrawal(
    withdrawal: WithdrawalRequest, *, web3_client=None
) -> WithdrawalRequest:
    web3_client = web3_client or get_coston2_web3()
    withdrawal = WithdrawalRequest.objects.select_related(
        "payroll_run", "payroll_run__institution", "instruction"
    ).get(pk=withdrawal.pk)
    if withdrawal.instruction_id:
        return withdrawal
    if not withdrawal.request_tx_hash:
        raise WithdrawalFlowError("Withdrawal request transaction has not been broadcast")

    _, _, gateway_deployment, _ = ensure_coston2_config()
    gateway = web3_client.eth.contract(address=gateway_deployment.address, abi=gateway_deployment.abi_json)
    try:
        receipt = _wait_for_receipt(withdrawal.request_tx_hash, web3_client=web3_client)
    except FccFlowError as exc:
        raise WithdrawalFlowError(str(exc)) from exc
    if int(receipt.get("status", 0)) != 1:
        WithdrawalRequest.objects.filter(pk=withdrawal.pk).update(
            status=WithdrawalRequest.Status.FAILED,
            error_message="Private withdrawal request reverted on-chain",
            updated_at=timezone.now(),
        )
        raise WithdrawalFlowError("Private withdrawal request reverted on-chain")

    logs = gateway.events.PrivateWithdrawalRequested().process_receipt(receipt, errors=DISCARD)
    matching = None
    for log in logs:
        args = log["args"]
        if _hex(args["ciphertextHash"]) == withdrawal.ciphertext_hash.lower():
            matching = log
            break
    if matching is None:
        raise WithdrawalFlowError("PrivateWithdrawalRequested event was not found")
    args = matching["args"]
    instruction_id = _hex(args["instructionId"])
    selected_tee_id = to_checksum_address(args["selectedTeeId"])
    tee_signer_epoch = int(args["teeSignerEpoch"])

    request_type, request_tee, request_epoch, requested_at, closed = gateway.functions.getRequestStatus(
        instruction_id
    ).call()
    if int(request_type) != 2 or bool(closed):
        raise WithdrawalFlowError("Gateway request is not an open private withdrawal")
    if to_checksum_address(request_tee) != selected_tee_id or int(request_epoch) != tee_signer_epoch:
        raise WithdrawalFlowError("Gateway withdrawal binding does not match its event")
    active = _hex(gateway.functions.activeWithdrawalInstruction(withdrawal.payroll_run.payroll_id).call())
    if active != instruction_id:
        raise WithdrawalFlowError("Gateway active withdrawal instruction does not match")
    tee_signer, binding_epoch, binding_active = gateway.functions.teeBindings(selected_tee_id).call()
    if not binding_active or int(binding_epoch) != tee_signer_epoch:
        raise WithdrawalFlowError("TEE signer binding is inactive or changed")

    with transaction.atomic():
        locked = WithdrawalRequest.objects.select_for_update().get(pk=withdrawal.pk)
        if locked.instruction_id:
            return locked
        instruction, created = FccInstruction.objects.get_or_create(
            instruction_id=instruction_id,
            defaults={
                "request_type": FccInstruction.RequestType.AUTHORIZE_WITHDRAWAL,
                "payroll_run": locked.payroll_run,
                "ciphertext_hash": locked.ciphertext_hash,
                "selected_tee_id": selected_tee_id,
                "tee_signer": to_checksum_address(tee_signer),
                "tee_signer_epoch": tee_signer_epoch,
                "requested_at": datetime.fromtimestamp(int(requested_at), tz=datetime_timezone.utc),
                "request_tx_hash": locked.request_tx_hash,
                "status": FccInstruction.Status.TEE_PENDING,
            },
        )
        if not created and instruction.payroll_run_id != locked.payroll_run_id:
            raise WithdrawalFlowError("Instruction ID is already bound to another payroll")
        locked.instruction = instruction
        locked.status = WithdrawalRequest.Status.TEE_PENDING
        locked.error_message = ""
        locked.save(update_fields=["instruction", "status", "error_message", "updated_at"])
        return locked


def process_withdrawal(*, actor: UserAccount, withdrawal: WithdrawalRequest) -> WithdrawalRequest:
    employee = _employee_for_actor(withdrawal.payroll_run, actor)
    if employee.pk != withdrawal.employee_id:
        raise WithdrawalFlowError("Withdrawal belongs to another employee")
    if not withdrawal.instruction_id and withdrawal.request_tx_hash:
        withdrawal = confirm_submitted_withdrawal(withdrawal)
    if not withdrawal.instruction_id:
        raise WithdrawalFlowError("Withdrawal does not have an FCC instruction")
    try:
        process_instruction(withdrawal.instruction)
    except FccFlowError as exc:
        raise WithdrawalFlowError(str(exc)) from exc
    return WithdrawalRequest.objects.select_related("instruction").get(pk=withdrawal.pk)
