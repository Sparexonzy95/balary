from django.urls import path

from .views import (
    ScheduleDetailView,
    ScheduleListCreateView,
    SchedulePauseView,
    ScheduleResumeView,
    ScheduleRunNowView,
)

urlpatterns = [
    path("", ScheduleListCreateView.as_view(), name="schedule-list-create"),
    path("<int:pk>/", ScheduleDetailView.as_view(), name="schedule-detail"),
    path("<int:pk>/run-now/", ScheduleRunNowView.as_view(), name="schedule-run-now"),
    path("<int:pk>/pause/", SchedulePauseView.as_view(), name="schedule-pause"),
    path("<int:pk>/resume/", ScheduleResumeView.as_view(), name="schedule-resume"),
]
