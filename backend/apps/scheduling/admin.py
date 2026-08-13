from django.contrib import admin

from .models import PayrollScheduleExecution, RecurringPayrollSchedule


@admin.register(RecurringPayrollSchedule)
class RecurringPayrollScheduleAdmin(admin.ModelAdmin):
    list_display = ["name", "institution", "frequency", "next_run_at", "active", "run_count"]
    list_filter = ["frequency", "active", "timezone_name"]
    search_fields = ["name", "institution__name"]


@admin.register(PayrollScheduleExecution)
class PayrollScheduleExecutionAdmin(admin.ModelAdmin):
    list_display = ["schedule", "scheduled_for", "status", "payroll_run", "created_at"]
    list_filter = ["status"]
