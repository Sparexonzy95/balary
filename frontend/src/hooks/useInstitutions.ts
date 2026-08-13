import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adaptInstitution, adaptPreparedTransaction } from "../lib/adapters";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { routes } from "../lib/routes";
import type { Institution, PreparedTx } from "../lib/types";

function preparedKey(flow: string) {
  return `zalary:prepared:${flow}`;
}

function rememberPrepared(flow: string, prepared: PreparedTx) {
  window.sessionStorage.setItem(preparedKey(flow), prepared.id);
}

function recalledPrepared(flow: string) {
  const id = window.sessionStorage.getItem(preparedKey(flow));
  if (!id) throw new Error("Prepared transaction expired or is missing. Prepare the action again.");
  return id;
}

export function useInstitutions() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ["institutions", "me"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const response = await api.get<Record<string, unknown>[]>(routes.institutions.me);
      return response.data.map(adaptInstitution);
    },
    refetchInterval: 8_000,
  });
}

export function useActiveInstitution() {
  const institutions = useInstitutions();
  return { ...institutions, institution: institutions.data?.[0] || null };
}

export function hasInstitutionRole(
  institution: Institution | null | undefined,
  wallet: string | null | undefined,
  role: "admin" | "hr" | "finance",
) {
  if (!institution || !wallet) return false;
  return institution.members.some(
    (member) =>
      member.wallet_address.toLowerCase() === wallet.toLowerCase() &&
      member.role === role &&
      member.status === "active" &&
      member.approved_onchain !== false,
  );
}

export function usePrepareRegistration() {
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      notification_email: string;
      treasury_address: string;
      tax_vault_address: string;
    }) => {
      const existing = await api.get<Record<string, unknown>[]>(routes.institutions.list);
      let institutionRaw = existing.data[0];
      if (!institutionRaw) {
        const created = await api.post<Record<string, unknown>>(routes.institutions.list, payload);
        institutionRaw = created.data;
      }
      const institution = adaptInstitution(institutionRaw);
      const response = await api.post<{ prepared_transaction: Record<string, unknown> }>(
        routes.institutions.prepareRegistration(institution.id),
        {},
        { headers: { "Idempotency-Key": `institution-${institution.id}-registration` } },
      );
      const prepared = adaptPreparedTransaction(response.data.prepared_transaction);
      rememberPrepared(`institution:${institution.id}:registration`, prepared);
      return { ...prepared, institution_id: institution.id } as PreparedTx & { institution_id: number };
    },
  });
}

export function useConfirmRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { institution_id: number; tx_hash: string }) => {
      await api.post(routes.institutions.confirmRegistration(payload.institution_id), {
        prepared_transaction_id: recalledPrepared(`institution:${payload.institution_id}:registration`),
        tx_hash: payload.tx_hash,
      });
      const response = await api.get<Record<string, unknown>>(routes.institutions.detail(payload.institution_id));
      return adaptInstitution(response.data);
    },
    onSuccess: async (institution) => {
      queryClient.setQueryData<Institution[]>(["institutions", "me"], (current) => {
        if (!current) return [institution];
        const next = current.filter((item) => item.id !== institution.id);
        return [institution, ...next];
      });
      await queryClient.invalidateQueries({ queryKey: ["institutions"] });
    },
  });
}

export function usePrepareRole(institutionId?: number) {
  return useMutation({
    mutationFn: async (payload: {
      role: "hr" | "finance";
      wallet_address: string;
      notification_email?: string;
    }) => {
      if (!institutionId) throw new Error("Missing institution");
      const endpoint =
        payload.role === "hr"
          ? routes.institutions.prepareHr(institutionId)
          : routes.institutions.prepareFinance(institutionId);
      const response = await api.post<{
        member_id: number;
        prepared_transaction: Record<string, unknown>;
      }>(endpoint, {
        wallet_address: payload.wallet_address,
        notification_email: payload.notification_email || "",
        approved: true,
      });
      const prepared = adaptPreparedTransaction(response.data.prepared_transaction);
      rememberPrepared(
        `institution:${institutionId}:role:${payload.role}:${payload.wallet_address.toLowerCase()}`,
        prepared,
      );
      return prepared;
    },
  });
}

export function useConfirmRole(institutionId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      role: "hr" | "finance";
      wallet_address: string;
      notification_email?: string;
      tx_hash: string;
    }) => {
      if (!institutionId) throw new Error("Missing institution");
      await api.post(routes.institutions.confirmRole(institutionId), {
        prepared_transaction_id: recalledPrepared(
          `institution:${institutionId}:role:${payload.role}:${payload.wallet_address.toLowerCase()}`,
        ),
        tx_hash: payload.tx_hash,
      });
      return { member_id: 0, status: "pending_onchain" };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["institutions"] }),
  });
}

export function usePrepareRoleRemoval(institutionId?: number) {
  return useMutation({
    mutationFn: async (payload: { role: "hr" | "finance"; wallet_address: string }) => {
      if (!institutionId) throw new Error("Missing institution");
      const response = await api.post<{
        member_id: number;
        prepared_transaction: Record<string, unknown>;
      }>(routes.institutions.prepareRoleRemoval(institutionId, payload.role), {
        wallet_address: payload.wallet_address,
        notification_email: "",
        approved: false,
      });
      const prepared = adaptPreparedTransaction(response.data.prepared_transaction);
      rememberPrepared(
        `institution:${institutionId}:remove:${payload.role}:${payload.wallet_address.toLowerCase()}`,
        prepared,
      );
      return prepared;
    },
  });
}

export function useConfirmRoleRemoval(institutionId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      role: "hr" | "finance";
      wallet_address: string;
      tx_hash: string;
    }) => {
      if (!institutionId) throw new Error("Missing institution");
      await api.post(routes.institutions.confirmRoleRemoval(institutionId), {
        prepared_transaction_id: recalledPrepared(
          `institution:${institutionId}:remove:${payload.role}:${payload.wallet_address.toLowerCase()}`,
        ),
        tx_hash: payload.tx_hash,
      });
      return { member_id: 0, status: "pending_onchain" };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["institutions"] }),
  });
}
