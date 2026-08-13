from django.urls import path

from .views import (
    ConfirmRegistrationView,
    ConfirmRoleChangeView,
    InstitutionDetailView,
    InstitutionListCreateView,
    PrepareRegistrationView,
    PrepareRoleChangeView,
)

urlpatterns = [
    path("", InstitutionListCreateView.as_view(), name="institution-list-create"),
    path("<int:pk>/", InstitutionDetailView.as_view(), name="institution-detail"),
    path("<int:pk>/registration/prepare/", PrepareRegistrationView.as_view(), name="institution-register-prepare"),
    path("<int:pk>/registration/confirm/", ConfirmRegistrationView.as_view(), name="institution-register-confirm"),
    path("<int:pk>/roles/<str:role>/prepare/", PrepareRoleChangeView.as_view(), name="institution-role-prepare"),
    path("<int:pk>/roles/confirm/", ConfirmRoleChangeView.as_view(), name="institution-role-confirm"),
]
