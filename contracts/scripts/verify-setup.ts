import { ethers } from "hardhat";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

async function main() {
  const vaultAddress = required("ZALARY_VAULT_ADDRESS");
  const gatewayAddress = required("ZALARY_GATEWAY_ADDRESS");
  const teeId = required("TEE_ID");
  const expectedSigner = required("TEE_SIGNER_ADDRESS");
  const expectedRelayer = required("INITIAL_RELAYER");

  const vault = await ethers.getContractAt("ZalaryPrivatePayrollVault", vaultAddress);
  const gateway = await ethers.getContractAt("ZalaryConfidentialGateway", gatewayAddress);

  const configuredGateway = await vault.confidentialGateway();
  if (configuredGateway.toLowerCase() !== gatewayAddress.toLowerCase()) {
    throw new Error(`Vault gateway mismatch: ${configuredGateway}`);
  }

  const configuredVault = await gateway.VAULT();
  if (configuredVault.toLowerCase() !== vaultAddress.toLowerCase()) {
    throw new Error(`Gateway vault mismatch: ${configuredVault}`);
  }

  const binding = await gateway.teeBindings(teeId);
  if (!binding.active) throw new Error("TEE machine binding is not active");
  if (binding.signer.toLowerCase() !== expectedSigner.toLowerCase()) {
    throw new Error(`TEE signer mismatch: ${binding.signer}`);
  }

  const relayerRole = await gateway.RELAYER_ROLE();
  if (!(await gateway.hasRole(relayerRole, expectedRelayer))) {
    throw new Error(`${expectedRelayer} does not have RELAYER_ROLE`);
  }

  console.log("Vault:", vaultAddress);
  console.log("Gateway:", gatewayAddress);
  console.log("Stablecoin:", await vault.STABLECOIN());
  console.log("Stablecoin decimals:", (await vault.STABLECOIN_DECIMALS()).toString());
  console.log("Minimum withdrawal:", (await vault.defaultMinimumWithdrawalAmount()).toString());
  console.log("Extension ID:", (await gateway.extensionId()).toString());
  console.log("TEE machine:", teeId);
  console.log("TEE signer:", binding.signer);
  console.log("TEE signer epoch:", binding.epoch.toString());
  console.log("Relayer:", expectedRelayer);
  console.log("Configuration verified.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
