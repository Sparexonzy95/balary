import { LogOut, Wallet } from "lucide-react";
import { errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useWallet } from "../lib/wallet";
import { shortAddress } from "../lib/utils";
import { Button } from "./ui";

export function WalletButton() {
  const wallet = useWallet();
  const auth = useAuth();

  async function connectAndLogin() {
    try {
      const address = await wallet.connect();
      await auth.loginWithWallet(address, wallet.signMessage);
    } catch (error) {
      window.alert(errorMessage(error));
    }
  }

  if (auth.isAuthenticated) {
    return (
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          auth.logout();
          wallet.disconnect();
        }}
      >
        <LogOut size={16} />
        {shortAddress(auth.account?.wallet_address)}
      </Button>
    );
  }

  return (
    <Button type="button" onClick={connectAndLogin} disabled={wallet.connecting}>
      <Wallet size={16} />
      {wallet.connecting ? "Connecting" : "Connect"}
    </Button>
  );
}

