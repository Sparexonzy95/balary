import { useMemo, useState } from "react";
import { errorMessage } from "../lib/api";
import { sendPreparedTransaction } from "../lib/tx";
import type { Address, PreparedTx } from "../lib/types";
import { useWallet } from "../lib/wallet";

export type TransactionPhase = "idle" | "connecting" | "network" | "wallet" | "submitted";

export function useTxSender() {
  const wallet = useWallet();
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [phase, setPhase] = useState<TransactionPhase>("idle");
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  async function sendPrepared(payload: PreparedTx, label = "Transaction") {
    setPendingLabel(label);
    setLastHash(null);
    setLastError(null);
    try {
      setPhase(wallet.address ? "network" : "connecting");
      const account = wallet.address || (await wallet.connect());
      if (!wallet.walletClient) throw new Error("Wallet client is not ready");
      setPhase("network");
      await wallet.ensureCoston2();
      setPhase("wallet");
      const hash = await sendPreparedTransaction(wallet.walletClient, account as Address, payload);
      setLastHash(hash);
      setPhase("submitted");
      return hash;
    } catch (error) {
      const message = errorMessage(error);
      setLastError(message);
      throw new Error(message);
    } finally {
      setPendingLabel(null);
      setPhase("idle");
    }
  }

  const statusText = useMemo(() => {
    if (!pendingLabel) return null;
    if (phase === "connecting") return "Connecting wallet...";
    if (phase === "network") return "Checking Coston2...";
    if (phase === "wallet") return "Confirm in wallet...";
    if (phase === "submitted") return "Transaction submitted";
    return `${pendingLabel}...`;
  }, [pendingLabel, phase]);

  return {
    sendPrepared,
    pendingLabel,
    phase,
    statusText,
    lastHash,
    lastError,
    busy: Boolean(pendingLabel),
  };
}

