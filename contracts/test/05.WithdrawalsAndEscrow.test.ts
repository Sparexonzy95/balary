import { expect } from "chai";
import { ethers } from "hardhat";
import {
  FAILURE,
  SUCCESS,
  activatePayroll,
  advance,
  buildFailureResult,
  buildWithdrawalResult,
  createComputedPayroll,
  deploySystem,
  finalizeWithdrawal,
  latestTimestamp,
  requestWithdrawal,
  signActionResult,
  type SystemOptions,
} from "./helpers/system";

describe("Private withdrawals and escrow accounting", function () {
  async function activeFixture<
    const TOptions extends SystemOptions = Record<never, never>,
  >(options: TOptions = {} as TOptions) {
    const f = await deploySystem(options);
    const computed = await createComputedPayroll(f);
    await activatePayroll(f, computed);
    return { f, computed };
  }

  it("accepts withdrawal requests only from approved relayers", async function () {
    const { f } = await activeFixture();
    await expect(
      f.gateway.connect(f.attacker).requestPrivateWithdrawal(1, ethers.toUtf8Bytes("x")),
    ).to.be.reverted;
    await expect(
      f.gateway.connect(f.relayer).requestPrivateWithdrawal(1, ethers.toUtf8Bytes("x")),
    ).not.to.be.reverted;
  });

  it("rejects empty and oversized encrypted withdrawal payloads", async function () {
    const { f } = await activeFixture();
    await expect(f.gateway.connect(f.relayer).requestPrivateWithdrawal(1, "0x"))
      .to.be.revertedWithCustomError(f.gateway, "EmptyCiphertext");
    const oversized = `0x${"11".repeat(48_001)}`;
    await expect(f.gateway.connect(f.relayer).requestPrivateWithdrawal(1, oversized))
      .to.be.revertedWithCustomError(f.gateway, "PayloadTooLarge");
  });

  it("rejects withdrawal requests before payroll activation", async function () {
    const f = await deploySystem();
    await createComputedPayroll(f);
    await expect(
      f.gateway.connect(f.relayer).requestPrivateWithdrawal(1, ethers.toUtf8Bytes("x")),
    ).to.be.revertedWithCustomError(f.gateway, "BadPayrollStatus");
  });

  it("tracks one pending withdrawal instruction and blocks a concurrent request", async function () {
    const { f } = await activeFixture();
    const request = await requestWithdrawal(f);
    expect(await f.gateway.activeWithdrawalInstruction(1)).to.equal(request.instructionId);
    expect((await f.vault.getPayroll(1)).pendingWithdrawalRequests).to.equal(1n);
    let secondFailed = false;
    try {
      await requestWithdrawal(f, 1n, "second");
    } catch {
      secondFailed = true;
    }
    expect(secondFailed).to.equal(true);
  });

  it("executes a valid partial withdrawal and updates the ledger root", async function () {
    const { f, computed } = await activeFixture();
    const request = await requestWithdrawal(f);
    const oldRoot = (await f.vault.getPayroll(1)).privateLedgerRoot;
    const result = await finalizeWithdrawal(f, computed, request);
    const payroll = await f.vault.getPayroll(1);
    expect(payroll.privateLedgerRoot).to.equal(result.data.newLedgerRoot);
    expect(payroll.privateLedgerRoot).not.to.equal(oldRoot);
    expect(payroll.netWithdrawnAmount).to.equal(result.data.amount);
    expect(await f.token.balanceOf(f.recipient.address)).to.equal(result.data.amount);
    expect(payroll.pendingWithdrawalRequests).to.equal(0n);
    expect(await f.gateway.activeWithdrawalInstruction(1)).to.equal(ethers.ZeroHash);
  });

  it("supports sequential partial withdrawals using the latest ledger root", async function () {
    const { f, computed } = await activeFixture();
    const firstRequest = await requestWithdrawal(f, 1n, "first");
    const first = await finalizeWithdrawal(f, computed, firstRequest, { amount: 500_000_000n });
    const secondRequest = await requestWithdrawal(f, 1n, "second");
    const second = await finalizeWithdrawal(f, computed, secondRequest, {
      amount: 400_000_000n,
      oldLedgerRoot: first.data.newLedgerRoot,
      newLedgerRoot: ethers.keccak256(ethers.toUtf8Bytes("third-root")),
    });
    const payroll = await f.vault.getPayroll(1);
    expect(payroll.netWithdrawnAmount).to.equal(900_000_000n);
    expect(payroll.privateLedgerRoot).to.equal(second.data.newLedgerRoot);
  });

  it("closes automatically when the full employee net total is withdrawn", async function () {
    const { f, computed } = await activeFixture();
    const request = await requestWithdrawal(f);
    const netTotal = BigInt(computed.result.data.employeeNetTotal as bigint);
    await finalizeWithdrawal(f, computed, request, { amount: netTotal });
    const payroll = await f.vault.getPayroll(1);
    expect(payroll.status).to.equal(6);
    expect(await f.vault.totalEscrowed()).to.equal(0n);
    expect(await f.vault.payrollEscrowRemaining(1)).to.equal(0n);
  });

  it("rejects a second use of a withdrawal nullifier", async function () {
    const { f, computed } = await activeFixture();
    const firstRequest = await requestWithdrawal(f, 1n, "first");
    const nullifier = ethers.keccak256(ethers.toUtf8Bytes("shared-nullifier"));
    const first = await finalizeWithdrawal(f, computed, firstRequest, {
      amount: 100_000_000n,
      withdrawalNullifier: nullifier,
    });
    const secondRequest = await requestWithdrawal(f, 1n, "second");
    const second = await buildWithdrawalResult(f, computed, secondRequest, {
      amount: 100_000_000n,
      oldLedgerRoot: first.data.newLedgerRoot,
      newLedgerRoot: ethers.keccak256(ethers.toUtf8Bytes("root-after-replay")),
      withdrawalNullifier: nullifier,
    });
    const signature = await signActionResult(
      f.teeSigner,
      second.encoded,
      secondRequest.instructionId,
      "submit",
      SUCCESS,
    );
    await expect(
      f.gateway.finalizePrivateWithdrawal(
        second.encoded,
        secondRequest.instructionId,
        "submit",
        SUCCESS,
        signature,
      ),
    ).to.be.revertedWithCustomError(f.vault, "WithdrawalAlreadyUsed");
  });

  it("rejects stale ledger roots", async function () {
    const { f, computed } = await activeFixture();
    const firstRequest = await requestWithdrawal(f, 1n, "first");
    await finalizeWithdrawal(f, computed, firstRequest, { amount: 100_000_000n });
    const secondRequest = await requestWithdrawal(f, 1n, "stale");
    const stale = await buildWithdrawalResult(f, computed, secondRequest, {
      amount: 100_000_000n,
      oldLedgerRoot: computed.result.data.privateLedgerRoot,
      newLedgerRoot: ethers.keccak256(ethers.toUtf8Bytes("stale-next")),
    });
    const signature = await signActionResult(
      f.teeSigner,
      stale.encoded,
      secondRequest.instructionId,
      "submit",
      SUCCESS,
    );
    await expect(
      f.gateway.finalizePrivateWithdrawal(
        stale.encoded,
        secondRequest.instructionId,
        "submit",
        SUCCESS,
        signature,
      ),
    ).to.be.revertedWithCustomError(f.gateway, "InvalidResult");
  });

  type Fixture = Awaited<ReturnType<typeof deploySystem>>;
  type ComputedPayroll = Awaited<ReturnType<typeof createComputedPayroll>>;
  type WithdrawalRequest = Awaited<ReturnType<typeof requestWithdrawal>>;
  type WithdrawalMismatchCase = [
    string,
    (
      f: Fixture,
      computed: ComputedPayroll,
      request: WithdrawalRequest,
    ) => Promise<Record<string, unknown>>,
  ];

  const withdrawalMismatchCases: WithdrawalMismatchCase[] = [
    ["domain", async () => ({ domain: ethers.ZeroHash })],
    ["gateway", async (f) => ({ gateway: f.attacker.address })],
    ["vault", async (f) => ({ vault: f.attacker.address })],
    ["chain id", async () => ({ chainId: 999n })],
    ["extension id", async () => ({ extensionId: 0x10001n })],
    ["TEE id", async (f) => ({ selectedTeeId: f.attacker.address })],
    ["TEE epoch", async (_f, _c, request) => ({ teeSignerEpoch: request.teeSignerEpoch + 1n })],
    ["payroll id", async () => ({ payrollId: 999n })],
    ["institution", async (f) => ({ institution: f.attacker.address })],
    ["stablecoin", async (f) => ({ stablecoin: f.attacker.address })],
    ["decimals", async () => ({ stablecoinDecimals: 18 })],
    ["ciphertext hash", async () => ({ ciphertextHash: ethers.keccak256(ethers.toUtf8Bytes("wrong")) })],
    ["zero new root", async () => ({ newLedgerRoot: ethers.ZeroHash })],
    ["same new root", async (_f, computed) => ({ newLedgerRoot: computed.result.data.privateLedgerRoot })],
    ["zero destination", async () => ({ destination: ethers.ZeroAddress })],
    ["below minimum", async () => ({ amount: 999_999n })],
    ["zero nullifier", async () => ({ withdrawalNullifier: ethers.ZeroHash })],
    ["requestedAt", async (_f, _c, request) => ({ requestedAt: request.requestedAt + 1n })],
  ];

  for (const [label, getOverrides] of withdrawalMismatchCases) {
    it(`rejects a withdrawal result with mismatched ${label}`, async function () {
      const { f, computed } = await activeFixture();
      const request = await requestWithdrawal(f);
      const overrides = await getOverrides(f, computed, request);
      const result = await buildWithdrawalResult(f, computed, request, overrides);
      const signature = await signActionResult(
        f.teeSigner,
        result.encoded,
        request.instructionId,
        "submit",
        SUCCESS,
      );
      await expect(
        f.gateway.finalizePrivateWithdrawal(
          result.encoded,
          request.instructionId,
          "submit",
          SUCCESS,
          signature,
        ),
      ).to.be.revertedWithCustomError(f.gateway, "InvalidResult");
    });
  }

  it("rejects a withdrawal larger than the employee escrow", async function () {
    const { f, computed } = await activeFixture();
    const request = await requestWithdrawal(f);
    const tooMuch = BigInt(computed.result.data.employeeNetTotal as bigint) + 1n;
    const result = await buildWithdrawalResult(f, computed, request, { amount: tooMuch });
    const signature = await signActionResult(
      f.teeSigner,
      result.encoded,
      request.instructionId,
      "submit",
      SUCCESS,
    );
    await expect(
      f.gateway.finalizePrivateWithdrawal(
        result.encoded,
        request.instructionId,
        "submit",
        SUCCESS,
        signature,
      ),
    ).to.be.revertedWithCustomError(f.vault, "InsufficientEscrow");
  });

  it("rejects a result that expires before finalization", async function () {
    const { f, computed } = await activeFixture();
    const request = await requestWithdrawal(f);
    const result = await buildWithdrawalResult(f, computed, request, {
      validUntil: request.requestedAt + 1n,
    });
    await advance(2);
    const signature = await signActionResult(
      f.teeSigner,
      result.encoded,
      request.instructionId,
      "submit",
      SUCCESS,
    );
    await expect(
      f.gateway.finalizePrivateWithdrawal(
        result.encoded,
        request.instructionId,
        "submit",
        SUCCESS,
        signature,
      ),
    ).to.be.revertedWithCustomError(f.gateway, "ResultExpired");
  });

  it("allows a valid request made before cutoff to settle during the grace period", async function () {
    const { f, computed } = await activeFixture();
    const cutoff = Number(await f.vault.effectiveWithdrawalDeadline(1));
    await advance(cutoff - (await latestTimestamp()) - 60);
    const request = await requestWithdrawal(f);
    await advance(120);
    expect(await latestTimestamp()).to.be.greaterThan(cutoff);
    await finalizeWithdrawal(f, computed, request);
  });

  it("rejects a new request after the withdrawal cutoff", async function () {
    const { f } = await activeFixture();
    const cutoff = Number(await f.vault.effectiveWithdrawalDeadline(1));
    await advance(cutoff - (await latestTimestamp()) + 1);
    let failed = false;
    try {
      await requestWithdrawal(f);
    } catch {
      failed = true;
    }
    expect(failed).to.equal(true);
  });

  it("closes a TEE-declared failed withdrawal without changing escrow", async function () {
    const { f } = await activeFixture();
    const request = await requestWithdrawal(f);
    const beforeEscrow = await f.vault.totalEscrowed();
    const failure = await buildFailureResult(f, request, 1n, 2);
    const signature = await signActionResult(
      f.teeSigner,
      failure.encoded,
      request.instructionId,
      "failed",
      FAILURE,
    );
    await f.gateway.finalizeFailedRequest(
      failure.encoded,
      request.instructionId,
      "failed",
      FAILURE,
      signature,
    );
    expect(await f.vault.totalEscrowed()).to.equal(beforeEscrow);
    expect((await f.vault.getPayroll(1)).pendingWithdrawalRequests).to.equal(0n);
  });

  it("rolls back all state when an outgoing fee token underpays the recipient", async function () {
    const { f, computed } = await activeFixture({ feeToken: true });
    await f.token.setFee(await f.vault.getAddress(), 100);
    const request = await requestWithdrawal(f);
    const before = await f.vault.getPayroll(1);
    let failed = false;
    try {
      await finalizeWithdrawal(f, computed, request);
    } catch {
      failed = true;
    }
    expect(failed).to.equal(true);
    const after = await f.vault.getPayroll(1);
    expect(after.privateLedgerRoot).to.equal(before.privateLedgerRoot);
    expect(after.netWithdrawnAmount).to.equal(before.netWithdrawnAmount);
    expect(await f.token.balanceOf(f.recipient.address)).to.equal(0n);
  });
});
