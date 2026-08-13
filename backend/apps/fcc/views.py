from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import has_active_role
from apps.institutions.models import InstitutionMember
from apps.payroll.services import accessible_payrolls

from .models import FccInstruction
from .serializers import FccInstructionSerializer
from .services import FccFlowError, process_instruction


class FccConfigurationView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "proxy_url": settings.ZALARY_FCC_PROXY_URL,
                "tee_id": settings.ZALARY_TEE_ID,
                "tee_signer_epoch": settings.ZALARY_TEE_SIGNER_EPOCH,
                "encryptor_configured": bool(settings.ZALARY_ENCRYPTOR_COMMAND.strip()),
                "relayer_configured": bool(settings.ZALARY_RELAYER_PRIVATE_KEY.strip()),
                "request_fee_wei": str(settings.ZALARY_FCC_FEE_WEI),
            }
        )


class FccInstructionListView(ListAPIView):
    serializer_class = FccInstructionSerializer

    def get_queryset(self):
        payroll_ids = accessible_payrolls(self.request.user).values_list("id", flat=True)
        return FccInstruction.objects.select_related("payroll_run").filter(payroll_run_id__in=payroll_ids)


class FccInstructionDetailView(RetrieveAPIView):
    serializer_class = FccInstructionSerializer

    def get_queryset(self):
        payroll_ids = accessible_payrolls(self.request.user).values_list("id", flat=True)
        return FccInstruction.objects.select_related("payroll_run").filter(payroll_run_id__in=payroll_ids)


class FccInstructionProcessView(APIView):
    def post(self, request, pk: int):
        payroll_ids = accessible_payrolls(request.user).values_list("id", flat=True)
        instruction = get_object_or_404(
            FccInstruction.objects.select_related("payroll_run", "payroll_run__institution"),
            pk=pk,
            payroll_run_id__in=payroll_ids,
        )
        institution = instruction.payroll_run.institution
        if not has_active_role(
            institution,
            request.user.wallet_address,
            [InstitutionMember.Role.HR, InstitutionMember.Role.ADMIN],
        ):
            return Response({"detail": "Only institution HR or Admin may process FCC instructions"}, status=status.HTTP_403_FORBIDDEN)
        try:
            instruction = process_instruction(instruction)
        except FccFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(FccInstructionSerializer(instruction).data)
