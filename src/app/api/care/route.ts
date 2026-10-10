import { addLoyalty, auraDay, award, getAura } from "@/lib/aura";
import { parseTokenId } from "@/lib/chogs";
import { getOwner } from "@/lib/owners";
import { prepareSoul } from "@/lib/soul";
import { resolveSpeaker, type AuthPayload } from "@/lib/speaker";
import { supabaseAdmin } from "@/lib/supabase/server";

// Days in a row this owner has checked in, counting today.
async function currentStreak(tokenId: number, owner: string): Promise<number> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await supabaseAdmin()
    .from("aura_events")
    .select("created_at")
    .eq("token_id", tokenId)
    .eq("source", "owner_care")
    .eq("actor", owner)
    .gte("created_at", since);
  const days = new Set((data ?? []).map((r) => String(r.created_at).slice(0, 10)));
  let streak = 1; // today
  for (let d = 1; d <= 30; d++) {
    if (!days.has(new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10))) break;
    streak++;
  }
  return streak;
}

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
  const streak = await currentStreak(tokenId, speaker.address!);
  const multiplier = streak >= 7 ? 2 : streak >= 3 ? 1.5 : 1;
  const granted = await award(tokenId, "owner_care", Math.round(5 * multiplier), {
    actor: speaker.address,
    dedupeKey: `care:${tokenId}:${auraDay()}`,
  });
  await supabaseAdmin().from("chog_state").update({ last_care_at: new Date().toISOString() }).eq("token_id", tokenId);
  if (granted) await addLoyalty(tokenId, 5);

  return Response.json({ granted, alreadyToday: !granted, streak, multiplier, aura: await getAura(tokenId) });
}
