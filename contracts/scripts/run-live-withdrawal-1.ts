import { ethers } from "hardhat";
import { spawnSync } from "node:child_process";

const VAULT_ADDRESS =
  "0xA5277D55a46514740b0C716C691d92b8D9E64e5E";

const GATEWAY_ADDRESS =
  "0xFE9A84346A614599C9A0b5a1F444bd816a6C100A";

const STABLECOIN_ADDRESS =
  "0xC1A5B41512496B80903D1f32d6dEa3a73212E71F";

const EXPECTED_OPERATOR =
  "0x0EdBC6F8506e72478CE78a4AE934C7b21cb7050A";

const TEE_ID =
  "0x59268355660DCb868507E538b967fc0eB05A394C";

const EXT_PROXY_URL =
  "https://unfurrowed-nonusurpingly-julianna.ngrok-free.dev";

const ENCRYPT_EXE =
  "C:\\Users\\cashkink\\extension-examples\\extension-scaffold\\go\\bin\\zalary-encrypt.exe";

const PAYROLL_ID = 1n;
const WITHDRAWAL_AMOUNT = 1_000_000n;
const EMPLOYEE_NONCE = 0n;
const EMPLOYEE_REF = "demo-employee-001";
const FCC_FEE_WEI = BigInt(process.env.FCC_FEE_WEI ?? "1000000");

type ActionResponse = {
  result: {
    id: string;
    submissionTag: string;
    status: number;
    log: string;
    data: string;
  };
  signature: string;
  proxySignature?: string;
};

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function encryptPayload(payload: unknown): string {
  const result = spawnSync(ENCRYPT_EXE, [], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: {
      ...process.env,
      EXT_PROXY_URL,
      TEE_ID,
    },
  });

  if (result.status !== 0) {
    throw new Error(
      `Encryption failed: ${result.stderr || "unknown encryption error"}`,
    );
  }

  const ciphertext = result.stdout.trim();

  if (!/^0x[0-9a-fA-F]+$/.test(ciphertext)) {
    throw new Error("Encryption helper returned invalid ciphertext");
  }

  return ciphertext;
}

/*
 * Employee signatures inside the private payload use the Go Ethereum
 * signature format, where V is 0 or 1.
 */
function normalizeEmployeeSignature(signature: string): string {
  const bytes = ethers.getBytes(signature);

  if (bytes.length !== 65) {
    throw new Error(`Employee signature is ${bytes.length} bytes`);
  }

  if (bytes[64] === 27 || bytes[64] === 28) {
    bytes[64] -= 27;
  }

  if (bytes[64] !== 0 && bytes[64] !== 1) {
    throw new Error(`Unsupported employee signature V: ${bytes[64]}`);
  }

  return ethers.hexlify(bytes);
}

/*
 * Solidity ECDSA verification expects V to be 27 or 28.
 */
function normalizeTeeSignature(signature: string): string {
  const bytes = ethers.getBytes(signature);

  if (bytes.length !== 65) {
    throw new Error(`TEE signature is ${bytes.length} bytes`);
  }

  if (bytes[64] === 0 || bytes[64] === 1) {
    bytes[64] += 27;
  }

  if (bytes[64] !== 27 && bytes[64] !== 28) {
    throw new Error(`Unsupported TEE signature V: ${bytes[64]}`);
  }

  return ethers.hexlify(bytes);
}

function recoverTeeSigner(
  action: ActionResponse,
  normalizedSignature: string,
): string {
  const dataHash = ethers.keccak256(action.result.data);

  const submissionTagHash = ethers.keccak256(
    ethers.toUtf8Bytes(action.result.submissionTag),
  );

  const resultHash = ethers.keccak256(
    ethers.solidityPacked(
      ["bytes32", "bytes32", "bytes32", "uint8"],
      [
        dataHash,
        action.result.id,
        submissionTagHash,
        action.result.status,
      ],
    ),
  );

  const payloadHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "uint256", "bytes32"],
      [
        ethers.encodeBytes32String("TEE_ACTION_RESULT"),
        114n,
        resultHash,
      ],
    ),
  );

  return ethers.recoverAddress(
    ethers.hashMessage(ethers.getBytes(payloadHash)),
    normalizedSignature,
  );
}

async function sendTransaction(
  label: string,
  transactionPromise: Promise<any>,
): Promise<any> {
  const transaction = await transactionPromise;

  console.log(`${label}: ${transaction.hash}`);

  const receipt = await transaction.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error(`${label} transaction failed`);
  }

  return receipt;
}

function findEvent(
  receipt: any,
  contract: any,
  eventName: string,
): any {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);

      if (parsed?.name === eventName) {
        return parsed;
      }
    } catch {
      // Ignore logs emitted by other contracts.
    }
  }

  throw new Error(`${eventName} event not found`);
}

async function pollActionResult(
  instructionId: string,
): Promise<ActionResponse> {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const response = await fetch(
      `${EXT_PROXY_URL}/action/result/${instructionId}`,
      {
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      },
    );

    if (response.status === 200) {
      const action = (await response.json()) as ActionResponse;

      if (
        action.result?.id?.toLowerCase() !==
        instructionId.toLowerCase()
      ) {
        throw new Error("Proxy returned a different instruction ID");
      }

      if (
        action.result.status === 0 ||
        action.result.status === 1
      ) {
        return action;
      }
    } else if (response.status !== 404) {
      const message = await response.text();

      console.log(
        `Proxy HTTP ${response.status}: ${message.slice(0, 120)}`,
      );
    }

    await sleep(2_000);
  }

  throw new Error("TEE withdrawal result polling timed out");
}

async function main(): Promise<void> {
  const [operator] = await ethers.getSigners();
  const operatorAddress = await operator.getAddress();
  const network = await ethers.provider.getNetwork();

  if (network.chainId !== 114n) {
    throw new Error(`Wrong network: ${network.chainId}`);
  }

  if (
    operatorAddress.toLowerCase() !==
    EXPECTED_OPERATOR.toLowerCase()
  ) {
    throw new Error(`Wrong operator: ${operatorAddress}`);
  }

  const c2flrBalance =
    await ethers.provider.getBalance(operatorAddress);

  console.log(`Operator: ${operatorAddress}`);
  console.log(`Network: Coston2 (${network.chainId})`);
  console.log(
    `C2FLR balance: ${ethers.formatEther(c2flrBalance)}`,
  );

  if (c2flrBalance < ethers.parseEther("0.05")) {
    throw new Error("Insufficient C2FLR for gas");
  }

  const gateway: any = await ethers.getContractAt(
    "ZalaryConfidentialGateway",
    GATEWAY_ADDRESS,
    operator,
  );

  const vault: any = await ethers.getContractAt(
    "ZalaryPrivatePayrollVault",
    VAULT_ADDRESS,
    operator,
  );

  const stablecoin: any = await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
    ],
    STABLECOIN_ADDRESS,
    operator,
  );

  const binding = await gateway.teeBindings(TEE_ID);

  if (
    String(binding[0]).toLowerCase() !==
      TEE_ID.toLowerCase() ||
    BigInt(binding[1]) !== 2n ||
    !Boolean(binding[2])
  ) {
    throw new Error("TEE signer epoch 2 is not active");
  }

  const context = await vault.getWithdrawalContext(PAYROLL_ID);

  const payrollStatus = Number(context.status);
  const oldLedgerRoot = String(context.privateLedgerRoot);
  const withdrawalDeadline = BigInt(context.withdrawalDeadline);
  const minimumWithdrawal = BigInt(
    context.minimumWithdrawalAmount,
  );

  const latestBlock = await ethers.provider.getBlock("latest");

  if (!latestBlock) {
    throw new Error("Unable to read the latest Coston2 block");
  }

  console.log(`Payroll status: ${payrollStatus}`);
  console.log(`Current private root: ${oldLedgerRoot}`);
  console.log(`Withdrawal deadline: ${withdrawalDeadline}`);
  console.log(`Current timestamp: ${latestBlock.timestamp}`);
  console.log(
    `Minimum withdrawal: ${ethers.formatUnits(
      minimumWithdrawal,
      6,
    )} USD₮0`,
  );

  if (payrollStatus !== 5) {
    throw new Error(
      `Payroll 1 is not Active. Status: ${payrollStatus}`,
    );
  }

  if (BigInt(latestBlock.timestamp) > withdrawalDeadline) {
    throw new Error("Payroll withdrawal deadline has expired");
  }

  if (WITHDRAWAL_AMOUNT < minimumWithdrawal) {
    throw new Error("Withdrawal amount is below the minimum");
  }

  if (oldLedgerRoot === ethers.ZeroHash) {
    throw new Error("Private ledger root is zero");
  }

  const extensionId = BigInt(await gateway.extensionId());
  const expiresAt = BigInt(latestBlock.timestamp + 600);
  const employeeRefHash = ethers.keccak256(
    ethers.toUtf8Bytes(EMPLOYEE_REF),
  );

  const withdrawalAuthDomain = ethers.keccak256(
    ethers.toUtf8Bytes(
      "ZALARY_FCC_WITHDRAWAL_AUTH_V1",
    ),
  );

  const authorizationDigest = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "bytes32",
        "uint256",
        "address",
        "address",
        "uint256",
        "uint256",
        "bytes32",
        "address",
        "uint256",
        "uint256",
        "bytes32",
        "uint64",
      ],
      [
        withdrawalAuthDomain,
        114n,
        GATEWAY_ADDRESS,
        VAULT_ADDRESS,
        extensionId,
        PAYROLL_ID,
        employeeRefHash,
        operatorAddress,
        WITHDRAWAL_AMOUNT,
        EMPLOYEE_NONCE,
        oldLedgerRoot,
        expiresAt,
      ],
    ),
  );

  const standardEmployeeSignature =
    await operator.signMessage(
      ethers.getBytes(authorizationDigest),
    );

  const recoveredEmployee = ethers.verifyMessage(
    ethers.getBytes(authorizationDigest),
    standardEmployeeSignature,
  );

  if (
    recoveredEmployee.toLowerCase() !==
    operatorAddress.toLowerCase()
  ) {
    throw new Error(
      `Employee authorization recovered ${recoveredEmployee}`,
    );
  }

  const employeeSignature =
    normalizeEmployeeSignature(standardEmployeeSignature);

  console.log(`Employee authorization signer: ${recoveredEmployee}`);
  console.log("Employee nonce: 0");
  console.log("Withdrawal amount: 1 USD₮0");
  console.log(`Destination: ${operatorAddress}`);

  const privateWithdrawal = {
    version: "1",
    payrollId: PAYROLL_ID.toString(),
    employeeRef: EMPLOYEE_REF,
    destination: operatorAddress,
    amount: WITHDRAWAL_AMOUNT.toString(),
    nonce: EMPLOYEE_NONCE.toString(),
    expiresAt: expiresAt.toString(),
    authSignature: employeeSignature,
  };

  const encryptedWithdrawal =
    encryptPayload(privateWithdrawal);

  console.log("Private withdrawal encrypted.");

  const walletBalanceBefore = BigInt(
    await stablecoin.balanceOf(operatorAddress),
  );

  const vaultBalanceBefore = BigInt(
    await stablecoin.balanceOf(VAULT_ADDRESS),
  );

  console.log(
    `Wallet before: ${ethers.formatUnits(
      walletBalanceBefore,
      6,
    )} USD₮0`,
  );

  console.log(
    `Vault before: ${ethers.formatUnits(
      vaultBalanceBefore,
      6,
    )} USD₮0`,
  );

  const requestReceipt = await sendTransaction(
    "Request private withdrawal",
    gateway.requestPrivateWithdrawal(
      PAYROLL_ID,
      encryptedWithdrawal,
      { value: FCC_FEE_WEI },
    ),
  );

  const requestedEvent = findEvent(
    requestReceipt,
    gateway,
    "PrivateWithdrawalRequested",
  );

  const instructionId =
    String(requestedEvent.args.instructionId);

  console.log(`Instruction ID: ${instructionId}`);
  console.log("Waiting for TEE withdrawal authorization...");

  const action = await pollActionResult(instructionId);

  console.log(`TEE status: ${action.result.status}`);
  console.log(`TEE log: ${action.result.log}`);

  const teeSignature =
    normalizeTeeSignature(action.signature);

  const recoveredTee = recoverTeeSigner(
    action,
    teeSignature,
  );

  console.log(`Recovered TEE signer: ${recoveredTee}`);

  if (
    recoveredTee.toLowerCase() !==
    TEE_ID.toLowerCase()
  ) {
    throw new Error("Withdrawal result has the wrong TEE signer");
  }

  if (action.result.status === 0) {
    await gateway.finalizeFailedRequest.staticCall(
      action.result.data,
      instructionId,
      action.result.submissionTag,
      action.result.status,
      teeSignature,
    );

    await sendTransaction(
      "Finalize failed withdrawal request",
      gateway.finalizeFailedRequest(
        action.result.data,
        instructionId,
        action.result.submissionTag,
        action.result.status,
        teeSignature,
      ),
    );

    throw new Error(
      `TEE rejected withdrawal: ${action.result.log}`,
    );
  }

  await gateway.finalizePrivateWithdrawal.staticCall(
    action.result.data,
    instructionId,
    action.result.submissionTag,
    action.result.status,
    teeSignature,
  );

  console.log("On-chain withdrawal simulation passed.");
  console.log("Executing exactly 1 USD₮0 withdrawal.");

  await sendTransaction(
    "Finalize private withdrawal",
    gateway.finalizePrivateWithdrawal(
      action.result.data,
      instructionId,
      action.result.submissionTag,
      action.result.status,
      teeSignature,
    ),
  );

  const updatedContext =
    await vault.getWithdrawalContext(PAYROLL_ID);

  const newLedgerRoot =
    String(updatedContext.privateLedgerRoot);

  const walletBalanceAfter = BigInt(
    await stablecoin.balanceOf(operatorAddress),
  );

  const vaultBalanceAfter = BigInt(
    await stablecoin.balanceOf(VAULT_ADDRESS),
  );

  console.log("");
  console.log("LIVE PRIVATE WITHDRAWAL COMPLETED");
  console.log(`Payroll ID: ${PAYROLL_ID}`);
  console.log(`Instruction ID: ${instructionId}`);
  console.log(`Old private root: ${oldLedgerRoot}`);
  console.log(`New private root: ${newLedgerRoot}`);
  console.log(
    `Wallet after: ${ethers.formatUnits(
      walletBalanceAfter,
      6,
    )} USD₮0`,
  );
  console.log(
    `Vault after: ${ethers.formatUnits(
      vaultBalanceAfter,
      6,
    )} USD₮0`,
  );
  console.log(
    `Payroll status: ${updatedContext.status}`,
  );

  if (newLedgerRoot === oldLedgerRoot) {
    throw new Error("Private ledger root did not change");
  }

  if (
    walletBalanceAfter !==
    walletBalanceBefore + WITHDRAWAL_AMOUNT
  ) {
    throw new Error("Employee wallet did not receive exactly 1 USD₮0");
  }

  if (
    vaultBalanceAfter !==
    vaultBalanceBefore - WITHDRAWAL_AMOUNT
  ) {
    throw new Error("Vault did not release exactly 1 USD₮0");
  }

  if (Number(updatedContext.status) !== 5) {
    throw new Error(
      `Payroll unexpectedly left Active status: ${updatedContext.status}`,
    );
  }
}

main().catch((error) => {
  console.error("");
  console.error("LIVE WITHDRAWAL FAILED");
  console.error(error);
  process.exitCode = 1;
});