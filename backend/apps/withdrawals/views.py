from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payroll.models import PayrollRun

from .models import WithdrawalRequest
from .serializers import (
    WithdrawalPrepareSerializer,
    WithdrawalRequestSerializer,
    WithdrawalSubmitSerializer,
)
from .services import (
    WithdrawalFlowError,
    accessible_withdrawals,
    eligible_withdrawal_payrolls,
    get_withdrawal_context,
    prepare_withdrawal,
    process_withdrawal,
    submit_withdrawal,
)


class WithdrawalListView(ListAPIView):
    serializer_class = WithdrawalRequestSerializer

    def get_queryset(self):
        return accessible_withdrawals(self.request.user)


class EligibleWithdrawalPayrollListView(APIView):
    def get(self, request):
        open_statuses = [
            WithdrawalRequest.Status.SIGNATURE_PENDING,
            WithdrawalRequest.Status.AUTHORIZED,
            WithdrawalRequest.Status.ENCRYPTED,
            WithdrawalRequest.Status.REQUEST_PENDING,
            WithdrawalRequest.Status.TEE_PENDING,
            WithdrawalRequest.Status.TEE_SUCCESS,
            WithdrawalRequest.Status.FINALIZATION_PENDING,
        ]
        existing = accessible_withdrawals(request.user)
        rows = []
        for payroll in eligible_withdrawal_payrolls(request.user):
            rows.append(
                {
                    "payroll_run_id": payroll.id,
                    "payroll_id": str(payroll.payroll_id),
                    "title": payroll.title,
                    "period_label": payroll.period_label,
                    "institution_name": payroll.institution.name,
                    "status": payroll.status,
                    "minimum_withdrawal_amount": payroll.minimum_withdrawal_amount,
                    "withdrawal_deadline": payroll.withdrawal_deadline,
                    "payroll_processing_tx_hash": payroll.finalization_tx_hash,
                    "has_open_request": existing.filter(
                        payroll_run=payroll,
                        status__in=open_statuses,
                    ).exists(),
                }
            )
        return Response(rows)


class WithdrawalDetailView(RetrieveAPIView):
    serializer_class = WithdrawalRequestSerializer

    def get_queryset(self):
        return accessible_withdrawals(self.request.user)


class WithdrawalContextView(APIView):
    def get(self, request, payroll_pk: int):
        payroll = get_object_or_404(PayrollRun.objects.select_related("institution"), pk=payroll_pk)
        try:
            context = get_withdrawal_context(actor=request.user, payroll=payroll)
        except WithdrawalFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(context)


class WithdrawalPrepareView(APIView):
    def post(self, request):
        serializer = WithdrawalPrepareSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payroll = get_object_or_404(
            PayrollRun.objects.select_related("institution"),
            pk=serializer.validated_data["payroll_id"],
        )
        try:
            withdrawal = prepare_withdrawal(
                actor=request.user,
                payroll=payroll,
            )
        except WithdrawalFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        data = WithdrawalRequestSerializer(withdrawal).data
        data["signing"] = {
            "method": "personal_sign",
            "message_hash": withdrawal.auth_digest,
            "message_encoding": "32-byte hex",
        }
        return Response(data, status=status.HTTP_201_CREATED)


class WithdrawalSubmitView(APIView):
    def post(self, request, pk):
        withdrawal = get_object_or_404(accessible_withdrawals(request.user), pk=pk)
        serializer = WithdrawalSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            withdrawal = submit_withdrawal(
                actor=request.user,
                withdrawal=withdrawal,
                signature=serializer.validated_data["signature"],
            )
        except WithdrawalFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(WithdrawalRequestSerializer(withdrawal).data, status=status.HTTP_202_ACCEPTED)


class WithdrawalProcessView(APIView):
    def post(self, request, pk):
        withdrawal = get_object_or_404(accessible_withdrawals(request.user), pk=pk)
        try:
            withdrawal = process_withdrawal(actor=request.user, withdrawal=withdrawal)
        except WithdrawalFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(WithdrawalRequestSerializer(withdrawal).data)
