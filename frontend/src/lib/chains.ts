import type { Chain } from "viem";
import { env } from "./env";

export const arcTestnet = {
  id: env.arcChainId,
  name: "Flare Coston2",
  nativeCurrency: {
    name: env.arcNativeSymbol,
    symbol: env.arcNativeSymbol,
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [env.arcRpcUrl] },
    public: { http: [env.arcRpcUrl] },
  },
  blockExplorers: {
    default: {
      name: "Coston2 Explorer",
      url: env.blockExplorerUrl,
    },
  },
  testnet: true,
} as const satisfies Chain;

export const coston2 = arcTestnet;

export function chainIdHex(chainId = env.arcChainId) {
  return `0x${chainId.toString(16)}`;
}

export function txExplorerUrl(hash?: string | null) {
  return hash ? `${env.blockExplorerUrl}/tx/${hash}` : undefined;
}

export function addressExplorerUrl(address?: string | null) {
  return address ? `${env.blockExplorerUrl}/address/${address}` : undefined;
}
