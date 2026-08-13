from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.transactions.models import ChainTransaction
from apps.transactions.serializers import ChainTransactionSerializer, PreparedTransactionSerializer

from .models import Institution, InstitutionMember
from .serializers import (
    InstitutionCreateSerializer,
    InstitutionSerializer,
    RolePrepareSerializer,
    SubmitPreparedTransactionSerializer,
)
from .services import (
    InstitutionFlowError,
    accessible_institutions,
    confirm_registration,
    confirm_role_change,
    create_local_institution,
    prepare_registration,
    prepare_role_change,
)


class InstitutionListCreateView(ListCreateAPIView):
    def get_queryset(self):
        return accessible_institutions(self.request.user)

    def get_serializer_class(self):
        return InstitutionCreateSerializer if self.request.method == "POST" else InstitutionSerializer

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "request": self.request}

    def create(self, request, *args, **kwargs):
        serializer = InstitutionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            institution = create_local_institution(
                account=request.user,
                **serializer.validated_data,
            )
        except InstitutionFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            InstitutionSerializer(institution, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class InstitutionDetailView(RetrieveAPIView):
    serializer_class = InstitutionSerializer

    def get_queryset(self):
        return accessible_institutions(self.request.user)


class PrepareRegistrationView(APIView):
    def post(self, request, pk: int):
        institution = get_object_or_404(accessible_institutions(request.user), pk=pk)
        try:
            prepared = prepare_registration(
                institution=institution,
                actor=request.user,
                idempotency_key=request.headers.get("Idempotency-Key"),
            )
        except InstitutionFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"prepared_transaction": PreparedTransactionSerializer(prepared).data})


class ConfirmRegistrationView(APIView):
    def post(self, request, pk: int):
        institution = get_object_or_404(accessible_institutions(request.user), pk=pk)
        serializer = SubmitPreparedTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            chain_tx = confirm_registration(
                institution=institution,
                actor=request.user,
                **serializer.validated_data,
            )
        except InstitutionFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ChainTransactionSerializer(chain_tx).data, status=status.HTTP_202_ACCEPTED)


class PrepareRoleChangeView(APIView):
    def post(self, request, pk: int, role: str):
        institution = get_object_or_404(accessible_institutions(request.user), pk=pk)
        if role not in InstitutionMember.Role.values:
            return Response({"detail": "Unsupported role"}, status=status.HTTP_400_BAD_REQUEST)
        serializer = RolePrepareSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            member, prepared = prepare_role_change(
                institution=institution,
                actor=request.user,
                role=role,
                idempotency_key=request.headers.get("Idempotency-Key"),
                **serializer.validated_data,
            )
        except InstitutionFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "member_id": member.id,
                "prepared_transaction": PreparedTransactionSerializer(prepared).data,
            }
        )


class ConfirmRoleChangeView(APIView):
    def post(self, request, pk: int):
        institution = get_object_or_404(accessible_institutions(request.user), pk=pk)
        serializer = SubmitPreparedTransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            chain_tx = confirm_role_change(
                institution=institution,
                actor=request.user,
                **serializer.validated_data,
            )
        except InstitutionFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ChainTransactionSerializer(chain_tx).data, status=status.HTTP_202_ACCEPTED)
