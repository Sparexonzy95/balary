import { expect } from "chai";
import { ethers } from "hardhat";
import {
  EXTENSION_ID,
  FAILURE,
  SUCCESS,
  advance,
  buildFailureResult,
  buildPayrollResult,
  createDraft,
  deploySystem,
  encodePayrollResult,
  finalizePayrollComputation,
  requestPayrollComputation,
  signActionResult,
} from "./helpers/system";

describe("Gateway and TEE result verification", function () {
  it("rejects payroll computation before extension configuration", async function () {
    const f = await deploySystem({ configureExtension: false, configureTee: false });
    const draft = await createDraft(f);
    await expect(
      f.gateway.connect(f.hr).requestPayrollComputation(draft.payrollId, ethers.toUtf8Bytes("x")),
    ).to.be.revertedWithCustomError(f.gateway, "ExtensionIdNotSet");
  });

  it("rejects a selected TEE with no active signer binding", async function () {
    const f = await deploySystem({ configureTee: false });
    const draft = await createDraft(f);
    await expect(
      f.gateway.connect(f.hr).requestPayrollComputation(draft.payrollId, ethers.toUtf8Bytes("x")),
    ).to.be.revertedWithCustomError(f.gateway, "TeeSignerNotConfigured");
  });

  it("rejects a zero TEE selection", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    await f.machineRegistry.setTeeId(ethers.ZeroAddress);
    await expect(
      f.gateway.connect(f.hr).requestPayrollComputation(draft.payrollId, ethers.toUtf8Bytes("x")),
    ).to.be.revertedWithCustomError(f.gateway, "InvalidTeeSelection");
  });

  it("rejects empty and oversized encrypted payroll payloads", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    await expect(f.gateway.connect(f.hr).requestPayrollComputation(draft.payrollId, "0x"))
      .to.be.revertedWithCustomError(f.gateway, "EmptyCiphertext");
    const oversized = `0x${"11".repeat(48_001)}`;
    await expect(f.gateway.connect(f.hr).requestPayrollComputation(draft.payrollId, oversized))
      .to.be.revertedWithCustomError(f.gateway, "PayloadTooLarge");
  });

  it("allows only institution HR or admin to request payroll computation", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    await expect(
      f.gateway.connect(f.finance).requestPayrollComputation(draft.payrollId, ethers.toUtf8Bytes("x")),
    ).to.be.revertedWithCustomError(f.gateway, "NotInstitutionHR");
    await expect(
      f.gateway.connect(f.institution).requestPayrollComputation(draft.payrollId, ethers.toUtf8Bytes("x")),
    ).not.to.be.reverted;
  });

  it("forwards the instruction fee to the Flare extension registry mock", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const fee = ethers.parseEther("0.01");
    await f.gateway.connect(f.hr).requestPayrollComputation(
      draft.payrollId,
      ethers.toUtf8Bytes("encrypted"),
      { value: fee },
    );
    expect(await ethers.provider.getBalance(await f.extensionRegistry.getAddress())).to.equal(fee);
  });

  it("records one active payroll instruction and blocks a second", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const request = await requestPayrollComputation(f, draft);
    expect(await f.gateway.activePayrollInstruction(draft.payrollId)).to.equal(request.instructionId);
    await expect(
      f.gateway.connect(f.hr).requestPayrollComputation(draft.payrollId, ethers.toUtf8Bytes("again")),
    ).to.be.revertedWithCustomError(f.gateway, "ActiveRequestExists");
  });

  it("rejects an invalid TEE signature", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const request = await requestPayrollComputation(f, draft);
    const result = await buildPayrollResult(f, draft, request);
    const attackerSigner = ethers.Wallet.createRandom();
    const signature = await signActionResult(
      attackerSigner,
      result.encoded,
      request.instructionId,
      "submit",
      SUCCESS,
    );
    await expect(
      f.gateway.finalizePayrollComputation(
        result.encoded,
        request.instructionId,
        "submit",
        SUCCESS,
        signature,
      ),
    ).to.be.revertedWithCustomError(f.gateway, "BadTeeSignature");
  });

  it("rejects the wrong action status", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const request = await requestPayrollComputation(f, draft);
    const result = await buildPayrollResult(f, draft, request);
    const signature = await signActionResult(
      f.teeSigner,
      result.encoded,
      request.instructionId,
      "submit",
      FAILURE,
    );
    await expect(
      f.gateway.finalizePayrollComputation(
        result.encoded,
        request.instructionId,
        "submit",
        FAILURE,
        signature,
      ),
    ).to.be.revertedWithCustomError(f.gateway, "InvalidActionStatus");
  });

  it("binds the signature to the submission tag", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const request = await requestPayrollComputation(f, draft);
    const result = await buildPayrollResult(f, draft, request);
    const signature = await signActionResult(
      f.teeSigner,
      result.encoded,
      request.instructionId,
      "original",
      SUCCESS,
    );
    await expect(
      f.gateway.finalizePayrollComputation(
        result.encoded,
        request.instructionId,
        "tampered",
        SUCCESS,
        signature,
      ),
    ).to.be.revertedWithCustomError(f.gateway, "BadTeeSignature");
  });

  type Fixture = Awaited<ReturnType<typeof deploySystem>>;
  type Draft = Awaited<ReturnType<typeof createDraft>>;
  type PayrollRequest = Awaited<ReturnType<typeof requestPayrollComputation>>;
  type PayrollMismatchCase = [
    string,
    (
      f: Fixture,
      draft: Draft,
      request: PayrollRequest,
    ) => Promise<Record<string, unknown>>,
  ];

  const payrollMismatchCases: PayrollMismatchCase[] = [
    ["domain", async () => ({ domain: ethers.ZeroHash })],
    ["gateway", async (_f) => ({ gateway: _f.attacker.address })],
    ["vault", async (f) => ({ vault: f.attacker.address })],
    ["chain id", async () => ({ chainId: 999n })],
    ["extension id", async () => ({ extensionId: EXTENSION_ID + 1n })],
    ["TEE id", async (f) => ({ selectedTeeId: f.attacker.address })],
    ["TEE epoch", async (_f, _d, request) => ({ teeSignerEpoch: request.teeSignerEpoch + 1n })],
    ["payroll id", async () => ({ payrollId: 999n })],
    ["institution", async (f) => ({ institution: f.attacker.address })],
    ["metadata", async () => ({ metadataHash: ethers.keccak256(ethers.toUtf8Bytes("wrong")) })],
    ["stablecoin", async (f) => ({ stablecoin: f.attacker.address })],
    ["decimals", async () => ({ stablecoinDecimals: 18 })],
    ["ciphertext hash", async () => ({ ciphertextHash: ethers.keccak256(ethers.toUtf8Bytes("wrong")) })],
    ["zero ledger root", async () => ({ privateLedgerRoot: ethers.ZeroHash })],
    ["zero employee count", async () => ({ employeeCount: 0n })],
    ["zero net total", async () => ({ employeeNetTotal: 0n })],
    ["inconsistent total", async () => ({ totalRequired: 123n })],
    ["requestedAt", async (_f, _d, request) => ({ requestedAt: request.requestedAt + 1n })],
  ];

  for (const [label, getOverrides] of payrollMismatchCases) {
    it(`rejects a payroll result with mismatched ${label}`, async function () {
      const f = await deploySystem();
      const draft = await createDraft(f);
      const request = await requestPayrollComputation(f, draft);
      const overrides = await getOverrides(f, draft, request);
      const result = await buildPayrollResult(f, draft, request, overrides);
      const signature = await signActionResult(
        f.teeSigner,
        result.encoded,
        request.instructionId,
        "submit",
        SUCCESS,
      );
      await expect(
        f.gateway.finalizePayrollComputation(
          result.encoded,
          request.instructionId,
          "submit",
          SUCCESS,
          signature,
        ),
      ).to.be.revertedWithCustomError(f.gateway, "InvalidResult");
    });
  }

  it("rejects employee counts above the vault maximum", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const request = await requestPayrollComputation(f, draft);
    const result = await buildPayrollResult(f, draft, request, {
      employeeCount: (1n << 32n),
    });
    const signature = await signActionResult(
      f.teeSigner,
      result.encoded,
      request.instructionId,
      "submit",
      SUCCESS,
    );
    await expect(
      f.gateway.finalizePayrollComputation(
        result.encoded,
        request.instructionId,
        "submit",
        SUCCESS,
        signature,
      ),
    ).to.be.revertedWithCustomError(f.vault, "InvalidCommitment");
  });

  it("rejects expired and excessively long-lived results", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const request = await requestPayrollComputation(f, draft);

    const expired = await buildPayrollResult(f, draft, request, {
      validUntil: request.requestedAt,
    });
    await advance(1);
    const expiredSig = await signActionResult(
      f.teeSigner,
      expired.encoded,
      request.instructionId,
      "submit",
      SUCCESS,
    );
    await expect(
      f.gateway.finalizePayrollComputation(
        expired.encoded,
        request.instructionId,
        "submit",
        SUCCESS,
        expiredSig,
      ),
    ).to.be.revertedWithCustomError(f.gateway, "ResultExpired");

    const tooLong = await buildPayrollResult(f, draft, request, {
      validUntil: request.requestedAt + 901n,
    });
    const tooLongSig = await signActionResult(
      f.teeSigner,
      tooLong.encoded,
      request.instructionId,
      "submit",
      SUCCESS,
    );
    await expect(
      f.gateway.finalizePayrollComputation(
        tooLong.encoded,
        request.instructionId,
        "submit",
        SUCCESS,
        tooLongSig,
      ),
    ).to.be.revertedWithCustomError(f.gateway, "ResultLifetimeTooLong");
  });

  it("finalizes a valid result, clears the active lane and blocks replay", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const request = await requestPayrollComputation(f, draft);
    const result = await finalizePayrollComputation(f, draft, request);
    expect(await f.gateway.activePayrollInstruction(draft.payrollId)).to.equal(ethers.ZeroHash);
    expect((await f.gateway.getRequestStatus(request.instructionId))[4]).to.equal(true);
    await expect(
      f.gateway.finalizePayrollComputation(
        result.encoded,
        request.instructionId,
        "submit",
        SUCCESS,
        result.signature,
      ),
    ).to.be.revertedWithCustomError(f.gateway, "ActionAlreadyClosed");
  });

  it("lets a TEE-signed payroll failure reset the payroll to Draft", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const request = await requestPayrollComputation(f, draft);
    const failure = await buildFailureResult(f, request, draft.payrollId, 1);
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
    const payroll = await f.vault.getPayroll(draft.payrollId);
    expect(payroll.status).to.equal(1);
    expect(payroll.ciphertextHash).to.equal(ethers.ZeroHash);
    expect(await f.gateway.activePayrollInstruction(draft.payrollId)).to.equal(ethers.ZeroHash);
  });

  it("does not allow stale request expiry before the TTL", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const request = await requestPayrollComputation(f, draft);
    await expect(f.gateway.expireStaleRequest(request.instructionId))
      .to.be.revertedWithCustomError(f.gateway, "RequestNotStale");
  });

  it("expires a stale payroll request and resets the vault state", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const request = await requestPayrollComputation(f, draft);
    await advance(901);
    await f.gateway.expireStaleRequest(request.instructionId);
    expect((await f.vault.getPayroll(draft.payrollId)).status).to.equal(1);
  });

  it("invalidates an open request when the extension sender changes", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const request = await requestPayrollComputation(f, draft);
    const result = await buildPayrollResult(f, draft, request);
    const signature = await signActionResult(
      f.teeSigner,
      result.encoded,
      request.instructionId,
      "submit",
      SUCCESS,
    );
    await f.extensionRegistry.setInstructionSender(f.attacker.address);
    await expect(
      f.gateway.finalizePayrollComputation(
        result.encoded,
        request.instructionId,
        "submit",
        SUCCESS,
        signature,
      ),
    ).to.be.revertedWithCustomError(f.gateway, "ExtensionSenderMismatch");
  });

  it("invalidates open requests after TEE revocation", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const request = await requestPayrollComputation(f, draft);
    const result = await buildPayrollResult(f, draft, request);
    const signature = await signActionResult(
      f.teeSigner,
      result.encoded,
      request.instructionId,
      "submit",
      SUCCESS,
    );
    await f.gateway.revokeTeeSigner(f.teeId.address);
    await expect(
      f.gateway.finalizePayrollComputation(
        result.encoded,
        request.instructionId,
        "submit",
        SUCCESS,
        signature,
      ),
    ).to.be.revertedWithCustomError(f.gateway, "TeeBindingChanged");
  });

  it("blocks new payroll requests while paused but permits finalization", async function () {
    const f = await deploySystem();
    const draft = await createDraft(f);
    const request = await requestPayrollComputation(f, draft);
    const result = await buildPayrollResult(f, draft, request);
    const signature = await signActionResult(
      f.teeSigner,
      result.encoded,
      request.instructionId,
      "submit",
      SUCCESS,
    );
    await f.gateway.pause();
    await f.gateway.finalizePayrollComputation(
      result.encoded,
      request.instructionId,
      "submit",
      SUCCESS,
      signature,
    );
    await f.gateway.unpause();
    await createDraft(f, 2n);
    await f.gateway.pause();
    await expect(
      f.gateway.connect(f.hr).requestPayrollComputation(2, ethers.toUtf8Bytes("blocked")),
    ).to.be.reverted;
  });
});
