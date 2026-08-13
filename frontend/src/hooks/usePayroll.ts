import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adaptPayrollRun, adaptPreparedTransaction } from "../lib/adapters";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { routes } from "../lib/routes";
import type { PayrollRun, PreparedTx } from "../lib/types";

function flowKey(runId: string | number, step: string) {
  return `zalary:prepared:payroll:${runId}:${step}`;
}

function remember(runId: string | number, step: string, tx: PreparedTx) {
  window.sessionStorage.setItem(flowKey(runId, step), tx.id);
}

function recall(runId: string | number, step: string) {
  const id = window.sessionStorage.getItem(flowKey(runId, step));
  if (!id) throw new Error("Prepared transaction is missing. Prepare this payroll action again.");
  return id;
}

export function usePayrollRuns() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["payroll-runs"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const response = await api.get<Record<string, unknown>[]>(routes.payroll.list);
      return response.data.map(adaptPayrollRun);
    },
    refetchInterval: 5_000,
  });
}

export function usePayrollRun(runId?: string | number) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["payroll-run", String(runId || "")],
    enabled: isAuthenticated && Boolean(runId),
    queryFn: async () => {
      const response = await api.get<Record<string, unknown>>(routes.payroll.detail(runId!));
      return adaptPayrollRun(response.data);
    },
    refetchInterval: 5_000,
  });
}

export function useCreatePayrollRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      institution_id: number;
      title: string;
      period_label: string;
      payroll_type?: "one_time" | "recurring";
      recurring_frequency?: "daily" | "weekly" | "monthly" | "";
      recurring_series_key?: string;
      recurring_index?: number;
      recurring_total?: number;
      funding_starts_at: string;
      claim_deadline: string;
      token_address: string;
    }) => {
      const fundingStart = new Date(payload.funding_starts_at);
      const fundingDeadline = new Date(payload.claim_deadline);
      const withdrawalWindow = Math.max(
        3_600,
        Math.floor((fundingDeadline.getTime() - fundingStart.getTime()) / 1000),
      );
      const response = await api.post<Record<string, unknown>>(routes.payroll.list, {
        institution_id: payload.institution_id,
        title: payload.title,
        period_label: payload.period_label,
        funding_starts_at: payload.funding_starts_at,
        funding_deadline: payload.claim_deadline,
        minimum_withdrawal_window_seconds: withdrawalWindow,
        settlement_grace_period_seconds: 3_600,
      });
      return adaptPayrollRun(response.data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll-runs"] }),
  });
}

export function useUploadPayroll(runId?: string | number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { content: string; filename: string }) => {
      if (!runId) throw new Error("Missing payroll run");
      const form = new FormData();
      form.append("file", new File([payload.content], payload.filename, { type: "text/csv" }));
      const response = await api.post<Record<string, unknown>>(routes.payroll.upload(runId), form);
      const run = adaptPayrollRun(response.data);
      return { valid: true, errors: [], rows: [], run };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-run", String(runId || "")] });
    },
  });
}

export function useValidatePayroll(runId?: string | number) {
  return useMutation({
    mutationFn: async () => {
      if (!runId) throw new Error("Missing payroll run");
      const response = await api.get<Record<string, unknown>>(routes.payroll.detail(runId));
      const run = adaptPayrollRun(response.data);
      return {
        valid: run.total_payments > 0 && Boolean(run.payments_root),
        errors: run.total_payments > 0 ? [] : ["No validated payroll rows are available"],
      };
    },
  });
}

export function useGeneratePayrollPackage(runId?: string | number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!runId) throw new Error("Missing payroll run");
      const response = await api.get<Record<string, unknown>>(routes.payroll.detail(runId));
      const run = adaptPayrollRun(response.data);
      if (!run.payments_root) throw new Error("Encrypt the payroll CSV before continuing");
      return {
        metadataHash: run.metadata_hash || "",
        paymentsRoot: run.payments_root,
        totalPayments: run.total_payments,
        totalGrossAmount: run.total_gross_amount,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-run", String(runId || "")] });
    },
  });
}

export function usePreparePayrollTx(runId?: string | number) {
  return useMutation({
    mutationFn: async (step: "create" | "upload" | "activate" | "fund" | "approval") => {
      if (!runId) throw new Error("Missing payroll run");
      const endpoint = {
        create: routes.payroll.prepareCreateDraft(runId),
        upload: routes.payroll.prepareUpload(runId),
        activate: routes.payroll.prepareActivate(runId),
        approval: routes.payroll.prepareApproval(runId),
        fund: routes.payroll.prepareFund(runId),
      }[step];
      const response = await api.post<{ prepared_transaction: Record<string, unknown> }>(
        endpoint,
        {},
        { headers: { "Idempotency-Key": `payroll-${runId}-${step}-${Date.now()}` } },
      );
      const prepared = adaptPreparedTransaction(response.data.prepared_transaction);
      remember(runId, step, prepared);
      return prepared;
    },
  });
}

export function useConfirmPayrollTx(runId?: string | number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      step: "create" | "upload" | "activate" | "fund" | "approval";
      tx_hash: string;
      onchain_payroll_id?: string;
    }) => {
      if (!runId) throw new Error("Missing payroll run");
      const endpoint = {
        create: routes.payroll.confirmCreateDraft(runId),
        upload: routes.payroll.confirmUpload(runId),
        activate: routes.payroll.confirmActivate(runId),
        approval: routes.payroll.confirmApproval(runId),
        fund: routes.payroll.confirmFund(runId),
      }[payload.step];
      await api.post(endpoint, {
        prepared_transaction_id: recall(runId, payload.step),
        tx_hash: payload.tx_hash,
      });
      const response = await api.get<Record<string, unknown>>(routes.payroll.detail(runId));
      return adaptPayrollRun(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-run", String(runId || "")] });
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
