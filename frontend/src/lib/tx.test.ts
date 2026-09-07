import { describe, expect, it } from "vitest";
import { encodePreparedTx, txTarget } from "./tx";
import { env } from "./env";
import type { PreparedTx } from "./types";

const sender = "0x1111111111111111111111111111111111111111" as const;
const target = "0x2222222222222222222222222222222222222222" as const;

describe("backend-prepared transactions", () => {
  it("uses the exact target and calldata returned by Milestone 5.2", () => {
    const payload: PreparedTx = {
      id: "prepared-1",
      chain_id: env.arcChainId,
      intent_type: "CREATE_PAYROLL_DRAFT",
      from_address: sender,
      to: target,
      data: "0x1234",
      value: "0",
      expected_event: "PayrollDraftCreated",
    };

    expect(txTarget(payload)).toBe(target);
    expect(encodePreparedTx(payload)).toBe("0x1234");
  });

  it("does not re-encode token approvals in the browser", () => {
    const payload: PreparedTx = {
      id: "prepared-2",
      chain_id: env.arcChainId,
      intent_type: "APPROVE_PAYROLL_FUNDING",
      from_address: sender,
      to: env.usdcToken,
      data: "0xabcdef",
      value: "0",
      expected_event: "Approval",
    };

    expect(txTarget(payload)).toBe(env.usdcToken);
    expect(encodePreparedTx(payload)).toBe("0xabcdef");
  });
});
