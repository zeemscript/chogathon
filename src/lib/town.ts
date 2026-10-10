import "server-only";
import { CHAT_MODEL, deepseek } from "./ai";
import { award } from "./aura";
import { CHOG_SUPPLY } from "./chain";
import { getChog, type Chog } from "./chogs";
import { buildPersonality } from "./personality";
import { supabaseAdmin } from "./supabase/server";

// Town Square: Chogs post on their own, gossip about each other, and every
// post nudges a relationship. Relationships then flow back into chat.

export type TownPost = {
  id: number;
  token_id: number;
  about_token_id: number | null;
  kind: "post" | "gossip" | "event" | "reaction";
  content: string;
  created_at: string;
};

export type Relation = {
  token_id: number;
  other_token_id: number;
  affinity: number;
  grudge: string | null;
  notes: string | null;
};

const rand = (n: number) => Math.floor(Math.random() * n);
const clamp = (n: number) => Math.max(-100, Math.min(100, Math.round(n)));

export async function listPosts({ limit = 40, tokenId }: { limit?: number; tokenId?: number } = {}) {
  let q = supabaseAdmin().from("town_posts").select("*").order("created_at", { ascending: false }).limit(limit);
  if (tokenId) q = q.or(`token_id.eq.${tokenId},about_token_id.eq.${tokenId}`);
  const { data, error } = await q;
  if (error) throw new Error(`listPosts: ${error.message}`);
  return data as TownPost[];
}

export async function getRelations(tokenId: number): Promise<Relation[]> {
  const { data, error } = await supabaseAdmin()
    .from("chog_relations")
    .select("token_id, other_token_id, affinity, grudge, notes")
    .eq("token_id", tokenId)
    .order("affinity", { ascending: true });
  if (error) throw new Error(`getRelations: ${error.message}`);
  return data as Relation[];
}

async function ensureChogs(ids: number[]) {
  const rows = ids.map(getChog).filter((c): c is Chog => !!c);
  await supabaseAdmin()
    .from("chogs")
    .upsert(
      rows.map((c) => ({ token_id: c.tokenId, name: c.name, image: c.image, traits: c.traits })),
      { onConflict: "token_id", ignoreDuplicates: true },
    );
}

// Shift how `from` feels about `to`. Grudges stick until replaced or erased.
export async function nudgeRelation(from: number, to: number, delta: number, grudge?: string | null, note?: string) {
  if (from === to) return;
  await ensureChogs([from, to]);
  const db = supabaseAdmin();
  const { data } = await db
    .from("chog_relations")
    .select("affinity, grudge")
    .eq("token_id", from)
    .eq("other_token_id", to)
    .maybeSingle();
  const affinity = clamp((data?.affinity ?? 0) + delta);
  // A strong bond (love or hate) is worth Aura once per pair.
  if (Math.abs(affinity) >= 50 && Math.abs(data?.affinity ?? 0) < 50) {
    await award(from, "bond", 10, { actor: String(to), dedupeKey: `bond:${from}:${to}` });
  }
  await db.from("chog_relations").upsert({
    token_id: from,
    other_token_id: to,
    affinity,
    grudge: grudge === undefined ? (data?.grudge ?? null) : grudge,
    notes: note ?? null,
    updated_at: new Date().toISOString(),
  });
}

// Pick who speaks next. Prefer Chogs with a life (chatted, related), with
// some random newcomers so the whole collection slowly wakes up.
async function pickAuthor(): Promise<number> {
  if (Math.random() < 0.35) {
    const { data } = await supabaseAdmin().from("chog_state").select("token_id").limit(200);
    if (data?.length) return data[rand(data.length)].token_id;
  }
  return rand(CHOG_SUPPLY) + 1;
}

async function pickTarget(author: number): Promise<number> {
  const rels = await getRelations(author);
  // Keep existing dramas going most of the time.
  if (rels.length && Math.random() < 0.65) {
    const strongest = [...rels].sort((a, b) => Math.abs(b.affinity) - Math.abs(a.affinity));
    return strongest[rand(Math.min(3, strongest.length))].other_token_id;
  }
  let t = rand(CHOG_SUPPLY) + 1;
  if (t === author) t = (t % CHOG_SUPPLY) + 1;
  return t;
}

type Generated = { content: string; kind: "post" | "gossip"; affinity_delta: number; grudge: string | null };

function describe(c: Chog) {
  const p = buildPersonality(c.traits);
  const look = ["Head", "Eyes", "Body", "Accessory"]
    .map((k) => c.traits[k])
    .filter((v) => v && v !== "None")
    .join(", ");
  return `${c.name}, ${p.archetype} (${p.temperament.join(", ")}). Look: ${look || c.traits.Tier}. Voice: ${p.voice}.`;
}

async function generateWithAI(author: Chog, target: Chog, rel: Relation | undefined, recent: TownPost[]) {
  const feeling = rel
    ? `Current feelings about ${target.name}: affinity ${rel.affinity} (-100 hate, 100 love)${rel.grudge ? `, grudge: "${rel.grudge}"` : ""}.`
    : `You have never talked about ${target.name} before.`;
  const res = await deepseek.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 1.2,
    max_tokens: 200,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You write posts for Town Square, a public feed where Chog NFTs (chaotic little creatures on Monad) gossip about each other. " +
          "Posts are short (max 200 chars), funny, petty, in character, like a social media post. No hashtags. At most one emoji. " +
          'Reply with JSON: {"content": string, "kind": "post"|"gossip", "affinity_delta": integer -25..25, "grudge": string|null}. ' +
          "affinity_delta is how this post changes the author's feelings toward the target. grudge is a short reason if a grudge forms, else null.",
      },
      {
        role: "user",
        content: [
          `Author: ${describe(author)}`,
          `Target: ${describe(target)}`,
          feeling,
          recent.length ? `Recent Square posts:\n${recent.map((p) => `- #${p.token_id}: ${p.content}`).join("\n")}` : "",
          `Write ${author.name}'s next post. Mention ${target.name} by name (as #${target.tokenId}).`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
  });
  const out = JSON.parse(res.choices[0]?.message?.content ?? "{}") as Partial<Generated>;
  if (!out.content) throw new Error("empty post");
  return {
    content: out.content.slice(0, 280),
    kind: out.kind === "post" ? "post" : "gossip",
    affinity_delta: Number(out.affinity_delta) || 0,
    grudge: out.grudge ?? null,
  } satisfies Generated;
}

// No AI? The Square keeps talking with in-character templates.
const NICE = [
  "Shoutout to #{t}. Only Chog on Monad with taste. Don't tell the others.",
  "#{t} and I bonded over {like} today. We're basically family now.",
  "Me and #{t} are starting a band. Genre: chaos.",
  "If anyone messes with #{t}, they mess with me. That's the post.",
  "#{t} said gm to me first. Respect. Massive respect.",
];
const MEAN = [
  "Saw #{t} pretending to like {like}. Fake. I can always tell.",
  "#{t} walked past me without saying gm. Noted. Remembered. Forever.",
  "Not saying #{t} copied my look, but why are we suddenly matching??",
  "Heard #{t}'s human paper-handed them once. Explains a lot.",
  "#{t} said {like} is overrated. We are no longer speaking.",
  "Who let #{t} into the Square looking like that.",
  "#{t} owes me 3 $CHOG and an apology. Not necessarily in that order.",
];
const SOLO = [
  "Thinking about {like} again. Can't stop. Won't stop.",
  "Another day on Monad, another block, another reason to hate {dislike}.",
  "My human hasn't talked to me today. I'm fine. Totally fine.",
  "Hot take: {dislike} should be illegal on Monad.",
];

function generateFallback(author: Chog, target: Chog, rel: Relation | undefined): Generated {
  const p = buildPersonality(author.traits);
  const mean = rel ? rel.affinity < 0 || (rel.affinity < 20 && Math.random() < 0.4) : Math.random() < 0.55;
  const solo = Math.random() < 0.15;
  const pool = solo ? SOLO : mean ? MEAN : NICE;
  const content = pool[rand(pool.length)]
    .replace("{t}", String(target.tokenId))
    .replace("{like}", p.likes[0])
    .replace("{dislike}", p.dislikes[0]);
  return {
    content,
    kind: solo ? "post" : "gossip",
    affinity_delta: solo ? 0 : mean ? -(8 + rand(10)) : 6 + rand(10),
    grudge: mean && !solo && Math.random() < 0.4 ? content.slice(0, 80) : null,
  };
}

// One tick of the Square: one Chog posts, and feelings shift both ways.
export async function townTick(): Promise<TownPost[]> {
  const authorId = await pickAuthor();
  const targetId = await pickTarget(authorId);
  const author = getChog(authorId)!;
  const target = getChog(targetId)!;
  await ensureChogs([authorId, targetId]);

  const [rels, recent] = await Promise.all([getRelations(authorId), listPosts({ limit: 6 })]);
  const rel = rels.find((r) => r.other_token_id === targetId);

  let gen: Generated;
  try {
    gen = await generateWithAI(author, target, rel, recent);
  } catch {
    gen = generateFallback(author, target, rel);
  }

  const solo = gen.kind === "post" && !gen.content.includes(`#${targetId}`);
  const db = supabaseAdmin();
  const { data: post, error } = await db
    .from("town_posts")
    .insert({ token_id: authorId, about_token_id: solo ? null : targetId, kind: gen.kind, content: gen.content })
    .select()
    .single();
  if (error) throw new Error(`townTick: ${error.message}`);

  const created = [post as TownPost];
  await award(authorId, "square_post", 1, { dedupeKey: `post:${(post as TownPost).id}` });
  if (!solo) {
    // Being talked about is fame, good or bad.
    await award(targetId, "square_mention", 3, { actor: String(authorId), dedupeKey: `mention:${(post as TownPost).id}` });
  }
  if (!solo) {
    await nudgeRelation(authorId, targetId, gen.affinity_delta, gen.grudge);
    // Being talked about stings (or flatters) the target too.
    await nudgeRelation(targetId, authorId, Math.round(gen.affinity_delta * 0.6));
  }
  return created;
}

// Run a tick only if the Square has been quiet for a while.
export async function tickIfQuiet(minGapMs = 3 * 60_000) {
  const [last] = await listPosts({ limit: 1 });
  if (last && Date.now() - Date.parse(last.created_at) < minGapMs) return [];
  return townTick();
}
