from django.conf import settings
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"service": "zalary-backend", "status": "ok", "milestone": 5})


class ReadinessView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        checks = {}
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            checks["database"] = "ok"
        except Exception as exc:
            checks["database"] = f"error:{exc.__class__.__name__}"

        checks["field_encryption"] = "ok" if (settings.ZALARY_FIELD_ENCRYPTION_KEY or settings.DEBUG) else "missing"
        if settings.CELERY_TASK_ALWAYS_EAGER:
            checks["redis"] = "not-required-eager-mode"
        else:
            try:
                import redis
                redis.Redis.from_url(settings.CELERY_BROKER_URL, socket_connect_timeout=1, socket_timeout=1).ping()
                checks["redis"] = "ok"
            except Exception as exc:
                checks["redis"] = f"error:{exc.__class__.__name__}"
        checks["fcc_endpoint"] = "configured" if settings.ZALARY_FCC_PROXY_URL else "missing"
        checks["email_backend"] = settings.EMAIL_BACKEND
        checks["celery_mode"] = "eager" if settings.CELERY_TASK_ALWAYS_EAGER else "worker"
        ready = (
            checks["database"] == "ok"
            and checks["field_encryption"] == "ok"
            and checks["fcc_endpoint"] == "configured"
            and checks["redis"] in {"ok", "not-required-eager-mode"}
        )
        return Response({"service": "zalary-backend", "ready": ready, "checks": checks}, status=200 if ready else 503)
