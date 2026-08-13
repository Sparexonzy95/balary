from datetime import datetime, timedelta, timezone as dt_timezone

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Account
from apps.chains.services import ensure_coston2_config
from apps.institutions.models import Institution, InstitutionMember
from apps.payroll.models import PayrollRun

from apps.scheduling.models import PayrollScheduleExecution, RecurringPayrollSchedule
from apps.scheduling.services import execute_schedule, next_occurrence, process_due_schedules


class PayrollScheduleTests(TestCase):
    def setUp(self):
        self.account = Account.objects.create_user(
            "0x0EdBC6F8506e72478CE78a4AE934C7b21cb7050A",
            email="admin@example.com",
        )
        chain, vault, _, _ = ensure_coston2_config()
        self.institution = Institution.objects.create(
            name="Schedule Co",
            notification_email="admin@example.com",
            institution_address=self.account.wallet_address,
            admin_address=self.account.wallet_address,
            treasury_address="0x1111111111111111111111111111111111111111",
            tax_vault_address="0x2222222222222222222222222222222222222222",
            chain=chain,
            vault_address=vault.address,
            registration_status=Institution.RegistrationStatus.ACTIVE,
            is_registered_onchain=True,
            is_active_onchain=True,
            created_by=self.account,
        )
        InstitutionMember.objects.create(
            institution=self.institution,
            account=self.account,
            wallet_address=self.account.wallet_address,
            role=InstitutionMember.Role.ADMIN,
            status=InstitutionMember.Status.ACTIVE,
            approved_onchain=True,
        )

    def build_schedule(self, **overrides):
        payload = {
            "institution": self.institution,
            "name": "Monthly payroll",
            "title_template": "Payroll - {period}",
            "period_label_template": "{month} {year}",
            "frequency": RecurringPayrollSchedule.Frequency.MONTHLY,
            "timezone_name": "Africa/Lagos",
            "next_run_at": timezone.now() - timedelta(minutes=1),
            "created_by": self.account,
        }
        payload.update(overrides)
        return RecurringPayrollSchedule.objects.create(**payload)

    def test_monthly_schedule_preserves_safe_month_end(self):
        current = datetime(2026, 1, 31, 9, 0, tzinfo=dt_timezone.utc)
        result = next_occurrence(current, RecurringPayrollSchedule.Frequency.MONTHLY, "UTC", 31)
        self.assertEqual(result, datetime(2026, 2, 28, 9, 0, tzinfo=dt_timezone.utc))

    def test_due_schedule_creates_fresh_payroll_shell(self):
        schedule = self.build_schedule()
        execution = execute_schedule(schedule)
        schedule.refresh_from_db()
        payroll = execution.payroll_run
        self.assertEqual(execution.status, PayrollScheduleExecution.Status.CREATED)
        self.assertEqual(payroll.status, PayrollRun.Status.DRAFT)
        self.assertEqual(payroll.employee_count, 0)
        self.assertEqual(payroll.ciphertext, "")
        self.assertEqual(schedule.run_count, 1)
        self.assertGreater(schedule.next_run_at, timezone.now())

    def test_due_processor_is_idempotent_for_same_execution_time(self):
        schedule = self.build_schedule()
        scheduled_for = schedule.next_run_at
        first = process_due_schedules()
        self.assertEqual(first["created"], 1)
        self.assertEqual(
            PayrollScheduleExecution.objects.filter(schedule=schedule, scheduled_for=scheduled_for).count(),
            1,
        )
        second = process_due_schedules()
        self.assertEqual(second["created"], 0)

    def test_run_now_does_not_destroy_future_schedule_anchor(self):
        future = timezone.now() + timedelta(days=15)
        schedule = self.build_schedule(next_run_at=future)
        execution = execute_schedule(schedule, force=True, actor=self.account)
        schedule.refresh_from_db()
        self.assertEqual(schedule.next_run_at, future)
        self.assertIsNotNone(execution.payroll_run_id)


class ReminderBucketTests(TestCase):
    def test_reminder_buckets_choose_nearest_threshold(self):
        from apps.scheduling.tasks import _hours_bucket

        self.assertEqual(_hours_bucket(30 * 60), 1)
        self.assertEqual(_hours_bucket(5 * 3600), 6)
        self.assertEqual(_hours_bucket(20 * 3600), 24)
        self.assertIsNone(_hours_bucket(25 * 3600))
        self.assertIsNone(_hours_bucket(-1))
