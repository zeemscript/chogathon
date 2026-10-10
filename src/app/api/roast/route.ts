import { parseTokenId } from "@/lib/chogs";
import { getOwner } from "@/lib/owners";
import { claimPayments, PRICES, readPayments, treasury } from "@/lib/payments";
import { resolveSpeaker, type AuthPayload } from "@/lib/speaker";
import { createPost } from "@/lib/town";

// POST /api/roast { fromTokenId, targetTokenId, txHash, auth }
// Commission a roast: your Chog publicly roasts another Chog in the Square.
// You must own the roasting Chog (the NFT is the voice), and pay PRICES.roast.
export async function POST(request: Request) {
  const vault = treasury();
  if (!vault) return Response.json({ error: "Not open yet" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as {
    fromTokenId?: number;
    targetTokenId?: number;
    txHash?: string;
    auth?: AuthPayload;
  } | null;
  const from = parseTokenId(String(body?.fromTokenId));
  const target = parseTokenId(String(body?.targetTokenId));
  if (!from || !target || from === target || !body?.txHash) {
    return Response.json({ error: "fromTokenId, targetTokenId and txHash required" }, { status: 400 });
  }
  try {
    const owner = await getOwner(from);
    const who = await resolveSpeaker(body.auth, owner);
    if (who.role !== "owner") return Response.json({ error: "Only the roasting Chog's owner can commission a roast" }, { status: 403 });
    const paid = await readPayments([body.txHash]);
    if (paid.from !== who.address) return Response.json({ error: "Pay from the wallet that owns your Chog" }, { status: 403 });
    if ((paid.to.get(vault) ?? 0) < PRICES.roast) {
      return Response.json({ error: `A roast costs ${PRICES.roast} $CHOG` }, { status: 400 });
    }
    await claimPayments([body.txHash], { from: paid.from, purpose: "roast", amount: paid.to.get(vault)!, tokenId: from });
    const post = await createPost(from, target, "roast", { commissioned_by: paid.from });
    return Response.json({ post });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Roast failed" }, { status: 400 });
  }
}
