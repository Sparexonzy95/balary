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
} from "../../typechain-types";

export const abi = ethers.AbiCoder.defaultAbiCoder();
export const TEE_PREFIX = ethers.encodeBytes32String("TEE_ACTION_RESULT");
export const EXTENSION_ID = 0x10000n;
export const SUCCESS = 1;
export const FAILURE = 0;
export const ONE_USDT = 1_000_000n;

export async function advance(seconds: number): Promise<void> {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

export async function latestTimestamp(): Promise<number> {
  return (await ethers.provider.getBlock("latest"))!.timestamp;
}

export async function setBalance(address: string, wei: bigint): Promise<void> {
  await ethers.provider.send("hardhat_setBalance", [address, ethers.toBeHex(wei)]);
}

export async function signActionResult(
  teeSigner: Signer,
  resultData: string,
  actionId: string,
  submissionTag: string,
  status: number,
  chainId?: bigint,
): Promise<string> {
  const networkChainId = chainId ?? (await ethers.provider.getNetwork()).chainId;
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
    abi.encode(["bytes32", "uint256", "bytes32"], [TEE_PREFIX, networkChainId, resultHash]),
  );
  return teeSigner.signMessage(ethers.getBytes(payloadHash));
}

export function encodePayrollResult(result: Record<string, unknown>): string {
  return abi.encode(
    [
      "tuple(bytes32 domain,address gateway,address vault,uint256 chainId,uint256 extensionId,address selectedTeeId,uint64 teeSignerEpoch,uint256 payrollId,address institution,bytes32 metadataHash,address stablecoin,uint8 stablecoinDecimals,bytes32 ciphertextHash,bytes32 privateLedgerRoot,uint256 employeeCount,uint256 employeeNetTotal,uint256 aggregateTaxTotal,uint256 totalRequired,uint64 requestedAt,uint64 validUntil)",
    ],
    [result],
  );
}

export function encodeWithdrawalResult(result: Record<string, unknown>): string {
  return abi.encode(
    [
      "tuple(bytes32 domain,address gateway,address vault,uint256 chainId,uint256 extensionId,address selectedTeeId,uint64 teeSignerEpoch,uint256 payrollId,address institution,address stablecoin,uint8 stablecoinDecimals,bytes32 ciphertextHash,bytes32 oldLedgerRoot,bytes32 newLedgerRoot,address destination,uint256 amount,bytes32 withdrawalNullifier,uint64 requestedAt,uint64 validUntil)",
    ],
    [result],
  );
}

export function encodeFailureResult(result: Record<string, unknown>): string {
  return abi.encode(
    [
      "tuple(bytes32 domain,address gateway,address vault,uint256 chainId,uint256 extensionId,address selectedTeeId,uint64 teeSignerEpoch,uint8 requestType,uint256 payrollId,bytes32 ciphertextHash,bytes32 errorCodeHash,uint64 requestedAt,uint64 validUntil)",
    ],
    [result],
  );
}

export type SystemOptions = {
  feeToken?: boolean;
  tokenDecimals?: number;
  configureExtension?: boolean;
  configureTee?: boolean;
  connectGateway?: boolean;
  registerInstitution?: boolean;
};

type FixtureToken<TOptions extends SystemOptions> =
  TOptions extends { feeToken: true } ? MockFeeToken : MockERC20;

export type SystemFixture<
  TToken extends MockERC20 | MockFeeToken = MockERC20 | MockFeeToken,
> = {
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
  secondAdmin: HardhatEthersSigner;
  extra: HardhatEthersSigner;
  teeSigner: HDNodeWallet;
  token: TToken;
  vault: ZalaryPrivatePayrollVault;
  gateway: ZalaryConfidentialGateway;
  extensionRegistry: MockTeeExtensionRegistry;
  machineRegistry: MockTeeMachineRegistry;
};

export async function deploySystem<
  const TOptions extends SystemOptions = Record<never, never>,
>(
  options: TOptions = {} as TOptions,
): Promise<SystemFixture<FixtureToken<TOptions>>> {
  const {
    feeToken = false,
    tokenDecimals = 6,
    configureExtension = true,
    configureTee = true,
    connectGateway = true,
    registerInstitution = true,
  } = options;

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
    secondAdmin,
    extra,
  ] = await ethers.getSigners();
  const teeSigner = ethers.Wallet.createRandom();

  const token = (
    feeToken
      ? await (await ethers.getContractFactory("MockFeeToken")).deploy(
          "Mock USDT0",
          "mUSDT0",
          tokenDecimals,
        )
      : await (await ethers.getContractFactory("MockERC20")).deploy(
          "Mock USDT0",
          "mUSDT0",
          tokenDecimals,
        )
  ) as FixtureToken<TOptions>;

  const Vault = await ethers.getContractFactory("ZalaryPrivatePayrollVault");
  const vault = await Vault.deploy(admin.address, await token.getAddress(), ONE_USDT);

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

  if (configureExtension) {
    await extensionRegistry.setInstructionSender(await gateway.getAddress());
    await gateway.setExtensionId(EXTENSION_ID);
  }

  if (configureTee) {
    if (!configureExtension) throw new Error("configureTee requires configureExtension");
    await gateway.proposeTeeSigner(teeId.address, teeSigner.address);
    await advance(3601);
    await gateway.activateTeeSigner(teeId.address);
  }

  if (connectGateway) {
    await vault.setConfidentialGateway(await gateway.getAddress());
  }

  if (registerInstitution) {
    await vault.adminRegisterInstitution(
      institution.address,
      institution.address,
      treasury.address,
      taxVault.address,
    );
    await vault.connect(institution).setInstitutionHR(institution.address, hr.address, true);
    await vault.connect(institution).setInstitutionFinance(institution.address, finance.address, true);
  }

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
    secondAdmin,
    extra,
    teeSigner,
    token,
    vault,
    gateway,
    extensionRegistry,
    machineRegistry,
  };
}

export async function createDraft(
  f: Awaited<ReturnType<typeof deploySystem>>,
  payrollId = 1n,
  overrides: Partial<{
    metadataHash: string;
    fundingStartsAt: number;
    fundingDeadline: number;
    minimumWithdrawalWindow: number;
    settlementGracePeriod: number;
  }> = {},
) {
  const timestamp = await latestTimestamp();
  const metadataHash =
    overrides.metadataHash ?? ethers.keccak256(ethers.toUtf8Bytes(`payroll-${payrollId}`));
  const fundingStartsAt = overrides.fundingStartsAt ?? timestamp;
  const fundingDeadline = overrides.fundingDeadline ?? timestamp + 2 * 24 * 3600;
  const minimumWithdrawalWindow = overrides.minimumWithdrawalWindow ?? 24 * 3600;
  const settlementGracePeriod = overrides.settlementGracePeriod ?? 3600;

  await f.vault.connect(f.hr).createPayrollDraft(
    payrollId,
    f.institution.address,
    metadataHash,
    fundingStartsAt,
    fundingDeadline,
    minimumWithdrawalWindow,
    settlementGracePeriod,
  );

  return {
    payrollId,
    metadataHash,
    fundingStartsAt,
    fundingDeadline,
    minimumWithdrawalWindow,
    settlementGracePeriod,
  };
}

export async function requestPayrollComputation(
  f: Awaited<ReturnType<typeof deploySystem>>,
  draft: Awaited<ReturnType<typeof createDraft>>,
  label = `encrypted-payroll-${draft.payrollId}`,
) {
  const ciphertext = ethers.toUtf8Bytes(label);
  const instructionId = await f.gateway
    .connect(f.hr)
    .requestPayrollComputation.staticCall(draft.payrollId, ciphertext);
  await f.gateway.connect(f.hr).requestPayrollComputation(draft.payrollId, ciphertext);
  const status = await f.gateway.getRequestStatus(instructionId);
  return {
    ciphertext,
    ciphertextHash: ethers.keccak256(ciphertext),
    instructionId,
    selectedTeeId: status[1],
    teeSignerEpoch: status[2],
    requestedAt: status[3],
  };
}

export async function buildPayrollResult(
  f: Awaited<ReturnType<typeof deploySystem>>,
  draft: Awaited<ReturnType<typeof createDraft>>,
  request: Awaited<ReturnType<typeof requestPayrollComputation>>,
  overrides: Record<string, unknown> = {},
) {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const employeeNetTotal = 2_000_000_000n;
  const aggregateTaxTotal = 200_000_000n;
  const defaults = {
    domain: await f.gateway.PAYROLL_RESULT_DOMAIN(),
    gateway: await f.gateway.getAddress(),
    vault: await f.vault.getAddress(),
    chainId,
    extensionId: EXTENSION_ID,
    selectedTeeId: request.selectedTeeId,
    teeSignerEpoch: request.teeSignerEpoch,
    payrollId: draft.payrollId,
    institution: f.institution.address,
    metadataHash: draft.metadataHash,
    stablecoin: await f.token.getAddress(),
    stablecoinDecimals: 6,
    ciphertextHash: request.ciphertextHash,
    privateLedgerRoot: ethers.keccak256(
      ethers.toUtf8Bytes(`ledger-${draft.payrollId}-0`),
    ),
    employeeCount: 2n,
    employeeNetTotal,
    aggregateTaxTotal,
    totalRequired: employeeNetTotal + aggregateTaxTotal,
    requestedAt: request.requestedAt,
    validUntil: request.requestedAt + 600n,
    ...overrides,
  };
  return { data: defaults, encoded: encodePayrollResult(defaults) };
}

export async function finalizePayrollComputation(
  f: Awaited<ReturnType<typeof deploySystem>>,
  draft: Awaited<ReturnType<typeof createDraft>>,
  request: Awaited<ReturnType<typeof requestPayrollComputation>>,
  overrides: Record<string, unknown> = {},
  signer = f.teeSigner,
  submissionTag = "submit",
  status = SUCCESS,
) {
  const result = await buildPayrollResult(f, draft, request, overrides);
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const signature = await signActionResult(
    signer,
    result.encoded,
    request.instructionId,
    submissionTag,
    status,
    chainId,
  );
  await f.gateway.finalizePayrollComputation(
    result.encoded,
    request.instructionId,
    submissionTag,
    status,
    signature,
  );
  return { ...result, signature };
}

export async function createComputedPayroll(
  f: Awaited<ReturnType<typeof deploySystem>>,
  payrollId = 1n,
  resultOverrides: Record<string, unknown> = {},
) {
  const draft = await createDraft(f, payrollId);
  const request = await requestPayrollComputation(f, draft);
  const result = await finalizePayrollComputation(f, draft, request, resultOverrides);
  return { draft, request, result };
}

export async function activatePayroll(
  f: Awaited<ReturnType<typeof deploySystem>>,
  computed: Awaited<ReturnType<typeof createComputedPayroll>>,
  partialAmount?: bigint,
) {
  const payrollId = computed.draft.payrollId;
  await f.vault.connect(f.hr).openFunding(payrollId);
  const totalRequired = BigInt(computed.result.data.totalRequired as bigint);
  await f.token.mint(f.finance.address, totalRequired);
  await f.token.connect(f.finance).approve(await f.vault.getAddress(), totalRequired);
  if (partialAmount !== undefined) {
    await f.vault.connect(f.finance).fundPayroll(payrollId, partialAmount);
  } else {
    await f.vault.connect(f.finance).fundPayroll(payrollId, totalRequired);
  }
}

export async function requestWithdrawal(
  f: Awaited<ReturnType<typeof deploySystem>>,
  payrollId = 1n,
  label = "encrypted-withdrawal",
) {
  const ciphertext = ethers.toUtf8Bytes(label);
  const instructionId = await f.gateway
    .connect(f.relayer)
    .requestPrivateWithdrawal.staticCall(payrollId, ciphertext);
  await f.gateway.connect(f.relayer).requestPrivateWithdrawal(payrollId, ciphertext);
  const status = await f.gateway.getRequestStatus(instructionId);
  return {
    ciphertext,
    ciphertextHash: ethers.keccak256(ciphertext),
    instructionId,
    selectedTeeId: status[1],
    teeSignerEpoch: status[2],
    requestedAt: status[3],
  };
}

export async function buildWithdrawalResult(
  f: Awaited<ReturnType<typeof deploySystem>>,
  computed: Awaited<ReturnType<typeof createComputedPayroll>>,
  request: Awaited<ReturnType<typeof requestWithdrawal>>,
  overrides: Record<string, unknown> = {},
) {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const payroll = await f.vault.getPayroll(computed.draft.payrollId);
  const defaults = {
    domain: await f.gateway.WITHDRAWAL_RESULT_DOMAIN(),
    gateway: await f.gateway.getAddress(),
    vault: await f.vault.getAddress(),
    chainId,
    extensionId: EXTENSION_ID,
    selectedTeeId: request.selectedTeeId,
    teeSignerEpoch: request.teeSignerEpoch,
    payrollId: computed.draft.payrollId,
    institution: f.institution.address,
    stablecoin: await f.token.getAddress(),
    stablecoinDecimals: 6,
    ciphertextHash: request.ciphertextHash,
    oldLedgerRoot: payroll.privateLedgerRoot,
    newLedgerRoot: ethers.keccak256(
      ethers.toUtf8Bytes(`ledger-next-${request.instructionId}`),
    ),
    destination: f.recipient.address,
    amount: 600_000_000n,
    withdrawalNullifier: ethers.keccak256(
      ethers.toUtf8Bytes(`nullifier-${request.instructionId}`),
    ),
    requestedAt: request.requestedAt,
    validUntil: request.requestedAt + 840n,
    ...overrides,
  };
  return { data: defaults, encoded: encodeWithdrawalResult(defaults) };
}

export async function finalizeWithdrawal(
  f: Awaited<ReturnType<typeof deploySystem>>,
  computed: Awaited<ReturnType<typeof createComputedPayroll>>,
  request: Awaited<ReturnType<typeof requestWithdrawal>>,
  overrides: Record<string, unknown> = {},
  signer = f.teeSigner,
  submissionTag = "submit",
  status = SUCCESS,
) {
  const result = await buildWithdrawalResult(f, computed, request, overrides);
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const signature = await signActionResult(
    signer,
    result.encoded,
    request.instructionId,
    submissionTag,
    status,
    chainId,
  );
  await f.gateway.finalizePrivateWithdrawal(
    result.encoded,
    request.instructionId,
    submissionTag,
    status,
    signature,
  );
  return { ...result, signature };
}

export async function buildFailureResult(
  f: Awaited<ReturnType<typeof deploySystem>>,
  request: {
    instructionId: string;
    selectedTeeId: string;
    teeSignerEpoch: bigint;
    requestedAt: bigint;
    ciphertextHash: string;
  },
  payrollId: bigint,
  requestType: number,
  overrides: Record<string, unknown> = {},
) {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const defaults = {
    domain: await f.gateway.FAILURE_RESULT_DOMAIN(),
    gateway: await f.gateway.getAddress(),
    vault: await f.vault.getAddress(),
    chainId,
    extensionId: EXTENSION_ID,
    selectedTeeId: request.selectedTeeId,
    teeSignerEpoch: request.teeSignerEpoch,
    requestType,
    payrollId,
    ciphertextHash: request.ciphertextHash,
    errorCodeHash: ethers.keccak256(ethers.toUtf8Bytes("TEE_REJECTED")),
    requestedAt: request.requestedAt,
    validUntil: request.requestedAt + 600n,
    ...overrides,
  };
  return { data: defaults, encoded: encodeFailureResult(defaults) };
}

export async function buildFailureResultFromContext(
  f: Awaited<ReturnType<typeof deploySystem>>,
  instructionId: string,
  errorCode: string,
  overrides: Record<string, unknown> = {},
) {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const context = await f.gateway.getRequestFailureContext(instructionId);
  const defaults = {
    domain: await f.gateway.FAILURE_RESULT_DOMAIN(),
    gateway: await f.gateway.getAddress(),
    vault: await f.vault.getAddress(),
    chainId,
    extensionId: context.requestExtensionId,
    selectedTeeId: context.selectedTeeId,
    teeSignerEpoch: context.teeSignerEpoch,
    requestType: context.requestType,
    payrollId: context.payrollId,
    ciphertextHash: context.ciphertextHash,
    errorCodeHash: ethers.keccak256(ethers.toUtf8Bytes(errorCode)),
    requestedAt: context.requestedAt,
    validUntil: context.requestedAt + 600n,
    ...overrides,
  };
  return { context, data: defaults, encoded: encodeFailureResult(defaults) };
}

export async function finalizeFailureFromContext(
  f: Awaited<ReturnType<typeof deploySystem>>,
  instructionId: string,
  errorCode: string,
  submissionTag = "failed",
) {
  const failure = await buildFailureResultFromContext(f, instructionId, errorCode);
  const signature = await signActionResult(
    f.teeSigner,
    failure.encoded,
    instructionId,
    submissionTag,
    FAILURE,
  );
  await f.gateway.finalizeFailedRequest(
    failure.encoded,
    instructionId,
    submissionTag,
    FAILURE,
    signature,
  );
  return { ...failure, signature };
}
