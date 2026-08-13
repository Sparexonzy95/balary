from __future__ import annotations

from apps.accounts.services import normalize_address
from apps.institutions.models import Institution, InstitutionMember


class InstitutionPermissionError(PermissionError):
    pass


def has_active_role(institution: Institution, wallet_address: str, roles: list[str] | tuple[str, ...]) -> bool:
    wallet = normalize_address(wallet_address)
    return institution.members.filter(
        wallet_address=wallet,
        role__in=roles,
        status=InstitutionMember.Status.ACTIVE,
        approved_onchain=True,
    ).exists()


def require_active_role(
    institution: Institution,
    wallet_address: str,
    roles: list[str] | tuple[str, ...],
) -> None:
    if not institution.is_registered_onchain or not institution.is_active_onchain:
        raise InstitutionPermissionError("Institution must be active on-chain")
    if not has_active_role(institution, wallet_address, roles):
        raise InstitutionPermissionError("Wallet does not have the required active institution role")
