import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userHasAnyRole } from "../components/RoleRoute";
import { api } from "../lib/api";
import {
  institutionsQueryKey,
  useActiveInstitution,
  useConfirmRegistration,
  useConfirmRole,
  useConfirmRoleRemoval,
} from "./useInstitutions";

const wallet = "0x1111111111111111111111111111111111111111";
const otherWallet = "0x4444444444444444444444444444444444444444";
let currentWallet = wallet;

vi.mock("../lib/auth", () => ({
  useAuth: () => ({ isAuthenticated: true, account: { wallet_address: currentWallet } }),
}));

const rawInstitution = {
  id: 7,
  name: "Balary Test Labs",
  institution_address: wallet,
  admin_address: wallet,
  treasury_address: "0x2222222222222222222222222222222222222222",
  tax_vault_address: "0x3333333333333333333333333333333333333333",
  chain_id: 114,
  registration_status: "confirmed",
  is_registered_onchain: true,
  members: [{
    id: 9,
    wallet_address: wallet,
    role: "admin",
    status: "active",
    approved_onchain: true,
  }],
};

describe("institution registration synchronization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    currentWallet = wallet;
  });

  it("keeps the confirmed institution selected even when the refreshed list is temporarily stale", async () => {
    const get = vi.spyOn(api, "get").mockImplementation(async (url) => ({
      data: url === "/institutions/7/" ? rawInstitution : [],
    }));
    vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    window.sessionStorage.setItem("zalary:prepared:institution:7:registration", "prepared-7");

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(["payroll-runs"], []);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const view = renderHook(() => ({
      active: useActiveInstitution(),
      confirm: useConfirmRegistration(),
    }), { wrapper });

    await waitFor(() => expect(view.result.current.active.isSuccess).toBe(true));
    await act(async () => {
      await view.result.current.confirm.mutateAsync({ institution_id: 7, tx_hash: "0xabc" });
    });

    await waitFor(() => expect(view.result.current.active.institution?.id).toBe(7));
    expect(queryClient.getQueryData<any[]>(institutionsQueryKey(wallet))?.[0]?.name).toBe("Balary Test Labs");
    expect(userHasAnyRole(queryClient.getQueryData(institutionsQueryKey(wallet)), wallet, ["admin"])).toBe(true);
    expect(queryClient.getQueryState(["payroll-runs"])?.isInvalidated).toBe(true);
    expect(get).toHaveBeenCalledWith("/institutions/7/");
    expect(get).toHaveBeenCalledWith("/institutions/");

    await act(async () => {
      await view.result.current.active.refetch();
    });
    expect(view.result.current.active.institution?.id).toBe(7);

    currentWallet = otherWallet;
    view.rerender();
    await waitFor(() => expect(view.result.current.active.institution).toBeNull());
    expect(window.sessionStorage.getItem(`balary:active-institution:${otherWallet}`)).toBeNull();
  });

  it("updates active role access after assignment and removal without a browser refresh", async () => {
    let detailPayload = {
      ...rawInstitution,
      updated_at: "2026-08-14T10:00:00Z",
      members: [
        ...rawInstitution.members,
        {
          id: 10,
          wallet_address: wallet,
          role: "hr",
          status: "active",
          approved_onchain: true,
        },
      ],
    };
    vi.spyOn(api, "get").mockImplementation(async (url) => ({
      data: url === "/institutions/7/" ? detailPayload : [rawInstitution],
    }));
    vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    window.sessionStorage.setItem(
      `zalary:prepared:institution:7:role:hr:${wallet}`,
      "prepared-role",
    );
    window.sessionStorage.setItem(
      `zalary:prepared:institution:7:remove:hr:${wallet}`,
      "prepared-removal",
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const view = renderHook(() => ({
      active: useActiveInstitution(),
      assign: useConfirmRole(7),
      remove: useConfirmRoleRemoval(7),
    }), { wrapper });

    await waitFor(() => expect(view.result.current.active.isSuccess).toBe(true));
    await act(async () => {
      await view.result.current.assign.mutateAsync({
        role: "hr",
        wallet_address: wallet,
        tx_hash: "0xassign",
      });
    });
    await waitFor(() =>
      expect(userHasAnyRole(view.result.current.active.data, wallet, ["hr"])).toBe(true),
    );

    detailPayload = {
      ...detailPayload,
      updated_at: "2026-08-14T10:01:00Z",
      members: rawInstitution.members,
    };
    await act(async () => {
      await view.result.current.remove.mutateAsync({
        role: "hr",
        wallet_address: wallet,
        tx_hash: "0xremove",
      });
    });
    await waitFor(() =>
      expect(userHasAnyRole(view.result.current.active.data, wallet, ["hr"])).toBe(false),
    );
  });
});
