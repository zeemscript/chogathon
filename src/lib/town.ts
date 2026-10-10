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

export async function listPosts({
  limit = 40,
  tokenId,
  before,
}: { limit?: number; tokenId?: number; before?: number } = {}) {
  let q = supabaseAdmin().from("town_posts").select("*").order("id", { ascending: false }).limit(limit);
  if (tokenId) q = q.or(`token_id.eq.${tokenId},about_token_id.eq.${tokenId}`);
  if (before) q = q.lt("id", before);
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

type Kind = "post" | "gossip" | "roast";
type Generated = { content: string; kind: Kind; affinity_delta: number; grudge: string | null };

// The roast-able bits of a Chog: its visible traits, in plain words.
function looks(c: Chog) {
  return ["Head", "Eyes", "Mouth", "Body", "Accessory", "Background"]
    .filter((k) => c.traits[k] && c.traits[k] !== "None")
    .map((k) => `${k.toLowerCase()}: ${c.traits[k]}`)
    .join(", ");
}

function describe(c: Chog) {
  const p = buildPersonality(c.traits);
  return `#${c.tokenId} ${p.archetype}, ${p.temperament.join("/")}; ${looks(c) || c.traits.Tier}; voice: ${p.voice}`;
}

// Same text on every call, so DeepSeek's prompt cache bills it at the cheap
// cached rate. Everything that varies goes in the short user message.
const SQUARE_SYSTEM =
  "You write one post for Town Square, a public feed where Chog NFTs (chaotic creatures on Monad) talk about each other. " +
  "Be genuinely funny: specific, petty, unexpected, like the best replies on crypto Twitter. Max 180 chars. No hashtags. At most one emoji. " +
  "A roast mocks the target's actual traits (cap, eyes, outfit, item, background) in a clever way, never slurs or real-world hate. " +
  'Reply only with JSON: {"content":string,"kind":"post"|"gossip"|"roast","affinity_delta":int -25..25,"grudge":string|null}. ' +
  "affinity_delta = how the post shifts the author's feelings to the target. grudge = short reason if one forms, else null.";

// Skip the AI for a while after it fails (e.g. no credit) instead of paying the
// timeout on every post.
let aiDownUntil = 0;

async function generateWithAI(author: Chog, target: Chog, rel: Relation | undefined, recent: TownPost[], mode: Kind) {
  if (Date.now() < aiDownUntil) throw new Error("ai cooling down");
  const feeling = rel ? `feelings to target: ${rel.affinity}${rel.grudge ? `, grudge: ${rel.grudge}` : ""}` : "first time mentioning target";
  try {
    const res = await deepseek.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 1.25,
      max_tokens: 110,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SQUARE_SYSTEM },
        {
          role: "user",
          content: [
            `author: ${describe(author)}`,
            `target: ${describe(target)}`,
            feeling,
            recent.length ? `recent (don't repeat): ${recent.map((p) => p.content).join(" | ")}` : "",
            `write a ${mode} by #${author.tokenId}${mode === "post" ? "" : ` about #${target.tokenId}`}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });
    const out = JSON.parse(res.choices[0]?.message?.content ?? "{}") as Partial<Generated>;
    if (!out.content) throw new Error("empty post");
    return {
      content: out.content.slice(0, 240),
      kind: (["post", "gossip", "roast"] as Kind[]).includes(out.kind as Kind) ? (out.kind as Kind) : mode,
      affinity_delta: Number(out.affinity_delta) || 0,
      grudge: out.grudge ?? null,
    } satisfies Generated;
  } catch (err) {
    aiDownUntil = Date.now() + 10 * 60_000;
    throw err;
  }
}

// Trait-aware roasts for when the AI is off. {t} = target id, {x} = the trait.
const ROASTS: [string, string[]][] = [
  ["Head", [
    "#{t} wearing a {x} like it's a personality. It's not. It's a hat.",
    "Saw #{t}'s {x} today. Bold choice. Wrong, but bold.",
    "#{t} bought a {x} and stopped developing as a person.",
  ]],
  ["Eyes", [
    "#{t} has {x} eyes and still can't see it's mid.",
    "#{t}'s {x} eyes are the only thing on Monad that never sees a pump.",
  ]],
  ["Body", [
    "#{t} out here in a {x} like it has somewhere to be. Buddy, you live in a JPEG.",
    "Who told #{t} the {x} was a good idea? I need names.",
  ]],
  ["Mouth", [
    "#{t} with that {x} mouth talking alpha again. Sit down.",
    "Every time #{t} opens its {x} mouth, the floor drops 2%.",
  ]],
  ["Accessory", [
    "#{t} carries a {x} everywhere. Emotional support item?",
    "#{t} thinks the {x} makes it interesting. The {x} is doing all the work.",
  ]],
  ["Background", [
    "#{t}'s background is {x}. Even the background is trying harder than #{t}.",
  ]],
  ["Tier", [
    "#{t} is {x}. Says a lot. Says nothing, actually.",
  ]],
];

function roastFallback(target: Chog): string | undefined {
  const options = ROASTS.flatMap(([trait, lines]) => {
    const v = target.traits[trait];
    return v && v !== "None" && v !== "1:1" ? lines.map((l) => l.replaceAll("{x}", v).replaceAll("{t}", String(target.tokenId))) : [];
  });
  return options.length ? options[rand(options.length)] : undefined;
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

function generateFallback(author: Chog, target: Chog, rel: Relation | undefined, mode: Kind): Generated {
  const roast = mode === "roast" ? roastFallback(target) : undefined;
  if (roast) return { content: roast, kind: "roast", affinity_delta: -(6 + rand(8)), grudge: null };
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

  const [rels, recent] = await Promise.all([getRelations(authorId), listPosts({ limit: 3 })]);
  const rel = rels.find((r) => r.other_token_id === targetId);

  // About a third of posts are roasts; the rest gossip, plus a few solo thoughts.
  const r = Math.random();
  const mode: Kind = r < 0.35 ? "roast" : r < 0.9 ? "gossip" : "post";
  let gen: Generated;
  try {
    gen = await generateWithAI(author, target, rel, recent, mode);
  } catch {
    gen = generateFallback(author, target, rel, mode);
  }

  const solo = gen.kind === "post" && !gen.content.includes(`#${targetId}`);
  const db = supabaseAdmin();
  const row = { token_id: authorId, about_token_id: solo ? null : targetId, kind: gen.kind, content: gen.content };
  let { data: post, error } = await db.from("town_posts").insert(row).select().single();
  if (error?.code === "23514" && gen.kind === "roast") {
    // Database not migrated for roasts yet (0003): store it as gossip.
    ({ data: post, error } = await db.from("town_posts").insert({ ...row, kind: "gossip" }).select().single());
  }
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

export type TownStats = {
  postsToday: number;
  bonds: number;
  feudsCount: number;
  trending: { tokenId: number; mentions: number }[];
  feuds: { a: number; b: number; affinity: number; grudge: string | null }[];
  besties: { a: number; b: number; affinity: number }[];
};

// Sidebar data for the Square: who's being talked about and who's fighting.
export async function townStats(): Promise<TownStats> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [posts, mentions, enemies, friends, bonds, feudsCount] = await Promise.all([
    db.from("town_posts").select("id", { count: "exact", head: true }).gte("created_at", since),
    db.from("aura_events").select("token_id").eq("source", "square_mention").gte("created_at", since).limit(2000),
    db.from("chog_relations").select("token_id, other_token_id, affinity, grudge").lt("affinity", -10).order("affinity").limit(30),
    db.from("chog_relations").select("token_id, other_token_id, affinity").gt("affinity", 10).order("affinity", { ascending: false }).limit(30),
    db.from("chog_relations").select("token_id", { count: "exact", head: true }).neq("affinity", 0),
    db.from("chog_relations").select("token_id", { count: "exact", head: true }).lt("affinity", -10),
  ]);

  const counts = new Map<number, number>();
  for (const m of mentions.data ?? []) counts.set(m.token_id, (counts.get(m.token_id) ?? 0) + 1);
  const trending = [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tokenId, n]) => ({ tokenId, mentions: n }));

  // One entry per pair, strongest feeling first.
  const pairs = <T extends { token_id: number; other_token_id: number }>(rows: T[]) => {
    const seen = new Set<string>();
    return rows.filter((r) => {
      const k = [r.token_id, r.other_token_id].sort((x, y) => x - y).join(":");
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  return {
    postsToday: posts.count ?? 0,
    bonds: bonds.count ?? 0,
    feudsCount: feudsCount.count ?? 0,
    trending,
    feuds: pairs(enemies.data ?? [])
      .slice(0, 4)
      .map((r) => ({ a: r.token_id, b: r.other_token_id, affinity: r.affinity, grudge: r.grudge })),
    besties: pairs(friends.data ?? [])
      .slice(0, 3)
      .map((r) => ({ a: r.token_id, b: r.other_token_id, affinity: r.affinity })),
  };
}
