import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import { useWithdrawal } from "./useWithdrawals";

vi.mock("../lib/auth", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

describe("useWithdrawal", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("fetches the Milestone 5.2 private withdrawal endpoint", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: {
        id: "4f23f8b6-2bb0-4a66-9443-7a58b7b3610a",
        payroll_run_id: 1,
        payroll_id: "44958541763155445",
        destination: "0x1111111111111111111111111111111111111111",
        amount: "1000000",
        status: "signature_pending",
      },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useWithdrawal("4f23f8b6-2bb0-4a66-9443-7a58b7b3610a"), { wrapper });

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        "/withdrawals/4f23f8b6-2bb0-4a66-9443-7a58b7b3610a/",
      ),
    );
  });
});
