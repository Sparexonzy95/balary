from django.urls import path

from .views import EmployeeListCreateView, EmployeeStatusView

urlpatterns = [
    path("", EmployeeListCreateView.as_view(), name="employee-list-create"),
    path("<int:pk>/status/", EmployeeStatusView.as_view(), name="employee-status"),
]
