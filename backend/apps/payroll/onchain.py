from __future__ import annotations

from datetime import datetime, timezone as datetime_timezone

from django.conf import settings
from django.db import transaction
from eth_utils import to_checksum_address
from web3.logs import DISCARD

from apps.chains.services import ensure_coston2_config, get_stablecoin_target
from apps.fcc.models import FccInstruction
from apps.transactions.models import ChainTransaction, TransactionIntent

from .models import PayrollRun


class PayrollOnchainError(ValueError):
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


def _matching_event(contract, event_name: str, receipt, expected: dict):
    decoded = getattr(contract.events, event_name)().process_receipt(receipt, errors=DISCARD)
    for log in decoded:
        args = log["args"]
        matched = True
        for key, expected_value in expected.items():
            actual = args[key]
            if isinstance(expected_value, str) and expected_value.startswith("0x"):
                if len(expected_value) == 42:
                    matched = to_checksum_address(actual) == to_checksum_address(expected_value)
                else:
                    matched = _hex(actual) == expected_value.lower()
            else:
                matched = int(actual) == int(expected_value) if isinstance(expected_value, int) else actual == expected_value
            if not matched:
                break
        if matched:
            return log
    raise PayrollOnchainError(f"Expected {event_name} event was not found")


@transaction.atomic
def verify_and_apply_confirmed_transaction(chain_tx: ChainTransaction, receipt, web3_client) -> None:
    prepared = chain_tx.prepared
    payroll = PayrollRun.objects.select_for_update().select_related("institution").get(
        id=prepared.metadata["payroll_run_id"]
    )
    _, vault_deployment, gateway_deployment, _ = ensure_coston2_config()
    vault = web3_client.eth.contract(address=vault_deployment.address, abi=vault_deployment.abi_json)

    if prepared.intent_type == TransactionIntent.CREATE_PAYROLL_DRAFT:
        _matching_event(
            vault,
            "PayrollDraftCreated",
            receipt,
            {
                "payrollId": payroll.payroll_id,
                "institution": payroll.institution.institution_address,
                "createdBy": prepared.sender_address,
                "metadataHash": payroll.metadata_hash,
                "fundingStartsAt": int(payroll.funding_starts_at.timestamp()),
                "fundingDeadline": int(payroll.funding_deadline.timestamp()),
                "minimumWithdrawalWindow": payroll.minimum_withdrawal_window_seconds,
                "settlementGracePeriod": payroll.settlement_grace_period_seconds,
            },
        )
        onchain = vault.functions.getPayroll(payroll.payroll_id).call()
        if to_checksum_address(_field(onchain, "institution", 0)) != payroll.institution.institution_address:
            raise PayrollOnchainError("On-chain payroll institution does not match")
        if to_checksum_address(_field(onchain, "createdBy", 1)) != prepared.sender_address:
            raise PayrollOnchainError("On-chain payroll creator does not match")
        if _hex(_field(onchain, "metadataHash", 4)) != payroll.metadata_hash.lower():
            raise PayrollOnchainError("On-chain payroll metadata hash does not match")
        if _hex(_field(onchain, "ciphertextHash", 5)) != "0x" + "00" * 32:
            raise PayrollOnchainError("New payroll draft already has a ciphertext commitment")
        status_value = int(_field(onchain, "status", 25))
        if status_value != 1:
            raise PayrollOnchainError("On-chain payroll is not in Draft status")
        payroll.status = PayrollRun.Status.DRAFT_ONCHAIN
        payroll.onchain_status = status_value
        payroll.draft_tx_hash = chain_tx.tx_hash
        payroll.save(update_fields=["status", "onchain_status", "draft_tx_hash", "updated_at"])
        return

    if prepared.intent_type == TransactionIntent.REQUEST_PAYROLL_COMPUTATION:
        gateway = web3_client.eth.contract(address=gateway_deployment.address, abi=gateway_deployment.abi_json)
        log = _matching_event(
            gateway,
            "PayrollComputationRequested",
            receipt,
            {
                "payrollId": payroll.payroll_id,
                "institution": payroll.institution.institution_address,
                "ciphertextHash": payroll.ciphertext_hash,
            },
        )
        args = log["args"]
        instruction_id = _hex(args["instructionId"])
        selected_tee_id = to_checksum_address(args["selectedTeeId"])
        tee_signer_epoch = int(args["teeSignerEpoch"])

        if selected_tee_id != to_checksum_address(payroll.selected_tee_id):
            raise PayrollOnchainError("Selected TEE does not match the encryption binding")

        request_type, request_tee, request_epoch, requested_at, closed = gateway.functions.getRequestStatus(
            instruction_id
        ).call()
        if int(request_type) != 1 or bool(closed):
            raise PayrollOnchainError("Gateway request is not an open payroll computation")
        if to_checksum_address(request_tee) != selected_tee_id or int(request_epoch) != tee_signer_epoch:
            raise PayrollOnchainError("Gateway request binding does not match its event")
        active_instruction = _hex(gateway.functions.activePayrollInstruction(payroll.payroll_id).call())
        if active_instruction != instruction_id:
            raise PayrollOnchainError("Gateway active instruction does not match")

        tee_signer, binding_epoch, binding_active = gateway.functions.teeBindings(selected_tee_id).call()
        tee_signer = to_checksum_address(tee_signer)
        if not binding_active or int(binding_epoch) != tee_signer_epoch:
            raise PayrollOnchainError("TEE signer binding is inactive or changed")

        onchain = vault.functions.getPayroll(payroll.payroll_id).call()
        status_value = int(_field(onchain, "status", 25))
        if status_value != 2:
            raise PayrollOnchainError("On-chain payroll is not in ComputationRequested status")
        if _hex(_field(onchain, "ciphertextHash", 5)) != payroll.ciphertext_hash.lower():
            raise PayrollOnchainError("On-chain ciphertext hash does not match")

        requested_datetime = datetime.fromtimestamp(int(requested_at), tz=datetime_timezone.utc)
        FccInstruction.objects.update_or_create(
            instruction_id=instruction_id,
            defaults={
                "request_type": FccInstruction.RequestType.PROCESS_PAYROLL,
                "payroll_run": payroll,
                "ciphertext_hash": payroll.ciphertext_hash,
                "selected_tee_id": selected_tee_id,
                "tee_signer": tee_signer,
                "tee_signer_epoch": tee_signer_epoch,
                "requested_at": requested_datetime,
                "request_tx_hash": chain_tx.tx_hash,
                "status": FccInstruction.Status.TEE_PENDING,
            },
        )
        payroll.status = PayrollRun.Status.TEE_PROCESSING
        payroll.onchain_status = status_value
        payroll.instruction_id = instruction_id
        payroll.computation_request_tx_hash = chain_tx.tx_hash
        payroll.save(
            update_fields=[
                "status",
                "onchain_status",
                "instruction_id",
                "computation_request_tx_hash",
                "updated_at",
            ]
        )
        return


    if prepared.intent_type == TransactionIntent.OPEN_PAYROLL_FUNDING:
        _matching_event(vault, "PayrollFundingOpened", receipt, {"payrollId": payroll.payroll_id})
        onchain = vault.functions.getPayroll(payroll.payroll_id).call()
        status_value = int(_field(onchain, "status", 25))
        if status_value != 4:
            raise PayrollOnchainError("On-chain payroll is not in FundingReady status")
        payroll.status = PayrollRun.Status.FUNDING_READY
        payroll.onchain_status = status_value
        payroll.open_funding_tx_hash = chain_tx.tx_hash
        payroll.funded_amount = str(int(_field(onchain, "fundedAmount", 11)))
        payroll.save(update_fields=["status", "onchain_status", "open_funding_tx_hash", "funded_amount", "updated_at"])
        return

    if prepared.intent_type == TransactionIntent.APPROVE_PAYROLL_FUNDING:
        token_target = get_stablecoin_target()
        token = web3_client.eth.contract(
            address=token_target.address,
            abi=token_target.abi_json,
        )
        amount = int(prepared.metadata["amount"])
        _matching_event(
            token,
            "Approval",
            receipt,
            {
                "owner": prepared.sender_address,
                "spender": vault_deployment.address,
                "value": amount,
            },
        )
        allowance = int(token.functions.allowance(prepared.sender_address, vault_deployment.address).call())
        if allowance < amount:
            raise PayrollOnchainError("Confirmed token allowance is below the prepared amount")
        onchain = vault.functions.getPayroll(payroll.payroll_id).call()
        status_value = int(_field(onchain, "status", 25))
        if status_value != 4:
            raise PayrollOnchainError("Payroll left FundingReady before token approval confirmation")
        payroll.status = PayrollRun.Status.FUNDING_READY
        payroll.onchain_status = status_value
        payroll.approval_tx_hash = chain_tx.tx_hash
        payroll.save(update_fields=["status", "onchain_status", "approval_tx_hash", "updated_at"])
        return

    if prepared.intent_type == TransactionIntent.FUND_PAYROLL:
        amount = int(prepared.metadata["amount"])
        funded_log = _matching_event(
            vault,
            "PayrollFunded",
            receipt,
            {
                "payrollId": payroll.payroll_id,
                "funder": prepared.sender_address,
                "amount": amount,
                "totalRequired": int(payroll.total_required),
            },
        )
        onchain = vault.functions.getPayroll(payroll.payroll_id).call()
        status_value = int(_field(onchain, "status", 25))
        funded_amount = int(_field(onchain, "fundedAmount", 11))
        if funded_amount != int(funded_log["args"]["fundedAmount"]):
            raise PayrollOnchainError("Funded amount does not match PayrollFunded event")
        payroll.funding_tx_hash = chain_tx.tx_hash
        payroll.funded_amount = str(funded_amount)
        payroll.onchain_status = status_value
        if status_value == 5:
            activated = _matching_event(
                vault,
                "PayrollActivated",
                receipt,
                {
                    "payrollId": payroll.payroll_id,
                    "employeeEscrow": int(payroll.employee_net_total),
                    "aggregateTaxPaid": int(payroll.aggregate_tax_total),
                },
            )
            payroll.status = PayrollRun.Status.ACTIVE
            payroll.activated_at = datetime.fromtimestamp(int(activated["args"]["activatedAt"]), tz=datetime_timezone.utc)
            payroll.withdrawal_deadline = datetime.fromtimestamp(int(activated["args"]["withdrawalDeadline"]), tz=datetime_timezone.utc)
            payroll.settlement_deadline = datetime.fromtimestamp(int(activated["args"]["settlementDeadline"]), tz=datetime_timezone.utc)
            payroll.tax_paid_amount = str(int(_field(onchain, "taxPaidAmount", 13)))
            payroll.minimum_withdrawal_amount = str(int(_field(onchain, "minimumWithdrawalAmount", 14)))
        elif status_value == 4:
            payroll.status = PayrollRun.Status.FUNDING_READY
        else:
            raise PayrollOnchainError("Payroll funding confirmed with an unexpected status")
        payroll.save()
        return

    raise PayrollOnchainError("No payroll state handler exists for this transaction")


@transaction.atomic
def apply_failed_transaction(chain_tx: ChainTransaction) -> None:
    payroll = PayrollRun.objects.select_for_update().filter(
        id=chain_tx.prepared.metadata.get("payroll_run_id")
    ).first()
    if not payroll:
        return
    if chain_tx.prepared.intent_type == TransactionIntent.CREATE_PAYROLL_DRAFT:
        payroll.status = PayrollRun.Status.ENCRYPTED_READY
        payroll.draft_tx_hash = ""
    elif chain_tx.prepared.intent_type == TransactionIntent.REQUEST_PAYROLL_COMPUTATION:
        payroll.status = PayrollRun.Status.DRAFT_ONCHAIN
        payroll.computation_request_tx_hash = ""
    elif chain_tx.prepared.intent_type == TransactionIntent.OPEN_PAYROLL_FUNDING:
        payroll.status = PayrollRun.Status.COMPUTED
        payroll.open_funding_tx_hash = ""
    elif chain_tx.prepared.intent_type == TransactionIntent.APPROVE_PAYROLL_FUNDING:
        payroll.status = PayrollRun.Status.FUNDING_READY
        payroll.approval_tx_hash = ""
    elif chain_tx.prepared.intent_type == TransactionIntent.FUND_PAYROLL:
        payroll.status = PayrollRun.Status.FUNDING_READY
        payroll.funding_tx_hash = ""
    else:
        return
    payroll.save()
