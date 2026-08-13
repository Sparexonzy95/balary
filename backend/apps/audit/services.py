from __future__ import annotations

from typing import Any

from django.db import models

from apps.accounts.services import normalize_address
from apps.institutions.services import accessible_institutions

from .models import AuditEvent


def json_safe(value: Any):
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [json_safe(item) for item in value]
    if isinstance(value, models.Model):
        return {"id": str(value.pk)}
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def record_audit_event(
    *,
    action: str,
    target_type: str,
    target_id,
    dedup_key: str,
    institution=None,
    actor=None,
    actor_wallet: str = "",
    metadata: dict | None = None,
    request_id: str = "",
    source: str = "system",
) -> AuditEvent:
    wallet = actor_wallet or (getattr(actor, "wallet_address", "") if actor else "")
    if wallet:
        wallet = normalize_address(wallet)
    event, _ = AuditEvent.objects.get_or_create(
        dedup_key=dedup_key,
        defaults={
            "institution": institution,
            "actor": actor,
            "actor_wallet": wallet,
            "action": action,
            "target_type": target_type,
            "target_id": str(target_id),
            "metadata": json_safe(metadata or {}),
            "request_id": request_id,
            "source": source,
        },
    )
    return event


def accessible_audit_events(account):
    institution_ids = accessible_institutions(account).values_list("id", flat=True)
    return AuditEvent.objects.filter(institution_id__in=institution_ids).select_related("institution", "actor")
