import { ethers } from "hardhat";

const MACHINE_MANAGER_ABI = [
  "function getActiveTeeMachines(uint256 extensionId) view returns (address[] teeIds, string[] urls)",
  "function getExtensionId(address teeId) view returns (uint256)",
  "function getTeeMachineOwner(address teeId) view returns (address)",
  "function pause(address teeId)",
];

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in .env or process environment`);
  return value;
}

async function main() {
  const [owner] = await ethers.getSigners();
  const managerAddress = required("TEE_MACHINE_REGISTRY");
  const extensionId = BigInt(required("FCE_EXTENSION_ID"));
  const currentTeeId = ethers.getAddress(required("CURRENT_TEE_ID"));
  const staleTeeId = ethers.getAddress(required("STALE_TEE_ID"));

  if (currentTeeId === staleTeeId) {
    throw new Error("Refusing to pause the active TEE: STALE_TEE_ID equals TEE_ID");
  }

  const manager = new ethers.Contract(managerAddress, MACHINE_MANAGER_ABI, owner);
  const [activeIdsBefore] = await manager.getActiveTeeMachines(extensionId);
  const activeBefore = (activeIdsBefore as string[]).map(ethers.getAddress);

  if (!activeBefore.includes(currentTeeId)) {
    throw new Error("Configured active TEE is not active for this extension");
  }
  if (!activeBefore.includes(staleTeeId)) {
    console.log("Legacy TEE is already paused; no transaction sent.");
    return;
  }

  const [staleExtensionId, currentExtensionId, staleOwner] = await Promise.all([
    manager.getExtensionId(staleTeeId),
    manager.getExtensionId(currentTeeId),
    manager.getTeeMachineOwner(staleTeeId),
  ]);
  if (staleExtensionId !== extensionId || currentExtensionId !== extensionId) {
    throw new Error("TEE extension binding does not match FCE_EXTENSION_ID");
  }
  if (ethers.getAddress(staleOwner) !== ethers.getAddress(owner.address)) {
    throw new Error("Connected signer is not the legacy TEE owner");
  }

  await manager.pause.staticCall(staleTeeId);
  const tx = await manager.pause(staleTeeId);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("Legacy TEE pause transaction failed");
  }

  const [activeIdsAfter] = await manager.getActiveTeeMachines(extensionId);
  const activeAfter = (activeIdsAfter as string[]).map(ethers.getAddress);
  if (activeAfter.length !== 1 || activeAfter[0] !== currentTeeId) {
    throw new Error("Post-pause active TEE set is not exactly the configured current TEE");
  }

  console.log("Legacy TEE paused successfully.");
  console.log("Extension ID:", extensionId.toString());
  console.log("Remaining active TEE:", currentTeeId);
  console.log("Transaction:", receipt.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
