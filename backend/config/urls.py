from django.contrib import admin
from django.urls import include, path

from apps.common.views import HealthView, ReadinessView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", HealthView.as_view(), name="health"),
    path("api/v1/health/ready/", ReadinessView.as_view(), name="readiness"),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/chains/", include("apps.chains.urls")),
    path("api/v1/institutions/", include("apps.institutions.urls")),
    path("api/v1/transactions/", include("apps.transactions.urls")),
    path("api/v1/employees/", include("apps.employees.urls")),
    path("api/v1/fcc/", include("apps.fcc.urls")),
    path("api/v1/payrolls/", include("apps.payroll.urls")),
    path("api/v1/withdrawals/", include("apps.withdrawals.urls")),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/schedules/", include("apps.scheduling.urls")),
    path("api/v1/audit/", include("apps.audit.urls")),
]
