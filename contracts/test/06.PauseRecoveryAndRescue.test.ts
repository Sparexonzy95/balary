import { expect } from "chai";
import { ethers } from "hardhat";
import {
  activatePayroll,
  advance,
  createComputedPayroll,
  createDraft,
  deploySystem,
  finalizeWithdrawal,
  latestTimestamp,
  requestWithdrawal,
} from "./helpers/system";

describe("Pause, recovery and rescue controls", function () {
  it("allows only protocol admins to pause and unpause", async function () {
    const f = await deploySystem();
    await expect(f.vault.connect(f.attacker).pause()).to.be.reverted;
    await expect(f.gateway.connect(f.attacker).pause()).to.be.reverted;
    await f.vault.pause();
    await f.gateway.pause();
    expect(await f.vault.paused()).to.equal(true);
    expect(await f.gateway.paused()).to.equal(true);
    await f.vault.unpause();
    await f.gateway.unpause();
  });

  it("extends funding deadlines by vault pause duration", async function () {
    const f = await deploySystem();
    await createDraft(f);
    const before = await f.vault.effectiveFundingDeadline(1);
    await f.vault.pause();
    await advance(3600);
    await f.vault.unpause();
    const after = await f.vault.effectiveFundingDeadline(1);
    const extension = after - before;
    expect(extension).to.be.gte(3600n);
    expect(extension).to.be.lte(3605n);
  });

  it("extends active withdrawal and settlement deadlines by pause duration", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await activatePayroll(f, computed);
    const withdrawalBefore = await f.vault.effectiveWithdrawalDeadline(1);
    const settlementBefore = await f.vault.effectiveSettlementDeadline(1);
    await f.vault.pause();
    await advance(7200);
    await f.vault.unpause();
    const withdrawalAfter = await f.vault.effectiveWithdrawalDeadline(1);
    const settlementAfter = await f.vault.effectiveSettlementDeadline(1);
    expect(withdrawalAfter - withdrawalBefore).to.be.gte(7200n);
    expect(withdrawalAfter - withdrawalBefore).to.be.lte(7205n);
    expect(settlementAfter - settlementBefore).to.equal(withdrawalAfter - withdrawalBefore);
  });

  it("blocks draft creation, funding opening and funding while the vault is paused", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await f.vault.pause();
    const t = await latestTimestamp();
    await expect(
      f.vault.connect(f.hr).createPayrollDraft(
        2,
        f.institution.address,
        ethers.keccak256(ethers.toUtf8Bytes("paused")),
        t,
        t + 7200,
        3600,
        900,
      ),
    ).to.be.reverted;
    await expect(f.vault.connect(f.hr).openFunding(1)).to.be.reverted;
    await f.vault.unpause();
    await f.vault.connect(f.hr).openFunding(1);
    const total = BigInt(computed.result.data.totalRequired as bigint);
    await f.token.mint(f.finance.address, total);
    await f.token.connect(f.finance).approve(await f.vault.getAddress(), total);
    await f.vault.pause();
    await expect(f.vault.connect(f.finance).fundPayroll(1, total)).to.be.reverted;
  });

  it("permits withdrawal requests and finalization while the gateway is paused", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await activatePayroll(f, computed);
    await f.gateway.pause();
    const request = await requestWithdrawal(f, 1n, "paused-gateway");
    await finalizeWithdrawal(f, computed, request);
    expect(await f.token.balanceOf(f.recipient.address)).to.equal(600_000_000n);
  });

  it("prevents payroll closure while a tracked request remains pending", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await activatePayroll(f, computed);
    const request = await requestWithdrawal(f, 1n, "pending-close");
    const settlement = Number(await f.vault.effectiveSettlementDeadline(1));
    await advance(settlement - (await latestTimestamp()) + 1);
    await expect(f.vault.connect(f.finance).closeExpiredPayroll(1))
      .to.be.revertedWithCustomError(f.vault, "PendingWithdrawalExists");
    await f.gateway.expireStaleRequest(request.instructionId);
    await f.vault.connect(f.finance).closeExpiredPayroll(1);
  });

  it("allows the protocol admin to rescue foreign tokens", async function () {
    const f = await deploySystem();
    const Foreign = await ethers.getContractFactory("MockERC20");
    const foreign = await Foreign.deploy("Foreign", "FRN", 18);
    await foreign.mint(await f.vault.getAddress(), 1000n);
    await expect(f.vault.connect(f.attacker).rescueForeignToken(
      await foreign.getAddress(),
      f.recipient.address,
      1000n,
    )).to.be.reverted;
    await f.vault.rescueForeignToken(await foreign.getAddress(), f.recipient.address, 1000n);
    expect(await foreign.balanceOf(f.recipient.address)).to.equal(1000n);
  });

  it("forbids rescuing the configured stablecoin through foreign-token rescue", async function () {
    const f = await deploySystem();
    await expect(
      f.vault.rescueForeignToken(await f.token.getAddress(), f.recipient.address, 1n),
    ).to.be.revertedWithCustomError(f.vault, "StablecoinRescueForbidden");
  });

  it("allows only true stablecoin surplus to be rescued", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await activatePayroll(f, computed);
    await f.token.mint(await f.vault.getAddress(), 50_000_000n);
    await f.vault.rescueStablecoinSurplus(f.recipient.address, 50_000_000n);
    expect(await f.token.balanceOf(f.recipient.address)).to.equal(50_000_000n);
    await expect(f.vault.rescueStablecoinSurplus(f.recipient.address, 1n))
      .to.be.revertedWithCustomError(f.vault, "InsufficientEscrow");
  });

  it("rescues native tokens from both vault and gateway", async function () {
    const f = await deploySystem();
    await f.admin.sendTransaction({ to: await f.vault.getAddress(), value: 1000n });
    await f.admin.sendTransaction({ to: await f.gateway.getAddress(), value: 2000n });
    const before = await ethers.provider.getBalance(f.recipient.address);
    await f.vault.rescueNative(f.recipient.address, 1000n);
    await f.gateway.rescueNative(f.recipient.address, 2000n);
    const after = await ethers.provider.getBalance(f.recipient.address);
    expect(after - before).to.equal(3000n);
  });

  it("rejects zero minimum withdrawal updates", async function () {
    const f = await deploySystem();
    await expect(f.vault.setDefaultMinimumWithdrawalAmount(0))
      .to.be.revertedWithCustomError(f.vault, "ZeroAmount");
  });

  it("rejects direct calls to gateway-only vault entry points", async function () {
    const f = await deploySystem();
    await createDraft(f);
    await expect(f.vault.connect(f.attacker).markComputationRequested(1, ethers.id("x")))
      .to.be.revertedWithCustomError(f.vault, "UnauthorizedGateway");
    await expect(f.vault.connect(f.attacker).resetComputationRequest(1, ethers.id("x")))
      .to.be.revertedWithCustomError(f.vault, "UnauthorizedGateway");
    await expect(f.vault.connect(f.attacker).noteWithdrawalRequestClosed(1, ethers.id("x")))
      .to.be.revertedWithCustomError(f.vault, "UnauthorizedGateway");
  });
});
