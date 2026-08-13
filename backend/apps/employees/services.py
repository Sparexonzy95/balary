from __future__ import annotations

from django.db import IntegrityError, transaction

from apps.accounts.models import Account
from apps.accounts.services import normalize_address
from apps.common.crypto import encrypt_private_text, stable_private_hash
from apps.common.permissions import InstitutionPermissionError, require_active_role
from apps.institutions.models import Institution, InstitutionMember

from .models import InstitutionEmployee


class EmployeeFlowError(ValueError):
    pass


def accessible_employees(account: Account):
    return InstitutionEmployee.objects.filter(
        institution__members__wallet_address=normalize_address(account.wallet_address),
        institution__members__role__in=[InstitutionMember.Role.ADMIN, InstitutionMember.Role.HR],
        institution__members__status=InstitutionMember.Status.ACTIVE,
        institution__members__approved_onchain=True,
    ).select_related("institution").distinct()


@transaction.atomic
def create_employee(
    *,
    actor: Account,
    institution: Institution,
    auth_wallet: str,
    name: str = "",
    email: str = "",
) -> InstitutionEmployee:
    try:
        require_active_role(
            institution,
            actor.wallet_address,
            [InstitutionMember.Role.ADMIN, InstitutionMember.Role.HR],
        )
    except InstitutionPermissionError as exc:
        raise EmployeeFlowError(str(exc)) from exc

    wallet = normalize_address(auth_wallet)
    try:
        return InstitutionEmployee.objects.create(
            institution=institution,
            auth_wallet_ciphertext=encrypt_private_text(wallet),
            auth_wallet_hash=stable_private_hash(wallet),
            name_ciphertext=encrypt_private_text(name.strip()),
            email_ciphertext=encrypt_private_text(email.strip().lower()),
            created_by=actor,
        )
    except IntegrityError as exc:
        raise EmployeeFlowError("That employee wallet is already registered for this institution") from exc


@transaction.atomic
def update_employee_status(
    *,
    actor: Account,
    employee: InstitutionEmployee,
    status: str,
) -> InstitutionEmployee:
    try:
        require_active_role(
            employee.institution,
            actor.wallet_address,
            [InstitutionMember.Role.ADMIN, InstitutionMember.Role.HR],
        )
    except InstitutionPermissionError as exc:
        raise EmployeeFlowError(str(exc)) from exc
    if status not in InstitutionEmployee.Status.values:
        raise EmployeeFlowError("Unsupported employee status")
    employee.status = status
    employee.save(update_fields=["status", "updated_at"])
    return employee
