import { ethers } from "hardhat";

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

const FAILED_INSTRUCTION_ID =
  "0x4f6a9fe4337fa574f44dccdd0ad0b69b684330c588f481c52104541dd9011383";

const ORIGINAL_REQUEST_TX =
  "0xb508457abe291473bc5bab45241f60943b9c9f120b2cad580e3d6d64fef471b4";

const PAYROLL_ID = 1n;
const EXPECTED_AMOUNT = 2_000_000n;
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
    throw new Error(`Unsupported signature V: ${bytes[64]}`);
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

  const actionResultHash = ethers.keccak256(
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
        actionResultHash,
      ],
    ),
  );

  return ethers.recoverAddress(
    ethers.hashMessage(ethers.getBytes(payloadHash)),
    normalizedSignature,
  );
}

async function fetchActionResult(
  instructionId: string,
): Promise<ActionResponse> {
  const response = await fetch(
    `${EXT_PROXY_URL}/action/result/${instructionId}`,
    {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Could not retrieve ${instructionId}: HTTP ${response.status}`,
    );
  }

  const action = (await response.json()) as ActionResponse;

  if (
    action.result?.id?.toLowerCase() !==
    instructionId.toLowerCase()
  ) {
    throw new Error("Proxy returned a different instruction ID");
  }

  if (!action.signature || action.signature === "0x") {
    throw new Error("TEE signature is missing");
  }

  return action;
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
      const body = await response.text();

      console.log(
        `Proxy HTTP ${response.status}: ${body.slice(0, 120)}`,
      );
    }

    await sleep(2_000);
  }

  throw new Error("TEE result polling timed out");
}

async function sendTransaction(
  label: string,
  transactionPromise: Promise<any>,
): Promise<any> {
  const transaction = await transactionPromise;

  console.log(`${label}: ${transaction.hash}`);

  const receipt = await transaction.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error(`${label} failed`);
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
      // Ignore unrelated logs.
    }
  }

  throw new Error(`${eventName} event not found`);
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
  console.log(`Network: Coston2 (${network.chainId})`);

  const c2flrBalance =
    await ethers.provider.getBalance(operatorAddress);

  console.log(
    `C2FLR balance: ${ethers.formatEther(c2flrBalance)}`,
  );

  if (c2flrBalance < ethers.parseEther("0.05")) {
    throw new Error("Insufficient C2FLR for gas");
  }

  const binding = await gateway.teeBindings(TEE_ID);

  if (
    String(binding[0]).toLowerCase() !==
      TEE_ID.toLowerCase() ||
    BigInt(binding[1]) !== 2n ||
    !Boolean(binding[2])
  ) {
    throw new Error("Signer epoch 2 binding is not active");
  }

  console.log("TEE signer epoch 2 confirmed.");

  /*
   * Step 1: finalize the current TEE-signed failure.
   */
  const failedStatus =
    await gateway.getRequestStatus(FAILED_INSTRUCTION_ID);

  if (!Boolean(failedStatus[4])) {
    const failedAction =
      await fetchActionResult(FAILED_INSTRUCTION_ID);

    if (failedAction.result.status !== 0) {
      throw new Error(
        `Expected status 0, received ${failedAction.result.status}`,
      );
    }

    const failedSignature =
      normalizeSignature(failedAction.signature);

    const failedSigner = recoverTeeSigner(
      failedAction,
      failedSignature,
    );

    console.log(`Failure signer: ${failedSigner}`);
    console.log(`Failure log: ${failedAction.result.log}`);

    if (
      failedSigner.toLowerCase() !==
      TEE_ID.toLowerCase()
    ) {
      throw new Error("Failure result was not signed by the TEE");
    }

    await gateway.finalizeFailedRequest.staticCall(
      failedAction.result.data,
      FAILED_INSTRUCTION_ID,
      failedAction.result.submissionTag,
      failedAction.result.status,
      failedSignature,
    );

    console.log("Failure finalization simulation passed.");

    await sendTransaction(
      "Finalize failed retry",
      gateway.finalizeFailedRequest(
        failedAction.result.data,
        FAILED_INSTRUCTION_ID,
        failedAction.result.submissionTag,
        failedAction.result.status,
        failedSignature,
      ),
    );
  } else {
    console.log("Failed retry request is already closed.");
  }

  let payroll = await vault.getPayroll(PAYROLL_ID);

  if (Number(payroll.status) !== 1) {
    throw new Error(
      `Payroll 1 did not return to Draft. Status: ${payroll.status}`,
    );
  }

  console.log("Payroll 1 reset to Draft.");

  /*
   * Step 2: recover the exact original ciphertext from Coston2.
   */
  const originalTransaction =
    await ethers.provider.getTransaction(ORIGINAL_REQUEST_TX);

  if (!originalTransaction) {
    throw new Error("Original transaction was not found");
  }

  if (
    originalTransaction.to?.toLowerCase() !==
    GATEWAY_ADDRESS.toLowerCase()
  ) {
    throw new Error("Original transaction was not sent to the gateway");
  }

  if (
    originalTransaction.from.toLowerCase() !==
    EXPECTED_OPERATOR.toLowerCase()
  ) {
    throw new Error("Original transaction has the wrong sender");
  }

  const parsedOriginal =
    gateway.interface.parseTransaction({
      data: originalTransaction.data,
      value: originalTransaction.value,
    });

  if (
    !parsedOriginal ||
    parsedOriginal.name !== "requestPayrollComputation"
  ) {
    throw new Error(
      "Original transaction is not a payroll computation request",
    );
  }

  const originalPayrollId = BigInt(parsedOriginal.args[0]);
  const originalCiphertext = String(parsedOriginal.args[1]);

  if (originalPayrollId !== PAYROLL_ID) {
    throw new Error(
      `Original transaction belongs to payroll ${originalPayrollId}`,
    );
  }

  if (
    !/^0x[0-9a-fA-F]+$/.test(originalCiphertext) ||
    originalCiphertext === "0x"
  ) {
    throw new Error("Recovered ciphertext is invalid");
  }

  const originalCiphertextHash =
    ethers.keccak256(originalCiphertext);

  console.log("Original ciphertext recovered from Coston2.");
  console.log(
    `Original ciphertext hash: ${originalCiphertextHash}`,
  );

  /*
   * Step 3: resubmit the original ciphertext under signer epoch 2.
   */
  const latestBlock = await ethers.provider.getBlock("latest");

  if (!latestBlock) {
    throw new Error("Unable to read latest Coston2 block");
  }

  const fundingDeadline: bigint =
    await vault.effectiveFundingDeadline(PAYROLL_ID);

  console.log(`Funding deadline: ${fundingDeadline}`);
  console.log(`Current timestamp: ${latestBlock.timestamp}`);

  if (BigInt(latestBlock.timestamp) > fundingDeadline) {
    throw new Error(
      "Payroll 1 funding deadline has expired. No request or token transfer was made.",
    );
  }

  const requestReceipt = await sendTransaction(
    "Resubmit original confidential payroll",
    gateway.requestPayrollComputation(
      PAYROLL_ID,
      originalCiphertext,
      { value: FCC_FEE_WEI },
    ),
  );

  const requestedEvent = findEvent(
    requestReceipt,
    gateway,
    "PayrollComputationRequested",
  );

  const newInstructionId =
    String(requestedEvent.args.instructionId);

  console.log(`New instruction ID: ${newInstructionId}`);
  console.log("Waiting for the TEE idempotent result...");

  const action = await pollActionResult(newInstructionId);

  console.log(`TEE status: ${action.result.status}`);
  console.log(`TEE log: ${action.result.log}`);

  if (action.result.status !== 1) {
    throw new Error(
      `TEE did not accept the original ciphertext: ${action.result.log}`,
    );
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
    throw new Error("Successful result has the wrong TEE signer");
  }

  await gateway.finalizePayrollComputation.staticCall(
    action.result.data,
    newInstructionId,
    action.result.submissionTag,
    action.result.status,
    normalizedSignature,
  );

  console.log("On-chain payroll finalization simulation passed.");

  await sendTransaction(
    "Finalize confidential payroll 1",
    gateway.finalizePayrollComputation(
      action.result.data,
      newInstructionId,
      action.result.submissionTag,
      action.result.status,
      normalizedSignature,
    ),
  );

  payroll = await vault.getPayroll(PAYROLL_ID);

  const computedStatus = Number(payroll.status);
  const totalRequired = BigInt(payroll.totalRequired);

  console.log(`Computed payroll status: ${computedStatus}`);
  console.log(
    `TEE-approved total: ${ethers.formatUnits(
      totalRequired,
      6,
    )} USD₮0`,
  );

  if (computedStatus !== 3) {
    throw new Error(
      `Expected Computed status 3, got ${computedStatus}`,
    );
  }

  if (totalRequired !== EXPECTED_AMOUNT) {
    throw new Error(
      `Expected exactly 2 USD₮0, got ${ethers.formatUnits(
        totalRequired,
        6,
      )}`,
    );
  }

  /*
   * Step 4: funding. Exactly 2 USD₮0.
   */
  const walletBalance =
    BigInt(await stablecoin.balanceOf(operatorAddress));

  console.log(
    `USD₮0 wallet balance: ${ethers.formatUnits(
      walletBalance,
      6,
    )}`,
  );

  if (walletBalance < EXPECTED_AMOUNT) {
    throw new Error("Insufficient USD₮0 balance");
  }

  await vault.openFunding.staticCall(PAYROLL_ID);

  await sendTransaction(
    "Open payroll funding",
    vault.openFunding(PAYROLL_ID),
  );

  const allowance = BigInt(
    await stablecoin.allowance(
      operatorAddress,
      VAULT_ADDRESS,
    ),
  );

  if (allowance < EXPECTED_AMOUNT) {
    await stablecoin.approve.staticCall(
      VAULT_ADDRESS,
      EXPECTED_AMOUNT,
    );

    await sendTransaction(
      "Approve exactly 2 USD₮0",
      stablecoin.approve(
        VAULT_ADDRESS,
        EXPECTED_AMOUNT,
      ),
    );
  }

  await vault.fundPayroll.staticCall(
    PAYROLL_ID,
    EXPECTED_AMOUNT,
  );

  console.log(
    "Funding simulation passed. Moving exactly 2 USD₮0.",
  );

  await sendTransaction(
    "Fund payroll with exactly 2 USD₮0",
    vault.fundPayroll(
      PAYROLL_ID,
      EXPECTED_AMOUNT,
    ),
  );

  payroll = await vault.getPayroll(PAYROLL_ID);

  const finalWalletBalance =
    BigInt(await stablecoin.balanceOf(operatorAddress));

  const vaultBalance =
    BigInt(await stablecoin.balanceOf(VAULT_ADDRESS));

  console.log("");
  console.log("LIVE CONFIDENTIAL PAYROLL COMPLETED");
  console.log(`Payroll ID: ${PAYROLL_ID}`);
  console.log(`Instruction ID: ${newInstructionId}`);
  console.log(`Payroll status: ${payroll.status}`);
  console.log("TEE signer epoch: 2");
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
    `Vault balance: ${ethers.formatUnits(
      vaultBalance,
      6,
    )} USD₮0`,
  );

  if (Number(payroll.status) !== 5) {
    throw new Error(
      `Payroll did not become Active. Status: ${payroll.status}`,
    );
  }
}

main().catch((error) => {
  console.error("");
  console.error("PAYROLL RECONCILIATION FAILED");
  console.error(error);
  process.exitCode = 1;
});