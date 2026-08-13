import { expect } from "chai";
import { ethers } from "hardhat";
import {
  abi,
  activatePayroll,
  createComputedPayroll,
  createDraft,
  deploySystem,
  finalizeFailureFromContext,
  requestPayrollComputation,
  requestWithdrawal,
} from "./helpers/system";

describe("Failure context and withdrawal envelope V3", function () {
  const payrollFailures = [
    ["malformed ABI instruction", "MALFORMED_ABI_INSTRUCTION"],
    ["undecryptable ciphertext", "UNDECRYPTABLE_CIPHERTEXT"],
    ["malformed decrypted payroll JSON", "MALFORMED_PAYROLL_JSON"],
    ["processor rejection", "PROCESSOR_REJECTION"],
  ] as const;

  for (const [description, errorCode] of payrollFailures) {
    it(`immediately finalizes ${description} from public request context`, async function () {
      const f = await deploySystem();
      const draft = await createDraft(f);
      const before = await f.vault.getPayroll(draft.payrollId);
      const beforeEscrow = await f.vault.totalEscrowed();
      const beforeVaultBalance = await f.token.balanceOf(await f.vault.getAddress());
      const request = await requestPayrollComputation(f, draft, errorCode);

      const failure = await finalizeFailureFromContext(
        f,
        request.instructionId,
        errorCode,
      );

      expect(failure.context.requestType).to.equal(1n);
      expect(failure.context.payrollId).to.equal(draft.payrollId);
      expect(failure.context.ciphertextHash).to.equal(request.ciphertextHash);
      expect((await f.gateway.getRequestStatus(request.instructionId)).closed).to.equal(true);
      expect(await f.gateway.activePayrollInstruction(draft.payrollId)).to.equal(
        ethers.ZeroHash,
      );

      const after = await f.vault.getPayroll(draft.payrollId);
      expect(after.status).to.equal(1n);
      expect(after.privateLedgerRoot).to.equal(before.privateLedgerRoot);
      expect(after.fundedAmount).to.equal(before.fundedAmount);
      expect(after.netWithdrawnAmount).to.equal(before.netWithdrawnAmount);
      expect(await f.vault.totalEscrowed()).to.equal(beforeEscrow);
      expect(await f.token.balanceOf(await f.vault.getAddress())).to.equal(
        beforeVaultBalance,
      );
      await expect(f.gateway.expireStaleRequest(request.instructionId))
        .to.be.revertedWithCustomError(f.gateway, "ActionAlreadyClosed");

      const retry = await requestPayrollComputation(f, draft, `${errorCode}-retry`);
      expect(retry.instructionId).not.to.equal(request.instructionId);
    });
  }

  const withdrawalFailures = [
    ["malformed decrypted withdrawal JSON", "MALFORMED_WITHDRAWAL_JSON"],
    ["invalid withdrawal authentication signature", "INVALID_WITHDRAWAL_SIGNATURE"],
    ["unknown employee", "UNKNOWN_EMPLOYEE"],
    ["zero withdrawal amount", "ZERO_WITHDRAWAL_AMOUNT"],
    ["insufficient private balance", "INSUFFICIENT_PRIVATE_BALANCE"],
    ["stale private root", "STALE_PRIVATE_ROOT"],
  ] as const;

  for (const [description, errorCode] of withdrawalFailures) {
    it(`immediately finalizes ${description} from public request context`, async function () {
      const f = await deploySystem();
      const computed = await createComputedPayroll(f);
      await activatePayroll(f, computed);
      const before = await f.vault.getPayroll(computed.draft.payrollId);
      const beforeEscrow = await f.vault.totalEscrowed();
      const beforeVaultBalance = await f.token.balanceOf(await f.vault.getAddress());
      const request = await requestWithdrawal(
        f,
        computed.draft.payrollId,
        errorCode,
      );
      expect((await f.vault.getPayroll(computed.draft.payrollId)).pendingWithdrawalRequests)
        .to.equal(1n);

      const failure = await finalizeFailureFromContext(
        f,
        request.instructionId,
        errorCode,
      );

      expect(failure.context.requestType).to.equal(2n);
      expect(failure.context.payrollId).to.equal(computed.draft.payrollId);
      expect(failure.context.ciphertextHash).to.equal(request.ciphertextHash);
      expect((await f.gateway.getRequestStatus(request.instructionId)).closed).to.equal(true);
      expect(await f.gateway.activeWithdrawalInstruction(computed.draft.payrollId))
        .to.equal(ethers.ZeroHash);

      const after = await f.vault.getPayroll(computed.draft.payrollId);
      expect(after.pendingWithdrawalRequests).to.equal(0n);
      expect(after.privateLedgerRoot).to.equal(before.privateLedgerRoot);
      expect(after.fundedAmount).to.equal(before.fundedAmount);
      expect(after.netWithdrawnAmount).to.equal(before.netWithdrawnAmount);
      expect(await f.vault.totalEscrowed()).to.equal(beforeEscrow);
      expect(await f.token.balanceOf(await f.vault.getAddress())).to.equal(
        beforeVaultBalance,
      );
      await expect(f.gateway.expireStaleRequest(request.instructionId))
        .to.be.revertedWithCustomError(f.gateway, "ActionAlreadyClosed");

      const retry = await requestWithdrawal(
        f,
        computed.draft.payrollId,
        `${errorCode}-retry`,
      );
      expect(retry.instructionId).not.to.equal(request.instructionId);
    });
  }

  it("emits the expanded withdrawal envelope in the V3 domain and commitment", async function () {
    const f = await deploySystem();
    const computed = await createComputedPayroll(f);
    await activatePayroll(f, computed);
    const request = await requestWithdrawal(f, computed.draft.payrollId, "v3-envelope");
    const context = await f.gateway.getRequestFailureContext(request.instructionId);
    const events = await f.extensionRegistry.queryFilter(
      f.extensionRegistry.filters.MockInstructionSent(request.instructionId),
    );
    expect(events).to.have.length(1);

    const [envelope, ciphertext] = abi.decode(
      [
        "tuple(bytes32 domain,address gateway,address vault,uint256 chainId,uint256 extensionId,address selectedTeeId,uint64 teeSignerEpoch,uint256 payrollId,address institution,address stablecoin,uint8 stablecoinDecimals,bytes32 expectedLedgerRoot,bytes32 requestCommitment,bytes32 ciphertextHash)",
        "bytes",
      ],
      events[0].args.message,
    );
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const expectedCommitment = ethers.keccak256(
      abi.encode(
        [
          "uint256",
          "address",
          "address",
          "uint256",
          "address",
          "address",
          "uint8",
          "bytes32",
          "bytes32",
        ],
        [
          chainId,
          await f.gateway.getAddress(),
          await f.vault.getAddress(),
          computed.draft.payrollId,
          f.institution.address,
          await f.token.getAddress(),
          6,
          context.expectedLedgerRoot,
          request.ciphertextHash,
        ],
      ),
    );
    const v3Domain = ethers.keccak256(
      ethers.toUtf8Bytes("ZALARY_FCC_WITHDRAWAL_ENVELOPE_V3"),
    );
    const v2Domain = ethers.keccak256(
      ethers.toUtf8Bytes("ZALARY_FCC_WITHDRAWAL_ENVELOPE_V2"),
    );

    expect(envelope.domain).to.equal(v3Domain);
    expect(envelope.domain).not.to.equal(v2Domain);
    expect(envelope.gateway).to.equal(await f.gateway.getAddress());
    expect(envelope.vault).to.equal(await f.vault.getAddress());
    expect(envelope.chainId).to.equal(chainId);
    expect(envelope.extensionId).to.equal(context.requestExtensionId);
    expect(envelope.selectedTeeId).to.equal(context.selectedTeeId);
    expect(envelope.teeSignerEpoch).to.equal(context.teeSignerEpoch);
    expect(envelope.payrollId).to.equal(computed.draft.payrollId);
    expect(envelope.institution).to.equal(f.institution.address);
    expect(envelope.stablecoin).to.equal(await f.token.getAddress());
    expect(envelope.stablecoinDecimals).to.equal(6n);
    expect(envelope.expectedLedgerRoot).to.equal(context.expectedLedgerRoot);
    expect(envelope.requestCommitment).to.equal(expectedCommitment);
    expect(envelope.ciphertextHash).to.equal(request.ciphertextHash);
    expect(ethers.keccak256(ciphertext)).to.equal(request.ciphertextHash);
  });
});
