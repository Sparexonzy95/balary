import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoleRoute, userHasAnyRole } from "./RoleRoute";
import type { Institution } from "../lib/types";

const wallet = "0x1111111111111111111111111111111111111111";
let roles: Array<"admin" | "hr" | "finance"> = [];

function institutionWithRoles(nextRoles: Array<"admin" | "hr" | "finance">): Institution[] {
  return [
    {
      id: 1,
      name: "Balary School",
      institution_address: wallet,
      admin_address: wallet,
      treasury_address: wallet,
      tax_vault_address: wallet,
      chain: 1,
      contract_address: "0xf094973c311E528de529b74BDD94A3c755499FB9",
      registration_status: "confirmed",
      is_registered_onchain: true,
      members: nextRoles.map((role, index) => ({
        id: index + 1,
        wallet_address: wallet,
        role,
        status: "active",
        created_at: "",
        updated_at: "",
      })),
      created_at: "",
      updated_at: "",
    },
  ];
}

vi.mock("../lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    account: { wallet_address: wallet },
  }),
}));

vi.mock("../hooks/useInstitutions", () => ({
  useInstitutions: () => ({
    data: institutionWithRoles(roles),
    isLoading: false,
  }),
}));

describe("RoleRoute", () => {
  beforeEach(() => {
    roles = [];
  });

  function renderGuard(required: Array<"admin" | "hr" | "finance">) {
    render(
      <MemoryRouter initialEntries={["/guarded"]}>
        <Routes>
          <Route element={<RoleRoute roles={required} />}>
            <Route path="/guarded" element={<div>Allowed page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  }

  it("denies HR access to Finance funding pages unless also Finance", () => {
    roles = ["hr"];
    renderGuard(["finance"]);
    expect(screen.getByRole("alert")).toHaveTextContent("Access denied");
    expect(screen.queryByText("Allowed page")).not.toBeInTheDocument();
  });

  it("denies Finance access to HR creation pages unless also HR", () => {
    roles = ["finance"];
    renderGuard(["hr"]);
    expect(screen.getByRole("alert")).toHaveTextContent("Access denied");
  });

  it("denies employee-only wallets from institution, HR, and Finance dashboards", () => {
    const institutions = institutionWithRoles([]);
    expect(userHasAnyRole(institutions, wallet, ["admin"])).toBe(false);
    expect(userHasAnyRole(institutions, wallet, ["hr"])).toBe(false);
    expect(userHasAnyRole(institutions, wallet, ["finance"])).toBe(false);
  });
});

