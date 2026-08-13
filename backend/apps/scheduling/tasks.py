from celery import shared_task
from django.utils import timezone

from apps.employees.models import InstitutionEmployee
from apps.institutions.models import InstitutionMember
from apps.notifications.services import account_for_wallet, emit_notification
from apps.payroll.models import PayrollRun
from apps.withdrawals.models import WithdrawalRequest

from .services import process_due_schedules


@shared_task
def process_due_payroll_schedules(limit: int = 100):
    return process_due_schedules(limit=limit)


def _hours_bucket(seconds_remaining: float) -> int | None:
    for hours in (1, 6, 24):
        if 0 < seconds_remaining <= hours * 3600:
            return hours
    return None


@shared_task
def send_payroll_deadline_reminders(limit: int = 250):
    now = timezone.now()
    sent = 0
    payrolls = PayrollRun.objects.select_related("institution").filter(
        status__in=[PayrollRun.Status.FUNDING_READY, PayrollRun.Status.ACTIVE]
    ).order_by("funding_deadline")[:limit]

    for payroll in payrolls:
        if payroll.status == PayrollRun.Status.FUNDING_READY:
            seconds = (payroll.funding_deadline - now).total_seconds()
            members = payroll.institution.members.filter(
                role__in=[InstitutionMember.Role.ADMIN, InstitutionMember.Role.FINANCE],
                status=InstitutionMember.Status.ACTIVE,
            ).select_related("account")
            if seconds <= 0:
                for member in members:
                    account = member.account or account_for_wallet(member.wallet_address)
                    email = member.notification_email or (account.email if account else "")
                    emit_notification(
                        notification_type="funding_deadline_passed",
                        category="security",
                        title="Payroll funding deadline passed",
                        message=f"{payroll.title} was not activated before its funding deadline. Review the payroll before taking another on-chain action.",
                        dedup_key=f"payroll:{payroll.id}:funding-deadline-passed:{member.wallet_address.lower()}",
                        account=account,
                        institution=payroll.institution,
                        recipient_wallet=member.wallet_address,
                        recipient_email=email,
                        template_name="transaction_failed",
                        context={"status": payroll.status, "error_message": "Funding deadline passed"},
                        metadata={"payroll_run_id": payroll.id},
                        payroll_run=payroll,
                    )
                    sent += 1
                continue
            bucket = _hours_bucket(seconds)
            if bucket is None:
                continue
            for member in members:
                account = member.account or account_for_wallet(member.wallet_address)
                email = member.notification_email or (account.email if account else "")
                emit_notification(
                    notification_type="funding_deadline_reminder",
                    category="reminder",
                    title=f"Payroll funding deadline in {bucket} hour{'s' if bucket != 1 else ''}",
                    message=f"{payroll.title} must be funded before {payroll.funding_deadline.isoformat()}.",
                    dedup_key=f"payroll:{payroll.id}:funding-reminder:{bucket}:{member.wallet_address.lower()}",
                    account=account,
                    institution=payroll.institution,
                    recipient_wallet=member.wallet_address,
                    recipient_email=email,
                    template_name="funding_reminder",
                    context={
                        "institution_name": payroll.institution.name,
                        "payroll_title": payroll.title,
                        "period_label": payroll.period_label,
                        "funding_deadline": payroll.funding_deadline,
                    },
                    metadata={"payroll_run_id": payroll.id, "hours_remaining": bucket},
                    payroll_run=payroll,
                )
                sent += 1
        elif payroll.status == PayrollRun.Status.ACTIVE and payroll.withdrawal_deadline:
            seconds = (payroll.withdrawal_deadline - now).total_seconds()
            employees = payroll.institution.employees.filter(status=InstitutionEmployee.Status.ACTIVE)
            if seconds <= 0:
                for employee in employees:
                    wallet = employee.auth_wallet
                    account = account_for_wallet(wallet)
                    try:
                        email = employee.private_email
                    except Exception:
                        email = ""
                    emit_notification(
                        notification_type="withdrawal_deadline_passed",
                        category="withdrawal",
                        title="Private withdrawal window closed",
                        message=f"The private withdrawal window for {payroll.period_label} has closed.",
                        dedup_key=f"payroll:{payroll.id}:withdrawal-deadline-passed:{employee.id}",
                        account=account,
                        institution=payroll.institution,
                        recipient_wallet=wallet,
                        recipient_email=email,
                        template_name="withdrawal_ready",
                        context={"period_label": payroll.period_label, "withdrawal_deadline": payroll.withdrawal_deadline},
                        metadata={"payroll_run_id": payroll.id},
                        payroll_run=payroll,
                    )
                    sent += 1
                continue
            bucket = _hours_bucket(seconds)
            if bucket is None:
                continue
            for employee in employees:
                wallet = employee.auth_wallet
                account = account_for_wallet(wallet)
                try:
                    email = employee.private_email
                except Exception:
                    email = ""
                emit_notification(
                    notification_type="withdrawal_deadline_reminder",
                    category="reminder",
                    title=f"Private withdrawal window closes in {bucket} hour{'s' if bucket != 1 else ''}",
                    message=f"The private withdrawal window for {payroll.period_label} closes at {payroll.withdrawal_deadline.isoformat()}.",
                    dedup_key=f"payroll:{payroll.id}:withdrawal-reminder:{bucket}:{employee.id}",
                    account=account,
                    institution=payroll.institution,
                    recipient_wallet=wallet,
                    recipient_email=email,
                    template_name="withdrawal_ready",
                    context={"period_label": payroll.period_label, "withdrawal_deadline": payroll.withdrawal_deadline},
                    metadata={"payroll_run_id": payroll.id, "hours_remaining": bucket},
                    payroll_run=payroll,
                )
                sent += 1
    return {"sent": sent}


@shared_task
def expire_unsigned_withdrawal_authorizations(limit: int = 250):
    now = timezone.now()
    queryset = WithdrawalRequest.objects.filter(
        status=WithdrawalRequest.Status.SIGNATURE_PENDING,
        expires_at__lte=now,
    ).order_by("expires_at")[:limit]
    updated = 0
    for withdrawal in queryset:
        withdrawal.status = WithdrawalRequest.Status.EXPIRED
        withdrawal.error_message = "Employee authorization expired before signature submission"
        withdrawal.save(update_fields=["status", "error_message", "updated_at"])
        updated += 1
    return {"expired": updated}
