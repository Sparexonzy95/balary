import { useQuery } from "@tanstack/react-query";
import { adaptTransaction } from "../lib/adapters";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { routes } from "../lib/routes";

export function useTransactions() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["transactions"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const response = await api.get<Record<string, unknown>[]>(routes.transactions.list);
      return response.data.map(adaptTransaction);
    },
    refetchInterval: 10_000,
  });
}

export function useTransaction(transactionId?: number | string) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["transactions", String(transactionId || "")],
    enabled: isAuthenticated && Boolean(transactionId),
    queryFn: async () => {
      const response = await api.get<Record<string, unknown>>(routes.transactions.detail(transactionId!));
      return adaptTransaction(response.data);
    },
    refetchInterval: 10_000,
  });
}
