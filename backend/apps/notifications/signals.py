from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.accounts.models import Account
from apps.employees.models import InstitutionEmployee
from apps.institutions.models import Institution, InstitutionMember
from apps.payroll.models import PayrollRun
from apps.transactions.models import ChainTransaction
from apps.withdrawals.models import WithdrawalRequest

from .services import account_for_wallet, emit_notification


def _account_email(account: Account | None) -> str:
    return account.email.strip() if account and account.email else ""


def _institution_admin(institution: Institution):
    account = institution.created_by or account_for_wallet(institution.admin_address)
    email = institution.notification_email.strip() or _account_email(account)
    return account, email


def _member_identity(member: InstitutionMember):
    account = member.account or account_for_wallet(member.wallet_address)
    email = member.notification_email.strip() or _account_email(account)
    return account, email


def _employee_identity(employee: InstitutionEmployee):
    wallet = employee.auth_wallet
    account = account_for_wallet(wallet)
    try:
        email = employee.private_email.strip()
    except Exception:
        email = ""
    return wallet, account, email


def _emit_to_role_members(*, payroll: PayrollRun, roles: list[str], notification_type: str, category: str, title: str, message: str, template_name: str, suffix: str):
    seen = set()
    for member in payroll.institution.members.filter(
        role__in=roles,
        status=InstitutionMember.Status.ACTIVE,
    ).select_related("account"):
        wallet_key = member.wallet_address.lower()
        if wallet_key in seen:
            continue
        seen.add(wallet_key)
        account, email = _member_identity(member)
        emit_notification(
            notification_type=notification_type,
            category=category,
            title=title,
            message=message,
            dedup_key=f"payroll:{payroll.id}:{suffix}:{wallet_key}",
            account=account,
            institution=payroll.institution,
            recipient_wallet=member.wallet_address,
            recipient_email=email,
            template_name=template_name,
            context={
                "institution_name": payroll.institution.name,
                "payroll_title": payroll.title,
                "period_label": payroll.period_label,
                "payroll_status": payroll.status,
                "funding_deadline": payroll.funding_deadline,
                "withdrawal_deadline": payroll.withdrawal_deadline,
            },
            metadata={"payroll_run_id": payroll.id, "payroll_id": payroll.payroll_id},
            payroll_run=payroll,
        )




@receiver(post_save, sender=Account)
def account_welcome_notification(sender, instance: Account, created: bool, **kwargs):
    if not instance.email:
        return
    emit_notification(
        notification_type="account_welcome",
        category="institution",
        title="Welcome to Zalary",
        message="Your wallet profile is ready. You can now receive operational payroll notifications at this email address.",
        dedup_key=f"account:{instance.id}:welcome",
        account=instance,
        recipient_wallet=instance.wallet_address,
        recipient_email=instance.email,
        template_name="notification",
        context={},
        metadata={"account_id": instance.id},
    )


@receiver(post_save, sender=Institution)
def institution_notifications(sender, instance: Institution, created: bool, **kwargs):
    account, email = _institution_admin(instance)
    if created:
        emit_notification(
            notification_type="institution_onboarding_started",
            category="institution",
            title="Welcome to Zalary",
            message=f"{instance.name} has been created. Complete the on-chain registration and assign HR and Finance roles.",
            dedup_key=f"institution:{instance.id}:created",
            account=account,
            institution=instance,
            recipient_wallet=instance.admin_address,
            recipient_email=email,
            template_name="institution_onboarding",
            context={"institution_name": instance.name, "status": instance.registration_status},
            metadata={"institution_id": instance.id},
        )
    if instance.is_registered_onchain and instance.is_active_onchain:
        emit_notification(
            notification_type="institution_registration_confirmed",
            category="institution",
            title="Institution registration confirmed",
            message=f"{instance.name} is active on Coston2 and ready for confidential payroll operations.",
            dedup_key=f"institution:{instance.id}:active",
            account=account,
            institution=instance,
            recipient_wallet=instance.admin_address,
            recipient_email=email,
            template_name="institution_onboarding",
            context={"institution_name": instance.name, "status": "active"},
            metadata={"institution_id": instance.id},
        )


@receiver(post_save, sender=InstitutionMember)
def role_notifications(sender, instance: InstitutionMember, created: bool, **kwargs):
    account, email = _member_identity(instance)
    role_label = instance.get_role_display()
    stage = instance.status.replace("_", " ")
    emit_notification(
        notification_type=f"institution_role_{instance.status}",
        category="institution",
        title=f"Zalary {role_label} role {stage}",
        message=f"You have been {stage} as {role_label} for {instance.institution.name}.",
        dedup_key=f"institution-member:{instance.id}:{instance.status}",
        account=account,
        institution=instance.institution,
        recipient_wallet=instance.wallet_address,
        recipient_email=email,
        template_name="role_assigned",
        context={
            "institution_name": instance.institution.name,
            "role_label": role_label,
            "role_status": instance.status,
        },
        metadata={"institution_member_id": instance.id, "role": instance.role},
    )


@receiver(post_save, sender=InstitutionEmployee)
def employee_notifications(sender, instance: InstitutionEmployee, created: bool, **kwargs):
    wallet, account, email = _employee_identity(instance)
    onboarding = created or instance.status == InstitutionEmployee.Status.ACTIVE
    notification_type = "employee_onboarded" if onboarding else "employee_deactivated"
    title = "You have been added to Zalary" if onboarding else "Your Zalary employee access changed"
    message = (
        f"You have been added as an employee of {instance.institution.name}. Connect this wallet to view private payroll actions."
        if onboarding
        else f"Your employee record for {instance.institution.name} is inactive. Contact the institution if this is unexpected."
    )
    emit_notification(
        notification_type=notification_type,
        category="institution",
        title=title,
        message=message,
        dedup_key=f"employee:{instance.id}:{instance.status}",
        account=account,
        institution=instance.institution,
        recipient_wallet=wallet,
        recipient_email=email,
        template_name="employee_onboarded",
        context={
            "institution_name": instance.institution.name,
            "employee_ref": str(instance.employee_ref),
        },
        metadata={"employee_id": instance.id, "employee_ref": str(instance.employee_ref)},
    )


@receiver(post_save, sender=PayrollRun)
def payroll_notifications(sender, instance: PayrollRun, created: bool, **kwargs):
    if created:
        _emit_to_role_members(
            payroll=instance,
            roles=[InstitutionMember.Role.ADMIN, InstitutionMember.Role.HR],
            notification_type="payroll_created",
            category="payroll",
            title="Payroll created",
            message=f"{instance.title} for {instance.period_label} is ready for a private CSV upload.",
            template_name="payroll_status",
            suffix="created",
        )

    if instance.status == PayrollRun.Status.ENCRYPTED_READY:
        _emit_to_role_members(
            payroll=instance,
            roles=[InstitutionMember.Role.ADMIN, InstitutionMember.Role.HR],
            notification_type="payroll_encrypted",
            category="payroll",
            title="Payroll encrypted for confidential compute",
            message=f"{instance.title} has passed validation and is encrypted for the registered TEE.",
            template_name="payroll_status",
            suffix="encrypted",
        )
    elif instance.status == PayrollRun.Status.COMPUTED:
        _emit_to_role_members(
            payroll=instance,
            roles=[InstitutionMember.Role.ADMIN, InstitutionMember.Role.HR],
            notification_type="payroll_computation_complete",
            category="payroll",
            title="Confidential payroll computation complete",
            message=f"{instance.title} has a verified TEE result and can be opened for funding.",
            template_name="payroll_status",
            suffix="computed",
        )
    elif instance.status == PayrollRun.Status.FUNDING_READY:
        _emit_to_role_members(
            payroll=instance,
            roles=[InstitutionMember.Role.ADMIN, InstitutionMember.Role.FINANCE],
            notification_type="payroll_ready_for_funding",
            category="payroll",
            title="Payroll is ready for funding",
            message=f"{instance.title} requires funding before {instance.funding_deadline.isoformat()}.",
            template_name="funding_reminder",
            suffix="funding-ready",
        )
    elif instance.status == PayrollRun.Status.ACTIVE:
        _emit_to_role_members(
            payroll=instance,
            roles=[InstitutionMember.Role.ADMIN, InstitutionMember.Role.HR, InstitutionMember.Role.FINANCE],
            notification_type="payroll_activated",
            category="payroll",
            title="Payroll activated",
            message=f"{instance.title} is funded and private withdrawals are available.",
            template_name="payroll_status",
            suffix="active-roles",
        )
        for employee in instance.institution.employees.filter(status=InstitutionEmployee.Status.ACTIVE):
            wallet, account, email = _employee_identity(employee)
            emit_notification(
                notification_type="private_withdrawal_ready",
                category="withdrawal",
                title="Your private payroll withdrawal is ready",
                message=f"A confidential payroll for {instance.period_label} is active. Sign in with your employee wallet to prepare a private withdrawal.",
                dedup_key=f"payroll:{instance.id}:active-employee:{employee.id}",
                account=account,
                institution=instance.institution,
                recipient_wallet=wallet,
                recipient_email=email,
                template_name="withdrawal_ready",
                context={
                    "institution_name": instance.institution.name,
                    "period_label": instance.period_label,
                    "withdrawal_deadline": instance.withdrawal_deadline,
                },
                metadata={"payroll_run_id": instance.id, "employee_ref": str(employee.employee_ref)},
                payroll_run=instance,
            )
    elif instance.status == PayrollRun.Status.CLOSED:
        _emit_to_role_members(
            payroll=instance,
            roles=[InstitutionMember.Role.ADMIN, InstitutionMember.Role.HR, InstitutionMember.Role.FINANCE],
            notification_type="payroll_closed",
            category="payroll",
            title="Payroll closed",
            message=f"{instance.title} is closed. The aggregate audit report remains available.",
            template_name="payroll_status",
            suffix="closed",
        )
    elif instance.status == PayrollRun.Status.FAILED:
        _emit_to_role_members(
            payroll=instance,
            roles=[InstitutionMember.Role.ADMIN, InstitutionMember.Role.FINANCE],
            notification_type="payroll_failed",
            category="security",
            title="Payroll action failed",
            message=f"{instance.title} entered a failed state. Review the transaction and FCC logs before retrying.",
            template_name="transaction_failed",
            suffix="failed",
        )


@receiver(post_save, sender=WithdrawalRequest)
def withdrawal_notifications(sender, instance: WithdrawalRequest, created: bool, **kwargs):
    wallet, account, email = _employee_identity(instance.employee)
    if instance.status == WithdrawalRequest.Status.SIGNATURE_PENDING:
        emit_notification(
            notification_type="withdrawal_signature_required",
            category="withdrawal",
            title="Withdrawal signature required",
            message="Review and sign the private withdrawal authorization before it expires.",
            dedup_key=f"withdrawal:{instance.id}:signature",
            account=account,
            institution=instance.payroll_run.institution,
            recipient_wallet=wallet,
            recipient_email=email,
            template_name="withdrawal_ready",
            context={"expires_at": instance.expires_at, "period_label": instance.payroll_run.period_label},
            metadata={"withdrawal_id": str(instance.id)},
            payroll_run=instance.payroll_run,
            withdrawal=instance,
        )
    elif instance.status == WithdrawalRequest.Status.FINALIZED:
        emit_notification(
            notification_type="withdrawal_finalized",
            category="withdrawal",
            title="Private withdrawal completed",
            message="Your confidential payroll withdrawal was finalized successfully.",
            dedup_key=f"withdrawal:{instance.id}:finalized",
            account=account,
            institution=instance.payroll_run.institution,
            recipient_wallet=wallet,
            recipient_email=email,
            template_name="withdrawal_receipt",
            context={
                "amount_atomic": instance.amount,
                "period_label": instance.payroll_run.period_label,
                "finalization_tx_hash": instance.finalization_tx_hash,
                "completed_at": instance.completed_at,
            },
            metadata={"withdrawal_id": str(instance.id), "finalization_tx_hash": instance.finalization_tx_hash},
            payroll_run=instance.payroll_run,
            withdrawal=instance,
        )
    elif instance.status in {WithdrawalRequest.Status.FAILED, WithdrawalRequest.Status.TEE_FAILURE, WithdrawalRequest.Status.EXPIRED}:
        emit_notification(
            notification_type="withdrawal_attention_required",
            category="security",
            title="Private withdrawal needs attention",
            message=f"The private withdrawal is {instance.status}. No duplicate request should be submitted until its status is reviewed.",
            dedup_key=f"withdrawal:{instance.id}:{instance.status}",
            account=account,
            institution=instance.payroll_run.institution,
            recipient_wallet=wallet,
            recipient_email=email,
            template_name="transaction_failed",
            context={"withdrawal_status": instance.status, "error_message": instance.error_message},
            metadata={"withdrawal_id": str(instance.id)},
            payroll_run=instance.payroll_run,
            withdrawal=instance,
        )


@receiver(post_save, sender=ChainTransaction)
def failed_transaction_notifications(sender, instance: ChainTransaction, created: bool, **kwargs):
    if instance.status not in {ChainTransaction.Status.FAILED, ChainTransaction.Status.EVENT_MISMATCH}:
        return
    account = account_for_wallet(instance.sender_address)
    institution = None
    payroll = None
    if instance.prepared.related_model == "payroll.PayrollRun":
        payroll = PayrollRun.objects.select_related("institution").filter(pk=instance.prepared.related_id).first()
        institution = payroll.institution if payroll else None
    elif instance.prepared.related_model == "institutions.Institution":
        institution = Institution.objects.filter(pk=instance.prepared.related_id).first()
    email = ""
    if institution:
        _, email = _institution_admin(institution)
    email = email or _account_email(account)
    emit_notification(
        notification_type="transaction_failed",
        category="security",
        title="Blockchain transaction needs attention",
        message=f"{instance.intent_type} could not be verified. Review transaction {instance.tx_hash} before retrying.",
        dedup_key=f"chain-transaction:{instance.id}:{instance.status}",
        account=account,
        institution=institution,
        recipient_wallet=instance.sender_address,
        recipient_email=email,
        template_name="transaction_failed",
        context={
            "intent_type": instance.intent_type,
            "tx_hash": instance.tx_hash,
            "status": instance.status,
            "error_message": instance.error_message,
        },
        metadata={"chain_transaction_id": instance.id, "tx_hash": instance.tx_hash},
        payroll_run=payroll,
    )
