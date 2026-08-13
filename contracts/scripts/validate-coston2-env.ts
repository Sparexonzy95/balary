import { ethers } from "hardhat";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function validAddress(name: string): string {
  const value = required(name);
  if (!ethers.isAddress(value) || value === ethers.ZeroAddress) {
    throw new Error(`${name} is not a valid non-zero EVM address`);
  }
  return ethers.getAddress(value);
}

async function requireCode(name: string, address: string): Promise<void> {
  const code = await ethers.provider.getCode(address);
  if (code === "0x") throw new Error(`${name} has no contract code at ${address}`);
  console.log(`✓ ${name}: ${address}`);
}

async function main(): Promise<void> {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 114n) {
    throw new Error(`Expected Coston2 chain id 114, received ${network.chainId}`);
  }
  console.log(`✓ Connected to Coston2 (${network.chainId})`);

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer account configured");
  console.log(`✓ Deployer: ${deployer.address}`);

  const protocolAdmin = validAddress("PROTOCOL_ADMIN");
  const initialRelayer = validAddress("INITIAL_RELAYER");
  const stablecoin = validAddress("STABLECOIN_ADDRESS");
  const extensionRegistry = validAddress("TEE_EXTENSION_REGISTRY");
  const machineRegistry = validAddress("TEE_MACHINE_REGISTRY");

  if (protocolAdmin.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error("PROTOCOL_ADMIN must equal the deployer for the current deploy-core.ts flow");
  }
  console.log(`✓ Protocol admin: ${protocolAdmin}`);
  console.log(`✓ Initial relayer: ${initialRelayer}`);

  await requireCode("STABLECOIN_ADDRESS", stablecoin);
  await requireCode("TEE_EXTENSION_REGISTRY", extensionRegistry);
  await requireCode("TEE_MACHINE_REGISTRY", machineRegistry);

  const token = new ethers.Contract(
    stablecoin,
    ["function decimals() view returns (uint8)", "function symbol() view returns (string)"],
    ethers.provider,
  );
  const decimals = Number(await token.decimals());
  if (decimals <= 0 || decimals > 18) throw new Error(`Unsupported stablecoin decimals: ${decimals}`);
  let symbol = "UNKNOWN";
  try { symbol = await token.symbol(); } catch {}
  console.log(`✓ Stablecoin: ${symbol}, ${decimals} decimals`);

  const minimumRaw = required("MINIMUM_WITHDRAWAL_AMOUNT");
  const minimum = BigInt(minimumRaw);
  if (minimum <= 0n) throw new Error("MINIMUM_WITHDRAWAL_AMOUNT must be positive");
  console.log(`✓ Minimum withdrawal: ${minimum} atomic units`);

  const balance = await ethers.provider.getBalance(deployer.address);
  if (balance === 0n) throw new Error("Deployer has no C2FLR for gas");
  console.log(`✓ Deployer C2FLR balance: ${ethers.formatEther(balance)}`);

  console.log("\nCoston2 pre-deployment environment validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
