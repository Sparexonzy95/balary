from django.urls import path

from .views import (
    EmailDeliveryListView,
    EmailDeliveryRetryView,
    NotificationListView,
    NotificationUnreadCountView,
    NotificationPreferenceView,
    NotificationReadAllView,
    NotificationReadView,
    ResendWebhookView,
)

urlpatterns = [
    path("", NotificationListView.as_view(), name="notification-list"),
    path("unread-count/", NotificationUnreadCountView.as_view(), name="notification-unread-count"),
    path("<int:pk>/read/", NotificationReadView.as_view(), name="notification-read"),
    path("read-all/", NotificationReadAllView.as_view(), name="notification-read-all"),
    path("preferences/", NotificationPreferenceView.as_view(), name="notification-preferences"),
    path("email-deliveries/", EmailDeliveryListView.as_view(), name="email-deliveries"),
    path("email-deliveries/<int:pk>/retry/", EmailDeliveryRetryView.as_view(), name="email-delivery-retry"),
    path("provider-webhooks/resend/", ResendWebhookView.as_view(), name="resend-email-webhook"),
]
