import { ethers } from "hardhat";

const VAULT_ADDRESS =
  "0xA5277D55a46514740b0C716C691d92b8D9E64e5E";

const GATEWAY_ADDRESS =
  "0xFE9A84346A614599C9A0b5a1F444bd816a6C100A";

const STABLECOIN_ADDRESS =
  "0xC1A5B41512496B80903D1f32d6dEa3a73212E71F";

const EXPECTED_OPERATOR =
  "0x0EdBC6F8506e72478CE78a4AE934C7b21cb7050A";

const EXT_PROXY_URL =
  "https://unfurrowed-nonusurpingly-julianna.ngrok-free.dev";

const PAYROLL_ID = 1n;

const INSTRUCTION_ID =
  "0x648859f7c3043f90b59ad04f7abda19f5dac086f75da5ecd3f5fb788006b8bc7";

const EXPECTED_TOTAL = 2_000_000n;

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

function normalizeTeeSignature(signature: string): {
  signature: string;
  originalV: number;
  normalizedV: number;
} {
  const bytes = ethers.getBytes(signature);

  if (bytes.length !== 65) {
    throw new Error(
      `Expected a 65-byte TEE signature, received ${bytes.length} bytes`,
    );
  }

  const originalV = bytes[64];

  if (originalV === 0 || originalV === 1) {
    bytes[64] = originalV + 27;
  } else if (originalV !== 27 && originalV !== 28) {
    throw new Error(`Unsupported signature V value: ${originalV}`);
  }

  return {
    signature: ethers.hexlify(bytes),
    originalV,
    normalizedV: bytes[64],
  };
}

function extractRevertData(error: any): string | undefined {
  return (
    error?.data ??
    error?.error?.data ??
    error?.info?.error?.data ??
    error?.cause?.data
  );
}

function describeRevert(error: any, contract: any): string {
  const data = extractRevertData(error);

  if (typeof data === "string" && data.startsWith("0x")) {
    try {
      const parsed = contract.interface.parseError(data);

      if (parsed) {
        return `${parsed.name}(${parsed.args
          .map((value: unknown) => String(value))
          .join(", ")})`;
      }
    } catch {
      return data;
    }
  }

  return error?.shortMessage ?? error?.message ?? String(error);
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

async function fetchActionResult(): Promise<ActionResponse> {
  const response = await fetch(
    `${EXT_PROXY_URL}/action/result/${INSTRUCTION_ID}`,
    {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Could not retrieve TEE result: HTTP ${response.status}`,
    );
  }

  const action = (await response.json()) as ActionResponse;

  if (
    action.result.id.toLowerCase() !==
    INSTRUCTION_ID.toLowerCase()
  ) {
    throw new Error("Proxy returned the wrong instruction ID");
  }

  if (!action.signature || action.signature === "0x") {
    throw new Error("TEE signature is missing");
  }

  return action;
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

  console.log(`Operator: ${operatorAddress}`);
  console.log(`Payroll ID: ${PAYROLL_ID}`);
  console.log(`Instruction ID: ${INSTRUCTION_ID}`);

  const requestStatus = await gateway.getRequestStatus(INSTRUCTION_ID);
  const requestClosed = Boolean(requestStatus[4]);

  console.log(`Request closed: ${requestClosed}`);

  if (!requestClosed) {
    const action = await fetchActionResult();

    console.log(`TEE status: ${action.result.status}`);
    console.log(`TEE log: ${action.result.log}`);

    if (action.result.status !== 1) {
      throw new Error(
        `TEE result is not successful: ${action.result.log}`,
      );
    }

    let signatureToUse = action.signature;

    try {
      await gateway.finalizePayrollComputation.staticCall(
        action.result.data,
        INSTRUCTION_ID,
        action.result.submissionTag,
        action.result.status,
        signatureToUse,
      );

      console.log("Raw TEE signature accepted.");
    } catch (rawError) {
      console.log(
        `Raw signature rejected: ${describeRevert(rawError, gateway)}`,
      );

      const normalized = normalizeTeeSignature(action.signature);

      console.log(
        `Normalizing signature V: ${normalized.originalV} -> ${normalized.normalizedV}`,
      );

      signatureToUse = normalized.signature;

      try {
        await gateway.finalizePayrollComputation.staticCall(
          action.result.data,
          INSTRUCTION_ID,
          action.result.submissionTag,
          action.result.status,
          signatureToUse,
        );

        console.log("Normalized TEE signature accepted.");
      } catch (normalizedError) {
        throw new Error(
          `Normalized signature rejected: ${describeRevert(
            normalizedError,
            gateway,
          )}`,
        );
      }
    }

    await sendTransaction(
      "Finalize confidential payroll",
      gateway.finalizePayrollComputation(
        action.result.data,
        INSTRUCTION_ID,
        action.result.submissionTag,
        action.result.status,
        signatureToUse,
      ),
    );
  } else {
    console.log("Payroll computation was already finalized.");
  }

  let payroll = await vault.getPayroll(PAYROLL_ID);
  let payrollStatus = Number(payroll.status);
  const totalRequired: bigint = payroll.totalRequired;

  console.log(`Payroll status after finalization: ${payrollStatus}`);
  console.log(
    `TEE-approved total: ${ethers.formatUnits(totalRequired, 6)} USD₮0`,
  );

  if (totalRequired !== EXPECTED_TOTAL) {
    throw new Error(
      `Unexpected payroll total: ${totalRequired}. Expected ${EXPECTED_TOTAL}`,
    );
  }

  if (payrollStatus === 3) {
    await sendTransaction(
      "Open payroll funding",
      vault.openFunding(PAYROLL_ID),
    );

    payroll = await vault.getPayroll(PAYROLL_ID);
    payrollStatus = Number(payroll.status);
  }

  if (payrollStatus === 4) {
    const walletBalance: bigint =
      await stablecoin.balanceOf(operatorAddress);

    console.log(
      `Wallet balance: ${ethers.formatUnits(walletBalance, 6)} USD₮0`,
    );

    if (walletBalance < totalRequired) {
      throw new Error("Insufficient USD₮0 balance");
    }

    const allowance: bigint = await stablecoin.allowance(
      operatorAddress,
      VAULT_ADDRESS,
    );

    if (allowance < totalRequired) {
      await sendTransaction(
        "Approve USD₮0",
        stablecoin.approve(VAULT_ADDRESS, totalRequired),
      );
    }

    await sendTransaction(
      "Fund payroll",
      vault.fundPayroll(PAYROLL_ID, totalRequired),
    );

    payroll = await vault.getPayroll(PAYROLL_ID);
    payrollStatus = Number(payroll.status);
  }

  if (payrollStatus !== 5) {
    throw new Error(
      `Payroll did not become active. Current status: ${payrollStatus}`,
    );
  }

  const finalWalletBalance: bigint =
    await stablecoin.balanceOf(operatorAddress);

  const vaultBalance: bigint =
    await stablecoin.balanceOf(VAULT_ADDRESS);

  console.log("");
  console.log("LIVE PAYROLL RECOVERED AND FUNDED");
  console.log(`Payroll ID: ${PAYROLL_ID}`);
  console.log(`Payroll status: ${payrollStatus}`);
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
    `Vault balance: ${ethers.formatUnits(vaultBalance, 6)} USD₮0`,
  );
}

main().catch((error) => {
  console.error("");
  console.error("PAYROLL RECOVERY FAILED");
  console.error(error);
  process.exitCode = 1;
});