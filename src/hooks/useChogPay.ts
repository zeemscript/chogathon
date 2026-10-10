"use client";

import { parseUnits } from "viem";
import { useWriteContract } from "wagmi";
import { CHOG_TOKEN } from "@/lib/chain";

export const TREASURY = process.env.NEXT_PUBLIC_CHOG_TREASURY as `0x${string}` | undefined;

// Same numbers as src/lib/payments.ts (server is the source of truth).
export const PRICES = { chatPack: 100, roast: 500 };
export const CHAT_PACK_SIZE = 10;
export const OWNER_SHARE = 0.8;

const erc20 = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

// Send $CHOG; resolves with the transaction hash once the wallet signs.
export function useChogPay() {
  const { writeContractAsync } = useWriteContract();
  return (to: `0x${string}`, amount: number) =>
    writeContractAsync({ address: CHOG_TOKEN, abi: erc20, functionName: "transfer", args: [to, parseUnits(String(amount), 18)] });
}

// Wallet errors are long and scary; say what happened in one line.
export function friendly(err: unknown, fallback: string) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/reject|denied|cancel/i.test(msg)) return "Cancelled in your wallet. No $CHOG was sent.";
  if (/insufficient|exceeds balance/i.test(msg)) return "Not enough $CHOG (or MON for gas) in this wallet.";
  return msg.split("\n")[0] || fallback;
}
