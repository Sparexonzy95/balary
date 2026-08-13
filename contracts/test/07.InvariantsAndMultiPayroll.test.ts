import { expect } from "chai";
import { ethers } from "hardhat";
import {
  activatePayroll,
  advance,
  createComputedPayroll,
  deploySystem,
  finalizeWithdrawal,
  latestTimestamp,
  requestWithdrawal,
} from "./helpers/system";

describe("Accounting invariants and multiple payrolls", function () {
  it("keeps totalEscrowed equal to the sum of active employee escrows", async function () {
    const f = await deploySystem();
    const p1 = await createComputedPayroll(f, 1n, {
      employeeNetTotal: 1_000_000_000n,
      aggregateTaxTotal: 100_000_000n,
      totalRequired: 1_100_000_000n,
    });
    await activatePayroll(f, p1);
    const p2 = await createComputedPayroll(f, 2n, {
      employeeNetTotal: 3_000_000_000n,
      aggregateTaxTotal: 300_000_000n,
      totalRequired: 3_300_000_000n,
    });
    await activatePayroll(f, p2);
    expect(await f.vault.totalEscrowed()).to.equal(4_000_000_000n);
    expect(await f.token.balanceOf(await f.vault.getAddress())).to.equal(4_000_000_000n);
  });

  it("isolates ledger roots and withdrawal lanes between payrolls", async function () {
    const f = await deploySystem();
    const p1 = await createComputedPayroll(f, 1n);
    await activatePayroll(f, p1);
    const p2 = await createComputedPayroll(f, 2n);
    await activatePayroll(f, p2);
    const r1 = await requestWithdrawal(f, 1n, "p1");
    const r2 = await requestWithdrawal(f, 2n, "p2");
    expect(await f.gateway.activeWithdrawalInstruction(1)).to.equal(r1.instructionId);
    expect(await f.gateway.activeWithdrawalInstruction(2)).to.equal(r2.instructionId);
    await finalizeWithdrawal(f, p1, r1, { amount: 100_000_000n });
    const payroll2Before = await f.vault.getPayroll(2);
    await finalizeWithdrawal(f, p2, r2, { amount: 200_000_000n });
    const payroll2After = await f.vault.getPayroll(2);
    expect(payroll2After.netWithdrawnAmount).to.equal(200_000_000n);
    expect(payroll2After.privateLedgerRoot).not.to.equal(payroll2Before.privateLedgerRoot);
  });

  it("maintains stablecoin balance >= totalEscrowed after withdrawals and surplus deposits", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await activatePayroll(f, computed);
    await f.token.mint(await f.vault.getAddress(), 25_000_000n);
    const request = await requestWithdrawal(f);
    await finalizeWithdrawal(f, computed, request, { amount: 500_000_000n });
    const balance = await f.token.balanceOf(await f.vault.getAddress());
    expect(balance).to.be.gte(await f.vault.totalEscrowed());
    expect(balance - (await f.vault.totalEscrowed())).to.equal(25_000_000n);
  });

  it("does not change totalEscrowed when a withdrawal finalization reverts", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await activatePayroll(f, computed);
    const before = await f.vault.totalEscrowed();
    const request = await requestWithdrawal(f);
    let failed = false;
    try {
      await finalizeWithdrawal(f, computed, request, {
        amount: BigInt(computed.result.data.employeeNetTotal as bigint) + 1n,
      });
    } catch {
      failed = true;
    }
    expect(failed).to.equal(true);
    expect(await f.vault.totalEscrowed()).to.equal(before);
  });

  it("returns only one payroll's remaining escrow when that payroll expires", async function () {
    const f = await deploySystem();
    const p1 = await createComputedPayroll(f, 1n, {
      employeeNetTotal: 1_000_000_000n,
      aggregateTaxTotal: 100_000_000n,
      totalRequired: 1_100_000_000n,
    });
    await activatePayroll(f, p1);
    const p2 = await createComputedPayroll(f, 2n, {
      employeeNetTotal: 2_000_000_000n,
      aggregateTaxTotal: 200_000_000n,
      totalRequired: 2_200_000_000n,
    });
    await activatePayroll(f, p2);

    const settlement1 = Number(await f.vault.effectiveSettlementDeadline(1));
    await advance(settlement1 - (await latestTimestamp()) + 1);
    await f.vault.connect(f.finance).closeExpiredPayroll(1);
    expect(await f.vault.totalEscrowed()).to.equal(2_000_000_000n);
    expect((await f.vault.getPayroll(2)).status).to.equal(5);
  });

  it("preserves totalRequired = employeeNetTotal + aggregateTaxTotal", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    const payroll = await f.vault.getPayroll(1);
    expect(payroll.totalRequired).to.equal(payroll.employeeNetTotal + payroll.aggregateTaxTotal);
    expect(computed.result.data.totalRequired).to.equal(
      BigInt(computed.result.data.employeeNetTotal as bigint) +
      BigInt(computed.result.data.aggregateTaxTotal as bigint),
    );
  });

  it("preserves fundedAmount and tax accounting after activation", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await activatePayroll(f, computed);
    const payroll = await f.vault.getPayroll(1);
    expect(payroll.fundedAmount).to.equal(payroll.totalRequired);
    expect(payroll.taxPaidAmount).to.equal(payroll.aggregateTaxTotal);
    expect(await f.token.balanceOf(await f.vault.getAddress())).to.equal(payroll.employeeNetTotal);
  });

  it("closes with zero refund after exact full withdrawals", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await activatePayroll(f, computed);
    const request = await requestWithdrawal(f);
    await finalizeWithdrawal(f, computed, request, {
      amount: BigInt(computed.result.data.employeeNetTotal as bigint),
    });
    const treasuryBefore = await f.token.balanceOf(f.treasury.address);
    expect((await f.vault.getPayroll(1)).status).to.equal(6);
    expect(await f.token.balanceOf(f.treasury.address)).to.equal(treasuryBefore);
  });
});
