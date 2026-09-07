import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewPrivateWithdrawalPage, withdrawalStatusText } from "./WithdrawalsPage";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  prepare: vi.fn(),
  submit: vi.fn(),
  walletRequest: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));

vi.mock("../lib/wallet", () => ({
  useWallet: () => ({
    address: "0x1111111111111111111111111111111111111111",
    provider: { request: mocks.walletRequest },
  }),
}));

vi.mock("../hooks/useWithdrawals", () => ({
  usePrepareWithdrawal: () => ({ mutateAsync: mocks.prepare, isPending: false }),
  useSubmitPreparedWithdrawal: () => ({ mutateAsync: mocks.submit, isPending: false }),
  useEligibleWithdrawals: () => ({
    data: [{
      payroll_run_id: 1,
      payroll_id: "9001",
      title: "August salary",
      period_label: "2026-08",
      institution_name: "Balary Test",
      status: "active",
      minimum_withdrawal_amount: "1",
      withdrawal_deadline: "2000000000",
      has_open_request: false,
    }],
  }),
  useWithdrawalContext: () => ({
    data: {
      available_withdrawal_amount: "2500000",
      destination_wallet: "0x1111111111111111111111111111111111111111",
      authorization_expires_at: 2000000000,
      stablecoin_decimals: 6,
    },
    isFetching: false,
  }),
  useWithdrawals: () => ({ data: [] }),
  useWithdrawal: () => ({ isLoading: true }),
  useSubmitWithdrawal: () => ({ isPending: false }),
  useProcessWithdrawal: () => ({ isPending: false }),
}));

vi.mock("../components/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../components/ui")>()),
  useToast: () => ({ push: mocks.toast, complete: mocks.toast }),
}));

describe("full salary withdrawal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prepare.mockResolvedValue({
      id: "4f23f8b6-2bb0-4a66-9443-7a58b7b3610a",
      auth_digest: `0x${"12".repeat(32)}`,
    });
    mocks.walletRequest.mockResolvedValue(`0x${"34".repeat(65)}`);
    mocks.submit.mockResolvedValue({ status: "tee_pending" });
  });

  it("removes amount entry and submits the backend-authorized full salary automatically", async () => {
    render(
      <MemoryRouter initialEntries={["/employee/claims/new?payroll=1"]}>
        <NewPrivateWithdrawalPage />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText(/Amount/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("2.5 USD₮0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Withdraw full salary" }));

    await waitFor(() => expect(mocks.prepare).toHaveBeenCalledWith({ payroll_id: 1 }));
    expect(mocks.prepare.mock.calls[0][0]).not.toHaveProperty("amount");
    expect(mocks.prepare.mock.calls[0][0]).not.toHaveProperty("destination");
    await waitFor(() => expect(mocks.walletRequest).toHaveBeenCalledWith({
      method: "personal_sign",
      params: [`0x${"12".repeat(32)}`, "0x1111111111111111111111111111111111111111"],
    }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalled());
  });

  it("uses the required terminal and processing status text", () => {
    expect(withdrawalStatusText("tee_pending")).toBe("TEE processing");
    expect(withdrawalStatusText("finalization_pending")).toBe("Finalizing settlement");
    expect(withdrawalStatusText("finalized")).toBe("Withdrawal finalized");
    expect(withdrawalStatusText("failed")).toBe("Withdrawal failed");
    expect(withdrawalStatusText("expired")).toBe("Withdrawal expired");
  });
});
