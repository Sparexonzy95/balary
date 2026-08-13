from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.employees.models import InstitutionEmployee
from apps.institutions.models import Institution, InstitutionMember
from apps.notifications.models import EmailDelivery
from apps.payroll.models import PayrollRun
from apps.scheduling.models import PayrollScheduleExecution, RecurringPayrollSchedule
from apps.transactions.models import ChainTransaction
from apps.withdrawals.models import WithdrawalRequest

from .services import record_audit_event


@receiver(post_save, sender=Institution)
def audit_institution(sender, instance: Institution, created: bool, **kwargs):
    state = "created" if created else instance.registration_status
    record_audit_event(
        action=f"institution_{state}",
        target_type="institutions.Institution",
        target_id=instance.id,
        dedup_key=f"audit:institution:{instance.id}:{state}:{int(instance.is_active_onchain)}",
        institution=instance,
        actor=instance.created_by,
        metadata={
            "registration_status": instance.registration_status,
            "is_registered_onchain": instance.is_registered_onchain,
            "is_active_onchain": instance.is_active_onchain,
            "registration_tx_hash": instance.registration_tx_hash,
        },
    )


@receiver(post_save, sender=InstitutionMember)
def audit_member(sender, instance: InstitutionMember, created: bool, **kwargs):
    record_audit_event(
        action="institution_role_updated",
        target_type="institutions.InstitutionMember",
        target_id=instance.id,
        dedup_key=f"audit:member:{instance.id}:{instance.role}:{instance.status}:{int(instance.approved_onchain)}",
        institution=instance.institution,
        actor=instance.account,
        actor_wallet=instance.wallet_address,
        metadata={
            "role": instance.role,
            "status": instance.status,
            "approved_onchain": instance.approved_onchain,
            "assigned_tx_hash": instance.assigned_tx_hash,
            "removed_tx_hash": instance.removed_tx_hash,
        },
    )


@receiver(post_save, sender=InstitutionEmployee)
def audit_employee(sender, instance: InstitutionEmployee, created: bool, **kwargs):
    record_audit_event(
        action="employee_created" if created else "employee_updated",
        target_type="employees.InstitutionEmployee",
        target_id=instance.id,
        dedup_key=f"audit:employee:{instance.id}:{instance.status}:{instance.updated_at.isoformat() if instance.updated_at else 'new'}",
        institution=instance.institution,
        actor=instance.created_by,
        metadata={"employee_ref": str(instance.employee_ref), "status": instance.status},
    )


@receiver(post_save, sender=PayrollRun)
def audit_payroll(sender, instance: PayrollRun, created: bool, **kwargs):
    record_audit_event(
        action="payroll_created" if created else f"payroll_{instance.status}",
        target_type="payroll.PayrollRun",
        target_id=instance.id,
        dedup_key=f"audit:payroll:{instance.id}:{instance.status}",
        institution=instance.institution,
        actor=instance.created_by,
        metadata={
            "payroll_id": instance.payroll_id,
            "status": instance.status,
            "onchain_status": instance.onchain_status,
            "employee_count": instance.employee_count,
            "total_required": instance.total_required,
            "metadata_hash": instance.metadata_hash,
            "ciphertext_hash": instance.ciphertext_hash,
            "private_ledger_root": instance.private_ledger_root,
            "draft_tx_hash": instance.draft_tx_hash,
            "computation_request_tx_hash": instance.computation_request_tx_hash,
            "finalization_tx_hash": instance.finalization_tx_hash,
            "open_funding_tx_hash": instance.open_funding_tx_hash,
            "approval_tx_hash": instance.approval_tx_hash,
            "funding_tx_hash": instance.funding_tx_hash,
        },
    )


@receiver(post_save, sender=WithdrawalRequest)
def audit_withdrawal(sender, instance: WithdrawalRequest, created: bool, **kwargs):
    record_audit_event(
        action="withdrawal_created" if created else f"withdrawal_{instance.status}",
        target_type="withdrawals.WithdrawalRequest",
        target_id=instance.id,
        dedup_key=f"audit:withdrawal:{instance.id}:{instance.status}",
        institution=instance.payroll_run.institution,
        actor_wallet=instance.destination,
        metadata={
            "payroll_run_id": instance.payroll_run_id,
            "employee_ref": str(instance.employee.employee_ref),
            "nonce": instance.nonce,
            "status": instance.status,
            "request_tx_hash": instance.request_tx_hash,
            "finalization_tx_hash": instance.finalization_tx_hash,
            "withdrawal_nullifier": instance.withdrawal_nullifier,
            "old_ledger_root": instance.old_ledger_root,
            "new_ledger_root": instance.new_ledger_root,
        },
    )


@receiver(post_save, sender=ChainTransaction)
def audit_chain_transaction(sender, instance: ChainTransaction, created: bool, **kwargs):
    institution = None
    if instance.prepared.related_model == "payroll.PayrollRun":
        payroll = PayrollRun.objects.select_related("institution").filter(pk=instance.prepared.related_id).first()
        institution = payroll.institution if payroll else None
    elif instance.prepared.related_model == "institutions.Institution":
        institution = Institution.objects.filter(pk=instance.prepared.related_id).first()
    record_audit_event(
        action=f"chain_transaction_{instance.status}",
        target_type="transactions.ChainTransaction",
        target_id=instance.id,
        dedup_key=f"audit:chain-tx:{instance.id}:{instance.status}",
        institution=institution,
        actor_wallet=instance.sender_address,
        metadata={
            "intent_type": instance.intent_type,
            "tx_hash": instance.tx_hash,
            "status": instance.status,
            "block_number": instance.block_number,
            "gas_used": instance.gas_used,
            "error_message": instance.error_message,
        },
    )


@receiver(post_save, sender=RecurringPayrollSchedule)
def audit_schedule(sender, instance: RecurringPayrollSchedule, created: bool, **kwargs):
    record_audit_event(
        action="schedule_created" if created else "schedule_updated",
        target_type="scheduling.RecurringPayrollSchedule",
        target_id=instance.id,
        dedup_key=f"audit:schedule:{instance.id}:{instance.updated_at.isoformat() if instance.updated_at else 'new'}",
        institution=instance.institution,
        actor=instance.created_by,
        metadata={
            "frequency": instance.frequency,
            "timezone_name": instance.timezone_name,
            "next_run_at": instance.next_run_at,
            "active": instance.active,
            "run_count": instance.run_count,
        },
    )


@receiver(post_save, sender=PayrollScheduleExecution)
def audit_schedule_execution(sender, instance: PayrollScheduleExecution, created: bool, **kwargs):
    if not created:
        return
    record_audit_event(
        action=f"schedule_execution_{instance.status}",
        target_type="scheduling.PayrollScheduleExecution",
        target_id=instance.id,
        dedup_key=f"audit:schedule-execution:{instance.id}:{instance.status}",
        institution=instance.schedule.institution,
        actor=instance.schedule.created_by,
        metadata={
            "schedule_id": instance.schedule_id,
            "scheduled_for": instance.scheduled_for,
            "payroll_run_id": instance.payroll_run_id,
            "message": instance.message,
        },
    )


@receiver(post_save, sender=EmailDelivery)
def audit_email_delivery(sender, instance: EmailDelivery, created: bool, **kwargs):
    if instance.status not in {
        EmailDelivery.Status.ACCEPTED,
        EmailDelivery.Status.DELIVERED,
        EmailDelivery.Status.FAILED,
        EmailDelivery.Status.BOUNCED,
        EmailDelivery.Status.COMPLAINED,
        EmailDelivery.Status.REJECTED,
        EmailDelivery.Status.SKIPPED,
    }:
        return
    record_audit_event(
        action=f"email_delivery_{instance.status}",
        target_type="notifications.EmailDelivery",
        target_id=instance.id,
        dedup_key=f"audit:email:{instance.id}:{instance.status}:{instance.attempts}",
        institution=instance.institution,
        actor_wallet=instance.recipient_wallet,
        metadata={
            "status": instance.status,
            "subject": instance.subject,
            "attempts": instance.attempts,
            "error_message": instance.last_error,
        },
    )
