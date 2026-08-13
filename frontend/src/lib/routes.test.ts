import { describe, expect, it } from "vitest";
import { routes } from "./routes";
import { env } from "./env";

describe("Balary route constants", () => {
  it("points at the Milestone 5.2 Django API paths", () => {
    expect(routes.auth.nonce).toBe("/auth/nonce/");
    expect(routes.auth.refresh).toBe("/auth/refresh/");
    expect(routes.institutions.me).toBe("/institutions/");
    expect(routes.payroll.detail(12)).toBe("/payrolls/12/");
    expect(routes.payroll.prepareFund(12)).toBe("/payrolls/12/funding/fund/prepare/");
    expect(routes.claims.payload(9)).toBe("/withdrawals/9/");
    expect(routes.transactions.detail(3)).toBe("/transactions/3/");
  });

  it("normalizes the API base URL to include the versioned API prefix", () => {
    expect(env.apiBaseUrl.endsWith("/api/v1")).toBe(true);
  });
});
