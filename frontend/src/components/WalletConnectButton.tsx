import { LogOut, Wallet } from "lucide-react";
import { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { shortAddress } from "../lib/utils";
import { useWallet } from "../lib/wallet";

export function WalletConnectButton() {
  const wallet = useWallet();
  const auth = useAuth();

  async function handleConnect() {
    try {
      const address = await wallet.connect();
      await auth.loginWithWallet(address, wallet.signMessage);
    } catch (error) {
      window.alert(errorMessage(error));
    }
  }

  function handleDisconnect() {
    auth.logout();
    wallet.disconnect();
  }

  if (!auth.isAuthenticated) {
    return (
      <button
        className="btn"
        onClick={() => void handleConnect()}
        disabled={wallet.connecting}
      >
        <Wallet size={16} />
        {wallet.connecting ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="badge"
      onClick={handleDisconnect}
      title="Connected wallet - click to disconnect"
    >
      <LogOut size={14} />
      {shortAddress(auth.account?.wallet_address)}
    </button>
  );
}
