import type { WalletClient } from "viem";
import { arcTestnet } from "./chains";
import type { Address, PreparedTx } from "./types";

export function txTarget(payload: PreparedTx): Address {
  if (!payload.to) throw new Error("Prepared transaction is missing its target address");
  return payload.to as Address;
}

export function encodePreparedTx(payload: PreparedTx) {
  if (!payload.data) throw new Error("Prepared transaction is missing calldata");
  return payload.data as `0x${string}`;
}

export async function sendPreparedTransaction(
  walletClient: WalletClient,
  account: Address,
  payload: PreparedTx,
) {
  if (payload.chain_id !== arcTestnet.id) {
    throw new Error(`Prepared transaction targets chain ${payload.chain_id}, expected ${arcTestnet.id}`);
  }
  if (payload.from_address && payload.from_address.toLowerCase() !== account.toLowerCase()) {
    throw new Error("Connected wallet does not match the prepared transaction sender");
  }

  return walletClient.sendTransaction({
    account,
    chain: arcTestnet,
    to: txTarget(payload),
    data: encodePreparedTx(payload),
    value: BigInt(payload.value || "0"),
  });
}
