import { expect } from "chai";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { HDNodeWallet, Signer } from "ethers";
import { ethers } from "hardhat";
import type {
  MockERC20,
  MockFeeToken,
  MockTeeExtensionRegistry,
  MockTeeMachineRegistry,
  ZalaryConfidentialGateway,
  ZalaryPrivatePayrollVault,
} from "../typechain-types";

const abi = ethers.AbiCoder.defaultAbiCoder();
const TEE_PREFIX = ethers.encodeBytes32String("TEE_ACTION_RESULT");
const EXTENSION_ID = 0x10000n;
const SUCCESS = 1;
const FAILURE = 0;

async function advance(seconds: number): Promise<void> {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

async function now(): Promise<number> {
  return (await ethers.provider.getBlock("latest"))!.timestamp;
}

async function signActionResult(
  teeSigner: Signer,
  resultData: string,
  actionId: string,
  submissionTag: string,
  status: number,
  chainId: bigint,
): Promise<string> {
  const resultHash = ethers.keccak256(
    ethers.solidityPacked(
      ["bytes32", "bytes32", "bytes32", "uint8"],
      [
        ethers.keccak256(resultData),
        actionId,
        ethers.keccak256(ethers.toUtf8Bytes(submissionTag)),
        status,
      ],
    ),
  );
  const payloadHash = ethers.keccak256(
    abi.encode(["bytes32", "uint256", "bytes32"], [TEE_PREFIX, chainId, resultHash]),
  );
  return teeSigner.signMessage(ethers.getBytes(payloadHash));
}

function encodePayrollResult(result: Record<string, unknown>): string {
  return abi.encode(
    [
      "tuple(bytes32 domain,address gateway,address vault,uint256 chainId,uint256 extensionId,address selectedTeeId,uint64 teeSignerEpoch,uint256 payrollId,address institution,bytes32 metadataHash,address stablecoin,uint8 stablecoinDecimals,bytes32 ciphertextHash,bytes32 privateLedgerRoot,uint256 employeeCount,uint256 employeeNetTotal,uint256 aggregateTaxTotal,uint256 totalRequired,uint64 requestedAt,uint64 validUntil)",
    ],
    [result],
  );
}

function encodeWithdrawalResult(result: Record<string, unknown>): string {
  return abi.encode(
    [
      "tuple(bytes32 domain,address gateway,address vault,uint256 chainId,uint256 extensionId,address selectedTeeId,uint64 teeSignerEpoch,uint256 payrollId,address institution,address stablecoin,uint8 stablecoinDecimals,bytes32 ciphertextHash,bytes32 oldLedgerRoot,bytes32 newLedgerRoot,address destination,uint256 amount,bytes32 withdrawalNullifier,uint64 requestedAt,uint64 validUntil)",
    ],
    [result],
  );
}

function encodeFailureResult(result: Record<string, unknown>): string {
  return abi.encode(
    [
      "tuple(bytes32 domain,address gateway,address vault,uint256 chainId,uint256 extensionId,address selectedTeeId,uint64 teeSignerEpoch,uint8 requestType,uint256 payrollId,bytes32 ciphertextHash,bytes32 errorCodeHash,uint64 requestedAt,uint64 validUntil)",
    ],
    [result],
  );
}

describe("Zalary confidential payroll v3", function () {
  type FixtureToken<TFeeToken extends boolean> =
    TFeeToken extends true ? MockFeeToken : MockERC20;

  type Fixture<TToken extends MockERC20 | MockFeeToken = MockERC20 | MockFeeToken> = {
    admin: HardhatEthersSigner;
    relayer: HardhatEthersSigner;
    institution: HardhatEthersSigner;
    hr: HardhatEthersSigner;
    finance: HardhatEthersSigner;
    employee: HardhatEthersSigner;
    attacker: HardhatEthersSigner;
    treasury: HardhatEthersSigner;
    taxVault: HardhatEthersSigner;
    teeId: HardhatEthersSigner;
    recipient: HardhatEthersSigner;
    recoveryAdmin: HardhatEthersSigner;
    teeSigner: HDNodeWallet;
    token: TToken;
    vault: ZalaryPrivatePayrollVault;
    gateway: ZalaryConfidentialGateway;
    extensionRegistry: MockTeeExtensionRegistry;
    machineRegistry: MockTeeMachineRegistry;
  };

  async function deployFixture<TFeeToken extends boolean = false>(
    useFeeToken: TFeeToken = false as TFeeToken,
  ): Promise<Fixture<FixtureToken<TFeeToken>>> {
    const [
      admin,
      relayer,
      institution,
      hr,
      finance,
      employee,
      attacker,
      treasury,
      taxVault,
      teeId,
      recipient,
      recoveryAdmin,
    ] = await ethers.getSigners();
    const teeSigner = ethers.Wallet.createRandom();

    const token = (
      useFeeToken
        ? await (await ethers.getContractFactory("MockFeeToken")).deploy(
            "Mock USDT0",
            "mUSDT0",
            6,
          )
        : await (await ethers.getContractFactory("MockERC20")).deploy(
            "Mock USDT0",
            "mUSDT0",
            6,
          )
    ) as FixtureToken<TFeeToken>;

    const Vault = await ethers.getContractFactory("ZalaryPrivatePayrollVault");
    const vault = await Vault.deploy(admin.address, await token.getAddress(), 1_000_000n);

    const ExtensionRegistry = await ethers.getContractFactory("MockTeeExtensionRegistry");
    const extensionRegistry = await ExtensionRegistry.deploy();
    const MachineRegistry = await ethers.getContractFactory("MockTeeMachineRegistry");
    const machineRegistry = await MachineRegistry.deploy(teeId.address);

    const Gateway = await ethers.getContractFactory("ZalaryConfidentialGateway");
    const gateway = await Gateway.deploy(
      admin.address,
      relayer.address,
      await extensionRegistry.getAddress(),
      await machineRegistry.getAddress(),
      await vault.getAddress(),
    );

    await extensionRegistry.setInstructionSender(await gateway.getAddress());
    await gateway.setExtensionId(EXTENSION_ID);
    await gateway.proposeTeeSigner(teeId.address, teeSigner.address);
    await advance(3601);
    await gateway.activateTeeSigner(teeId.address);
    await vault.setConfidentialGateway(await gateway.getAddress());

    await vault.adminRegisterInstitution(
      institution.address,
      institution.address,
      treasury.address,
      taxVault.address,
    );
    await vault.connect(institution).setInstitutionHR(institution.address, hr.address, true);
    await vault.connect(institution).setInstitutionFinance(institution.address, finance.address, true);

    return {
      admin,
      relayer,
      institution,
      hr,
      finance,
      employee,
      attacker,
      treasury,
      taxVault,
      teeId,
      recipient,
      recoveryAdmin,
      teeSigner,
      token,
      vault,
      gateway,
      extensionRegistry,
      machineRegistry,
    };
  }

  async function createComputedPayroll(f: Awaited<ReturnType<typeof deployFixture>>, payrollId = 1n) {
    const createdAt = await now();
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(`payroll-${payrollId}`));
    await f.vault.connect(f.hr).createPayrollDraft(
      payrollId,
      f.institution.address,
      metadataHash,
      createdAt,
      createdAt + 2 * 24 * 3600,
      24 * 3600,
      3600,
    );

    const encryptedPayroll = ethers.toUtf8Bytes(`encrypted-payroll-${payrollId}`);
    const instructionId = await f.gateway
      .connect(f.hr)
      .requestPayrollComputation.staticCall(payrollId, encryptedPayroll);
    await f.gateway.connect(f.hr).requestPayrollComputation(payrollId, encryptedPayroll);

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const status = await f.gateway.getRequestStatus(instructionId);
    const selectedTeeId = status[1];
    const teeSignerEpoch = status[2];
    const requestedAt = status[3];
    const employeeNetTotal = 2_000_000_000n;
    const aggregateTaxTotal = 200_000_000n;
    const totalRequired = employeeNetTotal + aggregateTaxTotal;
    const ledgerRoot = ethers.keccak256(ethers.toUtf8Bytes(`ledger-${payrollId}-0`));

    const resultData = encodePayrollResult({
      domain: await f.gateway.PAYROLL_RESULT_DOMAIN(),
      gateway: await f.gateway.getAddress(),
      vault: await f.vault.getAddress(),
      chainId,
      extensionId: EXTENSION_ID,
      selectedTeeId,
      teeSignerEpoch,
      payrollId,
      institution: f.institution.address,
      metadataHash,
      stablecoin: await f.token.getAddress(),
      stablecoinDecimals: 6,
      ciphertextHash: ethers.keccak256(encryptedPayroll),
      privateLedgerRoot: ledgerRoot,
      employeeCount: 2n,
      employeeNetTotal,
      aggregateTaxTotal,
      totalRequired,
      requestedAt,
      validUntil: requestedAt + 600n,
    });
    const signature = await signActionResult(
      f.teeSigner,
      resultData,
      instructionId,
      "submit",
      SUCCESS,
      chainId,
    );
    await f.gateway.finalizePayrollComputation(
      resultData,
      instructionId,
      "submit",
      SUCCESS,
      signature,
    );

    return {
      payrollId,
      metadataHash,
      employeeNetTotal,
      aggregateTaxTotal,
      totalRequired,
      ledgerRoot,
    };
  }

  async function activatePayroll(
    f: Awaited<ReturnType<typeof deployFixture>>,
    payroll: Awaited<ReturnType<typeof createComputedPayroll>>,
  ) {
    await f.vault.connect(f.hr).openFunding(payroll.payrollId);
    await f.token.mint(f.finance.address, payroll.totalRequired);
    await f.token.connect(f.finance).approve(await f.vault.getAddress(), payroll.totalRequired);
    await f.vault.connect(f.finance).fundPayroll(payroll.payrollId, payroll.totalRequired);
  }

  async function requestWithdrawal(
    f: Awaited<ReturnType<typeof deployFixture>>,
    payrollId: bigint,
    label = "withdrawal",
  ) {
    const ciphertext = ethers.toUtf8Bytes(label);
    const instructionId = await f.gateway
      .connect(f.relayer)
      .requestPrivateWithdrawal.staticCall(payrollId, ciphertext);
    await f.gateway.connect(f.relayer).requestPrivateWithdrawal(payrollId, ciphertext);
    const status = await f.gateway.getRequestStatus(instructionId);
    return {
      ciphertext,
      instructionId,
      selectedTeeId: status[1],
      teeSignerEpoch: status[2],
      requestedAt: status[3],
    };
  }

  async function finalizeWithdrawal(
    f: Awaited<ReturnType<typeof deployFixture>>,
    payroll: Awaited<ReturnType<typeof createComputedPayroll>>,
    request: Awaited<ReturnType<typeof requestWithdrawal>>,
    amount = 600_000_000n,
    recipient = f.recipient.address,
    oldRoot = payroll.ledgerRoot,
    nextRootLabel = "ledger-next",
  ) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const nextRoot = ethers.keccak256(ethers.toUtf8Bytes(nextRootLabel));
    const nullifier = ethers.keccak256(
      ethers.toUtf8Bytes(`nullifier-${request.instructionId}`),
    );
    const resultData = encodeWithdrawalResult({
      domain: await f.gateway.WITHDRAWAL_RESULT_DOMAIN(),
      gateway: await f.gateway.getAddress(),
      vault: await f.vault.getAddress(),
      chainId,
      extensionId: EXTENSION_ID,
      selectedTeeId: request.selectedTeeId,
      teeSignerEpoch: request.teeSignerEpoch,
      payrollId: payroll.payrollId,
      institution: f.institution.address,
      stablecoin: await f.token.getAddress(),
      stablecoinDecimals: 6,
      ciphertextHash: ethers.keccak256(request.ciphertext),
      oldLedgerRoot: oldRoot,
      newLedgerRoot: nextRoot,
      destination: recipient,
      amount,
      withdrawalNullifier: nullifier,
      requestedAt: request.requestedAt,
      validUntil: request.requestedAt + 840n,
    });
    const signature = await signActionResult(
      f.teeSigner,
      resultData,
      request.instructionId,
      "submit",
      SUCCESS,
      chainId,
    );
    await f.gateway.finalizePrivateWithdrawal(
      resultData,
      request.instructionId,
      "submit",
      SUCCESS,
      signature,
    );
    return { nextRoot, nullifier, resultData, signature };
  }

  it("runs the complete confidential payroll and private withdrawal flow", async function () {
    const f = await deployFixture();
    const payroll = await createComputedPayroll(f);
    await activatePayroll(f, payroll);

    expect((await f.vault.getPayroll(1)).status).to.equal(5);
    expect(await f.token.balanceOf(f.taxVault.address)).to.equal(payroll.aggregateTaxTotal);
    expect(await f.vault.totalEscrowed()).to.equal(payroll.employeeNetTotal);

    const request = await requestWithdrawal(f, 1n);
    await finalizeWithdrawal(f, payroll, request);

    expect(await f.token.balanceOf(f.recipient.address)).to.equal(600_000_000n);
    expect((await f.vault.getPayroll(1)).pendingWithdrawalRequests).to.equal(0n);
  });

  it("blocks public withdrawal-lane spam and permits only approved relayers", async function () {
    const f = await deployFixture();
    const payroll = await createComputedPayroll(f);
    await activatePayroll(f, payroll);

    await expect(
      f.gateway.connect(f.attacker).requestPrivateWithdrawal(1, ethers.toUtf8Bytes("junk")),
    ).to.be.reverted;

    await expect(
      f.gateway.connect(f.relayer).requestPrivateWithdrawal(1, ethers.toUtf8Bytes("valid")),
    ).not.to.be.reverted;
  });

  it("closes a TEE-declared failed request immediately and permits a retry", async function () {
    const f = await deployFixture();
    const payroll = await createComputedPayroll(f);
    await activatePayroll(f, payroll);
    const request = await requestWithdrawal(f, 1n, "bad-private-request");
    const chainId = (await ethers.provider.getNetwork()).chainId;

    const failureData = encodeFailureResult({
      domain: await f.gateway.FAILURE_RESULT_DOMAIN(),
      gateway: await f.gateway.getAddress(),
      vault: await f.vault.getAddress(),
      chainId,
      extensionId: EXTENSION_ID,
      selectedTeeId: request.selectedTeeId,
      teeSignerEpoch: request.teeSignerEpoch,
      requestType: 2,
      payrollId: 1n,
      ciphertextHash: ethers.keccak256(request.ciphertext),
      errorCodeHash: ethers.keccak256(ethers.toUtf8Bytes("INVALID_EMPLOYEE_SIGNATURE")),
      requestedAt: request.requestedAt,
      validUntil: request.requestedAt + 600n,
    });
    const signature = await signActionResult(
      f.teeSigner,
      failureData,
      request.instructionId,
      "failed",
      FAILURE,
      chainId,
    );

    await f.gateway.finalizeFailedRequest(
      failureData,
      request.instructionId,
      "failed",
      FAILURE,
      signature,
    );

    expect(await f.gateway.activeWithdrawalInstruction(1)).to.equal(ethers.ZeroHash);
    expect((await f.vault.getPayroll(1)).pendingWithdrawalRequests).to.equal(0n);
    await requestWithdrawal(f, 1n, "retry");
  });

  it("expires stale requests after fifteen minutes instead of one day", async function () {
    const f = await deployFixture();
    const payroll = await createComputedPayroll(f);
    await activatePayroll(f, payroll);
    const request = await requestWithdrawal(f, 1n, "stale");

    await advance(15 * 60 + 1);
    await f.gateway.expireStaleRequest(request.instructionId);

    expect(await f.gateway.activeWithdrawalInstruction(1)).to.equal(ethers.ZeroHash);
    expect((await f.vault.getPayroll(1)).pendingWithdrawalRequests).to.equal(0n);
  });

  it("creates a fresh employee withdrawal window even when funded near the funding deadline", async function () {
    const f = await deployFixture();
    const payroll = await createComputedPayroll(f);
    await f.vault.connect(f.hr).openFunding(1);

    const before = await f.vault.getPayroll(1);
    const fundingDeadline = Number(await f.vault.effectiveFundingDeadline(1));
    const current = await now();
    await advance(fundingDeadline - current - 5);

    await f.token.mint(f.finance.address, payroll.totalRequired);
    await f.token.connect(f.finance).approve(await f.vault.getAddress(), payroll.totalRequired);
    await f.vault.connect(f.finance).fundPayroll(1, payroll.totalRequired);

    const active = await f.vault.getPayroll(1);
    expect(active.activatedAt).to.be.greaterThan(0n);
    expect(active.withdrawalDeadline - active.activatedAt).to.equal(before.minimumWithdrawalWindow);
  });

  it("extends employee deadlines when the vault is paused and still permits withdrawal finalization", async function () {
    const f = await deployFixture();
    const payroll = await createComputedPayroll(f);
    await activatePayroll(f, payroll);
    const originalDeadline = await f.vault.effectiveWithdrawalDeadline(1);

    await f.vault.pause();
    await f.gateway.pause();
    await advance(2 * 3600);
    await f.vault.unpause();

    const extendedDeadline = await f.vault.effectiveWithdrawalDeadline(1);
    const pauseExtension = extendedDeadline - originalDeadline;
    expect(pauseExtension).to.be.gte(7200n);
    expect(pauseExtension).to.be.lte(7205n);

    // Gateway pause blocks new payroll work, but never blocks employee withdrawal requests.
    const request = await requestWithdrawal(f, 1n, "during-extended-window");
    await finalizeWithdrawal(f, payroll, request);
    await f.gateway.unpause();
  });

  it("allows an on-time request to settle during the grace period", async function () {
    const f = await deployFixture();
    const payroll = await createComputedPayroll(f);
    await activatePayroll(f, payroll);

    const cutoff = Number(await f.vault.effectiveWithdrawalDeadline(1));
    await advance(cutoff - (await now()) - 5 * 60);
    const request = await requestWithdrawal(f, 1n, "grace-period");
    await advance(10 * 60);

    expect(await now()).to.be.greaterThan(cutoff);
    await finalizeWithdrawal(f, payroll, request);
  });

  it("prevents employer closure while a withdrawal request is pending", async function () {
    const f = await deployFixture();
    const payroll = await createComputedPayroll(f);
    await activatePayroll(f, payroll);
    const request = await requestWithdrawal(f, 1n, "pending-at-close");

    const settlement = Number(await f.vault.effectiveSettlementDeadline(1));
    await advance(settlement - (await now()) + 1);

    await expect(f.vault.connect(f.finance).closeExpiredPayroll(1)).to.be.revertedWithCustomError(
      f.vault,
      "PendingWithdrawalExists",
    );

    await f.gateway.expireStaleRequest(request.instructionId);
    await f.vault.connect(f.finance).closeExpiredPayroll(1);
    expect((await f.vault.getPayroll(1)).status).to.equal(6);
    expect(await f.vault.payrollEscrowRemaining(1)).to.equal(0n);
  });

  it("invalidates open requests when a TEE signer binding is rotated", async function () {
    const f = await deployFixture();
    const payroll = await createComputedPayroll(f);
    await activatePayroll(f, payroll);
    const request = await requestWithdrawal(f, 1n, "old-signer-request");
    const replacement = ethers.Wallet.createRandom();

    await f.gateway.proposeTeeSigner(f.teeId.address, replacement.address);
    await advance(3601);
    await f.gateway.activateTeeSigner(f.teeId.address);

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const resultData = encodeWithdrawalResult({
      domain: await f.gateway.WITHDRAWAL_RESULT_DOMAIN(),
      gateway: await f.gateway.getAddress(),
      vault: await f.vault.getAddress(),
      chainId,
      extensionId: EXTENSION_ID,
      selectedTeeId: request.selectedTeeId,
      teeSignerEpoch: request.teeSignerEpoch,
      payrollId: 1n,
      institution: f.institution.address,
      stablecoin: await f.token.getAddress(),
      stablecoinDecimals: 6,
      ciphertextHash: ethers.keccak256(request.ciphertext),
      oldLedgerRoot: payroll.ledgerRoot,
      newLedgerRoot: ethers.keccak256(ethers.toUtf8Bytes("rotated-root")),
      destination: f.recipient.address,
      amount: 600_000_000n,
      withdrawalNullifier: ethers.keccak256(ethers.toUtf8Bytes("rotated-nullifier")),
      requestedAt: request.requestedAt,
      validUntil: request.requestedAt + 600n,
    });
    const oldSignature = await signActionResult(
      f.teeSigner,
      resultData,
      request.instructionId,
      "submit",
      SUCCESS,
      chainId,
    );

    await expect(
      f.gateway.finalizePrivateWithdrawal(
        resultData,
        request.instructionId,
        "submit",
        SUCCESS,
        oldSignature,
      ),
    ).to.be.revertedWithCustomError(f.gateway, "TeeBindingChanged");
  });

  it("rejects replayed actions and stale private-ledger roots", async function () {
    const f = await deployFixture();
    const payroll = await createComputedPayroll(f);
    await activatePayroll(f, payroll);

    const first = await requestWithdrawal(f, 1n, "first-root-transition");
    const finalized = await finalizeWithdrawal(f, payroll, first);

    await expect(
      f.gateway.finalizePrivateWithdrawal(
        finalized.resultData,
        first.instructionId,
        "submit",
        SUCCESS,
        finalized.signature,
      ),
    ).to.be.revertedWithCustomError(f.gateway, "ActionAlreadyClosed");

    const second = await requestWithdrawal(f, 1n, "stale-root-transition");
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const staleData = encodeWithdrawalResult({
      domain: await f.gateway.WITHDRAWAL_RESULT_DOMAIN(),
      gateway: await f.gateway.getAddress(),
      vault: await f.vault.getAddress(),
      chainId,
      extensionId: EXTENSION_ID,
      selectedTeeId: second.selectedTeeId,
      teeSignerEpoch: second.teeSignerEpoch,
      payrollId: 1n,
      institution: f.institution.address,
      stablecoin: await f.token.getAddress(),
      stablecoinDecimals: 6,
      ciphertextHash: ethers.keccak256(second.ciphertext),
      oldLedgerRoot: payroll.ledgerRoot,
      newLedgerRoot: ethers.keccak256(ethers.toUtf8Bytes("bad-next-root")),
      destination: f.recipient.address,
      amount: 100_000_000n,
      withdrawalNullifier: ethers.keccak256(ethers.toUtf8Bytes("stale-nullifier")),
      requestedAt: second.requestedAt,
      validUntil: second.requestedAt + 840n,
    });
    const staleSignature = await signActionResult(
      f.teeSigner,
      staleData,
      second.instructionId,
      "submit",
      SUCCESS,
      chainId,
    );

    await expect(
      f.gateway.finalizePrivateWithdrawal(
        staleData,
        second.instructionId,
        "submit",
        SUCCESS,
        staleSignature,
      ),
    ).to.be.revertedWithCustomError(f.gateway, "InvalidResult");
  });

  it("prevents removal of the final institution admin and supports delayed recovery", async function () {
    const f = await deployFixture();

    await expect(
      f.vault.connect(f.institution).setInstitutionAdmin(
        f.institution.address,
        f.institution.address,
        false,
      ),
    ).to.be.revertedWithCustomError(f.vault, "LastInstitutionAdmin");

    await f.vault.proposeInstitutionAdminRecovery(
      f.institution.address,
      f.recoveryAdmin.address,
    );
    await expect(
      f.vault.executeInstitutionAdminRecovery(f.institution.address),
    ).to.be.revertedWithCustomError(f.vault, "AdminRecoveryNotReady");
    await advance(2 * 24 * 3600 + 1);
    await f.vault.executeInstitutionAdminRecovery(f.institution.address);
    expect(
      await f.vault.institutionAdmins(f.institution.address, f.recoveryAdmin.address),
    ).to.equal(true);
  });

  it("rejects a stablecoin that deducts an outgoing transfer fee", async function () {
    const f = await deployFixture(true);
    const payroll = await createComputedPayroll(f);
    await activatePayroll(f, payroll);
    await f.token.setFee(await f.vault.getAddress(), 100);
    const request = await requestWithdrawal(f, 1n, "fee-token-withdrawal");

    let reverted = false;
    try {
      await finalizeWithdrawal(f, payroll, request);
    } catch {
      reverted = true;
    }
    expect(reverted).to.equal(true);
    expect(await f.token.balanceOf(f.recipient.address)).to.equal(0n);
    expect((await f.vault.getPayroll(1)).netWithdrawnAmount).to.equal(0n);
  });
});
