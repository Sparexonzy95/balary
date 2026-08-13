from __future__ import annotations

import json
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from eth_utils import keccak

from apps.accounts.models import Account
from apps.accounts.services import normalize_address
from apps.chains.models import ContractDeployment
from apps.chains.services import ensure_coston2_config, get_stablecoin_target
from apps.common.permissions import InstitutionPermissionError, require_active_role
from apps.employees.models import InstitutionEmployee
from apps.fcc.services import FccEncryptionError, encrypt_for_registered_tee
from apps.institutions.models import Institution, InstitutionMember
from apps.transactions.models import ChainTransaction, PreparedTransaction, TransactionIntent
from apps.transactions.services import TransactionFlowError, prepare_contract_transaction, record_submitted_transaction

from .models import PayrollEmployeeAllocation, PayrollImportBatch, PayrollRun
from .validators import ValidatedPayroll, validate_payroll_csv


class PayrollFlowError(ValueError):
    def __init__(self, message: str, *, errors: list[dict] | None = None):
        super().__init__(message)
        self.errors = errors or []


def accessible_payrolls(account: Account):
    wallet = normalize_address(account.wallet_address)
    return PayrollRun.objects.filter(
        institution__members__wallet_address=wallet,
        institution__members__status=InstitutionMember.Status.ACTIVE,
        institution__members__approved_onchain=True,
    ).select_related("institution", "chain").distinct()


def _require_hr(institution: Institution, actor: Account) -> None:
    try:
        require_active_role(
            institution,
            actor.wallet_address,
            [InstitutionMember.Role.HR, InstitutionMember.Role.ADMIN],
        )
    except InstitutionPermissionError as exc:
        raise PayrollFlowError(str(exc)) from exc


def _validate_timing(funding_starts_at, funding_deadline, minimum_withdrawal_window_seconds: int, settlement_grace_period_seconds: int) -> None:
    now = timezone.now()
    if funding_starts_at < now - timedelta(minutes=1):
        raise PayrollFlowError("Funding start cannot be in the past")
    if funding_deadline <= funding_starts_at:
        raise PayrollFlowError("Funding deadline must be after funding start")
    if minimum_withdrawal_window_seconds < 3600:
        raise PayrollFlowError("Minimum withdrawal window must be at least one hour")
    if settlement_grace_period_seconds < 3600:
        raise PayrollFlowError("Settlement grace period must be at least one hour")


@transaction.atomic
def create_payroll(
    *,
    actor: Account,
    institution: Institution,
    title: str,
    period_label: str,
    funding_starts_at,
    funding_deadline,
    minimum_withdrawal_window_seconds: int,
    settlement_grace_period_seconds: int,
) -> PayrollRun:
    _require_hr(institution, actor)
    _validate_timing(
        funding_starts_at,
        funding_deadline,
        minimum_withdrawal_window_seconds,
        settlement_grace_period_seconds,
    )
    chain, _, _, _ = ensure_coston2_config()
    return PayrollRun.objects.create(
        institution=institution,
        chain=chain,
        title=title.strip(),
        period_label=period_label.strip(),
        funding_starts_at=funding_starts_at,
        funding_deadline=funding_deadline,
        minimum_withdrawal_window_seconds=minimum_withdrawal_window_seconds,
        settlement_grace_period_seconds=settlement_grace_period_seconds,
        created_by=actor,
    )


def _metadata_for(payroll: PayrollRun, validated: ValidatedPayroll) -> tuple[dict, str]:
    metadata = {
        "version": "1",
        "chainId": payroll.chain.chain_id,
        "institution": payroll.institution.institution_address,
        "payrollId": str(payroll.payroll_id),
        "periodLabel": payroll.period_label,
        "sourceChecksum": validated.file_checksum,
        "payloadHash": validated.payload_hash,
    }
    encoded = json.dumps(metadata, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return metadata, "0x" + keccak(encoded).hex()


def validate_upload(
    *,
    actor: Account,
    payroll: PayrollRun,
    raw: bytes,
    filename: str,
) -> ValidatedPayroll:
    _require_hr(payroll.institution, actor)
    if payroll.status not in [PayrollRun.Status.DRAFT, PayrollRun.Status.VALIDATED, PayrollRun.Status.ENCRYPTED_READY]:
        raise PayrollFlowError("Payroll cannot accept a new private payload in its current state")

    try:
        validated = validate_payroll_csv(
            raw=raw,
            payroll_id=payroll.payroll_id,
            institution_id=payroll.institution_id,
        )
    except ValueError as exc:
        raise PayrollFlowError(str(exc)) from exc

    PayrollImportBatch.objects.create(
        payroll_run=payroll,
        original_filename=(filename or "payroll.csv")[:255],
        file_checksum=validated.file_checksum,
        row_count=validated.row_count,
        is_valid=validated.valid,
        validation_errors=validated.errors,
        employee_net_total=str(validated.employee_net_total),
        aggregate_tax_total=str(validated.aggregate_tax_total),
        total_required=str(validated.total_required),
        payload_hash=validated.payload_hash,
    )
    if not validated.valid:
        raise PayrollFlowError("Payroll CSV validation failed", errors=validated.errors)

    employees = {
        str(employee.employee_ref): employee
        for employee in InstitutionEmployee.objects.filter(
            institution=payroll.institution,
            status=InstitutionEmployee.Status.ACTIVE,
        )
    }
    allocations = []
    for row in validated.payload["employees"]:
        employee = employees[row["employeeRef"]]
        amount = (
            int(row["grossAmount"])
            + int(row["bonusAmount"])
            - int(row["deductionsAmount"])
            - int(row["taxAmount"])
        )
        allocation = PayrollEmployeeAllocation(payroll_run=payroll, employee=employee)
        allocation.set_authorized_amount(amount)
        allocations.append(allocation)
    with transaction.atomic():
        PayrollEmployeeAllocation.objects.filter(payroll_run=payroll).delete()
        PayrollEmployeeAllocation.objects.bulk_create(allocations)

    metadata, metadata_hash = _metadata_for(payroll, validated)
    payroll.source_checksum = validated.file_checksum
    payroll.employee_count = validated.row_count
    payroll.employee_net_total = str(validated.employee_net_total)
    payroll.aggregate_tax_total = str(validated.aggregate_tax_total)
    payroll.total_required = str(validated.total_required)
    payroll.metadata_json = metadata
    payroll.metadata_hash = metadata_hash
    payroll.ciphertext = ""
    payroll.ciphertext_hash = ""
    payroll.selected_tee_id = ""
    payroll.encryption_endpoint = ""
    payroll.encrypted_at = None
    payroll.status = PayrollRun.Status.VALIDATED
    payroll.save()
    return validated


def encrypt_upload(
    *,
    actor: Account,
    payroll: PayrollRun,
    raw: bytes,
    filename: str,
) -> ValidatedPayroll:
    validated = validate_upload(actor=actor, payroll=payroll, raw=raw, filename=filename)
    payload_buffer = bytearray(validated.payload_bytes)
    try:
        encrypted = encrypt_for_registered_tee(bytes(payload_buffer))
    except FccEncryptionError as exc:
        raise PayrollFlowError(str(exc)) from exc
    finally:
        for index in range(len(payload_buffer)):
            payload_buffer[index] = 0

    with transaction.atomic():
        payroll = PayrollRun.objects.select_for_update().get(pk=payroll.pk)
        payroll.ciphertext = encrypted.ciphertext
        payroll.ciphertext_hash = encrypted.ciphertext_hash
        payroll.selected_tee_id = encrypted.tee_id
        payroll.encryption_endpoint = encrypted.endpoint
        payroll.encrypted_at = timezone.now()
        payroll.status = PayrollRun.Status.ENCRYPTED_READY
        payroll.save(
            update_fields=[
                "ciphertext",
                "ciphertext_hash",
                "selected_tee_id",
                "encryption_endpoint",
                "encrypted_at",
                "status",
                "updated_at",
            ]
        )
    return validated



def _get_deployments() -> tuple[ContractDeployment, ContractDeployment]:
    _, vault, gateway, _ = ensure_coston2_config()
    return vault, gateway


def prepare_payroll_draft(
    *,
    actor: Account,
    payroll: PayrollRun,
    idempotency_key: str | None = None,
) -> PreparedTransaction:
    _require_hr(payroll.institution, actor)
    if payroll.status != PayrollRun.Status.ENCRYPTED_READY:
        raise PayrollFlowError("Payroll must be validated and encrypted before creating its on-chain draft")
    if not payroll.metadata_hash or payroll.metadata_hash == "0x" + "00" * 32:
        raise PayrollFlowError("Payroll metadata commitment is missing")
    if not payroll.ciphertext or not payroll.ciphertext_hash:
        raise PayrollFlowError("Encrypted payroll payload is missing")

    vault, _ = _get_deployments()
    return prepare_contract_transaction(
        account=actor,
        deployment=vault,
        intent_type=TransactionIntent.CREATE_PAYROLL_DRAFT,
        sender_address=actor.wallet_address,
        function_name="createPayrollDraft",
        function_args=[
            payroll.payroll_id,
            payroll.institution.institution_address,
            payroll.metadata_hash,
            int(payroll.funding_starts_at.timestamp()),
            int(payroll.funding_deadline.timestamp()),
            payroll.minimum_withdrawal_window_seconds,
            payroll.settlement_grace_period_seconds,
        ],
        expected_event="PayrollDraftCreated",
        related_model="payroll.PayrollRun",
        related_id=str(payroll.id),
        metadata={
            "payroll_run_id": payroll.id,
            "payroll_id": str(payroll.payroll_id),
            "institution_address": payroll.institution.institution_address,
            "metadata_hash": payroll.metadata_hash,
        },
        idempotency_key=idempotency_key,
    )


@transaction.atomic
def confirm_payroll_draft(
    *,
    actor: Account,
    payroll: PayrollRun,
    prepared_transaction_id,
    tx_hash: str,
) -> ChainTransaction:
    _require_hr(payroll.institution, actor)
    try:
        prepared = PreparedTransaction.objects.select_for_update().get(
            id=prepared_transaction_id,
            created_by=actor,
            related_model="payroll.PayrollRun",
            related_id=str(payroll.id),
            intent_type=TransactionIntent.CREATE_PAYROLL_DRAFT,
        )
    except PreparedTransaction.DoesNotExist as exc:
        raise PayrollFlowError("Prepared payroll-draft transaction not found") from exc
    try:
        chain_tx = record_submitted_transaction(
            prepared=prepared,
            actor_wallet=actor.wallet_address,
            tx_hash=tx_hash,
        )
    except TransactionFlowError as exc:
        raise PayrollFlowError(str(exc)) from exc
    payroll.status = PayrollRun.Status.DRAFT_TX_PENDING
    payroll.draft_tx_hash = chain_tx.tx_hash
    payroll.save(update_fields=["status", "draft_tx_hash", "updated_at"])
    return chain_tx


def prepare_computation_request(
    *,
    actor: Account,
    payroll: PayrollRun,
    idempotency_key: str | None = None,
) -> PreparedTransaction:
    _require_hr(payroll.institution, actor)
    if payroll.status != PayrollRun.Status.DRAFT_ONCHAIN:
        raise PayrollFlowError("Payroll draft must be confirmed on-chain before requesting computation")
    if not payroll.ciphertext or not payroll.ciphertext_hash:
        raise PayrollFlowError("Encrypted payroll payload is missing")
    from apps.fcc.tee_authorization import (
        TeeAuthorizationError,
        resolve_live_authorized_tee,
    )

    try:
        authorized_tee = resolve_live_authorized_tee()
    except TeeAuthorizationError as exc:
        raise PayrollFlowError(str(exc)) from exc

    if normalize_address(payroll.selected_tee_id) != normalize_address(authorized_tee.tee_id):
        raise PayrollFlowError(
            "Payroll encryption TEE does not match "
            "the live authorized TEE"
        )
    if timezone.now() > payroll.funding_deadline:
        raise PayrollFlowError("Payroll funding deadline has passed")

    _, gateway = _get_deployments()
    encrypted_payroll = bytes.fromhex(payroll.ciphertext[2:])
    return prepare_contract_transaction(
        account=actor,
        deployment=gateway,
        intent_type=TransactionIntent.REQUEST_PAYROLL_COMPUTATION,
        sender_address=actor.wallet_address,
        function_name="requestPayrollComputation",
        function_args=[payroll.payroll_id, encrypted_payroll],
        expected_event="PayrollComputationRequested",
        related_model="payroll.PayrollRun",
        related_id=str(payroll.id),
        metadata={
            "payroll_run_id": payroll.id,
            "payroll_id": str(payroll.payroll_id),
            "ciphertext_hash": payroll.ciphertext_hash,
            "selected_tee_id": payroll.selected_tee_id,
        },
        idempotency_key=idempotency_key,
        value_wei=settings.ZALARY_FCC_FEE_WEI,
    )


@transaction.atomic
def confirm_computation_request(
    *,
    actor: Account,
    payroll: PayrollRun,
    prepared_transaction_id,
    tx_hash: str,
) -> ChainTransaction:
    _require_hr(payroll.institution, actor)
    try:
        prepared = PreparedTransaction.objects.select_for_update().get(
            id=prepared_transaction_id,
            created_by=actor,
            related_model="payroll.PayrollRun",
            related_id=str(payroll.id),
            intent_type=TransactionIntent.REQUEST_PAYROLL_COMPUTATION,
        )
    except PreparedTransaction.DoesNotExist as exc:
        raise PayrollFlowError("Prepared computation-request transaction not found") from exc
    try:
        chain_tx = record_submitted_transaction(
            prepared=prepared,
            actor_wallet=actor.wallet_address,
            tx_hash=tx_hash,
        )
    except TransactionFlowError as exc:
        raise PayrollFlowError(str(exc)) from exc
    payroll.status = PayrollRun.Status.COMPUTATION_TX_PENDING
    payroll.computation_request_tx_hash = chain_tx.tx_hash
    payroll.save(update_fields=["status", "computation_request_tx_hash", "updated_at"])
    return chain_tx


def _require_finance(institution: Institution, actor: Account) -> None:
    try:
        require_active_role(
            institution,
            actor.wallet_address,
            [InstitutionMember.Role.FINANCE],
        )
    except InstitutionPermissionError as exc:
        raise PayrollFlowError(str(exc)) from exc


def _onchain_field(data, name: str, index: int):
    if hasattr(data, name):
        return getattr(data, name)
    if hasattr(data, "get") and data.get(name) is not None:
        return data.get(name)
    return data[index]


def get_funding_context(*, actor: Account, payroll: PayrollRun, web3_client=None) -> dict:
    from apps.chains.services import get_coston2_web3

    wallet = normalize_address(actor.wallet_address)
    if not payroll.institution.members.filter(
        wallet_address=wallet,
        status=InstitutionMember.Status.ACTIVE,
        approved_onchain=True,
    ).exists():
        raise PayrollFlowError("Wallet is not an active member of this institution")

    web3_client = web3_client or get_coston2_web3()
    _, vault_deployment, _, token_config = ensure_coston2_config()
    token_target = get_stablecoin_target()
    vault = web3_client.eth.contract(address=vault_deployment.address, abi=vault_deployment.abi_json)
    token = web3_client.eth.contract(address=token_target.address, abi=token_target.abi_json)
    data = vault.functions.getPayroll(payroll.payroll_id).call()
    total_required = int(_onchain_field(data, "totalRequired", 10))
    funded_amount = int(_onchain_field(data, "fundedAmount", 11))
    remaining = max(0, total_required - funded_amount)
    return {
        "payroll_id": str(payroll.payroll_id),
        "status": int(_onchain_field(data, "status", 25)),
        "total_required": str(total_required),
        "funded_amount": str(funded_amount),
        "remaining_amount": str(remaining),
        "finance_wallet": wallet,
        "finance_balance": str(int(token.functions.balanceOf(wallet).call())),
        "vault_allowance": str(int(token.functions.allowance(wallet, vault_deployment.address).call())),
        "effective_funding_starts_at": str(int(vault.functions.effectiveFundingStartsAt(payroll.payroll_id).call())),
        "effective_funding_deadline": str(int(vault.functions.effectiveFundingDeadline(payroll.payroll_id).call())),
        "stablecoin": token_target.address,
        "vault": vault_deployment.address,
        "decimals": token_config.decimals,
    }


def prepare_open_funding(
    *, actor: Account, payroll: PayrollRun, idempotency_key: str | None = None
) -> PreparedTransaction:
    _require_hr(payroll.institution, actor)
    if payroll.status != PayrollRun.Status.COMPUTED or payroll.onchain_status != 3:
        raise PayrollFlowError("Payroll must be computed before funding can open")
    vault, _ = _get_deployments()
    return prepare_contract_transaction(
        account=actor,
        deployment=vault,
        intent_type=TransactionIntent.OPEN_PAYROLL_FUNDING,
        sender_address=actor.wallet_address,
        function_name="openFunding",
        function_args=[payroll.payroll_id],
        expected_event="PayrollFundingOpened",
        related_model="payroll.PayrollRun",
        related_id=str(payroll.id),
        metadata={"payroll_run_id": payroll.id, "payroll_id": str(payroll.payroll_id)},
        idempotency_key=idempotency_key,
    )


@transaction.atomic
def confirm_open_funding(
    *, actor: Account, payroll: PayrollRun, prepared_transaction_id, tx_hash: str
) -> ChainTransaction:
    _require_hr(payroll.institution, actor)
    try:
        prepared = PreparedTransaction.objects.select_for_update().get(
            id=prepared_transaction_id,
            created_by=actor,
            related_model="payroll.PayrollRun",
            related_id=str(payroll.id),
            intent_type=TransactionIntent.OPEN_PAYROLL_FUNDING,
        )
    except PreparedTransaction.DoesNotExist as exc:
        raise PayrollFlowError("Prepared open-funding transaction not found") from exc
    try:
        chain_tx = record_submitted_transaction(
            prepared=prepared, actor_wallet=actor.wallet_address, tx_hash=tx_hash
        )
    except TransactionFlowError as exc:
        raise PayrollFlowError(str(exc)) from exc
    payroll.status = PayrollRun.Status.OPEN_FUNDING_TX_PENDING
    payroll.open_funding_tx_hash = chain_tx.tx_hash
    payroll.save(update_fields=["status", "open_funding_tx_hash", "updated_at"])
    return chain_tx


def prepare_funding_approval(
    *, actor: Account, payroll: PayrollRun, idempotency_key: str | None = None, web3_client=None
) -> PreparedTransaction:
    _require_finance(payroll.institution, actor)
    context = get_funding_context(actor=actor, payroll=payroll, web3_client=web3_client)
    if context["status"] != 4 or payroll.status != PayrollRun.Status.FUNDING_READY:
        raise PayrollFlowError("Payroll funding is not open")
    remaining = int(context["remaining_amount"])
    if remaining <= 0:
        raise PayrollFlowError("Payroll is already fully funded")
    _, vault, _, _ = ensure_coston2_config()
    token_target = get_stablecoin_target()
    return prepare_contract_transaction(
        account=actor,
        deployment=token_target,
        intent_type=TransactionIntent.APPROVE_PAYROLL_FUNDING,
        sender_address=actor.wallet_address,
        function_name="approve",
        function_args=[vault.address, remaining],
        expected_event="Approval",
        related_model="payroll.PayrollRun",
        related_id=str(payroll.id),
        metadata={
            "payroll_run_id": payroll.id,
            "payroll_id": str(payroll.payroll_id),
            "amount": str(remaining),
            "spender": vault.address,
        },
        idempotency_key=idempotency_key,
    )


@transaction.atomic
def confirm_funding_approval(
    *, actor: Account, payroll: PayrollRun, prepared_transaction_id, tx_hash: str
) -> ChainTransaction:
    _require_finance(payroll.institution, actor)
    try:
        prepared = PreparedTransaction.objects.select_for_update().get(
            id=prepared_transaction_id,
            created_by=actor,
            related_model="payroll.PayrollRun",
            related_id=str(payroll.id),
            intent_type=TransactionIntent.APPROVE_PAYROLL_FUNDING,
        )
    except PreparedTransaction.DoesNotExist as exc:
        raise PayrollFlowError("Prepared token-approval transaction not found") from exc
    try:
        chain_tx = record_submitted_transaction(
            prepared=prepared, actor_wallet=actor.wallet_address, tx_hash=tx_hash
        )
    except TransactionFlowError as exc:
        raise PayrollFlowError(str(exc)) from exc
    payroll.status = PayrollRun.Status.APPROVAL_TX_PENDING
    payroll.approval_tx_hash = chain_tx.tx_hash
    payroll.save(update_fields=["status", "approval_tx_hash", "updated_at"])
    return chain_tx


def prepare_funding(
    *, actor: Account, payroll: PayrollRun, idempotency_key: str | None = None, web3_client=None
) -> PreparedTransaction:
    _require_finance(payroll.institution, actor)
    context = get_funding_context(actor=actor, payroll=payroll, web3_client=web3_client)
    if context["status"] != 4 or payroll.status != PayrollRun.Status.FUNDING_READY:
        raise PayrollFlowError("Payroll funding is not open")
    remaining = int(context["remaining_amount"])
    if remaining <= 0:
        raise PayrollFlowError("Payroll is already fully funded")
    if int(context["vault_allowance"]) < remaining:
        raise PayrollFlowError("USD₮0 allowance is below the remaining payroll amount")
    if int(context["finance_balance"]) < remaining:
        raise PayrollFlowError("Finance wallet has insufficient USD₮0")
    vault, _ = _get_deployments()
    return prepare_contract_transaction(
        account=actor,
        deployment=vault,
        intent_type=TransactionIntent.FUND_PAYROLL,
        sender_address=actor.wallet_address,
        function_name="fundPayroll",
        function_args=[payroll.payroll_id, remaining],
        expected_event="PayrollFunded",
        related_model="payroll.PayrollRun",
        related_id=str(payroll.id),
        metadata={
            "payroll_run_id": payroll.id,
            "payroll_id": str(payroll.payroll_id),
            "amount": str(remaining),
        },
        idempotency_key=idempotency_key,
    )


@transaction.atomic
def confirm_funding(
    *, actor: Account, payroll: PayrollRun, prepared_transaction_id, tx_hash: str
) -> ChainTransaction:
    _require_finance(payroll.institution, actor)
    try:
        prepared = PreparedTransaction.objects.select_for_update().get(
            id=prepared_transaction_id,
            created_by=actor,
            related_model="payroll.PayrollRun",
            related_id=str(payroll.id),
            intent_type=TransactionIntent.FUND_PAYROLL,
        )
    except PreparedTransaction.DoesNotExist as exc:
        raise PayrollFlowError("Prepared payroll-funding transaction not found") from exc
    try:
        chain_tx = record_submitted_transaction(
            prepared=prepared, actor_wallet=actor.wallet_address, tx_hash=tx_hash
        )
    except TransactionFlowError as exc:
        raise PayrollFlowError(str(exc)) from exc
    payroll.status = PayrollRun.Status.FUNDING_TX_PENDING
    payroll.funding_tx_hash = chain_tx.tx_hash
    payroll.save(update_fields=["status", "funding_tx_hash", "updated_at"])
    return chain_tx
