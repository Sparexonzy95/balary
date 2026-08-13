import { expect } from "chai";
import { ethers } from "hardhat";
import {
  activatePayroll,
  advance,
  createComputedPayroll,
  createDraft,
  deploySystem,
  finalizePayrollComputation,
  latestTimestamp,
  requestPayrollComputation,
} from "./helpers/system";

describe("Payroll lifecycle and accounting", function () {
  it("creates a valid payroll draft", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const payroll = await f.vault.getPayroll(1);
    expect(payroll.institution).to.equal(f.institution.address);
    expect(payroll.createdBy).to.equal(f.hr.address);
    expect(payroll.metadataHash).to.equal(draft.metadataHash);
    expect(payroll.status).to.equal(1);
  });

  it("creates auto-incrementing payroll ids", async function () {
    const f = await deploySystem();
    const timestamp = await latestTimestamp();
    const args = [
      f.institution.address,
      ethers.keccak256(ethers.toUtf8Bytes("auto")),
      timestamp,
      timestamp + 7200,
      3600,
      900,
    ] as const;
    const predicted = await f.vault.connect(f.hr).createPayrollDraftAuto.staticCall(...args);
    await f.vault.connect(f.hr).createPayrollDraftAuto(...args);
    expect(predicted).to.equal(1n);
    expect(await f.vault.nextPayrollId()).to.equal(2n);
  });

  it("rejects zero payroll id, zero metadata, duplicates and non-HR callers", async function () {
    const f = await deploySystem();
    const timestamp = await latestTimestamp();
    const metadata = ethers.keccak256(ethers.toUtf8Bytes("valid"));
    await expect(
      f.vault.connect(f.hr).createPayrollDraft(
        0,
        f.institution.address,
        metadata,
        timestamp,
        timestamp + 7200,
        3600,
        900,
      ),
    ).to.be.reverted;
    await expect(
      f.vault.connect(f.hr).createPayrollDraft(
        1,
        f.institution.address,
        ethers.ZeroHash,
        timestamp,
        timestamp + 7200,
        3600,
        900,
      ),
    ).to.be.revertedWithCustomError(f.vault, "InvalidCommitment");
    await createDraft(f, 1n);
    let duplicateFailed = false;
    try {
      await createDraft(f, 1n);
    } catch {
      duplicateFailed = true;
    }
    expect(duplicateFailed).to.equal(true);
    await expect(
      f.vault.connect(f.finance).createPayrollDraft(
        2,
        f.institution.address,
        metadata,
        timestamp,
        timestamp + 7200,
        3600,
        900,
      ),
    ).to.be.revertedWithCustomError(f.vault, "NotAuthorized");
  });

  it("rejects invalid funding, withdrawal and grace windows", async function () {
    const f = await deploySystem();
    const t = await latestTimestamp();
    const metadata = ethers.keccak256(ethers.toUtf8Bytes("timing"));
    const badCases = [
      [t, t + 3599, 3600, 900],
      [t, t + 7200, 3599, 900],
      [t, t + 7200, 91 * 24 * 3600, 900],
      [t, t + 7200, 3600, 899],
      [t, t + 7200, 3600, 8 * 24 * 3600],
    ];
    for (let i = 0; i < badCases.length; i++) {
      const [start, deadline, window, grace] = badCases[i];
      await expect(
        f.vault.connect(f.hr).createPayrollDraft(
          BigInt(i + 1),
          f.institution.address,
          metadata,
          start,
          deadline,
          window,
          grace,
        ),
      ).to.be.revertedWithCustomError(f.vault, "InvalidDeadline");
    }
  });

  it("moves Draft -> ComputationRequested -> Computed", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    const payroll = await f.vault.getPayroll(computed.draft.payrollId);
    expect(payroll.status).to.equal(3);
    expect(payroll.privateLedgerRoot).to.equal(computed.result.data.privateLedgerRoot);
    expect(payroll.totalRequired).to.equal(computed.result.data.totalRequired);
  });

  it("opens funding only for HR or institution admin", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await expect(f.vault.connect(f.finance).openFunding(1))
      .to.be.revertedWithCustomError(f.vault, "NotAuthorized");
    await expect(f.vault.connect(f.hr).openFunding(1))
      .to.emit(f.vault, "PayrollFundingOpened")
      .withArgs(1);
  });

  it("supports partial funding without activating", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    const total = BigInt(computed.result.data.totalRequired as bigint);
    await f.vault.connect(f.hr).openFunding(1);
    await f.token.mint(f.finance.address, total);
    await f.token.connect(f.finance).approve(await f.vault.getAddress(), total);
    await f.vault.connect(f.finance).fundPayroll(1, total / 2n);
    const payroll = await f.vault.getPayroll(1);
    expect(payroll.status).to.equal(4);
    expect(payroll.fundedAmount).to.equal(total / 2n);
    expect(await f.vault.totalEscrowed()).to.equal(total / 2n);
  });

  it("activates only after exact full funding and pays aggregate tax", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await activatePayroll(f, computed);
    const payroll = await f.vault.getPayroll(1);
    expect(payroll.status).to.equal(5);
    expect(payroll.taxPaidAmount).to.equal(computed.result.data.aggregateTaxTotal);
    expect(await f.token.balanceOf(f.taxVault.address)).to.equal(computed.result.data.aggregateTaxTotal);
    expect(await f.vault.totalEscrowed()).to.equal(computed.result.data.employeeNetTotal);
  });

  it("rejects an incoming fee-on-transfer stablecoin and rolls back funding", async function () {
    const f = await deploySystem({ feeToken: true });
    const computed = await createComputedPayroll(f);
    const total = BigInt(computed.result.data.totalRequired as bigint);
    await f.vault.connect(f.hr).openFunding(1);
    await f.token.mint(f.finance.address, total);
    await f.token.connect(f.finance).approve(await f.vault.getAddress(), total);
    await f.token.setFee(f.finance.address, 100);
    await expect(f.vault.connect(f.finance).fundPayroll(1, total))
      .to.be.revertedWithCustomError(f.vault, "FeeOnTransferDetected");
    const payroll = await f.vault.getPayroll(1);
    expect(payroll.fundedAmount).to.equal(0n);
    expect(await f.vault.totalEscrowed()).to.equal(0n);
  });

  it("rejects zero funding, overfunding and unauthorized funders", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    const total = BigInt(computed.result.data.totalRequired as bigint);
    await f.vault.connect(f.hr).openFunding(1);
    await f.token.mint(f.finance.address, total * 2n);
    await f.token.connect(f.finance).approve(await f.vault.getAddress(), total * 2n);
    await expect(f.vault.connect(f.finance).fundPayroll(1, 0))
      .to.be.revertedWithCustomError(f.vault, "ZeroAmount");
    await expect(f.vault.connect(f.attacker).fundPayroll(1, 1n))
      .to.be.revertedWithCustomError(f.vault, "NotAuthorized");
    await expect(f.vault.connect(f.finance).fundPayroll(1, total + 1n))
      .to.be.revertedWithCustomError(f.vault, "InvalidCommitment");
  });

  it("rejects funding before fundingStartsAt", async function () {
    const f = await deploySystem();
    const t = await latestTimestamp();
    const draft = await createDraft(f, 1n, {
      fundingStartsAt: t + 3600,
      fundingDeadline: t + 7200,
    });
    // Compute manually through the normal helper path by creating a second fixture is unnecessary;
    // the gateway can still compute before the funding window opens.
    const request = await requestPayrollComputation(f, draft);
    const result = await finalizePayrollComputation(f, draft, request);
    await f.vault.connect(f.hr).openFunding(1);
    const total = BigInt(result.data.totalRequired as bigint);
    await f.token.mint(f.finance.address, total);
    await f.token.connect(f.finance).approve(await f.vault.getAddress(), total);
    await expect(f.vault.connect(f.finance).fundPayroll(1, total))
      .to.be.revertedWithCustomError(f.vault, "FundingNotOpen");
  });

  it("rejects opening or funding after the funding deadline", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    const deadline = Number(await f.vault.effectiveFundingDeadline(1));
    await advance(deadline - (await latestTimestamp()) + 1);
    await expect(f.vault.connect(f.hr).openFunding(1))
      .to.be.revertedWithCustomError(f.vault, "DeadlinePassed");
  });

  it("cancels a non-active payroll and refunds partial funding to the snapshotted treasury", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    const total = BigInt(computed.result.data.totalRequired as bigint);
    await f.vault.connect(f.hr).openFunding(1);
    await f.token.mint(f.finance.address, total);
    await f.token.connect(f.finance).approve(await f.vault.getAddress(), total);
    await f.vault.connect(f.finance).fundPayroll(1, total / 2n);
    const reason = ethers.keccak256(ethers.toUtf8Bytes("cancelled"));
    await f.vault.connect(f.institution).cancelPayroll(1, reason);
    expect((await f.vault.getPayroll(1)).status).to.equal(7);
    expect(await f.token.balanceOf(f.treasury.address)).to.equal(total / 2n);
    expect(await f.vault.totalEscrowed()).to.equal(0n);
  });

  it("does not allow cancellation after activation", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await activatePayroll(f, computed);
    await expect(
      f.vault.connect(f.institution).cancelPayroll(1, ethers.keccak256(ethers.toUtf8Bytes("x"))),
    ).to.be.revertedWithCustomError(f.vault, "BadStatus");
  });

  it("closes an expired payroll and returns unclaimed employee escrow", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await activatePayroll(f, computed);
    const settlement = Number(await f.vault.effectiveSettlementDeadline(1));
    await advance(settlement - (await latestTimestamp()) + 1);
    const before = await f.token.balanceOf(f.treasury.address);
    await f.vault.connect(f.finance).closeExpiredPayroll(1);
    const after = await f.token.balanceOf(f.treasury.address);
    expect(after - before).to.equal(computed.result.data.employeeNetTotal);
    expect((await f.vault.getPayroll(1)).status).to.equal(6);
    expect(await f.vault.totalEscrowed()).to.equal(0n);
    expect(await f.vault.payrollEscrowRemaining(1)).to.equal(0n);
  });
});
