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

const FCC_FEE_WEI = BigInt(process.env.FCC_FEE_WEI ?? "1000000");
const PAYROLL_AMOUNT = 2_000_000n;

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
      const body = (await response.json()) as ActionResponse;

      if (
        body.result?.id?.toLowerCase() !==
        instructionId.toLowerCase()
      ) {
        throw new Error("Proxy returned a different instruction ID");
      }

      if (body.result.status === 0 || body.result.status === 1) {
        return body;
      }
    } else if (response.status !== 404) {
      const message = await response.text();
      console.log(
        `Proxy response ${response.status}: ${message.slice(0, 120)}`,
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
      `Wrong signer. Loaded ${operatorAddress}, expected ${EXPECTED_OPERATOR}`,
    );
  }

  const network = await ethers.provider.getNetwork();

  if (network.chainId !== 114n) {
    throw new Error(`Wrong network. Expected Coston2, got ${network.chainId}`);
  }

  const vault: any = await ethers.getContractAt(
    "ZalaryPrivatePayrollVault",
    VAULT_ADDRESS,
    operator,
  );

  const gateway: any = await ethers.getContractAt(
    "ZalaryConfidentialGateway",
    GATEWAY_ADDRESS,
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

  console.log(`Operator: ${operatorAddress}`);
  console.log(`Network: Coston2 (${network.chainId})`);

  let institution = await vault.institutions(operatorAddress);

  if (!institution.registered) {
    await sendTransaction(
      "Register institution",
      vault.registerMyInstitution(operatorAddress, operatorAddress),
    );

    institution = await vault.institutions(operatorAddress);
  }

  if (!institution.active) {
    await sendTransaction(
      "Activate institution",
      vault.setInstitutionActive(operatorAddress, true),
    );
  }

  if (!(await vault.institutionHR(operatorAddress, operatorAddress))) {
    await sendTransaction(
      "Grant HR role",
      vault.setInstitutionHR(operatorAddress, operatorAddress, true),
    );
  }

  if (
    !(await vault.institutionFinance(operatorAddress, operatorAddress))
  ) {
    await sendTransaction(
      "Grant Finance role",
      vault.setInstitutionFinance(operatorAddress, operatorAddress, true),
    );
  }

  const payrollId: bigint = await vault.nextPayrollId();
  const latestBlock = await ethers.provider.getBlock("latest");

  if (!latestBlock) {
    throw new Error("Unable to read latest Coston2 block");
  }

  const now = latestBlock.timestamp;
  const fundingStartsAt = now;
  const fundingDeadline = now + 7_200;
  const minimumWithdrawalWindow = 3_600;
  const settlementGracePeriod = 900;

  const metadataHash = ethers.keccak256(
    ethers.toUtf8Bytes(`zalary-live-payroll-${payrollId}`),
  );

  await sendTransaction(
    "Create payroll draft",
    vault.createPayrollDraft(
      payrollId,
      operatorAddress,
      metadataHash,
      fundingStartsAt,
      fundingDeadline,
      minimumWithdrawalWindow,
      settlementGracePeriod,
    ),
  );

  const privatePayroll = {
    version: "1",
    payrollId: payrollId.toString(),
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

  console.log("Private payroll encrypted successfully.");
  console.log(`Payroll ID: ${payrollId}`);

  const requestReceipt = await sendTransaction(
    "Request confidential payroll computation",
    gateway.requestPayrollComputation(
      payrollId,
      encryptedPayroll,
      { value: FCC_FEE_WEI },
    ),
  );

  const requestEvent = findEvent(
    requestReceipt,
    gateway,
    "PayrollComputationRequested",
  );

  const instructionId: string = requestEvent.args.instructionId;

  console.log(`Instruction ID: ${instructionId}`);
  console.log("TEE request submitted.");

  const action = await pollActionResult(instructionId);

  console.log(`TEE status: ${action.result.status}`);
  console.log(`TEE log: ${action.result.log}`);

  if (!action.signature || action.signature === "0x") {
    throw new Error("TEE response did not contain a signature");
  }

  if (action.result.status === 0) {
    await sendTransaction(
      "Finalize failed TEE request",
      gateway.finalizeFailedRequest(
        action.result.data,
        instructionId,
        action.result.submissionTag,
        action.result.status,
        action.signature,
      ),
    );

    throw new Error(`TEE rejected payroll: ${action.result.log}`);
  }

  await sendTransaction(
    "Finalize confidential payroll",
    gateway.finalizePayrollComputation(
      action.result.data,
      instructionId,
      action.result.submissionTag,
      action.result.status,
      action.signature,
    ),
  );

  let payroll = await vault.getPayroll(payrollId);
  const totalRequired: bigint = payroll.totalRequired;
  const walletBalance: bigint =
    await stablecoin.balanceOf(operatorAddress);

  console.log(
    `TEE-approved payroll total: ${ethers.formatUnits(totalRequired, 6)} USD₮0`,
  );
  console.log(
    `Wallet balance before funding: ${ethers.formatUnits(walletBalance, 6)} USD₮0`,
  );

  if (totalRequired !== PAYROLL_AMOUNT) {
    throw new Error(
      `Unexpected payroll total. Expected ${PAYROLL_AMOUNT}, got ${totalRequired}`,
    );
  }

  if (walletBalance < totalRequired) {
    throw new Error("Insufficient USD₮0 balance for the payroll");
  }

  await sendTransaction(
    "Open payroll funding",
    vault.openFunding(payrollId),
  );

  await sendTransaction(
    "Approve USD₮0",
    stablecoin.approve(VAULT_ADDRESS, totalRequired),
  );

  await sendTransaction(
    "Fund payroll",
    vault.fundPayroll(payrollId, totalRequired),
  );

  payroll = await vault.getPayroll(payrollId);

  const finalWalletBalance: bigint =
    await stablecoin.balanceOf(operatorAddress);

  const vaultBalance: bigint =
    await stablecoin.balanceOf(VAULT_ADDRESS);

  console.log("");
  console.log("LIVE PAYROLL COMPLETED");
  console.log(`Payroll ID: ${payrollId}`);
  console.log(`Instruction ID: ${instructionId}`);
  console.log(`Payroll status: ${payroll.status}`);
  console.log(
    `Employee escrow: ${ethers.formatUnits(payroll.employeeNetTotal, 6)} USD₮0`,
  );
  console.log(
    `Wallet balance: ${ethers.formatUnits(finalWalletBalance, 6)} USD₮0`,
  );
  console.log(
    `Vault token balance: ${ethers.formatUnits(vaultBalance, 6)} USD₮0`,
  );

  if (Number(payroll.status) !== 5) {
    throw new Error(
      `Payroll did not become active. Current status: ${payroll.status}`,
    );
  }
}

main().catch((error) => {
  console.error("");
  console.error("LIVE PAYROLL FAILED");
  console.error(error);
  process.exitCode = 1;
});