import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RegistrationStatusPanel } from "./RegistrationStatusPanel";
import type { Institution } from "../lib/types";

const wallet = "0x1111111111111111111111111111111111111111";

function institution(overrides: Partial<Institution> = {}): Institution {
  return {
    id: 1,
    name: "Balary School",
    institution_address: wallet,
    admin_address: wallet,
    treasury_address: "0x2222222222222222222222222222222222222222",
    tax_vault_address: "0x3333333333333333333333333333333333333333",
    chain: 1,
    contract_address: "0xf094973c311E528de529b74BDD94A3c755499FB9",
    registration_status: "pending",
    registration_tx_hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    registration_tx_status: "pending",
    registration_tx_error: "",
    can_retry_registration: false,
    is_registered_onchain: false,
    members: [],
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function renderPanel(nextInstitution: Institution) {
  render(
    <MemoryRouter>
      <RegistrationStatusPanel institution={nextInstitution} onRefresh={vi.fn()} />
    </MemoryRouter>,
  );
}

describe("RegistrationStatusPanel", () => {
  it("shows failed registration tx details instead of access denied", () => {
    renderPanel(
      institution({
        registration_status: "failed",
        registration_tx_status: "failed",
        registration_tx_error: "Transaction reverted on-chain",
        can_retry_registration: true,
      }),
    );

    expect(screen.getByText("Registration failed")).toBeInTheDocument();
    expect(screen.getByText("Transaction reverted on-chain")).toBeInTheDocument();
    expect(screen.queryByText("Access denied")).not.toBeInTheDocument();
  });

  it("shows an existing pending registration as pending", () => {
    renderPanel(institution());

    expect(screen.getByText("Registration pending")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh status/i })).toBeInTheDocument();
  });

  it("routes confirmed registrations to the institution dashboard", () => {
    renderPanel(
      institution({
        registration_status: "confirmed",
        registration_tx_status: "confirmed",
        is_registered_onchain: true,
        members: [
          {
            id: 1,
            wallet_address: wallet,
            role: "admin",
            status: "active",
            assigned_tx_hash: "",
            created_at: "",
            updated_at: "",
          },
        ],
      }),
    );

    expect(screen.getByText("Institution already registered")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open institution dashboard/i })).toHaveAttribute("href", "/institution");
  });
});
