import { expect } from "chai";
import { ethers } from "hardhat";
import {
  EXTENSION_ID,
  activatePayroll,
  createComputedPayroll,
  createDraft,
  deploySystem,
  requestPayrollComputation,
  requestWithdrawal,
} from "./helpers/system";

describe("ABI constants, events and view functions", function () {
  it("exposes the expected Flare operation constants", async function () {
    const f = await deploySystem();
    expect(await f.gateway.OP_TYPE_ZALARY()).to.equal(ethers.encodeBytes32String("ZALARY_FCC"));
    expect(await f.gateway.OP_COMMAND_PROCESS_PAYROLL()).to.equal(
      ethers.encodeBytes32String("PROCESS_PAYROLL"),
    );
    expect(await f.gateway.OP_COMMAND_AUTHORIZE_WITHDRAWAL()).to.equal(
      ethers.encodeBytes32String("AUTHORIZE_WITHDRAWAL"),
    );
  });

  it("exposes deterministic domain separators", async function () {
    const f = await deploySystem();
    expect(await f.gateway.PAYROLL_RESULT_DOMAIN()).to.equal(
      ethers.keccak256(ethers.toUtf8Bytes("ZALARY_FCC_PAYROLL_RESULT_V2")),
    );
    expect(await f.gateway.WITHDRAWAL_RESULT_DOMAIN()).to.equal(
      ethers.keccak256(ethers.toUtf8Bytes("ZALARY_FCC_WITHDRAWAL_RESULT_V2")),
    );
    expect(await f.gateway.FAILURE_RESULT_DOMAIN()).to.equal(
      ethers.keccak256(ethers.toUtf8Bytes("ZALARY_FCC_FAILURE_RESULT_V2")),
    );
  });

  it("exposes the expected safety limits", async function () {
    const f = await deploySystem();
    expect(await f.gateway.MAX_ENCRYPTED_PAYLOAD_BYTES()).to.equal(48_000n);
    expect(await f.gateway.REQUEST_TTL()).to.equal(900n);
    expect(await f.gateway.MAX_RESULT_VALIDITY()).to.equal(900n);
    expect(await f.gateway.TEE_SIGNER_ROTATION_DELAY()).to.equal(0n);
    expect(await f.vault.MIN_FUNDING_WINDOW()).to.equal(3600n);
    expect(await f.vault.MIN_ACTIVE_WITHDRAWAL_WINDOW()).to.equal(3600n);
    expect(await f.vault.MIN_SETTLEMENT_GRACE_PERIOD()).to.equal(900n);
  });

  it("exposes immutable component addresses", async function () {
    const f = await deploySystem();
    expect(await f.gateway.TEE_EXTENSION_REGISTRY()).to.equal(await f.extensionRegistry.getAddress());
    expect(await f.gateway.TEE_MACHINE_REGISTRY()).to.equal(await f.machineRegistry.getAddress());
    expect(await f.gateway.VAULT()).to.equal(await f.vault.getAddress());
    expect(await f.gateway.extensionId()).to.equal(EXTENSION_ID);
  });

  it("returns a complete payroll gateway context", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const request = await requestPayrollComputation(f, draft);
    const context = await f.vault.getPayrollGatewayContext(1);
    expect(context.institution).to.equal(f.institution.address);
    expect(context.metadataHash).to.equal(draft.metadataHash);
    expect(context.ciphertextHash).to.equal(request.ciphertextHash);
    expect(context.stablecoin).to.equal(await f.token.getAddress());
    expect(context.stablecoinDecimals).to.equal(6);
    expect(context.status).to.equal(2);
  });

  it("returns a complete active withdrawal context", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await activatePayroll(f, computed);
    const context = await f.vault.getWithdrawalContext(1);
    expect(context.institution).to.equal(f.institution.address);
    expect(context.privateLedgerRoot).to.equal(computed.result.data.privateLedgerRoot);
    expect(context.status).to.equal(5);
    expect(context.withdrawalDeadline).to.be.greaterThan(0n);
    expect(context.settlementDeadline).to.be.greaterThan(context.withdrawalDeadline);
    expect(context.minimumWithdrawalAmount).to.equal(1_000_000n);
  });

  it("reports request type, TEE, epoch, timestamp and closed status", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const request = await requestPayrollComputation(f, draft);
    const status = await f.gateway.getRequestStatus(request.instructionId);
    expect(status[0]).to.equal(1);
    expect(status[1]).to.equal(f.teeId.address);
    expect(status[2]).to.equal(1n);
    expect(status[3]).to.be.greaterThan(0n);
    expect(status[4]).to.equal(false);
  });

  it("reverts view functions for unknown payrolls and unknown requests", async function () {
    const f = await deploySystem();
    await expect(f.vault.getPayroll(999)).to.be.revertedWithCustomError(f.vault, "UnknownPayroll");
    await expect(f.gateway.getRequestStatus(ethers.id("missing")))
      .to.be.revertedWithCustomError(f.gateway, "RequestNotFound");
  });

  it("emits instruction and tracking events for a private withdrawal", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await activatePayroll(f, computed);
    const ciphertext = ethers.toUtf8Bytes("event-withdrawal");
    const instructionId = await f.gateway
      .connect(f.relayer)
      .requestPrivateWithdrawal.staticCall(1, ciphertext);
    await expect(f.gateway.connect(f.relayer).requestPrivateWithdrawal(1, ciphertext))
      .to.emit(f.gateway, "PrivateWithdrawalRequested")
      .and.to.emit(f.vault, "WithdrawalRequestTracked");
    expect(await f.gateway.activeWithdrawalInstruction(1)).to.equal(instructionId);
  });

  it("reports remaining escrow by payroll status", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await f.vault.connect(f.hr).openFunding(1);
    const total = BigInt(computed.result.data.totalRequired as bigint);
    await f.token.mint(f.finance.address, total);
    await f.token.connect(f.finance).approve(await f.vault.getAddress(), total);
    await f.vault.connect(f.finance).fundPayroll(1, total / 2n);
    expect(await f.vault.payrollEscrowRemaining(1)).to.equal(total / 2n);
  });
});
