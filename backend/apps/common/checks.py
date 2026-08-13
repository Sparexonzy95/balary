from django.conf import settings
from django.core.checks import Error, Tags, Warning, register


@register(Tags.security, deploy=True)
def zalary_deployment_checks(app_configs, **kwargs):
    messages = []
    if settings.DEBUG:
        return messages
    if settings.SECRET_KEY == "unsafe-development-key-change-me" or len(settings.SECRET_KEY) < 32:
        messages.append(Error("DJANGO_SECRET_KEY must be a strong production secret", id="zalary.E001"))
    if not settings.ZALARY_FIELD_ENCRYPTION_KEY:
        messages.append(Error("ZALARY_FIELD_ENCRYPTION_KEY is required in production", id="zalary.E002"))
    if not settings.ALLOWED_HOSTS:
        messages.append(Error("ALLOWED_HOSTS cannot be empty in production", id="zalary.E003"))
    if settings.EMAIL_BACKEND.endswith("console.EmailBackend"):
        messages.append(Warning("Console email backend is not suitable for production", id="zalary.W001"))
    if settings.EMAIL_BACKEND.endswith("smtp.EmailBackend") and not settings.EMAIL_HOST:
        messages.append(Error("EMAIL_HOST is required for the SMTP email backend", id="zalary.E005"))
    if settings.EMAIL_USE_TLS and settings.EMAIL_USE_SSL:
        messages.append(Error("EMAIL_USE_TLS and EMAIL_USE_SSL cannot both be enabled", id="zalary.E004"))
    if "ngrok" in settings.ZALARY_FCC_PROXY_URL.lower():
        messages.append(Warning("Replace the temporary ngrok FCC endpoint before production", id="zalary.W002"))
    if not settings.CSRF_TRUSTED_ORIGINS:
        messages.append(Warning("Configure CSRF_TRUSTED_ORIGINS for the production frontend", id="zalary.W003"))
    if "localhost" in settings.ZALARY_APP_URL or "127.0.0.1" in settings.ZALARY_APP_URL:
        messages.append(Warning("ZALARY_APP_URL still points to a local development address", id="zalary.W004"))
    if any("localhost" in origin or "127.0.0.1" in origin for origin in settings.CORS_ALLOWED_ORIGINS):
        messages.append(Warning("CORS_ALLOWED_ORIGINS still includes local development origins", id="zalary.W005"))
    return messages
