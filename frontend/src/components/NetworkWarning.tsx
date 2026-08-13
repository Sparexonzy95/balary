import { AlertTriangle } from "lucide-react";
import { env } from "../lib/env";
import { useWallet } from "../lib/wallet";

export function NetworkWarning() {
  const wallet = useWallet();
  const wrongNetwork = Boolean(wallet.address && wallet.chainId && wallet.chainId !== env.arcChainId);

  if (!wrongNetwork) return null;

  return (
    <button type="button" className="network-warning" onClick={() => void wallet.ensureCoston2()}>
      <AlertTriangle size={15} />
      Switch to Flare Coston2
    </button>
  );
}

