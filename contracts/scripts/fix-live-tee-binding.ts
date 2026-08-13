import { ethers } from "hardhat";

const GATEWAY_ADDRESS =
  "0xFE9A84346A614599C9A0b5a1F444bd816a6C100A";

const INSTRUCTION_ID =
  "0x648859f7c3043f90b59ad04f7abda19f5dac086f75da5ecd3f5fb788006b8bc7";

const EXT_PROXY_URL =
  "https://unfurrowed-nonusurpingly-julianna.ngrok-free.dev";

const EXPECTED_TEE_ID =
  "0x59268355660DCb868507E538b967fc0eB05A394C";

type ActionResponse = {
  result: {
    id: string;
    submissionTag: string;
    status: number;
    log: string;
    data: string;
  };
  signature: string;
};

function normalizeSignature(signature: string): string {
  const bytes = ethers.getBytes(signature);

  if (bytes.length !== 65) {
    throw new Error(`Expected 65-byte signature, got ${bytes.length}`);
  }

  if (bytes[64] === 0 || bytes[64] === 1) {
    bytes[64] += 27;
  }

  if (bytes[64] !== 27 && bytes[64] !== 28) {
    throw new Error(`Unsupported signature V: ${bytes[64]}`);
  }

  return ethers.hexlify(bytes);
}

async function fetchAction(): Promise<ActionResponse> {
  const response = await fetch(
    `${EXT_PROXY_URL}/action/result/${INSTRUCTION_ID}`,
    {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Proxy returned HTTP ${response.status}`);
  }

  return (await response.json()) as ActionResponse;
}

async function send(label: string, promise: Promise<any>): Promise<void> {
  const transaction = await promise;

  console.log(`${label}: ${transaction.hash}`);

  const receipt = await transaction.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error(`${label} failed`);
  }
}

async function main(): Promise<void> {
  const [operator] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  if (network.chainId !== 114n) {
    throw new Error(`Wrong network: ${network.chainId}`);
  }

  const gateway: any = await ethers.getContractAt(
    "ZalaryConfidentialGateway",
    GATEWAY_ADDRESS,
    operator,
  );

  const action = await fetchAction();

  if (
    action.result.id.toLowerCase() !==
    INSTRUCTION_ID.toLowerCase()
  ) {
    throw new Error("Proxy returned the wrong instruction ID");
  }

  const normalizedSignature = normalizeSignature(action.signature);

  const dataHash = ethers.keccak256(action.result.data);

  const tagHash = ethers.keccak256(
    ethers.toUtf8Bytes(action.result.submissionTag),
  );

  const resultHash = ethers.keccak256(
    ethers.solidityPacked(
      ["bytes32", "bytes32", "bytes32", "uint8"],
      [
        dataHash,
        INSTRUCTION_ID,
        tagHash,
        action.result.status,
      ],
    ),
  );

  const prefix = ethers.encodeBytes32String("TEE_ACTION_RESULT");

  const payloadHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "uint256", "bytes32"],
      [prefix, 114n, resultHash],
    ),
  );

  const recoveredSigner = ethers.recoverAddress(
    ethers.hashMessage(ethers.getBytes(payloadHash)),
    normalizedSignature,
  );

  const request = await gateway.getRequestStatus(INSTRUCTION_ID);

  const selectedTeeId: string = request[1];
  const requestedAt: bigint = request[3];
  const requestClosed: boolean = request[4];

  const binding = await gateway.teeBindings(selectedTeeId);

  const currentSigner: string = binding[0];
  const currentEpoch: bigint = binding[1];
  const currentActive: boolean = binding[2];

  console.log("");
  console.log("=== SIGNATURE DIAGNOSIS ===");
  console.log(`Selected TEE ID:   ${selectedTeeId}`);
  console.log(`Expected TEE ID:   ${EXPECTED_TEE_ID}`);
  console.log(`Recovered signer:  ${recoveredSigner}`);
  console.log(`Configured signer: ${currentSigner}`);
  console.log(`Current epoch:     ${currentEpoch}`);
  console.log(`Binding active:    ${currentActive}`);
  console.log(`Request closed:    ${requestClosed}`);

  if (
    selectedTeeId.toLowerCase() !==
    EXPECTED_TEE_ID.toLowerCase()
  ) {
    throw new Error("Unexpected TEE was selected");
  }

  if (
    recoveredSigner.toLowerCase() !==
    selectedTeeId.toLowerCase()
  ) {
    throw new Error(
      "Recovered signer is not the selected TEE identity. No binding change made.",
    );
  }

  if (
    currentSigner.toLowerCase() !==
    recoveredSigner.toLowerCase()
  ) {
    const pending = await gateway.pendingTeeSignerProposals(
      selectedTeeId,
    );

    const pendingSigner: string = pending[0];
    const executableAt: bigint = pending[1];

    if (
      pendingSigner.toLowerCase() ===
        recoveredSigner.toLowerCase() &&
      executableAt > 0n
    ) {
      console.log("");
      console.log("Correct signer proposal already exists.");
      console.log(
        `Executable at Unix timestamp: ${executableAt}`,
      );
    } else {
      await send(
        "Propose correct TEE signer",
        gateway.proposeTeeSigner(
          selectedTeeId,
          recoveredSigner,
        ),
      );

      const updatedPending =
        await gateway.pendingTeeSignerProposals(selectedTeeId);

      console.log(
        `Signer activation timestamp: ${updatedPending[1]}`,
      );
    }
  } else {
    console.log("TEE signer binding is already correct.");
  }

  if (!requestClosed) {
    const latestBlock = await ethers.provider.getBlock("latest");

    if (!latestBlock) {
      throw new Error("Could not read latest block");
    }

    const staleAt = requestedAt + 900n;
    const now = BigInt(latestBlock.timestamp);

    if (now > staleAt) {
      await send(
        "Expire stale payroll 1 request",
        gateway.expireStaleRequest(INSTRUCTION_ID),
      );

      console.log(
        "Payroll 1 was reset to Draft. No USD₮0 was transferred.",
      );
    } else {
      console.log("");
      console.log(
        `Payroll 1 can be cleaned in ${staleAt - now + 1n} seconds.`,
      );
      console.log(`Stale timestamp: ${staleAt}`);
    }
  }
}

main().catch((error) => {
  console.error("");
  console.error("TEE BINDING FIX FAILED");
  console.error(error);
  process.exitCode = 1;
});