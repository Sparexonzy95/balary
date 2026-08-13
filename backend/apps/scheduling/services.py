from __future__ import annotations

import calendar
from datetime import datetime, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone

from apps.common.permissions import InstitutionPermissionError, require_active_role
from apps.institutions.models import InstitutionMember
from apps.notifications.services import emit_notification
from apps.payroll.models import PayrollRun

from .models import PayrollScheduleExecution, RecurringPayrollSchedule


class ScheduleFlowError(ValueError):
    pass


def _add_months(value: datetime, months: int) -> datetime:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def next_occurrence(current: datetime, frequency: str, timezone_name: str, anchor_day: int | None = None) -> datetime:
    zone = ZoneInfo(timezone_name)
    local = current.astimezone(zone)
    if frequency == RecurringPayrollSchedule.Frequency.WEEKLY:
        next_local = local + timedelta(days=7)
    elif frequency == RecurringPayrollSchedule.Frequency.BIWEEKLY:
        next_local = local + timedelta(days=14)
    elif frequency == RecurringPayrollSchedule.Frequency.MONTHLY:
        next_local = _add_months(local, 1)
        if anchor_day:
            next_local = next_local.replace(day=min(anchor_day, calendar.monthrange(next_local.year, next_local.month)[1]))
    elif frequency == RecurringPayrollSchedule.Frequency.QUARTERLY:
        next_local = _add_months(local, 3)
        if anchor_day:
            next_local = next_local.replace(day=min(anchor_day, calendar.monthrange(next_local.year, next_local.month)[1]))
    else:
        raise ScheduleFlowError("Unsupported schedule frequency")
    return next_local.astimezone(dt_timezone.utc)


def _format_context(schedule: RecurringPayrollSchedule, scheduled_for: datetime) -> dict[str, str]:
    local = scheduled_for.astimezone(ZoneInfo(schedule.timezone_name))
    period = local.strftime("%B %Y")
    return {
        "institution": schedule.institution.name,
        "month": local.strftime("%B"),
        "month_short": local.strftime("%b"),
        "year": local.strftime("%Y"),
        "date": local.strftime("%Y-%m-%d"),
        "period": period,
    }


def _render_template(template: str, context: dict[str, str], field_name: str) -> str:
    try:
        return template.format(**context).strip()
    except (KeyError, ValueError) as exc:
        raise ScheduleFlowError(f"Invalid token in {field_name}") from exc


def accessible_schedules(account):
    wallet = account.wallet_address
    return RecurringPayrollSchedule.objects.filter(
        institution__members__wallet_address__iexact=wallet,
        institution__members__status=InstitutionMember.Status.ACTIVE,
        institution__members__approved_onchain=True,
    ).distinct().select_related("institution", "created_by")


def require_schedule_manager(schedule: RecurringPayrollSchedule, account) -> None:
    try:
        require_active_role(
            schedule.institution,
            account.wallet_address,
            [InstitutionMember.Role.ADMIN, InstitutionMember.Role.HR],
        )
    except InstitutionPermissionError as exc:
        raise ScheduleFlowError(str(exc)) from exc


@transaction.atomic
def execute_schedule(
    schedule: RecurringPayrollSchedule,
    *,
    scheduled_for: datetime | None = None,
    force: bool = False,
    actor=None,
) -> PayrollScheduleExecution:
    locked = RecurringPayrollSchedule.objects.select_for_update().select_related(
        "institution", "institution__chain", "created_by"
    ).get(pk=schedule.pk)
    now = timezone.now()
    due_at = scheduled_for or (now if force else locked.next_run_at)

    if actor is not None:
        require_schedule_manager(locked, actor)
    if not force and not locked.active:
        raise ScheduleFlowError("Schedule is paused")
    if not force and due_at > now:
        raise ScheduleFlowError("Schedule is not due yet")

    existing = PayrollScheduleExecution.objects.filter(
        schedule=locked,
        scheduled_for=due_at,
    ).first()
    if existing:
        return existing

    if locked.max_runs is not None and locked.run_count >= locked.max_runs:
        locked.active = False
        locked.save(update_fields=["active", "updated_at"])
        return PayrollScheduleExecution.objects.create(
            schedule=locked,
            scheduled_for=due_at,
            status=PayrollScheduleExecution.Status.SKIPPED,
            message="Maximum schedule run count reached",
        )
    if locked.end_at and due_at > locked.end_at:
        locked.active = False
        locked.save(update_fields=["active", "updated_at"])
        return PayrollScheduleExecution.objects.create(
            schedule=locked,
            scheduled_for=due_at,
            status=PayrollScheduleExecution.Status.SKIPPED,
            message="Schedule end date reached",
        )

    context = _format_context(locked, due_at)
    title = _render_template(locked.title_template, context, "title_template")
    period_label = _render_template(locked.period_label_template, context, "period_label_template")
    funding_base = max(due_at, now)
    funding_starts_at = funding_base + timedelta(minutes=locked.funding_start_offset_minutes)
    funding_deadline = funding_starts_at + timedelta(hours=locked.funding_window_hours)

    payroll = PayrollRun.objects.create(
        institution=locked.institution,
        chain=locked.institution.chain,
        title=title,
        period_label=period_label,
        funding_starts_at=funding_starts_at,
        funding_deadline=funding_deadline,
        minimum_withdrawal_window_seconds=locked.minimum_withdrawal_window_seconds,
        settlement_grace_period_seconds=locked.settlement_grace_period_seconds,
        created_by=actor or locked.created_by,
    )
    execution = PayrollScheduleExecution.objects.create(
        schedule=locked,
        scheduled_for=due_at,
        payroll_run=payroll,
        status=PayrollScheduleExecution.Status.CREATED,
        message="Payroll shell created; a fresh private CSV upload is required",
    )

    locked.run_count += 1
    locked.last_run_at = now
    if not force or locked.next_run_at <= now:
        locked.next_run_at = next_occurrence(due_at, locked.frequency, locked.timezone_name, locked.anchor_day)
    if locked.max_runs is not None and locked.run_count >= locked.max_runs:
        locked.active = False
    if locked.end_at and locked.next_run_at > locked.end_at:
        locked.active = False
    locked.save(
        update_fields=["run_count", "last_run_at", "next_run_at", "active", "updated_at"]
    )

    admin = locked.institution.created_by
    emit_notification(
        notification_type="scheduled_payroll_created",
        category="reminder",
        title="Scheduled payroll created",
        message=f"{payroll.title} was created from {locked.name}. Upload a fresh private payroll CSV to continue.",
        dedup_key=f"schedule-execution:{execution.id}:created",
        account=admin,
        institution=locked.institution,
        recipient_wallet=admin.wallet_address,
        recipient_email=locked.institution.notification_email or admin.email,
        template_name="schedule_due",
        context={
            "schedule_name": locked.name,
            "payroll_title": payroll.title,
            "period_label": payroll.period_label,
            "next_run_at": locked.next_run_at,
        },
        metadata={"schedule_id": locked.id, "payroll_run_id": payroll.id},
        payroll_run=payroll,
    )
    return execution


def process_due_schedules(limit: int = 100) -> dict[str, int]:
    now = timezone.now()
    schedule_ids = list(
        RecurringPayrollSchedule.objects.filter(active=True, next_run_at__lte=now)
        .order_by("next_run_at")
        .values_list("id", flat=True)[:limit]
    )
    created = 0
    failed = 0
    skipped = 0
    for schedule_id in schedule_ids:
        schedule = RecurringPayrollSchedule.objects.get(pk=schedule_id)
        due_at = schedule.next_run_at
        try:
            execution = execute_schedule(schedule, scheduled_for=due_at)
        except Exception as exc:
            PayrollScheduleExecution.objects.get_or_create(
                schedule=schedule,
                scheduled_for=due_at,
                defaults={
                    "status": PayrollScheduleExecution.Status.FAILED,
                    "message": str(exc)[:1000],
                },
            )
            schedule.active = False
            schedule.save(update_fields=["active", "updated_at"])
            admin = schedule.institution.created_by
            emit_notification(
                notification_type="schedule_execution_failed",
                category="security",
                title="Recurring payroll schedule paused",
                message=f"{schedule.name} could not create its next payroll and was paused for review.",
                dedup_key=f"schedule:{schedule.id}:failed:{due_at.isoformat()}",
                account=admin,
                institution=schedule.institution,
                recipient_wallet=admin.wallet_address,
                recipient_email=schedule.institution.notification_email or admin.email,
                template_name="transaction_failed",
                context={"status": "failed", "error_message": str(exc)[:1000]},
                metadata={"schedule_id": schedule.id, "scheduled_for": due_at},
            )
            failed += 1
            continue
        created += int(execution.status == PayrollScheduleExecution.Status.CREATED)
        skipped += int(execution.status == PayrollScheduleExecution.Status.SKIPPED)
    return {"processed": len(schedule_ids), "created": created, "skipped": skipped, "failed": failed}
