import { addCredits, CHAT_PACK_SIZE, claimPayments, PRICES, readPayments, treasury } from "@/lib/payments";
import { resolveSpeaker, type AuthPayload } from "@/lib/speaker";

// POST /api/chats/buy { txHash, auth } -> extra chats for $CHOG sent to the treasury.
// Every PRICES.chatPack $CHOG buys CHAT_PACK_SIZE chats, kept on the wallet.
export async function POST(request: Request) {
  const vault = treasury();
  if (!vault) return Response.json({ error: "Not open yet" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { txHash?: string; auth?: AuthPayload } | null;
  if (!body?.txHash) return Response.json({ error: "txHash required" }, { status: 400 });
  try {
    const paid = await readPayments([body.txHash]);
    const who = await resolveSpeaker(body.auth, undefined);
    if (who.address !== paid.from) return Response.json({ error: "Sign in with the wallet that paid" }, { status: 403 });
    const packs = Math.floor((paid.to.get(vault) ?? 0) / PRICES.chatPack);
    if (packs < 1) return Response.json({ error: `Send at least ${PRICES.chatPack} $CHOG to the treasury` }, { status: 400 });
    await claimPayments([body.txHash], { from: paid.from, purpose: "chats", amount: paid.to.get(vault)! });
    const credits = await addCredits(paid.from, packs * CHAT_PACK_SIZE);
    return Response.json({ added: packs * CHAT_PACK_SIZE, credits });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Purchase failed" }, { status: 400 });
  }
}
