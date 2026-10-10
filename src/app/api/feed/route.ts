import { decodeEventLog, formatUnits, isHash, parseAbi } from "viem";
import { addLoyalty, award, chogCurve, getAura } from "@/lib/aura";
import { CHOG_TOKEN } from "@/lib/chain";
import { parseTokenId } from "@/lib/chogs";
import { publicClient } from "@/lib/owners";
import { supabaseAdmin } from "@/lib/supabase/server";

const erc20 = parseAbi(["event Transfer(address indexed from, address indexed to, uint256 value)"]);

// POST /api/feed { tokenId, txHash } -> credit a verified $CHOG transfer to the
// treasury as food for this Chog. Anyone can feed any Chog. Aura from $CHOG
// follows a sqrt curve and is capped at 30% of the Chog's total Aura.
export async function POST(request: Request) {
  const treasury = process.env.NEXT_PUBLIC_CHOG_TREASURY?.toLowerCase();
  if (!treasury) return Response.json({ error: "Feeding isn't open yet" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { tokenId?: number; txHash?: string } | null;
  const tokenId = parseTokenId(String(body?.tokenId));
  const txHash = body?.txHash;
  if (!tokenId || !txHash || !isHash(txHash)) {
    return Response.json({ error: "tokenId and txHash required" }, { status: 400 });
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 }).catch(() => null);
  if (!receipt || receipt.status !== "success") return Response.json({ error: "Transaction not found or failed" }, { status: 400 });

  let amount = 0;
  let from = "";
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== CHOG_TOKEN.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: erc20, data: log.data, topics: log.topics });
      if (ev.args.to.toLowerCase() === treasury) {
        amount += Number(formatUnits(ev.args.value, 18));
        from = ev.args.from.toLowerCase();
      }
    } catch {}
  }
  if (amount <= 0) return Response.json({ error: "No $CHOG sent to the treasury in that transaction" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: prev } = await db.from("chog_feeds").select("amount").eq("token_id", tokenId);
  const before = (prev ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const { error } = await db.from("chog_feeds").insert({ tx_hash: txHash, token_id: tokenId, from_addr: from, amount });
  if (error?.code === "23505") return Response.json({ error: "Already counted" }, { status: 409 });
  if (error) throw new Error(error.message);

  const points = Math.round((chogCurve(before + amount) - chogCurve(before)) * 10) / 10;
  await award(tokenId, "chog_feed", points, { actor: from, dedupeKey: `feed:${txHash}`, meta: { amount } });
  await addLoyalty(tokenId, Math.min(10, Math.ceil(amount / 100)));

  return Response.json({ amount, points, aura: await getAura(tokenId) });
}
