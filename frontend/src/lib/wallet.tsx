import React from "react";
import { createWalletClient, custom, type WalletClient } from "viem";
import { arcTestnet, chainIdHex } from "./chains";
import { env } from "./env";
import type { Address } from "./types";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
};

type WalletContextValue = {
  address: Address | null;
  chainId: number | null;
  provider: EthereumProvider | null;
  walletClient: WalletClient | null;
  connecting: boolean;
  connect: () => Promise<Address>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<string>;
  ensureCoston2: () => Promise<void>;
  ensureArc: () => Promise<void>;
};

const WalletContext = React.createContext<WalletContextValue | null>(null);

function getProvider(): EthereumProvider | null {
  const injected = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  if (!injected) return null;

  const providers = injected.providers;
  if (Array.isArray(providers) && providers.length > 0) {
    return providers.find((candidate) => candidate.isMetaMask) || providers[0];
  }

  return injected;
}

function normalizeAddress(address: string): Address {
  return address as Address;
}

function rpcErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const direct = (error as { code?: unknown }).code;
  if (typeof direct === "number") return direct;
  const nested = (error as { error?: { code?: unknown } }).error?.code;
  return typeof nested === "number" ? nested : undefined;
}

async function switchToCoston2(provider: EthereumProvider) {
  const id = chainIdHex();
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: id }],
    });
  } catch (error) {
    if (rpcErrorCode(error) !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: id,
          chainName: "Flare Testnet Coston2",
          rpcUrls: [env.arcRpcUrl],
          blockExplorerUrls: [env.blockExplorerUrl],
          nativeCurrency: {
            name: "Coston2 Flare",
            symbol: env.arcNativeSymbol,
            decimals: 18,
          },
        },
      ],
    });
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = React.useState<Address | null>(null);
  const [chainId, setChainId] = React.useState<number | null>(null);
  const [provider, setProvider] = React.useState<EthereumProvider | null>(() => getProvider());
  const [connecting, setConnecting] = React.useState(false);
  const providerRef = React.useRef<EthereumProvider | null>(provider);
  const addressRef = React.useRef<Address | null>(address);

  React.useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  React.useEffect(() => {
    addressRef.current = address;
  }, [address]);

  const walletClient = React.useMemo(() => {
    if (!provider) return null;
    return createWalletClient({
      chain: arcTestnet,
      transport: custom(provider),
    });
  }, [provider]);

  React.useEffect(() => {
    const nextProvider = getProvider();
    setProvider(nextProvider);
    providerRef.current = nextProvider;
    if (!nextProvider) return;

    const handleAccounts = (accounts: unknown) => {
      const first = Array.isArray(accounts) ? accounts[0] : null;
      const nextAddress = first ? normalizeAddress(String(first)) : null;
      addressRef.current = nextAddress;
      setAddress(nextAddress);
    };
    const handleChain = (nextChainId: unknown) => {
      setChainId(Number.parseInt(String(nextChainId), 16));
    };

    nextProvider.on?.("accountsChanged", handleAccounts);
    nextProvider.on?.("chainChanged", handleChain);

    void nextProvider
      .request({ method: "eth_accounts" })
      .then(handleAccounts)
      .catch(() => undefined);
    void nextProvider
      .request({ method: "eth_chainId" })
      .then(handleChain)
      .catch(() => undefined);

    return () => {
      nextProvider.removeListener?.("accountsChanged", handleAccounts);
      nextProvider.removeListener?.("chainChanged", handleChain);
    };
  }, []);

  const ensureCoston2 = React.useCallback(async () => {
    const activeProvider = providerRef.current || getProvider();
    if (!activeProvider) throw new Error("MetaMask or another browser wallet was not found");
    await switchToCoston2(activeProvider);
    const activeChain = await activeProvider.request({ method: "eth_chainId" });
    setChainId(Number.parseInt(String(activeChain), 16));
  }, []);

  const connect = React.useCallback(async () => {
    const activeProvider = providerRef.current || getProvider();
    if (!activeProvider) throw new Error("MetaMask or another browser wallet was not found");

    setConnecting(true);
    try {
      const accounts = (await activeProvider.request({ method: "eth_requestAccounts" })) as string[];
      if (!Array.isArray(accounts) || !accounts[0]) {
        throw new Error("The wallet did not return an account");
      }

      const connected = normalizeAddress(accounts[0]);
      await switchToCoston2(activeProvider);
      const activeChain = await activeProvider.request({ method: "eth_chainId" });

      providerRef.current = activeProvider;
      addressRef.current = connected;
      setProvider(activeProvider);
      setAddress(connected);
      setChainId(Number.parseInt(String(activeChain), 16));
      return connected;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = React.useCallback(() => {
    addressRef.current = null;
    setAddress(null);
  }, []);

  const signMessage = React.useCallback(async (message: string) => {
    const activeProvider = providerRef.current || getProvider();
    if (!activeProvider) throw new Error("MetaMask or another browser wallet was not found");

    let activeAddress = addressRef.current;
    if (!activeAddress) {
      const accounts = (await activeProvider.request({ method: "eth_accounts" })) as string[];
      if (Array.isArray(accounts) && accounts[0]) {
        activeAddress = normalizeAddress(accounts[0]);
      }
    }
    if (!activeAddress) {
      activeAddress = await connect();
    }

    const client = createWalletClient({
      chain: arcTestnet,
      transport: custom(activeProvider),
    });

    return client.signMessage({
      account: activeAddress,
      message,
    });
  }, [connect]);

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        provider,
        walletClient,
        connecting,
        connect,
        disconnect,
        signMessage,
        ensureCoston2,
        ensureArc: ensureCoston2,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = React.useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside WalletProvider");
  return context;
}
