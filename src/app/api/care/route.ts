import { addLoyalty, auraDay, award, getAura } from "@/lib/aura";
import { parseTokenId } from "@/lib/chogs";
import { getOwner } from "@/lib/owners";
import { prepareSoul } from "@/lib/soul";
import { resolveSpeaker, type AuthPayload } from "@/lib/speaker";
import { supabaseAdmin } from "@/lib/supabase/server";

// POST /api/care { tokenId, auth } -> the owner's daily check-in.
// Earns care Aura once a day, raises loyalty and stops the neglect fade.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { tokenId?: number; auth?: AuthPayload } | null;
  const tokenId = parseTokenId(String(body?.tokenId));
  if (!tokenId) return Response.json({ error: "tokenId required" }, { status: 400 });

  const owner = await getOwner(tokenId);
  const speaker = await resolveSpeaker(body?.auth, owner);
  if (speaker.role !== "owner") return Response.json({ error: "Only its human can do that" }, { status: 403 });

  await prepareSoul(tokenId, owner); // makes sure state exists and transfers are noticed
  const granted = await award(tokenId, "owner_care", 5, {
    actor: speaker.address,
    dedupeKey: `care:${tokenId}:${auraDay()}`,
  });
  await supabaseAdmin().from("chog_state").update({ last_care_at: new Date().toISOString() }).eq("token_id", tokenId);
  if (granted) await addLoyalty(tokenId, 5);

  return Response.json({ granted, alreadyToday: !granted, aura: await getAura(tokenId) });
}
