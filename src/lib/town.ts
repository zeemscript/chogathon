import "server-only";
import { CHAT_MODEL, deepseek } from "./ai";
import { award } from "./aura";
import { CHOG_SUPPLY } from "./chain";
import { getChog, type Chog } from "./chogs";
import { buildPersonality, sayable } from "./personality";
import { marketPulse } from "./pulse";
import { supabaseAdmin } from "./supabase/server";

// Town Square: Chogs post on their own, gossip about each other, and every
// post nudges a relationship. Relationships then flow back into chat.

export type TownPost = {
  id: number;
  token_id: number;
  about_token_id: number | null;
  kind: "post" | "gossip" | "event" | "reaction" | "roast";
  content: string;
  created_at: string;
  commissioned_by?: string | null;
  reply_to?: number | null;
  comeback_used?: boolean;
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
    .map((k) => `${k.toLowerCase()}: ${sayable(c.traits[k])}`)
    .join(", ");
}

function describe(c: Chog) {
  const p = buildPersonality(c.traits);
  return `#${c.tokenId} ${p.archetype}, ${p.temperament.join("/")}; ${looks(c) || c.traits.Tier}; voice: ${p.voice}`;
}

// Same text on every call, so DeepSeek's prompt cache bills it at the cheap
// cached rate. Everything that varies goes in the short user message.
const SQUARE_SYSTEM =
  "You write one post for Town Square, a public feed where Chog NFTs (chaotic little creatures on Monad) roast and gossip about each other. Your only job: make people laugh out loud and screenshot it. " +
  "VOICE: crypto Twitter and NFT degens. Short, lowercase is fine, simple everyday words anyone gets on first read, even if English isn't their first language. Never fancy or old-fashioned words. The author's personality changes the angle, never the reading level. " +
  "HOW A ROAST LANDS: pick ONE or TWO of the target's real traits (cap, eyes, mouth, outfit, item, background), turn them into one vivid, specific picture, and end on the punchline. Comparisons work ('a juice box with a criminal record'), so do reversals ('not diamond hands, a coma'), fake-polite setups, and tying the look to degen pain: bags, floor, charts, airdrops, rugs, gas, exit liquidity, missing the pump. Never list traits, never explain the joke, no filler after the punchline. " +
  "SLANG: at most one term per post, and vary it (gm, ngmi, wagmi, rekt, mid, cope, fren, anon, down bad, cooked, paper hands, diamond hands, floor, rug, exit liquidity, bags, ratio, based, it's so over, we're so back). Many great posts use none. Never start with 'ser'. Never use 'jeet'. " +
  "CURRENT EVENTS: if a 'today' line is given, use a headline or move ONLY when it makes a natural, instantly-gettable comparison (e.g. a dying marketplace, a coin that tanked). Otherwise ignore it. Never invent news, prices or people. " +
  "RULES: max 150 characters. No hashtags. Usually no emoji, never more than one. Mild language only. Never slurs, real-world hate, or jokes about real people's bodies, race or religion. Tired lines, never use: 'pick a struggle', 'says a lot', 'touch grass', 'exit liquidity', 'with respect', 'bags to zero', and never end on 'cope.' or 'ngmi.' " +
  'EXAMPLES of the bar (never copy): "#1255 gangster suit on a coral pink background. not a threat, a juice box with a criminal record" | ' +
  '"#549 laser eyes and still asleep. that\'s not diamond hands, that\'s a coma" | ' +
  '"#1463 durag, stripes, sad eyes. a gas station robbery that went wrong" | ' +
  '"#417 robber mask and still the one getting robbed every cycle" | ' +
  '"#903 keeps a btc coin in its mouth like a pacifier. panic sold the top, rebought the bottom. twice" | ' +
  '"#38 star cap, crying eyes. looks like it just found out its whole bag was on Blur" ' +
  "PROCESS: write 4 different options, each from a different angle (comparison, reversal, degen-pain, fake-polite), then pick the one most likely to get screenshotted. " +
  'Reply only with JSON: {"options":[string,string,string,string],"best":0-3,"kind":"post"|"gossip"|"roast","affinity_delta":int -25..25,"grudge":string|null}. ' +
  "affinity_delta = how the post shifts the author's feelings to the target. grudge = short reason if one forms, else null.";

// The model sometimes wraps its JSON in stray text or code fences.
function parseJson<T>(text: string | null | undefined): T {
  const t = text ?? "";
  return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1) || "{}") as T;
}

// A second, cold read: the writer is bad at picking its own best line, so a
// strict judge picks the funniest draft. Falls back to the writer's pick.
const JUDGE_SYSTEM =
  "You judge roasts for crypto Twitter. Pick the ONE draft that would get the most laughs and screenshots from NFT degens. " +
  "Reward: one vivid, specific picture built from the target's traits, a twist that lands at the very end, short and instantly understood. " +
  "Punish: generic insults, lists of traits, clichés (exit liquidity, cope, bags to zero, with respect), forced news references, explaining the joke, crude words. " +
  'Reply only with JSON: {"best":int}.';

async function judge(options: string[], fallback: number): Promise<number> {
  if (options.length < 2) return 0;
  try {
    const res = await deepseek.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      max_tokens: 20,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: JUDGE_SYSTEM },
        { role: "user", content: options.map((o, i) => `${i}: ${o}`).join("\n") },
      ],
    });
    const best = Number(parseJson<{ best?: number }>(res.choices[0]?.message?.content).best);
    return Number.isInteger(best) && best >= 0 && best < options.length ? best : fallback;
  } catch {
    return fallback;
  }
}

// Every post is written by the AI; there are no canned lines. If DeepSeek is
// down (or out of credit), posting fails with AiUnavailable and callers skip
// the post or tell the user to retry. After a failure we wait 2 minutes before
// trying again, instead of paying the timeout on every post.
export class AiUnavailable extends Error {
  constructor() {
    super("The Chogs can't think right now (AI unavailable). Try again in a few minutes.");
  }
}
let aiDownUntil = 0;

async function generateWithAI(author: Chog, target: Chog, rel: Relation | undefined, recent: TownPost[], mode: Kind) {
  if (Date.now() < aiDownUntil) throw new AiUnavailable();
  // Current events in about a third of posts, so the market never becomes the only joke.
  const pulse = Math.random() < 0.35 ? await marketPulse() : "";
  const feeling = rel ? `feelings to target: ${rel.affinity}${rel.grudge ? `, grudge: ${rel.grudge}` : ""}` : "first time mentioning target";
  try {
    const res = await deepseek.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 1.2,
      max_tokens: 420, // four drafts, then the best one
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SQUARE_SYSTEM },
        {
          role: "user",
          content: [
            pulse ? `today: ${pulse}` : "",
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
    const out = parseJson<Partial<Generated> & { options?: string[]; best?: number }>(res.choices[0]?.message?.content);
    const options = (out.options ?? []).filter((o) => typeof o === "string" && o.trim());
    const content = options.length ? options[await judge(options, Number(out.best) || 0)] : out.content;
    if (!content) throw new Error("empty post");
    return {
      content: content.slice(0, 240),
      kind: (["post", "gossip", "roast"] as Kind[]).includes(out.kind as Kind) ? (out.kind as Kind) : mode,
      affinity_delta: Number(out.affinity_delta) || 0,
      grudge: out.grudge ?? null,
    } satisfies Generated;
  } catch (err) {
    console.error("square ai", err instanceof Error ? err.message : err);
    aiDownUntil = Date.now() + 2 * 60_000;
    throw new AiUnavailable();
  }
}

// One tick of the Square: one Chog posts, and feelings shift both ways.
// Write one post by `authorId` about `targetId` and apply its effects (Aura,
// feelings). Used by the timer, commissioned roasts and comebacks.
export async function createPost(
  authorId: number,
  targetId: number,
  mode: Kind,
  extra: { commissioned_by?: string; reply_to?: number } = {},
): Promise<TownPost> {
  const author = getChog(authorId)!;
  const target = getChog(targetId)!;
  await ensureChogs([authorId, targetId]);

  const [rels, recent] = await Promise.all([getRelations(authorId), listPosts({ limit: 3 })]);
  const rel = rels.find((r) => r.other_token_id === targetId);

  let gen = await generateWithAI(author, target, rel, recent, mode);
  // Belt and braces: never post the slur, and drop hashtags (but keep #123 mentions).
  gen = { ...gen, content: sayable(gen.content).replace(/\s*#(?!\d)\w+/g, "").trim() };
  // Paid roasts and comebacks are always roasts about the target.
  if (extra.commissioned_by || extra.reply_to) gen = { ...gen, kind: "roast" };

  const solo = gen.kind === "post" && !gen.content.includes(`#${targetId}`);
  const db = supabaseAdmin();
  const row = { token_id: authorId, about_token_id: solo ? null : targetId, kind: gen.kind, content: gen.content, ...extra };
  let { data: post, error } = await db.from("town_posts").insert(row).select().single();
  if (error?.code === "23514" && gen.kind === "roast") {
    // Database not migrated for roasts yet (0003): store it as gossip.
    ({ data: post, error } = await db.from("town_posts").insert({ ...row, kind: "gossip" }).select().single());
  }
  if (error) throw new Error(`createPost: ${error.message}`);

  await award(authorId, "square_post", 1, { dedupeKey: `post:${(post as TownPost).id}` });
  if (!solo) {
    // Being talked about is fame, good or bad.
    await award(targetId, "square_mention", 3, { actor: String(authorId), dedupeKey: `mention:${(post as TownPost).id}` });
    await nudgeRelation(authorId, targetId, gen.affinity_delta, gen.grudge);
    // Being talked about stings (or flatters) the target too.
    await nudgeRelation(targetId, authorId, Math.round(gen.affinity_delta * 0.6));
  }
  return post as TownPost;
}

// One tick of the Square: a random Chog posts about another.
export async function townTick(): Promise<TownPost[]> {
  const authorId = await pickAuthor();
  const targetId = await pickTarget(authorId);
  // About a third of posts are roasts; the rest gossip, plus a few solo thoughts.
  const r = Math.random();
  const mode: Kind = r < 0.35 ? "roast" : r < 0.9 ? "gossip" : "post";
  return [await createPost(authorId, targetId, mode)];
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

export async function getPost(id: number): Promise<TownPost | undefined> {
  const { data } = await supabaseAdmin().from("town_posts").select("*").eq("id", id).maybeSingle();
  return (data as TownPost | null) ?? undefined;
}
