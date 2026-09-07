import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { routes } from "../lib/routes";
import type { AvailableClaim, PreparedTx } from "../lib/types";

export function useAvailableClaims() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["claims", "available"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const response = await api.get<AvailableClaim[]>(routes.claims.available);
      return response.data;
    },
    refetchInterval: 5_000,
  });
}

export function useClaimPayload(paymentId?: string | number, enabled = true) {
  return useQuery({
    queryKey: ["claims", "payload", String(paymentId || "")],
    enabled: Boolean(paymentId) && enabled,
    queryFn: async () => {
      const response = await api.get<PreparedTx>(routes.claims.payload(paymentId!));
      return response.data;
    },
  });
}

export function useConfirmClaim(paymentId?: string | number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (txHash: string) => {
      if (!paymentId) throw new Error("Missing claim");
      const response = await api.post<{ payment_id: number; claim_tx_hash: string }>(routes.claims.confirm(paymentId), {
        tx_hash: txHash,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
