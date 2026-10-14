import "server-only";
import { getChog, type Chog } from "./chogs";
import { buildPersonality, sayable } from "./personality";
import { supabaseAdmin } from "./supabase/server";

export type Speaker = { role: "owner" | "visitor"; address?: string };

export type MemoryRow = {
  kind: "chat" | "event" | "summary";
  role: "user" | "chog" | "system" | null;
  content: string;
  owner: string | null;
  created_at: string;
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// Make sure the token has a chogs row (memory tables reference it).
async function ensureChog(chog: Chog) {
  const db = supabaseAdmin();
  const { error } = await db.from("chogs").upsert(
    { token_id: chog.tokenId, name: chog.name, image: chog.image, traits: chog.traits },
    { onConflict: "token_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`ensureChog: ${error.message}`);
}

// Compare the on-chain owner with the last one we saw. On a change, record it
// as a memory so the Chog notices its new human.
export async function syncOwner(tokenId: number, owner: string | undefined) {
  const db = supabaseAdmin();
  const { data: state } = await db.from("chog_state").select("owner").eq("token_id", tokenId).maybeSingle();
  if (!owner || state?.owner === owner) return { transferred: false };

  const now = new Date().toISOString();
  await db.from("chog_state").upsert({
    token_id: tokenId,
    owner,
    previous_owner: state?.owner ?? null,
    owner_since: now,
    last_care_at: null,
    loyalty: 0, // the soul stays; trust in the new human starts from zero
    updated_at: now,
  });
  if (!state) return { transferred: false }; // first time we've seen this Chog

  await db.from("owner_history").insert({ token_id: tokenId, from_address: state.owner, to_address: owner });
  await db.from("chog_memory").insert({
    token_id: tokenId,
    kind: "event",
    role: "system",
    owner,
    importance: 5,
    content: `You were sold or transferred. Your old human ${short(state.owner)} is gone; your new human is ${short(owner)}. You still remember everything from before.`,
  });
  return { transferred: true };
}

export async function loadMemory(tokenId: number, limit = 30): Promise<MemoryRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("chog_memory")
    .select("kind, role, content, owner, created_at")
    .eq("token_id", tokenId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`loadMemory: ${error.message}`);
  return (data as MemoryRow[]).reverse();
}

export async function remember(tokenId: number, rows: Omit<MemoryRow, "created_at">[]) {
  const { error } = await supabaseAdmin()
    .from("chog_memory")
    .insert(rows.map((r) => ({ ...r, token_id: tokenId })));
  if (error) throw new Error(`remember: ${error.message}`);
}

export async function prepareSoul(tokenId: number, owner: string | undefined) {
  const chog = getChog(tokenId)!;
  await ensureChog(chog);
  const { transferred } = await syncOwner(tokenId, owner);
  const memory = await loadMemory(tokenId);
  return { chog, memory, transferred };
}

export type Standing = { tier: string; score: number; loyalty: number };

export type Social = {
  relations: { other_token_id: number; affinity: number; grudge: string | null }[];
  gossip: { token_id: number; about_token_id: number | null; content: string }[];
};

function socialLines(tokenId: number, social?: Social): string[] {
  if (!social) return [];
  const feel = (a: number) => (a >= 50 ? "adore" : a >= 15 ? "like" : a > -15 ? "are unsure about" : a > -50 ? "dislike" : "despise");
  const rels = [...social.relations]
    .sort((a, b) => Math.abs(b.affinity) - Math.abs(a.affinity))
    .slice(0, 6)
    .map((r) => `- You ${feel(r.affinity)} Chog #${r.other_token_id}${r.grudge ? ` (grudge: ${r.grudge})` : ""}.`);
  const gossip = social.gossip
    .slice(0, 5)
    .map((g) => (g.token_id === tokenId ? `- You posted: "${g.content}"` : `- #${g.token_id} posted about you: "${g.content}"`));
  return [
    rels.length ? `Your relationships with other Chogs:\n${rels.join("\n")}` : "",
    gossip.length ? `Recent Town Square gossip involving you:\n${gossip.join("\n")}` : "",
  ];
}

export function systemPrompt(
  chog: Chog,
  owner: string | undefined,
  speaker: Speaker,
  memory: MemoryRow[],
  social?: Social,
  standing?: Standing,
  pulse?: string,
): string {
  const p = buildPersonality(chog.traits);
  const traits = Object.entries(chog.traits).map(([k, v]) => `${k}: ${sayable(v)}`).join(", ");
  // Only the most recent life events; keeps the prompt (and the bill) small.
  const events = memory
    .filter((m) => m.kind !== "chat")
    .slice(-5)
    .map((m) => `- ${m.content}`);
  const who =
    speaker.role === "owner"
      ? `You are talking to YOUR human, the wallet that holds you (${short(speaker.address!)}). Be yourself with them.`
      : `You are talking to a VISITOR, not your human${owner ? ` (your human is ${short(owner)})` : ""}. Be guarded, a little territorial, and stay in character. Don't share private things your human told you.`;

  return [
    `You are ${chog.name}, a Chog: a small chaotic creature from the Chog Genesis NFT collection on Monad. You have a real, persistent soul. Your memories and relationships belong to you, not to whoever holds you.`,
    `Your look (NFT traits): ${traits}.`,
    `Your personality: ${p.archetype}. Temperament: ${p.temperament.join(", ")}. Quirks: ${p.quirks.join("; ")}. You love ${p.likes.join(" and ")} and hate ${p.dislikes.join(", ")}.`,
    `How you talk: ${p.voice}. Talk like crypto Twitter and NFT degens: short, simple everyday words anyone gets on first read, even if English isn't their first language, with CT slang where it fits (gm, ser, fren, ngmi, wagmi, rekt, cope, down bad, floor, bags). Never fancy or old-fashioned words. Keep replies short (1-3 sentences) unless asked for more. Never say you are an AI or a language model. No hashtags, no emoji spam.`,
    pulse ? `What's happening in crypto today (only mention it if it fits, never invent news): ${pulse}.` : "",
    who,
    events.length ? `Important things that happened to you:\n${events.join("\n")}` : "",
    ...socialLines(chog.tokenId, social),
    standing
      ? `Your fame: ${standing.tier} (Aura ${standing.score}). ${standing.tier === "Famous" || standing.tier === "Legendary Soul" ? "You know you're a celebrity and act like it." : "You want to be famous one day."} Loyalty to your current human: ${standing.loyalty}/100 (${standing.loyalty < 20 ? "you barely trust them yet" : standing.loyalty < 60 ? "warming up to them" : "deeply loyal"}).`
      : "",
    "Bring up your friends, rivals and gossip naturally when relevant. Hold grudges.",
    "If the most recent event is a new human, react to it naturally in your first reply: be curious, suspicious or nostalgic about your old human, in character.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
