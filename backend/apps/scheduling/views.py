from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import RecurringPayrollSchedule
from .serializers import RecurringPayrollScheduleSerializer
from apps.common.permissions import InstitutionPermissionError, require_active_role
from apps.institutions.models import InstitutionMember

from .services import ScheduleFlowError, accessible_schedules, execute_schedule, require_schedule_manager


class ScheduleListCreateView(APIView):
    def get(self, request):
        queryset = accessible_schedules(request.user)
        active = request.query_params.get("active")
        if active in {"1", "true", "yes"}:
            queryset = queryset.filter(active=True)
        elif active in {"0", "false", "no"}:
            queryset = queryset.filter(active=False)
        return Response(RecurringPayrollScheduleSerializer(queryset, many=True).data)

    def post(self, request):
        serializer = RecurringPayrollScheduleSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        institution = serializer.validated_data["institution"]
        try:
            require_active_role(
                institution,
                request.user.wallet_address,
                [InstitutionMember.Role.ADMIN, InstitutionMember.Role.HR],
            )
        except InstitutionPermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        schedule = serializer.save()
        return Response(RecurringPayrollScheduleSerializer(schedule).data, status=status.HTTP_201_CREATED)


class ScheduleDetailView(APIView):
    def get_object(self, request, pk):
        return get_object_or_404(accessible_schedules(request.user), pk=pk)

    def get(self, request, pk: int):
        return Response(RecurringPayrollScheduleSerializer(self.get_object(request, pk)).data)

    def patch(self, request, pk: int):
        schedule = self.get_object(request, pk)
        try:
            require_schedule_manager(schedule, request.user)
        except ScheduleFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        serializer = RecurringPayrollScheduleSerializer(
            schedule,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk: int):
        schedule = self.get_object(request, pk)
        try:
            require_schedule_manager(schedule, request.user)
        except ScheduleFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        schedule.active = False
        schedule.save(update_fields=["active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ScheduleRunNowView(APIView):
    def post(self, request, pk: int):
        schedule = get_object_or_404(accessible_schedules(request.user), pk=pk)
        try:
            execution = execute_schedule(schedule, force=True, actor=request.user)
        except ScheduleFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        schedule.refresh_from_db()
        return Response(
            {
                "schedule": RecurringPayrollScheduleSerializer(schedule).data,
                "execution_id": execution.id,
                "payroll_run_id": execution.payroll_run_id,
                "status": execution.status,
            },
            status=status.HTTP_201_CREATED,
        )


class SchedulePauseView(APIView):
    def post(self, request, pk: int):
        schedule = get_object_or_404(accessible_schedules(request.user), pk=pk)
        try:
            require_schedule_manager(schedule, request.user)
        except ScheduleFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        schedule.active = False
        schedule.save(update_fields=["active", "updated_at"])
        return Response(RecurringPayrollScheduleSerializer(schedule).data)


class ScheduleResumeView(APIView):
    def post(self, request, pk: int):
        schedule = get_object_or_404(accessible_schedules(request.user), pk=pk)
        try:
            require_schedule_manager(schedule, request.user)
        except ScheduleFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        schedule.active = True
        schedule.save(update_fields=["active", "updated_at"])
        return Response(RecurringPayrollScheduleSerializer(schedule).data)
