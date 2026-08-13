import { ethers } from "hardhat";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

async function main() {
  const gatewayAddress = required("ZALARY_GATEWAY_ADDRESS");
  const extensionId = BigInt(required("FCE_EXTENSION_ID"));
  const teeId = required("TEE_ID");
  const teeSigner = required("TEE_SIGNER_ADDRESS");
  const gateway = await ethers.getContractAt("ZalaryConfidentialGateway", gatewayAddress);

  const currentExtensionId = await gateway.extensionId().catch(() => 0n);
  if (currentExtensionId === 0n) {
    const tx = await gateway.setExtensionId(extensionId);
    await tx.wait();
  } else if (currentExtensionId !== extensionId) {
    throw new Error(
      `Gateway is already bound to extension ${currentExtensionId}, not ${extensionId}`,
    );
  }

  const binding = await gateway.teeBindings(teeId);
  if (binding.active && binding.signer.toLowerCase() === teeSigner.toLowerCase()) {
    console.log("TEE binding is already active.");
  } else {
    const proposal = await gateway.pendingTeeSignerProposals(teeId);

    let activeProposal = proposal;
    if (activeProposal.signer === ethers.ZeroAddress) {
      const tx = await gateway.proposeTeeSigner(teeId, teeSigner);
      await tx.wait();
      activeProposal = await gateway.pendingTeeSignerProposals(teeId);
      console.log("TEE signer proposed.");
    }

    const latestBlock = await ethers.provider.getBlock("latest");
    if (!latestBlock) throw new Error("Unable to read latest block");
    const now = BigInt(latestBlock.timestamp);

    if (activeProposal.signer.toLowerCase() !== teeSigner.toLowerCase()) {
      throw new Error(`Pending signer ${activeProposal.signer} does not match ${teeSigner}`);
    }
    if (now < activeProposal.executableAt) {
      throw new Error(
        `Signer proposal is not ready. Activate after Unix time ${activeProposal.executableAt}`,
      );
    }

    const tx = await gateway.activateTeeSigner(teeId);
    await tx.wait();
    console.log("TEE signer activated.");
  }

  const finalBinding = await gateway.teeBindings(teeId);
  console.log("Gateway:", gatewayAddress);
  console.log("Extension ID:", (await gateway.extensionId()).toString());
  console.log("TEE machine ID:", teeId);
  console.log("TEE signer:", finalBinding.signer);
  console.log("TEE signer epoch:", finalBinding.epoch.toString());
  console.log("TEE active:", finalBinding.active);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
