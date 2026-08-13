import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { routes } from "../lib/routes";
import type {
  EligibleWithdrawalPayroll,
  WithdrawalContext,
  WithdrawalRequest,
} from "../lib/types";

export function useEligibleWithdrawals() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["withdrawals", "eligible"],
    enabled: isAuthenticated,
    queryFn: async () =>
      (await api.get<EligibleWithdrawalPayroll[]>(routes.claims.eligible)).data,
    refetchInterval: 10_000,
  });
}

export function useWithdrawals() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["withdrawals"],
    enabled: isAuthenticated,
    queryFn: async () => (await api.get<WithdrawalRequest[]>(routes.claims.available)).data,
    refetchInterval: 5_000,
  });
}

export function useWithdrawal(withdrawalId?: string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["withdrawals", withdrawalId],
    enabled: isAuthenticated && Boolean(withdrawalId),
    queryFn: async () => (await api.get<WithdrawalRequest>(routes.claims.payload(withdrawalId!))).data,
    refetchInterval: 5_000,
  });
}

export function useWithdrawalContext(payrollId?: string | number) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["withdrawal-context", String(payrollId || "")],
    enabled: isAuthenticated && Boolean(payrollId),
    queryFn: async () => (await api.get<WithdrawalContext>(routes.claims.context(payrollId!))).data,
  });
}

export function usePrepareWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { payroll_id: number }) =>
      (await api.post<WithdrawalRequest>(routes.claims.prepare, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["withdrawals"] }),
  });
}

export function useSubmitPreparedWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ withdrawalId, signature }: { withdrawalId: string; signature: string }) =>
      (await api.post<WithdrawalRequest>(routes.claims.confirm(withdrawalId), { signature })).data,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["withdrawals", variables.withdrawalId] });
    },
  });
}

export function useSubmitWithdrawal(withdrawalId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (signature: string) => {
      if (!withdrawalId) throw new Error("Missing withdrawal request");
      return (await api.post<WithdrawalRequest>(routes.claims.confirm(withdrawalId), { signature })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["withdrawals", withdrawalId] });
    },
  });
}

export function useProcessWithdrawal(withdrawalId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!withdrawalId) throw new Error("Missing withdrawal request");
      return (await api.post<WithdrawalRequest>(routes.claims.process(withdrawalId))).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["withdrawals", withdrawalId] });
    },
  });
}
