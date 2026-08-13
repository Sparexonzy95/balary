from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import ListCreateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.institutions.models import Institution
from apps.institutions.services import accessible_institutions

from .models import InstitutionEmployee
from .serializers import EmployeeCreateSerializer, EmployeeSerializer, EmployeeStatusSerializer
from .services import EmployeeFlowError, accessible_employees, create_employee, update_employee_status


class EmployeeListCreateView(ListCreateAPIView):
    def get_queryset(self):
        queryset = accessible_employees(self.request.user)
        institution_id = self.request.query_params.get("institution_id")
        if institution_id:
            queryset = queryset.filter(institution_id=institution_id)
        return queryset

    def get_serializer_class(self):
        return EmployeeCreateSerializer if self.request.method == "POST" else EmployeeSerializer

    def create(self, request, *args, **kwargs):
        serializer = EmployeeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        institution = get_object_or_404(
            accessible_institutions(request.user),
            id=serializer.validated_data.pop("institution_id"),
        )
        try:
            employee = create_employee(
                actor=request.user,
                institution=institution,
                **serializer.validated_data,
            )
        except EmployeeFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(EmployeeSerializer(employee).data, status=status.HTTP_201_CREATED)


class EmployeeStatusView(APIView):
    def patch(self, request, pk: int):
        employee = get_object_or_404(accessible_employees(request.user), pk=pk)
        serializer = EmployeeStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            employee = update_employee_status(
                actor=request.user,
                employee=employee,
                status=serializer.validated_data["status"],
            )
        except EmployeeFlowError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(EmployeeSerializer(employee).data)
