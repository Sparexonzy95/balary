from django.urls import path

from .views import (
    PayrollConfirmComputationView,
    PayrollConfirmDraftView,
    PayrollDetailView,
    PayrollEncryptView,
    PayrollListCreateView,
    PayrollPrepareComputationView,
    PayrollPrepareDraftView,
    PayrollFundingContextView,
    PayrollPrepareOpenFundingView,
    PayrollConfirmOpenFundingView,
    PayrollPrepareFundingApprovalView,
    PayrollConfirmFundingApprovalView,
    PayrollPrepareFundingView,
    PayrollConfirmFundingView,
    PayrollValidateView,
)

urlpatterns = [
    path("", PayrollListCreateView.as_view(), name="payroll-list-create"),
    path("<int:pk>/", PayrollDetailView.as_view(), name="payroll-detail"),
    path("<int:pk>/validate/", PayrollValidateView.as_view(), name="payroll-validate"),
    path("<int:pk>/encrypt/", PayrollEncryptView.as_view(), name="payroll-encrypt"),
    path("<int:pk>/draft/prepare/", PayrollPrepareDraftView.as_view(), name="payroll-draft-prepare"),
    path("<int:pk>/draft/confirm/", PayrollConfirmDraftView.as_view(), name="payroll-draft-confirm"),
    path("<int:pk>/computation/prepare/", PayrollPrepareComputationView.as_view(), name="payroll-computation-prepare"),
    path("<int:pk>/computation/confirm/", PayrollConfirmComputationView.as_view(), name="payroll-computation-confirm"),
    path("<int:pk>/funding/context/", PayrollFundingContextView.as_view(), name="payroll-funding-context"),
    path("<int:pk>/funding/open/prepare/", PayrollPrepareOpenFundingView.as_view(), name="payroll-open-funding-prepare"),
    path("<int:pk>/funding/open/confirm/", PayrollConfirmOpenFundingView.as_view(), name="payroll-open-funding-confirm"),
    path("<int:pk>/funding/approval/prepare/", PayrollPrepareFundingApprovalView.as_view(), name="payroll-funding-approval-prepare"),
    path("<int:pk>/funding/approval/confirm/", PayrollConfirmFundingApprovalView.as_view(), name="payroll-funding-approval-confirm"),
    path("<int:pk>/funding/fund/prepare/", PayrollPrepareFundingView.as_view(), name="payroll-fund-prepare"),
    path("<int:pk>/funding/fund/confirm/", PayrollConfirmFundingView.as_view(), name="payroll-fund-confirm"),
]
