import { describe, expect, it } from "vitest";
import {
  adaptChainConfig,
  adaptInstitution,
  adaptPayrollRun,
  adaptPreparedTransaction,
} from "./adapters";

const wallet = "0x1111111111111111111111111111111111111111";

describe("Milestone 5.2 API adapters", () => {
  it("preserves the exact backend-prepared transaction", () => {
    const prepared = adaptPreparedTransaction({
      id: "a7f14f2f-2566-49e6-8628-6398342fc3d0",
      chain_id: 114,
      intent_type: "FUND_PAYROLL",
      from_address: wallet,
      to: "0xA5277D55a46514740b0C716C691d92b8D9E64e5E",
      data: "0x1234",
      value: "0",
      expected_event: "PayrollFunded",
    });
    expect(prepared.chain_id).toBe(114);
    expect(prepared.data).toBe("0x1234");
    expect(prepared.to).toBe("0xA5277D55a46514740b0C716C691d92b8D9E64e5E");
  });

  it("maps backend payroll states into the locked sample UI", () => {
    expect(adaptPayrollRun({ id: 1, status: "computed", payroll_id: "44958541763155445" }).status).toBe(
      "uploaded_onchain",
    );
    const fundingReady = adaptPayrollRun({ id: 1, status: "funding_ready", payroll_id: "44958541763155445" });
    expect(fundingReady.status).toBe("funding_ready");
    expect(fundingReady.onchain_payroll_id).toBe("44958541763155445");
  });

  it("maps institution roles and current chain configuration", () => {
    const institution = adaptInstitution({
      id: 3,
      name: "Balary Labs",
      chain_id: 114,
      institution_address: wallet,
      admin_address: wallet,
      treasury_address: wallet,
      tax_vault_address: wallet,
      members: [{ id: 1, wallet_address: wallet, role: "admin", status: "active" }],
    });
    expect(institution.chain_id).toBe(114);
    expect(institution.members[0].role).toBe("admin");

    const config = adaptChainConfig({
      chain: { name: "Coston2", chain_id: 114 },
      contracts: {
        vault: { name: "BalaryVault", address: "0xA5277D55a46514740b0C716C691d92b8D9E64e5E" },
        gateway: { name: "BalaryGateway", address: "0xFE9A84346A614599C9A0b5a1F444bd816a6C100A" },
      },
      token: { address: "0xC1A5B41512496B80903D1f32d6dEa3a73212E71F", symbol: "USD₮0", decimals: 6 },
    });
    expect(config.chain.chain_id).toBe(114);
    expect(config.token.symbol).toBe("USD₮0");
  });
});
