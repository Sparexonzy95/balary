import React from "react";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adaptInstitution, adaptPreparedTransaction } from "../lib/adapters";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { routes } from "../lib/routes";
import type { Institution, PreparedTx } from "../lib/types";

export const institutionsQueryKey = (wallet?: string | null) => [
  "institutions",
  "me",
  wallet?.toLowerCase() || "anonymous",
] as const;
const activeInstitutionKey = (wallet?: string | null) => [
  "institutions",
  "active",
  wallet?.toLowerCase() || "anonymous",
] as const;
const authoritativeInstitutionsKey = (wallet?: string | null) => [
  "institutions",
  "authoritative",
  wallet?.toLowerCase() || "anonymous",
] as const;

function activeInstitutionStorageKey(wallet?: string | null) {
  return `balary:active-institution:${wallet?.toLowerCase() || "anonymous"}`;
}

function storedActiveInstitution(wallet?: string | null) {
  if (typeof window === "undefined") return null;
  const value = Number(window.sessionStorage.getItem(activeInstitutionStorageKey(wallet)));
  return Number.isInteger(value) && value > 0 ? value : null;
}

const institutionDependentQueryKeys = [
  ["payroll-runs"],
  ["claims"],
  ["withdrawals"],
  ["notifications"],
  ["transactions"],
  ["schedules"],
  ["audit"],
  ["fcc"],
] as const;

function selectInstitution(
  queryClient: QueryClient,
  wallet: string | null | undefined,
  institutionId: number,
) {
  queryClient.setQueryData(activeInstitutionKey(wallet), institutionId);
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(activeInstitutionStorageKey(wallet), String(institutionId));
  }
}

function mergeInstitution(
  current: Institution[] | undefined,
  institution: Institution,
) {
  return [institution, ...(current || []).filter((item) => item.id !== institution.id)];
}

function institutionUpdatedAt(institution: Institution) {
  const timestamp = new Date(institution.updated_at).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mergeAuthoritativeInstitutions(
  collection: Institution[],
  authoritative: Institution[] | undefined,
) {
  return (authoritative || []).reduce((current, detail) => {
    const collectionInstitution = current.find((item) => item.id === detail.id);
    if (
      collectionInstitution &&
      institutionUpdatedAt(collectionInstitution) > institutionUpdatedAt(detail)
    ) {
      return current;
    }
    return mergeInstitution(current, detail);
  }, collection);
}

async function synchronizeInstitutionCache(
  queryClient: QueryClient,
  wallet: string | null | undefined,
  institution: Institution,
) {
  const listKey = institutionsQueryKey(wallet);
  queryClient.setQueryData<Institution[]>(authoritativeInstitutionsKey(wallet), (current) =>
    mergeInstitution(current, institution),
  );
  queryClient.setQueryData<Institution[]>(listKey, (current) =>
    mergeInstitution(current, institution),
  );
  await queryClient.invalidateQueries({
    queryKey: listKey,
    exact: true,
    refetchType: "active",
  });
  queryClient.setQueryData<Institution[]>(listKey, (current) =>
    mergeInstitution(current, institution),
  );
}

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
  const { account, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const wallet = account?.wallet_address;
  return useQuery({
    queryKey: institutionsQueryKey(wallet),
    enabled: isAuthenticated,
    queryFn: async () => {
      const response = await api.get<Record<string, unknown>[]>(routes.institutions.me);
      const collection = response.data.map(adaptInstitution);
      const authoritativeKey = authoritativeInstitutionsKey(wallet);
      const authoritative = queryClient.getQueryData<Institution[]>(authoritativeKey) || [];
      const missingFromCollection = authoritative.filter(
        (detail) => !collection.some((item) => item.id === detail.id),
      );
      const verifiedMissing = await Promise.all(
        missingFromCollection.map(async (detail) => {
          try {
            const detailResponse = await api.get<Record<string, unknown>>(
              routes.institutions.detail(detail.id),
            );
            return adaptInstitution(detailResponse.data);
          } catch {
            return null;
          }
        }),
      );
      const verifiedAuthoritative = [
        ...authoritative.filter((detail) =>
          collection.some((item) => item.id === detail.id),
        ),
        ...verifiedMissing.filter((detail): detail is Institution => Boolean(detail)),
      ];
      queryClient.setQueryData(authoritativeKey, verifiedAuthoritative);
      return mergeAuthoritativeInstitutions(
        collection,
        verifiedAuthoritative,
      );
    },
    refetchInterval: 8_000,
  });
}

export function useActiveInstitution() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const institutions = useInstitutions();
  const selectionKey = activeInstitutionKey(auth.account?.wallet_address);
  const selection = useQuery<number | null>({
    queryKey: selectionKey,
    queryFn: async () => null,
    enabled: false,
    initialData: () => storedActiveInstitution(auth.account?.wallet_address),
  });
  const selectedInstitutionId = selection.data;
  const institution =
    institutions.data?.find((item) => item.id === selectedInstitutionId) ||
    institutions.data?.[0] ||
    null;

  React.useEffect(() => {
    if (institution && institution.id !== selectedInstitutionId) {
      selectInstitution(queryClient, auth.account?.wallet_address, institution.id);
    }
  }, [auth.account?.wallet_address, institution, queryClient, selectedInstitutionId]);

  return { ...institutions, institution };
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
  const auth = useAuth();
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
      // Select immediately so every consumer agrees on the post-registration workspace.
      selectInstitution(queryClient, auth.account?.wallet_address, institution.id);
      // The collection endpoint can lag behind the confirmed detail response. Refresh it,
      // then re-merge the authoritative detail so a stale list cannot revoke fresh access.
      await synchronizeInstitutionCache(queryClient, auth.account?.wallet_address, institution);

      institutionDependentQueryKeys.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey });
      });
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
  const auth = useAuth();
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
      try {
        const response = await api.get<Record<string, unknown>>(routes.institutions.detail(institutionId));
        return adaptInstitution(response.data);
      } catch {
        return null;
      }
    },
    onSuccess: async (institution) => {
      if (institution) {
        await synchronizeInstitutionCache(queryClient, auth.account?.wallet_address, institution);
      } else {
        await queryClient.invalidateQueries({
          queryKey: institutionsQueryKey(auth.account?.wallet_address),
          exact: true,
        });
      }
    },
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
  const auth = useAuth();
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
      try {
        const response = await api.get<Record<string, unknown>>(routes.institutions.detail(institutionId));
        return adaptInstitution(response.data);
      } catch {
        return null;
      }
    },
    onSuccess: async (institution) => {
      if (institution) {
        await synchronizeInstitutionCache(queryClient, auth.account?.wallet_address, institution);
      } else {
        await queryClient.invalidateQueries({
          queryKey: institutionsQueryKey(auth.account?.wallet_address),
          exact: true,
        });
      }
    },
  });
}
