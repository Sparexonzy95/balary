import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Institution, InstitutionMember } from "../lib/types";
import { AppDashboard } from "./AppDashboard";

const wallet = "0x1111111111111111111111111111111111111111";
let members: InstitutionMember[] = [];

const institution: Institution = {
  id: 7,
  name: "Balary Test Labs",
  institution_address: wallet,
  admin_address: wallet,
  treasury_address: wallet,
  tax_vault_address: wallet,
  chain: 114,
  contract_address: wallet,
  registration_status: "active",
  is_registered_onchain: true,
  members: [],
  created_at: "",
  updated_at: "",
};

vi.mock("../hooks/useInstitutions", async () => {
  const actual = await vi.importActual<typeof import("../hooks/useInstitutions")>("../hooks/useInstitutions");
  return {
    ...actual,
    useInstitutions: () => ({ data: [{ ...institution, members }], isLoading: false }),
  };
});

vi.mock("../hooks/useNotifications", () => ({
  useNotifications: () => ({ data: [] }),
}));

vi.mock("../lib/auth", () => ({
  useAuth: () => ({
    account: { wallet_address: wallet },
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

vi.mock("../lib/wallet", () => ({
  useWallet: () => ({ address: wallet, disconnect: vi.fn() }),
}));

vi.mock("../components/tour/DashboardTour", () => ({
  DashboardTourProvider: ({ children }: { children: ReactNode }) => children,
}));

function member(role: "admin" | "hr" | "finance", status: InstitutionMember["status"]): InstitutionMember {
  return {
    id: members.length + 1,
    wallet_address: wallet,
    role,
    status,
    approved_onchain: status === "active",
    created_at: "",
    updated_at: "",
  };
}

function dashboard() {
  return (
    <MemoryRouter initialEntries={["/app"]}>
      <Routes>
        <Route element={<AppDashboard />}>
          <Route path="/app" element={<div>Workspace</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AppDashboard role navigation", () => {
  beforeEach(() => {
    members = [];
    members = [member("admin", "active")];
  });

  it("adds navigation only after a pending connected-wallet role becomes active", () => {
    members = [...members, member("hr", "pending_onchain")];
    const view = render(dashboard());
    expect(screen.queryByRole("link", { name: /HR Payroll/i })).not.toBeInTheDocument();

    members = members.map((item) =>
      item.role === "hr" ? { ...item, status: "active", approved_onchain: true } : item,
    );
    view.rerender(dashboard());
    expect(screen.getByRole("link", { name: /HR Payroll/i })).toBeInTheDocument();
  });

  it("removes navigation immediately when role removal becomes pending", () => {
    members = [...members, member("finance", "active")];
    const view = render(dashboard());
    expect(screen.getByRole("link", { name: "Finance" })).toBeInTheDocument();

    members = members.map((item) =>
      item.role === "finance"
        ? { ...item, status: "pending_onchain", removed_tx_hash: "0xremove" }
        : item,
    );
    view.rerender(dashboard());
    expect(screen.queryByRole("link", { name: "Finance" })).not.toBeInTheDocument();
  });
});
