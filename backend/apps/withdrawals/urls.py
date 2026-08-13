from django.urls import path

from .views import (
    EligibleWithdrawalPayrollListView,
    WithdrawalContextView,
    WithdrawalDetailView,
    WithdrawalListView,
    WithdrawalPrepareView,
    WithdrawalProcessView,
    WithdrawalSubmitView,
)

urlpatterns = [
    path("", WithdrawalListView.as_view(), name="withdrawal-list"),
    path("available/", EligibleWithdrawalPayrollListView.as_view(), name="withdrawal-available"),
    path("prepare/", WithdrawalPrepareView.as_view(), name="withdrawal-prepare"),
    path("context/<int:payroll_pk>/", WithdrawalContextView.as_view(), name="withdrawal-context"),
    path("<uuid:pk>/", WithdrawalDetailView.as_view(), name="withdrawal-detail"),
    path("<uuid:pk>/submit/", WithdrawalSubmitView.as_view(), name="withdrawal-submit"),
    path("<uuid:pk>/process/", WithdrawalProcessView.as_view(), name="withdrawal-process"),
]
