import { describe, expect, it } from "vitest";
import { backendReportedPayrollStatus, canGenerateMerkle } from "./readiness";

describe("frontend readiness guards", () => {
  it("keeps Merkle generation disabled until backend has an on-chain payroll id", () => {
    expect(canGenerateMerkle({ onchain_payroll_id: null })).toBe(false);
    expect(canGenerateMerkle({ onchain_payroll_id: 77 })).toBe(true);
  });

  it("does not treat submitted funding as active unless backend reports active", () => {
    expect(backendReportedPayrollStatus({ status: "pending_funding" })).toBe("pending_funding");
    expect(backendReportedPayrollStatus({ status: "active" })).toBe("active");
  });
});

