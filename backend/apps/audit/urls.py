from django.urls import path

from .views import AuditEventCsvView, AuditEventListView, PayrollAuditCsvView, PayrollAuditReportView

urlpatterns = [
    path("events/", AuditEventListView.as_view(), name="audit-events"),
    path("events.csv", AuditEventCsvView.as_view(), name="audit-events-csv"),
    path("payrolls/<int:pk>/", PayrollAuditReportView.as_view(), name="payroll-audit-report"),
    path("payrolls/<int:pk>.csv", PayrollAuditCsvView.as_view(), name="payroll-audit-csv"),
]
