from __future__ import annotations

import csv
import io
import json
import re
import uuid
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from django.conf import settings
from eth_utils import keccak

from apps.accounts.services import normalize_address
from apps.employees.models import InstitutionEmployee


REQUIRED_COLUMNS = [
    "employee_ref",
    "auth_address",
    "gross_amount",
    "bonus_amount",
    "deductions_amount",
    "tax_amount",
]
_AMOUNT_RE = re.compile(r"^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$")


@dataclass(frozen=True)
class ValidatedPayroll:
    payload: dict
    payload_bytes: bytes
    file_checksum: str
    payload_hash: str
    row_count: int
    employee_net_total: int
    aggregate_tax_total: int
    total_required: int
    errors: list[dict]

    @property
    def valid(self) -> bool:
        return not self.errors


def decode_csv(raw: bytes) -> str:
    if len(raw) > settings.ZALARY_PAYROLL_UPLOAD_MAX_BYTES:
        raise ValueError("Payroll CSV exceeds the configured upload limit")
    if b"\x00" in raw:
        raise ValueError("Payroll CSV contains invalid null bytes")
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("Payroll CSV must be UTF-8 encoded") from exc


def file_checksum(raw: bytes) -> str:
    return "0x" + keccak(raw).hex()


def _parse_amount(value: str, row_number: int, field: str, errors: list[dict]) -> int | None:
    text = (value or "").strip()
    if not _AMOUNT_RE.fullmatch(text):
        errors.append({"row": row_number, "field": field, "message": "Use a non-negative amount with at most 6 decimals"})
        return None
    try:
        decimal_value = Decimal(text)
    except InvalidOperation:
        errors.append({"row": row_number, "field": field, "message": "Invalid amount"})
        return None
    atomic = decimal_value * Decimal(10**6)
    if atomic != atomic.to_integral_value():
        errors.append({"row": row_number, "field": field, "message": "Amount has more than 6 decimals"})
        return None
    integer = int(atomic)
    if integer >= 2**256:
        errors.append({"row": row_number, "field": field, "message": "Amount exceeds uint256"})
        return None
    return integer


def validate_payroll_csv(*, raw: bytes, payroll_id: int, institution_id: int) -> ValidatedPayroll:
    text = decode_csv(raw)
    reader = csv.DictReader(io.StringIO(text, newline=""))
    headers = [header.strip() for header in (reader.fieldnames or []) if header is not None]
    missing = [column for column in REQUIRED_COLUMNS if column not in headers]
    errors: list[dict] = []
    if missing:
        errors.append({"row": 1, "field": "header", "message": f"Missing columns: {', '.join(missing)}"})
        return ValidatedPayroll(
            payload={}, payload_bytes=b"", file_checksum=file_checksum(raw), payload_hash="",
            row_count=0, employee_net_total=0, aggregate_tax_total=0, total_required=0, errors=errors,
        )

    employees = {
        str(employee.employee_ref): employee
        for employee in InstitutionEmployee.objects.filter(
            institution_id=institution_id,
            status=InstitutionEmployee.Status.ACTIVE,
        )
    }
    normalized: list[dict] = []
    seen_refs: set[str] = set()
    seen_wallets: set[str] = set()
    net_total = 0
    tax_total = 0
    row_count = 0

    for row_count, row in enumerate(reader, start=1):
        row = {(key or "").strip(): value for key, value in row.items()}
        row_number = row_count + 1
        if row_count > settings.ZALARY_PAYROLL_MAX_ROWS:
            errors.append({"row": row_number, "field": "file", "message": "Payroll exceeds the configured employee limit"})
            break

        employee_ref_text = (row.get("employee_ref") or "").strip()
        try:
            employee_ref = str(uuid.UUID(employee_ref_text))
        except (ValueError, AttributeError):
            errors.append({"row": row_number, "field": "employee_ref", "message": "Unknown or malformed employee reference"})
            continue
        if employee_ref in seen_refs:
            errors.append({"row": row_number, "field": "employee_ref", "message": "Duplicate employee reference"})
            continue
        seen_refs.add(employee_ref)

        employee = employees.get(employee_ref)
        if employee is None:
            errors.append({"row": row_number, "field": "employee_ref", "message": "Employee is not active for this institution"})
            continue

        try:
            auth_address = normalize_address(row.get("auth_address") or "")
        except ValueError as exc:
            errors.append({"row": row_number, "field": "auth_address", "message": str(exc)})
            continue
        if auth_address != employee.auth_wallet:
            errors.append({"row": row_number, "field": "auth_address", "message": "Authentication wallet does not match employee record"})
            continue
        if auth_address in seen_wallets:
            errors.append({"row": row_number, "field": "auth_address", "message": "Duplicate authentication wallet"})
            continue
        seen_wallets.add(auth_address)

        gross = _parse_amount(row.get("gross_amount", ""), row_number, "gross_amount", errors)
        bonus = _parse_amount(row.get("bonus_amount", ""), row_number, "bonus_amount", errors)
        deductions = _parse_amount(row.get("deductions_amount", ""), row_number, "deductions_amount", errors)
        tax = _parse_amount(row.get("tax_amount", ""), row_number, "tax_amount", errors)
        if None in (gross, bonus, deductions, tax):
            continue

        income = gross + bonus
        outgoing = deductions + tax
        if income < outgoing:
            errors.append({"row": row_number, "field": "amount", "message": "Deductions and tax exceed gross and bonus"})
            continue
        net = income - outgoing
        if net <= 0:
            errors.append({"row": row_number, "field": "amount", "message": "Employee net amount must be positive"})
            continue
        if income >= 2**256 or outgoing >= 2**256 or net >= 2**256:
            errors.append({"row": row_number, "field": "amount", "message": "Amount arithmetic exceeds uint256"})
            continue

        net_total += net
        tax_total += tax
        if net_total >= 2**256 or tax_total >= 2**256 or net_total + tax_total >= 2**256:
            errors.append({"row": row_number, "field": "amount", "message": "Payroll totals exceed uint256"})
            continue

        normalized.append(
            {
                "employeeRef": employee_ref,
                "authAddress": auth_address,
                "grossAmount": str(gross),
                "bonusAmount": str(bonus),
                "deductionsAmount": str(deductions),
                "taxAmount": str(tax),
            }
        )

    if row_count == 0 and not errors:
        errors.append({"row": 2, "field": "file", "message": "Payroll must contain at least one employee"})

    normalized.sort(key=lambda item: item["employeeRef"])
    payload = {"version": "1", "payrollId": str(payroll_id), "employees": normalized}
    payload_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8") if not errors else b""
    payload_hash = "0x" + keccak(payload_bytes).hex() if payload_bytes else ""
    return ValidatedPayroll(
        payload=payload if not errors else {},
        payload_bytes=payload_bytes,
        file_checksum=file_checksum(raw),
        payload_hash=payload_hash,
        row_count=row_count,
        employee_net_total=net_total,
        aggregate_tax_total=tax_total,
        total_required=net_total + tax_total,
        errors=errors,
    )
