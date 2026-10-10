import { auraDay, award, getAura } from "@/lib/aura";
import { parseTokenId } from "@/lib/chogs";
import { getOwner } from "@/lib/owners";
import { isRealWallet, resolveSpeaker, type AuthPayload } from "@/lib/speaker";
import { supabaseAdmin } from "@/lib/supabase/server";

const HYPES_PER_WALLET_PER_DAY = 10;

// POST /api/hype { tokenId, auth } -> a wallet boosts someone else's Chog.
// Once per wallet per Chog per day; fame has to come from other people.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { tokenId?: number; auth?: AuthPayload } | null;
  const tokenId = parseTokenId(String(body?.tokenId));
  if (!tokenId) return Response.json({ error: "tokenId required" }, { status: 400 });

  const owner = await getOwner(tokenId);
  const who = await resolveSpeaker(body?.auth, owner);
  if (!who.address) return Response.json({ error: "Sign in with your wallet to hype" }, { status: 401 });
  if (who.role === "owner") return Response.json({ error: "You can't hype your own Chog. Get your friends to." }, { status: 403 });
  if (!(await isRealWallet(who.address))) {
    return Response.json({ error: "This wallet is too new to hype. Hold a Chog or use a wallet with some Monad history." }, { status: 403 });
  }

  const { count } = await supabaseAdmin()
    .from("aura_events")
    .select("id", { count: "exact", head: true })
    .eq("source", "hype")
    .eq("actor", who.address)
    .gte("created_at", `${auraDay()}T00:00:00Z`);
  if ((count ?? 0) >= HYPES_PER_WALLET_PER_DAY) {
    return Response.json({ error: `You've used all ${HYPES_PER_WALLET_PER_DAY} hypes today.` }, { status: 429 });
  }

  const granted = await award(tokenId, "hype", 3, {
    actor: who.address,
    dedupeKey: `hype:${tokenId}:${who.address}:${auraDay()}`,
  });
  return Response.json({
    granted,
    alreadyToday: !granted,
    hypesLeft: Math.max(0, HYPES_PER_WALLET_PER_DAY - (count ?? 0) - (granted ? 1 : 0)),
    aura: await getAura(tokenId),
  });
}
