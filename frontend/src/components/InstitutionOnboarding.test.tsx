import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Institution } from "../lib/types";
import { InstitutionCreatedPanel, InstitutionRoleOverview } from "./InstitutionOnboarding";

const wallet = "0x1111111111111111111111111111111111111111";
const institution: Institution = {
  id: 7,
  name: "Balary Test Labs",
  institution_address: wallet,
  admin_address: wallet,
  treasury_address: wallet,
  tax_vault_address: wallet,
  chain: 114,
  contract_address: wallet,
  registration_status: "confirmed",
  is_registered_onchain: true,
  members: [{
    id: 1,
    wallet_address: wallet,
    role: "admin",
    status: "active",
    approved_onchain: true,
    created_at: "",
    updated_at: "",
  }],
  created_at: "",
  updated_at: "",
};

describe("institution onboarding guidance", () => {
  it("shows registration success, setup progress, and the next-step CTA", () => {
    render(<MemoryRouter><InstitutionCreatedPanel institution={institution} /></MemoryRouter>);

    expect(screen.getByText("Institution created successfully")).toBeInTheDocument();
    expect(screen.getByLabelText("Setup progress")).toHaveTextContent("Assign team roles");
    expect(screen.getByRole("link", { name: /set up team roles/i })).toHaveAttribute("href", "/institution/roles");
    expect(screen.getByRole("link", { name: /go to institution/i })).toHaveAttribute("href", "/institution");
  });

  it("explains every role and offers an assignment action", () => {
    const onAssign = vi.fn();
    render(
      <MemoryRouter>
        <InstitutionRoleOverview institution={institution} canAddEmployees={false} onAssign={onAssign} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Creates and manages employees and payroll.")).toBeInTheDocument();
    expect(screen.getByText("Funds approved payrolls.")).toBeInTheDocument();
    expect(screen.getByText("Views and claims eligible salary payments.")).toBeInTheDocument();
    expect(screen.getByText("Assign HR first")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Assign HR" }));
    expect(onAssign).toHaveBeenCalledWith("hr");
  });
});
