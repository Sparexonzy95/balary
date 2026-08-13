import { ethers } from "hardhat";

const GATEWAY =
  "0xFE9A84346A614599C9A0b5a1F444bd816a6C100A";

const TEE_ID =
  "0x59268355660DCb868507E538b967fc0eB05A394C";

const EXPECTED_SIGNER =
  "0x59268355660DCb868507E538b967fc0eB05A394C";

async function main(): Promise<void> {
  const [operator] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  if (network.chainId !== 114n) {
    throw new Error(`Wrong network: ${network.chainId}`);
  }

  const gateway: any = await ethers.getContractAt(
    "ZalaryConfidentialGateway",
    GATEWAY,
    operator,
  );

  const pending = await gateway.pendingTeeSignerProposals(TEE_ID);
  const proposedSigner: string = pending[0];
  const executableAt: bigint = pending[1];

  const block = await ethers.provider.getBlock("latest");

  if (!block) {
    throw new Error("Could not read latest Coston2 block");
  }

  console.log(`Proposed signer: ${proposedSigner}`);
  console.log(`Executable at: ${executableAt}`);
  console.log(`Current timestamp: ${block.timestamp}`);

  if (
    proposedSigner.toLowerCase() !==
    EXPECTED_SIGNER.toLowerCase()
  ) {
    throw new Error("Pending proposal is not the expected TEE signer");
  }

  if (BigInt(block.timestamp) < executableAt) {
    throw new Error(
      `Signer is not yet activatable. Remaining seconds: ${
        executableAt - BigInt(block.timestamp)
      }`,
    );
  }

  await gateway.activateTeeSigner.staticCall(TEE_ID);

  console.log("Activation simulation passed.");

  const transaction = await gateway.activateTeeSigner(TEE_ID);

  console.log(`Activation transaction: ${transaction.hash}`);

  const receipt = await transaction.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("Signer activation transaction failed");
  }

  const binding = await gateway.teeBindings(TEE_ID);

  const activeSigner: string = binding[0];
  const signerEpoch: bigint = binding[1];
  const active: boolean = binding[2];

  console.log("");
  console.log("TEE SIGNER ACTIVATED");
  console.log(`TEE ID: ${TEE_ID}`);
  console.log(`Active signer: ${activeSigner}`);
  console.log(`Signer epoch: ${signerEpoch}`);
  console.log(`Active: ${active}`);

  if (
    activeSigner.toLowerCase() !==
      EXPECTED_SIGNER.toLowerCase() ||
    !active
  ) {
    throw new Error("Post-activation binding verification failed");
  }
}

main().catch((error) => {
  console.error("");
  console.error("TEE SIGNER ACTIVATION FAILED");
  console.error(error);
  process.exitCode = 1;
});