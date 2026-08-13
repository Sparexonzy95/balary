from __future__ import annotations

from django.db import transaction
from django.db.models import Q
from eth_utils import to_checksum_address
from web3.logs import DISCARD

from apps.accounts.models import Account
from apps.accounts.services import normalize_address
from apps.chains.models import ContractDeployment
from apps.chains.services import ensure_coston2_config
from apps.transactions.models import ChainTransaction, PreparedTransaction, TransactionIntent
from apps.transactions.services import (
    TransactionFlowError,
    prepare_contract_transaction,
    record_submitted_transaction,
)

from .models import Institution, InstitutionMember


class InstitutionFlowError(ValueError):
    pass


ROLE_CONFIG = {
    InstitutionMember.Role.ADMIN: {
        "method": "setInstitutionAdmin",
        "event": "InstitutionAdminUpdated",
        "getter": "institutionAdmins",
        "intent": TransactionIntent.SET_INSTITUTION_ADMIN,
    },
    InstitutionMember.Role.HR: {
        "method": "setInstitutionHR",
        "event": "InstitutionHRUpdated",
        "getter": "institutionHR",
        "intent": TransactionIntent.SET_HR,
    },
    InstitutionMember.Role.FINANCE: {
        "method": "setInstitutionFinance",
        "event": "InstitutionFinanceUpdated",
        "getter": "institutionFinance",
        "intent": TransactionIntent.SET_FINANCE,
    },
}


def _active_admin(institution: Institution, wallet_address: str) -> bool:
    return institution.members.filter(
        wallet_address=normalize_address(wallet_address),
        role=InstitutionMember.Role.ADMIN,
        status=InstitutionMember.Status.ACTIVE,
        approved_onchain=True,
    ).exists()


@transaction.atomic
def create_local_institution(*, account: Account, name: str, treasury_address: str, tax_vault_address: str, notification_email: str = "") -> Institution:
    institution_address = normalize_address(account.wallet_address)
    treasury = normalize_address(treasury_address)
    tax_vault = normalize_address(tax_vault_address)
    chain, vault, _, _ = ensure_coston2_config()
    if treasury == vault.address or tax_vault == vault.address:
        raise InstitutionFlowError("Treasury and tax vault cannot be the payroll Vault contract")

    existing = Institution.objects.filter(institution_address=institution_address).first()
    if existing:
        raise InstitutionFlowError("This wallet already owns an institution record")

    institution = Institution.objects.create(
        name=name.strip(),
        notification_email=notification_email.strip(),
        institution_address=institution_address,
        admin_address=institution_address,
        treasury_address=treasury,
        tax_vault_address=tax_vault,
        chain=chain,
        vault_address=vault.address,
        created_by=account,
    )
    InstitutionMember.objects.create(
        institution=institution,
        account=account,
        wallet_address=institution_address,
        notification_email=notification_email.strip(),
        role=InstitutionMember.Role.ADMIN,
        status=InstitutionMember.Status.PENDING_ONCHAIN,
        approved_onchain=False,
    )
    return institution


def accessible_institutions(account: Account):
    wallet = normalize_address(account.wallet_address)
    return Institution.objects.filter(
        Q(created_by=account) | Q(members__wallet_address=wallet)
    ).distinct().prefetch_related("members")


def _get_vault_deployment() -> ContractDeployment:
    _, vault, _, _ = ensure_coston2_config()
    return vault


def prepare_registration(*, institution: Institution, actor: Account, idempotency_key: str | None = None) -> PreparedTransaction:
    actor_wallet = normalize_address(actor.wallet_address)
    if actor_wallet != institution.institution_address:
        raise InstitutionFlowError("Only the institution wallet can self-register")
    if institution.is_registered_onchain:
        raise InstitutionFlowError("Institution is already registered on-chain")
    if institution.registration_status == Institution.RegistrationStatus.PENDING:
        raise InstitutionFlowError("Institution registration is already pending")

    return prepare_contract_transaction(
        account=actor,
        deployment=_get_vault_deployment(),
        intent_type=TransactionIntent.REGISTER_INSTITUTION,
        sender_address=actor_wallet,
        function_name="registerMyInstitution",
        function_args=[institution.treasury_address, institution.tax_vault_address],
        expected_event="InstitutionRegistered",
        related_model="institutions.Institution",
        related_id=str(institution.id),
        metadata={
            "institution_id": institution.id,
            "institution_address": institution.institution_address,
            "admin_address": institution.admin_address,
            "treasury_address": institution.treasury_address,
            "tax_vault_address": institution.tax_vault_address,
        },
        idempotency_key=idempotency_key,
    )


@transaction.atomic
def confirm_registration(*, institution: Institution, actor: Account, prepared_transaction_id, tx_hash: str) -> ChainTransaction:
    try:
        prepared = PreparedTransaction.objects.select_for_update().get(
            id=prepared_transaction_id,
            created_by=actor,
            related_model="institutions.Institution",
            related_id=str(institution.id),
            intent_type=TransactionIntent.REGISTER_INSTITUTION,
        )
    except PreparedTransaction.DoesNotExist as exc:
        raise InstitutionFlowError("Prepared registration transaction not found") from exc

    try:
        chain_tx = record_submitted_transaction(
            prepared=prepared,
            actor_wallet=actor.wallet_address,
            tx_hash=tx_hash,
        )
    except TransactionFlowError as exc:
        raise InstitutionFlowError(str(exc)) from exc

    institution.registration_status = Institution.RegistrationStatus.PENDING
    institution.registration_tx_hash = chain_tx.tx_hash
    institution.save(update_fields=["registration_status", "registration_tx_hash", "updated_at"])
    return chain_tx


def prepare_role_change(
    *,
    institution: Institution,
    actor: Account,
    role: str,
    wallet_address: str,
    notification_email: str = "",
    approved: bool = True,
    idempotency_key: str | None = None,
) -> tuple[InstitutionMember, PreparedTransaction]:
    if role not in ROLE_CONFIG:
        raise InstitutionFlowError("Unsupported institution role")
    if not institution.is_registered_onchain or not institution.is_active_onchain:
        raise InstitutionFlowError("Institution must be active on-chain")
    if not _active_admin(institution, actor.wallet_address):
        raise InstitutionFlowError("Only an active institution admin can manage roles")

    wallet = normalize_address(wallet_address)
    if role == InstitutionMember.Role.ADMIN and not approved:
        active_admins = institution.members.filter(
            role=InstitutionMember.Role.ADMIN,
            status=InstitutionMember.Status.ACTIVE,
            approved_onchain=True,
        ).count()
        if active_admins <= 1:
            raise InstitutionFlowError("Cannot remove the last institution admin")

    account = Account.objects.filter(wallet_address=wallet).first()
    member, _ = InstitutionMember.objects.get_or_create(
        institution=institution,
        wallet_address=wallet,
        role=role,
        defaults={
            "account": account,
            "notification_email": notification_email.strip(),
            "status": InstitutionMember.Status.INVITED,
        },
    )
    if notification_email:
        member.notification_email = notification_email.strip()
        member.save(update_fields=["notification_email", "updated_at"])

    config = ROLE_CONFIG[role]
    prepared = prepare_contract_transaction(
        account=actor,
        deployment=_get_vault_deployment(),
        intent_type=config["intent"],
        sender_address=actor.wallet_address,
        function_name=config["method"],
        function_args=[institution.institution_address, wallet, approved],
        expected_event=config["event"],
        related_model="institutions.InstitutionMember",
        related_id=str(member.id),
        metadata={
            "institution_id": institution.id,
            "institution_address": institution.institution_address,
            "member_id": member.id,
            "role": role,
            "wallet_address": wallet,
            "approved": approved,
        },
        idempotency_key=idempotency_key,
    )
    return member, prepared


@transaction.atomic
def confirm_role_change(
    *,
    institution: Institution,
    actor: Account,
    prepared_transaction_id,
    tx_hash: str,
) -> ChainTransaction:
    try:
        prepared = PreparedTransaction.objects.select_for_update().get(
            id=prepared_transaction_id,
            created_by=actor,
            related_model="institutions.InstitutionMember",
            metadata__institution_id=institution.id,
        )
    except PreparedTransaction.DoesNotExist as exc:
        raise InstitutionFlowError("Prepared role transaction not found") from exc

    try:
        chain_tx = record_submitted_transaction(
            prepared=prepared,
            actor_wallet=actor.wallet_address,
            tx_hash=tx_hash,
        )
    except TransactionFlowError as exc:
        raise InstitutionFlowError(str(exc)) from exc

    member = InstitutionMember.objects.select_for_update().get(id=prepared.metadata["member_id"])
    approved = bool(prepared.metadata["approved"])
    member.status = InstitutionMember.Status.PENDING_ONCHAIN
    if approved:
        member.assigned_tx_hash = chain_tx.tx_hash
    else:
        member.removed_tx_hash = chain_tx.tx_hash
    member.save(update_fields=["status", "assigned_tx_hash", "removed_tx_hash", "updated_at"])
    return chain_tx


def _matching_event(contract, event_name: str, receipt, expected: dict):
    event_factory = getattr(contract.events, event_name)
    decoded = event_factory().process_receipt(receipt, errors=DISCARD)
    for log in decoded:
        args = log["args"]
        matched = True
        for key, value in expected.items():
            actual = args[key]
            if isinstance(value, str) and value.startswith("0x") and len(value) == 42:
                matched = to_checksum_address(actual) == to_checksum_address(value)
            else:
                matched = actual == value
            if not matched:
                break
        if matched:
            return log
    raise InstitutionFlowError(f"Expected {event_name} event was not found")


@transaction.atomic
def verify_and_apply_confirmed_transaction(chain_tx: ChainTransaction, receipt, web3_client) -> None:
    prepared = chain_tx.prepared
    vault = web3_client.eth.contract(
        address=prepared.contract_address,
        abi=_get_vault_deployment().abi_json,
    )

    if prepared.intent_type == TransactionIntent.REGISTER_INSTITUTION:
        institution = Institution.objects.select_for_update().get(id=prepared.metadata["institution_id"])
        _matching_event(
            vault,
            prepared.expected_event,
            receipt,
            {
                "institution": institution.institution_address,
                "institutionAdmin": institution.admin_address,
                "treasury": institution.treasury_address,
                "taxVault": institution.tax_vault_address,
            },
        )
        registered, active, treasury, tax_vault = vault.functions.institutions(
            institution.institution_address
        ).call()
        admin_ok = vault.functions.institutionAdmins(
            institution.institution_address,
            institution.admin_address,
        ).call()
        if not registered or not active or not admin_ok:
            raise InstitutionFlowError("On-chain institution state is not active")
        if to_checksum_address(treasury) != institution.treasury_address:
            raise InstitutionFlowError("On-chain treasury does not match")
        if to_checksum_address(tax_vault) != institution.tax_vault_address:
            raise InstitutionFlowError("On-chain tax vault does not match")

        institution.registration_status = Institution.RegistrationStatus.ACTIVE
        institution.is_registered_onchain = True
        institution.is_active_onchain = True
        institution.save(
            update_fields=[
                "registration_status",
                "is_registered_onchain",
                "is_active_onchain",
                "updated_at",
            ]
        )
        admin_member = institution.members.select_for_update().get(
            wallet_address=institution.admin_address,
            role=InstitutionMember.Role.ADMIN,
        )
        admin_member.status = InstitutionMember.Status.ACTIVE
        admin_member.approved_onchain = True
        admin_member.save(update_fields=["status", "approved_onchain", "updated_at"])
        return

    if prepared.related_model == "institutions.InstitutionMember":
        member = InstitutionMember.objects.select_for_update().select_related("institution").get(
            id=prepared.metadata["member_id"]
        )
        config = ROLE_CONFIG[prepared.metadata["role"]]
        approved = bool(prepared.metadata["approved"])
        _matching_event(
            vault,
            prepared.expected_event,
            receipt,
            {
                "institution": member.institution.institution_address,
                "account": member.wallet_address,
                "approved": approved,
            },
        )
        onchain_approved = getattr(vault.functions, config["getter"])(
            member.institution.institution_address,
            member.wallet_address,
        ).call()
        if bool(onchain_approved) != approved:
            raise InstitutionFlowError("On-chain role state does not match the prepared action")
        member.approved_onchain = approved
        member.status = InstitutionMember.Status.ACTIVE if approved else InstitutionMember.Status.REMOVED
        member.save(update_fields=["approved_onchain", "status", "updated_at"])
        return

    raise InstitutionFlowError("No institution state handler exists for this transaction")


@transaction.atomic
def apply_failed_transaction(chain_tx: ChainTransaction) -> None:
    prepared = chain_tx.prepared
    if prepared.intent_type == TransactionIntent.REGISTER_INSTITUTION:
        institution = Institution.objects.select_for_update().filter(
            id=prepared.metadata.get("institution_id")
        ).first()
        if institution:
            institution.registration_status = Institution.RegistrationStatus.FAILED
            institution.save(update_fields=["registration_status", "updated_at"])
        return
    if prepared.related_model == "institutions.InstitutionMember":
        member = InstitutionMember.objects.select_for_update().filter(
            id=prepared.metadata.get("member_id")
        ).first()
        if member:
            member.status = (
                InstitutionMember.Status.ACTIVE
                if member.approved_onchain
                else InstitutionMember.Status.INVITED
            )
            member.save(update_fields=["status", "updated_at"])
