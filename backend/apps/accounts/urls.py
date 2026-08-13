from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import MeView, NonceView, VerifyView

urlpatterns = [
    path("nonce/", NonceView.as_view(), name="auth-nonce"),
    path("verify/", VerifyView.as_view(), name="auth-verify"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),
]
