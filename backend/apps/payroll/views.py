from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.institutions.services import accessible_institutions
from apps.transactions.serializers import ChainTransactionSerializer, PreparedTransactionSerializer

from .serializers import (
    PayrollCreateSerializer,
    PayrollFileSerializer,
    PayrollRunSerializer,
    PreparedTransactionSubmitSerializer,
)
from .services import (
    PayrollFlowError,
    accessible_payrolls,
    confirm_computation_request,
    confirm_payroll_draft,
    confirm_open_funding,
    confirm_funding_approval,
    confirm_funding,
    create_payroll,
    encrypt_upload,
    prepare_computation_request,
    prepare_payroll_draft,
    prepare_open_funding,
    prepare_funding_approval,
    prepare_funding,
    get_funding_context,
    validate_upload,
)


class PayrollListCreateView(ListCreateAPIView):
    def get_queryset(self):
        queryset = accessible_payrolls(self.request.user).prefetch_related("import_batches")
        institution_id = self.request.query_params.get("institution_id")
        if institution_id:
            queryset = queryset.filter(institution_id=institution_id)
        return queryset

    def get_serializer_class(self):
        return PayrollCreateSerializer if self.request.method == "POST" else PayrollRunSerializer

    def create(self, request, *args, **kwargs):
        serializer = PayrollCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        institution = get_object_or_404(
            accessible_institutions(request.user),
            id=serializer.validated_data.pop("institution_id"),
        )
        try:
            payroll = create_payroll(actor=request.user, institution=institution, **serializer.validated_data)
        except PayrollFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PayrollRunSerializer(payroll).data, status=status.HTTP_201_CREATED)


class PayrollDetailView(RetrieveAPIView):
    serializer_class = PayrollRunSerializer

    def get_queryset(self):
        return accessible_payrolls(self.request.user).prefetch_related("import_batches")


class _PayrollFileBase(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def get_payroll_and_file(self, request, pk):
        payroll = get_object_or_404(accessible_payrolls(request.user), pk=pk)
        serializer = PayrollFileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded = serializer.validated_data["file"]
        if uploaded.size > settings.ZALARY_PAYROLL_UPLOAD_MAX_BYTES:
            raise PayrollFlowError("Payroll CSV exceeds the configured upload limit")
        raw = uploaded.read(settings.ZALARY_PAYROLL_UPLOAD_MAX_BYTES + 1)
        return payroll, uploaded, raw

    def error_response(self, exc: PayrollFlowError):
        payload = {"detail": str(exc)}
        if exc.errors:
            payload["errors"] = exc.errors
        return Response(payload, status=status.HTTP_400_BAD_REQUEST)


class PayrollValidateView(_PayrollFileBase):
    def post(self, request, pk: int):
        try:
            payroll, uploaded, raw = self.get_payroll_and_file(request, pk)
            validate_upload(actor=request.user, payroll=payroll, raw=raw, filename=uploaded.name)
        except PayrollFlowError as exc:
            return self.error_response(exc)
        payroll.refresh_from_db()
        return Response(PayrollRunSerializer(payroll).data)


class PayrollEncryptView(_PayrollFileBase):
    def post(self, request, pk: int):
        try:
            payroll, uploaded, raw = self.get_payroll_and_file(request, pk)
            encrypt_upload(actor=request.user, payroll=payroll, raw=raw, filename=uploaded.name)
        except PayrollFlowError as exc:
            return self.error_response(exc)
        payroll.refresh_from_db()
        return Response(PayrollRunSerializer(payroll).data)


class PayrollPrepareDraftView(APIView):
    def post(self, request, pk: int):
        payroll = get_object_or_404(accessible_payrolls(request.user), pk=pk)
        try:
            prepared = prepare_payroll_draft(
                actor=request.user,
                payroll=payroll,
                idempotency_key=request.headers.get("Idempotency-Key"),
            )
        except PayrollFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"prepared_transaction": PreparedTransactionSerializer(prepared).data})


class PayrollConfirmDraftView(APIView):
    def post(self, request, pk: int):
        payroll = get_object_or_404(accessible_payrolls(request.user), pk=pk)
        serializer = PreparedTransactionSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            chain_tx = confirm_payroll_draft(
                actor=request.user,
                payroll=payroll,
                **serializer.validated_data,
            )
        except PayrollFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ChainTransactionSerializer(chain_tx).data, status=status.HTTP_202_ACCEPTED)


class PayrollPrepareComputationView(APIView):
    def post(self, request, pk: int):
        payroll = get_object_or_404(accessible_payrolls(request.user), pk=pk)
        try:
            prepared = prepare_computation_request(
                actor=request.user,
                payroll=payroll,
                idempotency_key=request.headers.get("Idempotency-Key"),
            )
        except PayrollFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"prepared_transaction": PreparedTransactionSerializer(prepared).data})


class PayrollConfirmComputationView(APIView):
    def post(self, request, pk: int):
        payroll = get_object_or_404(accessible_payrolls(request.user), pk=pk)
        serializer = PreparedTransactionSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            chain_tx = confirm_computation_request(
                actor=request.user,
                payroll=payroll,
                **serializer.validated_data,
            )
        except PayrollFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ChainTransactionSerializer(chain_tx).data, status=status.HTTP_202_ACCEPTED)


class PayrollFundingContextView(APIView):
    def get(self, request, pk: int):
        payroll = get_object_or_404(accessible_payrolls(request.user), pk=pk)
        try:
            context = get_funding_context(actor=request.user, payroll=payroll)
        except PayrollFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(context)


class PayrollPrepareOpenFundingView(APIView):
    def post(self, request, pk: int):
        payroll = get_object_or_404(accessible_payrolls(request.user), pk=pk)
        try:
            prepared = prepare_open_funding(
                actor=request.user,
                payroll=payroll,
                idempotency_key=request.headers.get("Idempotency-Key"),
            )
        except PayrollFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"prepared_transaction": PreparedTransactionSerializer(prepared).data})


class PayrollConfirmOpenFundingView(APIView):
    def post(self, request, pk: int):
        payroll = get_object_or_404(accessible_payrolls(request.user), pk=pk)
        serializer = PreparedTransactionSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            chain_tx = confirm_open_funding(
                actor=request.user, payroll=payroll, **serializer.validated_data
            )
        except PayrollFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ChainTransactionSerializer(chain_tx).data, status=status.HTTP_202_ACCEPTED)


class PayrollPrepareFundingApprovalView(APIView):
    def post(self, request, pk: int):
        payroll = get_object_or_404(accessible_payrolls(request.user), pk=pk)
        try:
            prepared = prepare_funding_approval(
                actor=request.user,
                payroll=payroll,
                idempotency_key=request.headers.get("Idempotency-Key"),
            )
        except PayrollFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"prepared_transaction": PreparedTransactionSerializer(prepared).data})


class PayrollConfirmFundingApprovalView(APIView):
    def post(self, request, pk: int):
        payroll = get_object_or_404(accessible_payrolls(request.user), pk=pk)
        serializer = PreparedTransactionSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            chain_tx = confirm_funding_approval(
                actor=request.user, payroll=payroll, **serializer.validated_data
            )
        except PayrollFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ChainTransactionSerializer(chain_tx).data, status=status.HTTP_202_ACCEPTED)


class PayrollPrepareFundingView(APIView):
    def post(self, request, pk: int):
        payroll = get_object_or_404(accessible_payrolls(request.user), pk=pk)
        try:
            prepared = prepare_funding(
                actor=request.user,
                payroll=payroll,
                idempotency_key=request.headers.get("Idempotency-Key"),
            )
        except PayrollFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"prepared_transaction": PreparedTransactionSerializer(prepared).data})


class PayrollConfirmFundingView(APIView):
    def post(self, request, pk: int):
        payroll = get_object_or_404(accessible_payrolls(request.user), pk=pk)
        serializer = PreparedTransactionSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            chain_tx = confirm_funding(
                actor=request.user, payroll=payroll, **serializer.validated_data
            )
        except PayrollFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ChainTransactionSerializer(chain_tx).data, status=status.HTTP_202_ACCEPTED)
