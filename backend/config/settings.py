from __future__ import annotations

import os
import sys
from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
RUNNING_TESTS = any("pytest" in arg or arg == "test" for arg in sys.argv)


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_csv(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]

DEBUG = env_bool("DEBUG", True)
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "unsafe-development-key-change-me")
ALLOWED_HOSTS = env_csv("ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "apps.common.apps.CommonConfig",
    "apps.accounts",
    "apps.chains",
    "apps.institutions",
    "apps.transactions",
    "apps.employees",
    "apps.fcc",
    "apps.payroll",
    "apps.withdrawals",
    "apps.notifications.apps.NotificationsConfig",
    "apps.scheduling.apps.SchedulingConfig",
    "apps.audit.apps.AuditConfig",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "apps.common.middleware.RequestIdMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DEFAULT_DATABASE_URL = f"sqlite:///{BASE_DIR / 'db.sqlite3'}"
DATABASES = {
    "default": dj_database_url.parse(
        os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL),
        conn_max_age=600,
    )
}
if RUNNING_TESTS:
    DATABASES["default"] = dj_database_url.parse(DEFAULT_DATABASE_URL)

AUTH_USER_MODEL = "accounts.Account"
AUTH_PASSWORD_VALIDATORS: list[dict] = []
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv("DRF_ANON_THROTTLE", "30/min"),
        "user": os.getenv("DRF_USER_THROTTLE", "300/min"),
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.getenv("JWT_ACCESS_LIFETIME_MINUTES", "30"))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.getenv("JWT_REFRESH_LIFETIME_DAYS", "7"))
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
}

LOCAL_FRONTEND_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
CORS_ALLOWED_ORIGINS = env_csv("CORS_ALLOWED_ORIGINS") or LOCAL_FRONTEND_ORIGINS
CSRF_TRUSTED_ORIGINS = env_csv("CSRF_TRUSTED_ORIGINS") or LOCAL_FRONTEND_ORIGINS
CORS_ALLOW_HEADERS = (*default_headers, "idempotency-key")

CELERY_BROKER_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", DEBUG)

# Wallet authentication domain binding.
ZALARY_AUTH_DOMAIN = os.getenv("ZALARY_AUTH_DOMAIN", "localhost:5173")
ZALARY_AUTH_URI = os.getenv("ZALARY_AUTH_URI", "http://localhost:5173")
ZALARY_AUTH_NONCE_TTL_MINUTES = int(os.getenv("ZALARY_AUTH_NONCE_TTL_MINUTES", "10"))

# Coston2 deployment proven live on 2026-07-30.
COSTON2_CHAIN_ID = int(os.getenv("COSTON2_CHAIN_ID", "114"))
COSTON2_RPC_URL = os.getenv(
    "COSTON2_RPC_URL", "https://coston2-api.flare.network/ext/C/rpc"
)
COSTON2_EXPLORER_URL = os.getenv(
    "COSTON2_EXPLORER_URL", "https://coston2-explorer.flare.network"
)
ZALARY_VAULT_ADDRESS = os.getenv(
    "ZALARY_VAULT_ADDRESS", "0xA5277D55a46514740b0C716C691d92b8D9E64e5E"
)
ZALARY_GATEWAY_ADDRESS = os.getenv(
    "ZALARY_GATEWAY_ADDRESS", "0xFE9A84346A614599C9A0b5a1F444bd816a6C100A"
)
ZALARY_STABLECOIN_ADDRESS = os.getenv(
    "ZALARY_STABLECOIN_ADDRESS", "0xC1A5B41512496B80903D1f32d6dEa3a73212E71F"
)
ZALARY_STABLECOIN_SYMBOL = os.getenv("ZALARY_STABLECOIN_SYMBOL", "USDâ‚®0")
ZALARY_STABLECOIN_DECIMALS = int(os.getenv("ZALARY_STABLECOIN_DECIMALS", "6"))
ZALARY_GATEWAY_ADDRESS = os.getenv(
    "ZALARY_GATEWAY_ADDRESS",
    "0xFE9A84346A614599C9A0b5a1F444bd816a6C100A",
)
ZALARY_CHAIN_RPC_URL = os.getenv(
    "ZALARY_CHAIN_RPC_URL",
    "https://coston2-api.flare.network/ext/C/rpc",
)
ZALARY_TEE_AUTH_MODE = os.getenv(
    "ZALARY_TEE_AUTH_MODE",
    "onchain",
)

# Static values are retained only for tests and emergency fallback.
ZALARY_TEE_ID = os.getenv(
    "ZALARY_TEE_ID",
    "0x7748CB088399CB4223375298F7404394A1680D2D",
)
ZALARY_TEE_SIGNER_EPOCH = int(
    os.getenv("ZALARY_TEE_SIGNER_EPOCH", "1")
)
ZALARY_FCC_PROXY_URL = os.getenv(
    "ZALARY_FCC_PROXY_URL", "http://127.0.0.1:6674"
)
CHAIN_MIN_CONFIRMATIONS = int(os.getenv("CHAIN_MIN_CONFIRMATIONS", "1"))
CHAIN_RECEIPT_BATCH_SIZE = int(os.getenv("CHAIN_RECEIPT_BATCH_SIZE", "100"))

# Milestone 2 privacy and encryption settings.
ZALARY_FIELD_ENCRYPTION_KEY = os.getenv("ZALARY_FIELD_ENCRYPTION_KEY", "")
ZALARY_ENCRYPTOR_COMMAND = os.getenv("ZALARY_ENCRYPTOR_COMMAND", "")
ZALARY_ENCRYPTOR_TIMEOUT_SECONDS = int(os.getenv("ZALARY_ENCRYPTOR_TIMEOUT_SECONDS", "30"))
ZALARY_PAYROLL_UPLOAD_MAX_BYTES = int(os.getenv("ZALARY_PAYROLL_UPLOAD_MAX_BYTES", str(2 * 1024 * 1024)))
ZALARY_PAYROLL_MAX_ROWS = int(os.getenv("ZALARY_PAYROLL_MAX_ROWS", "10000"))

# Milestone 3 on-chain payroll and FCC orchestration.
ZALARY_FCC_FEE_WEI = int(os.getenv("ZALARY_FCC_FEE_WEI", "1000000"))
ZALARY_FCC_HTTP_TIMEOUT_SECONDS = int(os.getenv("ZALARY_FCC_HTTP_TIMEOUT_SECONDS", "15"))
ZALARY_FCC_POLL_BATCH_SIZE = int(os.getenv("ZALARY_FCC_POLL_BATCH_SIZE", "25"))
ZALARY_RELAYER_PRIVATE_KEY = os.getenv("ZALARY_RELAYER_PRIVATE_KEY", "")
ZALARY_RELAYER_RECEIPT_TIMEOUT_SECONDS = int(os.getenv("ZALARY_RELAYER_RECEIPT_TIMEOUT_SECONDS", "120"))
ZALARY_FCC_REQUEST_TTL_SECONDS = int(os.getenv("ZALARY_FCC_REQUEST_TTL_SECONDS", "900"))

# Milestone 4 funding and withdrawal orchestration.
ZALARY_WITHDRAWAL_AUTH_TTL_SECONDS = int(os.getenv("ZALARY_WITHDRAWAL_AUTH_TTL_SECONDS", "600"))


# Milestone 5 operational product layer.
ZALARY_APP_URL = os.getenv("ZALARY_APP_URL", "http://localhost:5173")
ZALARY_NOTIFICATIONS_INLINE = env_bool("ZALARY_NOTIFICATIONS_INLINE", DEBUG)
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend" if DEBUG else "django.core.mail.backends.smtp.EmailBackend",
)
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "Zalary <no-reply@zalary.local>")
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
if EMAIL_USE_SSL:
    EMAIL_USE_TLS = False
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "20"))
ZALARY_EMAIL_PROVIDER = os.getenv("ZALARY_EMAIL_PROVIDER", "smtp").strip().lower()
ZALARY_EMAIL_REPLY_TO = os.getenv(
    "ZALARY_EMAIL_REPLY_TO", EMAIL_HOST_USER or DEFAULT_FROM_EMAIL
).strip()
ZALARY_EMAIL_MESSAGE_ID_DOMAIN = os.getenv(
    "ZALARY_EMAIL_MESSAGE_ID_DOMAIN", "zalary.local"
).strip()
ZALARY_RESEND_API_KEY = os.getenv("ZALARY_RESEND_API_KEY", "")
ZALARY_RESEND_WEBHOOK_SECRET = os.getenv("ZALARY_RESEND_WEBHOOK_SECRET", "")
ZALARY_EMAIL_WEBHOOK_TOLERANCE_SECONDS = int(
    os.getenv("ZALARY_EMAIL_WEBHOOK_TOLERANCE_SECONDS", "300")
)

CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_SOFT_TIME_LIMIT = int(os.getenv("CELERY_TASK_SOFT_TIME_LIMIT", "240"))
CELERY_TASK_TIME_LIMIT = int(os.getenv("CELERY_TASK_TIME_LIMIT", "300"))
CELERY_BEAT_SCHEDULE = {
    "sync-pending-chain-transactions": {
        "task": "apps.transactions.tasks.sync_pending_chain_transactions",
        "schedule": 30.0,
    },
    "process-pending-fcc-instructions": {
        "task": "apps.fcc.tasks.process_pending_fcc_instructions",
        "schedule": 15.0,
    },
    "process-due-payroll-schedules": {
        "task": "apps.scheduling.tasks.process_due_payroll_schedules",
        "schedule": 60.0,
    },
    "send-payroll-deadline-reminders": {
        "task": "apps.scheduling.tasks.send_payroll_deadline_reminders",
        "schedule": 900.0,
    },
    "expire-unsigned-withdrawal-authorizations": {
        "task": "apps.scheduling.tasks.expire_unsigned_withdrawal_authorizations",
        "schedule": 60.0,
    },
    "retry-failed-email-deliveries": {
        "task": "apps.notifications.tasks.retry_failed_email_deliveries",
        "schedule": 60.0,
    },
}

# Production hardening. These remain disabled in local DEBUG mode.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = False if RUNNING_TESTS else env_bool("SECURE_SSL_REDIRECT", not DEBUG)
SESSION_COOKIE_SECURE = False if RUNNING_TESTS else env_bool("SESSION_COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SECURE = False if RUNNING_TESTS else env_bool("CSRF_COOKIE_SECURE", not DEBUG)
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "0" if DEBUG else "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", not DEBUG)
SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", False)
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "structured": {
            "format": "{asctime} {levelname} {name} {message}",
            "style": "{",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "structured",
        }
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
}

# Ballary FCC/TEE lifecycle reconciliation.
ZALARY_FCC_EXTENSION_ID = int(os.getenv("ZALARY_FCC_EXTENSION_ID", "0"))
ZALARY_TEE_PROXY_SIGNER = os.getenv("ZALARY_TEE_PROXY_SIGNER", "")
ZALARY_TEE_LIFECYCLE_ENABLED = env_bool("ZALARY_TEE_LIFECYCLE_ENABLED", True)
