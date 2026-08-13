from __future__ import annotations

import csv
import json

from django.http import HttpResponse
from django.utils.dateparse import parse_datetime
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payroll.models import PayrollRun
from apps.payroll.services import accessible_payrolls

from .serializers import AuditEventSerializer
from .services import accessible_audit_events




def _csv_safe(value):
    if value is None:
        return ""
    text = str(value)
    if text.startswith(("=", "+", "-", "@")):
        return "'" + text
    return text


def _filtered_events(request):
    queryset = accessible_audit_events(request.user)
    institution_id = request.query_params.get("institution_id")
    action = request.query_params.get("action")
    target_type = request.query_params.get("target_type")
    date_from = request.query_params.get("from")
    date_to = request.query_params.get("to")
    if institution_id:
        queryset = queryset.filter(institution_id=institution_id)
    if action:
        queryset = queryset.filter(action=action)
    if target_type:
        queryset = queryset.filter(target_type=target_type)
    if date_from and (parsed := parse_datetime(date_from)):
        queryset = queryset.filter(created_at__gte=parsed)
    if date_to and (parsed := parse_datetime(date_to)):
        queryset = queryset.filter(created_at__lte=parsed)
    return queryset


class AuditEventListView(APIView):
    def get(self, request):
        queryset = _filtered_events(request)[:500]
        return Response(AuditEventSerializer(queryset, many=True).data)


class AuditEventCsvView(APIView):
    def get(self, request):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="zalary-audit-events.csv"'
        writer = csv.writer(response)
        writer.writerow([
            "created_at",
            "institution_id",
            "institution_name",
            "actor_wallet",
            "action",
            "target_type",
            "target_id",
            "source",
            "metadata_json",
        ])
        for event in _filtered_events(request)[:5000]:
            writer.writerow([
                _csv_safe(event.created_at.isoformat()),
                _csv_safe(event.institution_id or ""),
                _csv_safe(event.institution.name if event.institution else ""),
                _csv_safe(event.actor_wallet or (event.actor.wallet_address if event.actor else "")),
                _csv_safe(event.action),
                _csv_safe(event.target_type),
                _csv_safe(event.target_id),
                _csv_safe(event.source),
                _csv_safe(json.dumps(event.metadata, sort_keys=True)),
            ])
        return response


def payroll_report_payload(payroll: PayrollRun) -> dict:
    withdrawals = payroll.withdrawal_requests.all()
    finalized = withdrawals.filter(status="finalized")
    return {
        "backend_payroll_run_id": payroll.id,
        "payroll_id": payroll.payroll_id,
        "institution": {
            "id": payroll.institution_id,
            "name": payroll.institution.name,
            "address": payroll.institution.institution_address,
        },
        "title": payroll.title,
        "period_label": payroll.period_label,
        "status": payroll.status,
        "onchain_status": payroll.onchain_status,
        "employee_count": payroll.employee_count,
        "employee_net_total_atomic": payroll.employee_net_total,
        "aggregate_tax_total_atomic": payroll.aggregate_tax_total,
        "total_required_atomic": payroll.total_required,
        "funded_amount_atomic": payroll.funded_amount,
        "net_withdrawn_amount_atomic": payroll.net_withdrawn_amount,
        "tax_paid_amount_atomic": payroll.tax_paid_amount,
        "metadata_hash": payroll.metadata_hash,
        "ciphertext_hash": payroll.ciphertext_hash,
        "private_ledger_root": payroll.private_ledger_root,
        "selected_tee_id": payroll.selected_tee_id,
        "instruction_id": payroll.instruction_id,
        "funding_starts_at": payroll.funding_starts_at,
        "funding_deadline": payroll.funding_deadline,
        "activated_at": payroll.activated_at,
        "withdrawal_deadline": payroll.withdrawal_deadline,
        "settlement_deadline": payroll.settlement_deadline,
        "transactions": {
            "draft": payroll.draft_tx_hash,
            "computation_request": payroll.computation_request_tx_hash,
            "computation_finalization": payroll.finalization_tx_hash,
            "open_funding": payroll.open_funding_tx_hash,
            "approval": payroll.approval_tx_hash,
            "funding": payroll.funding_tx_hash,
        },
        "withdrawals": {
            "total_requests": withdrawals.count(),
            "finalized": finalized.count(),
            "pending": withdrawals.exclude(status__in=["finalized", "failed", "expired", "tee_failure"]).count(),
            "failed_or_expired": withdrawals.filter(status__in=["failed", "expired", "tee_failure"]).count(),
            "finalization_transactions": list(finalized.values_list("finalization_tx_hash", flat=True)),
            "nullifiers": list(finalized.values_list("withdrawal_nullifier", flat=True)),
        },
        "created_at": payroll.created_at,
        "updated_at": payroll.updated_at,
    }


class PayrollAuditReportView(APIView):
    def get(self, request, pk: int):
        payroll = get_object_or_404(
            accessible_payrolls(request.user).select_related("institution").prefetch_related("withdrawal_requests"),
            pk=pk,
        )
        return Response(payroll_report_payload(payroll))


class PayrollAuditCsvView(APIView):
    def get(self, request, pk: int):
        payroll = get_object_or_404(
            accessible_payrolls(request.user).select_related("institution").prefetch_related("withdrawal_requests"),
            pk=pk,
        )
        payload = payroll_report_payload(payroll)
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="zalary-payroll-{payroll.payroll_id}.csv"'
        writer = csv.writer(response)
        writer.writerow(["field", "value"])
        for key, value in payload.items():
            if isinstance(value, (dict, list)):
                value = json.dumps(value, default=str, sort_keys=True)
            elif hasattr(value, "isoformat"):
                value = value.isoformat()
            writer.writerow([_csv_safe(key), _csv_safe(value)])
        return response
