from django.urls import path

from .views import (
    FccConfigurationView,
    FccInstructionDetailView,
    FccInstructionListView,
    FccInstructionProcessView,
)

urlpatterns = [
    path("configuration/", FccConfigurationView.as_view(), name="fcc-configuration"),
    path("instructions/", FccInstructionListView.as_view(), name="fcc-instruction-list"),
    path("instructions/<int:pk>/", FccInstructionDetailView.as_view(), name="fcc-instruction-detail"),
    path("instructions/<int:pk>/process/", FccInstructionProcessView.as_view(), name="fcc-instruction-process"),
]
