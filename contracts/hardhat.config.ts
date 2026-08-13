import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

dotenv.config();

const rawPrivateKey = process.env.DEPLOYER_PRIVATE_KEY?.trim() ?? "";

if (
  rawPrivateKey.length > 0 &&
  !/^0x[0-9a-fA-F]{64}$/.test(rawPrivateKey)
) {
  throw new Error(
    "DEPLOYER_PRIVATE_KEY must be blank or contain 0x followed by 64 hexadecimal characters",
  );
}

const accounts = rawPrivateKey.length > 0 ? [rawPrivateKey] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      hardfork: "cancun",
    },
    coston2: {
      url:
        process.env.COSTON2_RPC_URL ||
        "https://coston2-api.flare.network/ext/C/rpc",
      chainId: 114,
      accounts,
    },
  },
  mocha: {
    timeout: 120_000,
  },
};

export default config;
