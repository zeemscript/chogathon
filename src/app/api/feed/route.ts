import { addLoyalty, award, chogCurve, getAura } from "@/lib/aura";
import { parseTokenId } from "@/lib/chogs";
import { getOwner } from "@/lib/owners";
import { claimPayments, OWNER_SHARE, readPayments, treasury } from "@/lib/payments";
import { resolveSpeaker, type AuthPayload } from "@/lib/speaker";
import { supabaseAdmin } from "@/lib/supabase/server";

// POST /api/feed { tokenId, txHashes, auth } -> credit a $CHOG feed.
// Fans pay the Chog's owner 80% and the treasury 20%, so a famous Chog earns
// its holder real $CHOG. Owners feeding their own Chog pay the treasury 100%
// (otherwise they'd buy Aura at a 20% discount). Aura from $CHOG follows a sqrt
// curve and is capped at 30% of the Chog's total Aura.
export async function POST(request: Request) {
  const vault = treasury();
  if (!vault) return Response.json({ error: "Feeding isn't open yet" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { tokenId?: number; txHashes?: string[]; auth?: AuthPayload } | null;
  const tokenId = parseTokenId(String(body?.tokenId));
  const txHashes = [...new Set(body?.txHashes ?? [])].slice(0, 3);
  if (!tokenId || !txHashes.length) return Response.json({ error: "tokenId and txHashes required" }, { status: 400 });

  try {
    const paid = await readPayments(txHashes);
    // Only the wallet that sent the $CHOG can say which Chog it was for.
    const who = await resolveSpeaker(body?.auth, undefined);
    if (who.address !== paid.from) return Response.json({ error: "Sign in with the wallet that sent this $CHOG" }, { status: 403 });

    const owner = await getOwner(tokenId);
    const toVault = paid.to.get(vault) ?? 0;
    const toOwner = owner && owner !== vault ? (paid.to.get(owner) ?? 0) : 0;
    const total = toVault + toOwner;
    const selfFeed = owner === paid.from;
    const ok = selfFeed
      ? toVault > 0 // feeding your own Chog: everything to the treasury
      : total > 0 && toOwner >= total * (OWNER_SHARE - 0.01) && toVault >= total * (1 - OWNER_SHARE - 0.01);
    if (!ok) {
      return Response.json(
        { error: selfFeed ? "Feeding your own Chog goes to the treasury" : "Expected 80% to the owner and 20% to the treasury" },
        { status: 400 },
      );
    }
    const amount = selfFeed ? toVault : total;
    await claimPayments(txHashes, { from: paid.from, purpose: "feed", amount, tokenId });

    const db = supabaseAdmin();
    const { data: prev } = await db.from("chog_feeds").select("amount").eq("token_id", tokenId);
    const before = (prev ?? []).reduce((s, r) => s + Number(r.amount), 0);
    await db.from("chog_feeds").insert({
      tx_hash: txHashes[0],
      token_id: tokenId,
      from_addr: paid.from,
      amount,
      owner_addr: selfFeed ? null : owner,
      owner_amount: selfFeed ? 0 : toOwner,
    });

    const points = Math.round((chogCurve(before + amount) - chogCurve(before)) * 10) / 10;
    await award(tokenId, "chog_feed", points, { actor: paid.from, dedupeKey: `feed:${txHashes[0]}`, meta: { amount } });
    await addLoyalty(tokenId, Math.min(10, Math.ceil(amount / 100)));
    return Response.json({ amount, toOwner: selfFeed ? 0 : toOwner, points, aura: await getAura(tokenId) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Feeding failed" }, { status: 400 });
  }
}
