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
const PAYROLL_AMOUNT = 2_000_000n;
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

function normalizeSignature(signature: string): string {
  const bytes = ethers.getBytes(signature);

  if (bytes.length !== 65) {
    throw new Error(
      `Expected a 65-byte signature, received ${bytes.length}`,
    );
  }

  if (bytes[64] === 0 || bytes[64] === 1) {
    bytes[64] += 27;
  }

  if (bytes[64] !== 27 && bytes[64] !== 28) {
    throw new Error(`Unsupported signature V value: ${bytes[64]}`);
  }

  return ethers.hexlify(bytes);
}

function recoverTeeSigner(
  action: ActionResponse,
  signature: string,
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

  const domain = ethers.encodeBytes32String("TEE_ACTION_RESULT");

  const payloadHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "uint256", "bytes32"],
      [domain, 114n, resultHash],
    ),
  );

  return ethers.recoverAddress(
    ethers.hashMessage(ethers.getBytes(payloadHash)),
    signature,
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
      // Ignore logs from other contracts.
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

  throw new Error("TEE result was not available before polling ended");
}

async function main(): Promise<void> {
  const [operator] = await ethers.getSigners();
  const operatorAddress = await operator.getAddress();

  if (
    operatorAddress.toLowerCase() !==
    EXPECTED_OPERATOR.toLowerCase()
  ) {
    throw new Error(
      `Wrong signer: ${operatorAddress}. Expected ${EXPECTED_OPERATOR}`,
    );
  }

  const network = await ethers.provider.getNetwork();

  if (network.chainId !== 114n) {
    throw new Error(`Wrong network: ${network.chainId}`);
  }

  const c2flrBalance =
    await ethers.provider.getBalance(operatorAddress);

  console.log(`Operator: ${operatorAddress}`);
  console.log(`Network: Coston2 (${network.chainId})`);
  console.log(
    `C2FLR balance: ${ethers.formatEther(c2flrBalance)}`,
  );

  if (c2flrBalance < ethers.parseEther("0.05")) {
    throw new Error("Insufficient C2FLR for transaction gas");
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
      "function allowance(address,address) view returns (uint256)",
      "function approve(address,uint256) returns (bool)",
    ],
    STABLECOIN_ADDRESS,
    operator,
  );

  const binding = await gateway.teeBindings(TEE_ID);

  const activeSigner: string = binding[0];
  const signerEpoch: bigint = binding[1];
  const signerActive: boolean = binding[2];

  console.log(`Active TEE signer: ${activeSigner}`);
  console.log(`Signer epoch: ${signerEpoch}`);
  console.log(`Signer active: ${signerActive}`);

  if (
    activeSigner.toLowerCase() !== TEE_ID.toLowerCase() ||
    signerEpoch !== 2n ||
    !signerActive
  ) {
    throw new Error("Correct TEE signer binding is not active");
  }

  let payroll = await vault.getPayroll(PAYROLL_ID);
  const initialStatus = Number(payroll.status);

  console.log(`Payroll 1 current status: ${initialStatus}`);

  if (initialStatus !== 1) {
    throw new Error(
      `Payroll 1 is not in Draft status. Current status: ${initialStatus}`,
    );
  }

  const privatePayroll = {
    version: "1",
    payrollId: PAYROLL_ID.toString(),
    employees: [
      {
        employeeRef: "demo-employee-001",
        authAddress: operatorAddress,
        grossAmount: PAYROLL_AMOUNT.toString(),
        bonusAmount: "0",
        deductionsAmount: "0",
        taxAmount: "0",
      },
    ],
  };

  const encryptedPayroll = encryptPayload(privatePayroll);

  console.log("Private payroll encrypted.");
  console.log("Amount to fund after verification: 2 USD₮0");

  const requestReceipt = await sendTransaction(
    "Request confidential payroll computation",
    gateway.requestPayrollComputation(
      PAYROLL_ID,
      encryptedPayroll,
      { value: FCC_FEE_WEI },
    ),
  );

  const requestEvent = findEvent(
    requestReceipt,
    gateway,
    "PayrollComputationRequested",
  );

  const instructionId: string =
    requestEvent.args.instructionId;

  console.log(`Instruction ID: ${instructionId}`);
  console.log("Waiting for TEE result...");

  const action = await pollActionResult(instructionId);

  console.log(`TEE status: ${action.result.status}`);
  console.log(`TEE log: ${action.result.log}`);

  if (action.result.status !== 1) {
    throw new Error(`TEE rejected payroll: ${action.result.log}`);
  }

  const normalizedSignature =
    normalizeSignature(action.signature);

  const recoveredSigner = recoverTeeSigner(
    action,
    normalizedSignature,
  );

  console.log(`Recovered TEE signer: ${recoveredSigner}`);

  if (
    recoveredSigner.toLowerCase() !==
    TEE_ID.toLowerCase()
  ) {
    throw new Error(
      `TEE signature mismatch. Recovered ${recoveredSigner}`,
    );
  }

  await gateway.finalizePayrollComputation.staticCall(
    action.result.data,
    instructionId,
    action.result.submissionTag,
    action.result.status,
    normalizedSignature,
  );

  console.log("On-chain finalization simulation passed.");

  await sendTransaction(
    "Finalize confidential payroll",
    gateway.finalizePayrollComputation(
      action.result.data,
      instructionId,
      action.result.submissionTag,
      action.result.status,
      normalizedSignature,
    ),
  );

  payroll = await vault.getPayroll(PAYROLL_ID);

  const finalizedStatus = Number(payroll.status);
  const totalRequired: bigint = payroll.totalRequired;

  console.log(`Payroll status after finalization: ${finalizedStatus}`);
  console.log(
    `TEE-approved total: ${ethers.formatUnits(
      totalRequired,
      6,
    )} USD₮0`,
  );

  if (finalizedStatus !== 3) {
    throw new Error(
      `Unexpected finalized payroll status: ${finalizedStatus}`,
    );
  }

  if (totalRequired !== PAYROLL_AMOUNT) {
    throw new Error(
      `Unexpected payroll total. Expected ${PAYROLL_AMOUNT}, got ${totalRequired}`,
    );
  }

  const walletBalance: bigint =
    await stablecoin.balanceOf(operatorAddress);

  console.log(
    `USD₮0 wallet balance before funding: ${ethers.formatUnits(
      walletBalance,
      6,
    )}`,
  );

  if (walletBalance < totalRequired) {
    throw new Error("Insufficient USD₮0 balance");
  }

  await vault.openFunding.staticCall(PAYROLL_ID);

  await sendTransaction(
    "Open payroll funding",
    vault.openFunding(PAYROLL_ID),
  );

  const allowance: bigint = await stablecoin.allowance(
    operatorAddress,
    VAULT_ADDRESS,
  );

  if (allowance < totalRequired) {
    await stablecoin.approve.staticCall(
      VAULT_ADDRESS,
      totalRequired,
    );

    await sendTransaction(
      "Approve exactly 2 USD₮0",
      stablecoin.approve(
        VAULT_ADDRESS,
        totalRequired,
      ),
    );
  }

  await vault.fundPayroll.staticCall(
    PAYROLL_ID,
    totalRequired,
  );

  console.log(
    "Funding simulation passed. Transferring exactly 2 USD₮0.",
  );

  await sendTransaction(
    "Fund payroll with 2 USD₮0",
    vault.fundPayroll(
      PAYROLL_ID,
      totalRequired,
    ),
  );

  payroll = await vault.getPayroll(PAYROLL_ID);

  const finalStatus = Number(payroll.status);

  const finalWalletBalance: bigint =
    await stablecoin.balanceOf(operatorAddress);

  const vaultBalance: bigint =
    await stablecoin.balanceOf(VAULT_ADDRESS);

  console.log("");
  console.log("LIVE CONFIDENTIAL PAYROLL COMPLETED");
  console.log(`Payroll ID: ${PAYROLL_ID}`);
  console.log(`Instruction ID: ${instructionId}`);
  console.log(`Payroll status: ${finalStatus}`);
  console.log(`TEE signer epoch: ${signerEpoch}`);
  console.log(
    `Employee escrow: ${ethers.formatUnits(
      payroll.employeeNetTotal,
      6,
    )} USD₮0`,
  );
  console.log(
    `Wallet balance: ${ethers.formatUnits(
      finalWalletBalance,
      6,
    )} USD₮0`,
  );
  console.log(
    `Vault token balance: ${ethers.formatUnits(
      vaultBalance,
      6,
    )} USD₮0`,
  );

  if (finalStatus !== 5) {
    throw new Error(
      `Payroll did not become active. Status: ${finalStatus}`,
    );
  }
}

main().catch((error) => {
  console.error("");
  console.error("PAYROLL 1 RETRY FAILED");
  console.error(error);
  process.exitCode = 1;
});