import { useState } from "react";
import { errorMessage } from "../lib/api";
import { sendPreparedTransaction } from "../lib/tx";
import type { Address, PreparedTx } from "../lib/types";
import { useWallet } from "../lib/wallet";

export function useTxSender() {
  const wallet = useWallet();
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  async function sendPrepared(payload: PreparedTx, label = "Transaction") {
    setPendingLabel(label);
    setLastError(null);
    try {
      const account = wallet.address || (await wallet.connect());
      if (!wallet.walletClient) throw new Error("Wallet client is not ready");
      await wallet.ensureCoston2();
      return await sendPreparedTransaction(wallet.walletClient, account as Address, payload);
    } catch (error) {
      const message = errorMessage(error);
      setLastError(message);
      throw new Error(message);
    } finally {
      setPendingLabel(null);
    }
  }

  return {
    sendPrepared,
    pendingLabel,
    lastError,
    busy: Boolean(pendingLabel),
  };
}

