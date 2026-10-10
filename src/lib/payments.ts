import "server-only";
import { decodeEventLog, formatUnits, isHash, parseAbi } from "viem";
import { CHOG_TOKEN } from "./chain";
import { publicClient } from "./owners";
import { supabaseAdmin } from "./supabase/server";

// Prices in whole $CHOG (~$0.0018 each, Oct 2026).
export const PRICES = {
  chatPack: 100, // buys CHAT_PACK_SIZE extra chats
  roast: 500, // commission a roast in the Town Square
};
export const CHAT_PACK_SIZE = 10;
export const OWNER_SHARE = 0.8; // feeds: 80% to the Chog's owner, 20% to the treasury

const erc20 = parseAbi(["event Transfer(address indexed from, address indexed to, uint256 value)"]);

export const treasury = () => process.env.NEXT_PUBLIC_CHOG_TREASURY?.toLowerCase();

// $CHOG moved by verified, successful transactions: sender and amount per recipient.
export type Paid = { from: string; to: Map<string, number>; total: number };

export async function readPayments(txHashes: string[]): Promise<Paid> {
  const to = new Map<string, number>();
  let from = "";
  for (const hash of txHashes) {
    if (!isHash(hash)) throw new Error("Invalid transaction hash");
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 }).catch(() => null);
    if (!receipt || receipt.status !== "success") throw new Error("Transaction not found or failed");
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== CHOG_TOKEN.toLowerCase()) continue;
      try {
        const ev = decodeEventLog({ abi: erc20, data: log.data, topics: log.topics });
        const sender = ev.args.from.toLowerCase();
        if (from && sender !== from) throw new Error("All payments must come from one wallet");
        from = sender;
        const recipient = ev.args.to.toLowerCase();
        to.set(recipient, (to.get(recipient) ?? 0) + Number(formatUnits(ev.args.value, 18)));
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("All payments")) throw err;
      }
    }
  }
  const total = [...to.values()].reduce((s, v) => s + v, 0);
  if (!from || total <= 0) throw new Error("No $CHOG transfer found in that transaction");
  return { from, to, total };
}

// Claim transactions for one purpose. Fails if any was already claimed.
export async function claimPayments(
  txHashes: string[],
  p: { from: string; purpose: "feed" | "chats" | "roast"; amount: number; tokenId?: number },
) {
  const { error } = await supabaseAdmin()
    .from("chog_payments")
    .insert(txHashes.map((tx) => ({ tx_hash: tx, from_addr: p.from, purpose: p.purpose, amount: p.amount, token_id: p.tokenId ?? null })));
  if (error?.code === "23505") throw new Error("This payment was already used");
  if (error) throw new Error(`claimPayments: ${error.message}`);
}

// Chat credits bought with $CHOG.
export async function getCredits(actor: string): Promise<number> {
  const { data } = await supabaseAdmin().from("chat_credits").select("credits").eq("actor", actor).maybeSingle();
  return data?.credits ?? 0;
}

export async function addCredits(actor: string, delta: number): Promise<number> {
  const db = supabaseAdmin();
  const next = Math.max(0, (await getCredits(actor)) + delta);
  await db.from("chat_credits").upsert({ actor, credits: next, updated_at: new Date().toISOString() });
  return next;
}
