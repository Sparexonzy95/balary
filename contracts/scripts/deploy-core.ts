import { ethers } from "hardhat";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const protocolAdmin = process.env.PROTOCOL_ADMIN || deployer.address;
  const initialRelayer = process.env.INITIAL_RELAYER || deployer.address;
  if (protocolAdmin.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(
      "For this one-time deployment script, PROTOCOL_ADMIN must be the deployer. " +
        "Deploy from the multisig/admin wallet or configure the contracts manually.",
    );
  }
  const stablecoin = required("STABLECOIN_ADDRESS");
  const extensionRegistry = required("TEE_EXTENSION_REGISTRY");
  const machineRegistry = required("TEE_MACHINE_REGISTRY");
  const minimumWithdrawalAmount = BigInt(
    process.env.MINIMUM_WITHDRAWAL_AMOUNT || "1",
  );

  console.log("Deployer:", deployer.address);
  console.log("Protocol admin:", protocolAdmin);
  console.log("Initial relayer:", initialRelayer);
  console.log("Stablecoin:", stablecoin);
  console.log("Minimum withdrawal atomic units:", minimumWithdrawalAmount.toString());

  const Vault = await ethers.getContractFactory("ZalaryPrivatePayrollVault");
  const vault = await Vault.deploy(
    protocolAdmin,
    stablecoin,
    minimumWithdrawalAmount,
  );
  await vault.waitForDeployment();

  const Gateway = await ethers.getContractFactory("ZalaryConfidentialGateway");
  const gateway = await Gateway.deploy(
    protocolAdmin,
    initialRelayer,
    extensionRegistry,
    machineRegistry,
    await vault.getAddress(),
  );
  await gateway.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  const gatewayAddress = await gateway.getAddress();

  const connectTx = await vault.setConfidentialGateway(gatewayAddress);
  await connectTx.wait();

  console.log("\nDeployment complete");
  console.log("ZALARY_VAULT_ADDRESS=", vaultAddress);
  console.log("ZALARY_GATEWAY_ADDRESS=", gatewayAddress);
  console.log("\nNext steps:");
  console.log("1. Register the gateway as the Zalary FCE instruction sender.");
  console.log("2. Put the assigned extension ID in FCE_EXTENSION_ID.");
  console.log("3. Put the selected machine ID and proxy signer in TEE_ID and TEE_SIGNER_ADDRESS.");
  console.log("4. Run configure-fcc.ts once to propose and immediately activate the TEE signer.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
