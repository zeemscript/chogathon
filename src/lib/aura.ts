import "server-only";
import { supabaseAdmin } from "./supabase/server";

// Aura is a Chog's earned reputation. Rules:
// - social Aura (visitors, the Square, bonds) can only come from others
// - care Aura comes from its owner showing up, capped per day
// - $CHOG Aura has diminishing returns and is capped at 30% of the total
// - Famous and above require social Aura: fame can't be bought
// - neglect slowly fades Aura; showing up again stops the fade

export type AuraSource =
  | "visitor_chat"
  | "owner_chat"
  | "owner_care"
  | "square_post"
  | "square_mention"
  | "bond"
  | "chog_feed"
  | "neglect";

export const TIERS = [
  { name: "Dormant", min: 0, social: 0 },
  { name: "Awakened", min: 25, social: 0 },
  { name: "Known", min: 100, social: 30 },
  { name: "Famous", min: 300, social: 150 },
  { name: "Legendary Soul", min: 800, social: 400 },
] as const;

export type TierName = (typeof TIERS)[number]["name"];

// Daily caps per source (points per Chog per UTC day).
const DAILY_CAP: Partial<Record<AuraSource, number>> = {
  visitor_chat: 20,
  owner_chat: 5,
  square_post: 3,
  square_mention: 15,
};

const CHOG_SHARE_CAP = 0.3;
const GRACE_DAYS = 3; // no fade for the first 3 idle days
const FADE_PER_DAY = 0.02; // then 2% of earned Aura per idle day
const MAX_FADE = 0.4; // never fade more than 40% of earned Aura

const day = (d = new Date()) => d.toISOString().slice(0, 10);

// Record Aura. Returns the points actually granted (0 if capped/duplicate).
export async function award(
  tokenId: number,
  source: AuraSource,
  points: number,
  opts: { actor?: string; dedupeKey?: string; meta?: Record<string, unknown> } = {},
): Promise<number> {
  const db = supabaseAdmin();
  let grant = points;
  const cap = DAILY_CAP[source];
  if (cap !== undefined) {
    const { data } = await db
      .from("aura_events")
      .select("points")
      .eq("token_id", tokenId)
      .eq("source", source)
      .gte("created_at", `${day()}T00:00:00Z`);
    const used = (data ?? []).reduce((s, r) => s + Number(r.points), 0);
    grant = Math.min(points, cap - used);
  }
  if (grant <= 0 && source !== "neglect") return 0;
  const { error } = await db.from("aura_events").insert({
    token_id: tokenId,
    source,
    points: grant,
    actor: opts.actor ?? null,
    dedupe_key: opts.dedupeKey ?? null,
    meta: opts.meta ?? null,
  });
  if (error) {
    if (error.code === "23505") return 0; // duplicate dedupe_key: already counted
    // Aura must never break chat or the Square; log and move on.
    console.error(`aura award failed (${source}):`, error.message);
    return 0;
  }
  return grant;
}

// $CHOG -> Aura curve: sqrt, so 100x the spend gives ~10x the Aura.
export const chogCurve = (totalChog: number) => 40 * Math.sqrt(Math.max(0, totalChog) / 100);

export type Aura = {
  score: number;
  social: number;
  care: number;
  chog: number; // counted $CHOG Aura (after cap)
  chogRaw: number; // $CHOG Aura before cap
  neglect: number;
  tier: TierName;
  next?: { name: TierName; min: number; social: number };
  progress: number; // 0..1 toward next tier
  blockedBySocial: boolean; // has the points but not the fame for next tier
  idleDays: number;
  fading: boolean;
};

type Totals = { social: number; care: number; chog: number; neglect: number };

export function scoreFrom(t: Totals, idleDays = 0): Aura {
  const earned = t.social + t.care;
  // chog may be at most 30% of (earned + chog): chog <= earned * 0.3/0.7
  const chog = Math.min(t.chog, (earned * CHOG_SHARE_CAP) / (1 - CHOG_SHARE_CAP));
  const score = Math.max(0, Math.round(earned + chog + t.neglect));

  let tierIdx = 0;
  TIERS.forEach((tier, i) => {
    if (score >= tier.min && t.social >= tier.social) tierIdx = i;
  });
  const next = TIERS[tierIdx + 1];
  const prev = TIERS[tierIdx];
  const progress = next ? Math.min(1, (score - prev.min) / (next.min - prev.min)) : 1;

  return {
    score,
    social: Math.round(t.social),
    care: Math.round(t.care),
    chog: Math.round(chog),
    chogRaw: Math.round(t.chog),
    neglect: Math.round(t.neglect),
    tier: prev.name,
    next,
    progress,
    blockedBySocial: !!next && score >= next.min && t.social < next.social,
    idleDays,
    fading: idleDays > GRACE_DAYS,
  };
}

async function totals(tokenId: number): Promise<Totals> {
  const { data, error } = await supabaseAdmin().from("aura_totals").select("*").eq("token_id", tokenId).maybeSingle();
  if (error) console.error("aura totals failed:", error.message);
  return {
    social: Number(data?.social ?? 0),
    care: Number(data?.care ?? 0),
    chog: Number(data?.chog ?? 0),
    neglect: Number(data?.neglect ?? 0),
  };
}

// Apply any neglect owed since the owner last showed up (one event per idle
// day, deduped, so calling this often is safe).
async function applyNeglect(tokenId: number, t: Totals): Promise<{ t: Totals; idleDays: number }> {
  const { data: state } = await supabaseAdmin()
    .from("chog_state")
    .select("last_care_at, owner_since")
    .eq("token_id", tokenId)
    .maybeSingle();
  const since = state?.last_care_at ?? state?.owner_since;
  if (!since) return { t, idleDays: 0 };

  const idleDays = Math.floor((Date.now() - Date.parse(since)) / 86_400_000);
  const earned = t.social + t.care;
  if (idleDays <= GRACE_DAYS || earned <= 0) return { t, idleDays };

  const floor = -earned * MAX_FADE;
  let neglect = t.neglect;
  for (let d = GRACE_DAYS + 1; d <= Math.min(idleDays, 30); d++) {
    if (neglect <= floor) break;
    const when = new Date(Date.parse(since) + d * 86_400_000);
    const pts = -Math.max(0.5, Math.round(earned * FADE_PER_DAY * 10) / 10);
    const granted = await award(tokenId, "neglect", Math.max(pts, floor - neglect), {
      dedupeKey: `neglect:${tokenId}:${day(when)}`,
    });
    neglect += granted;
  }
  return { t: { ...t, neglect }, idleDays };
}

export async function getAura(tokenId: number): Promise<Aura> {
  const { t, idleDays } = await applyNeglect(tokenId, await totals(tokenId));
  return scoreFrom(t, idleDays);
}

// Leaderboard straight from the view (neglect already materialized).
export async function auraLeaderboard(limit = 25): Promise<({ tokenId: number } & Aura)[]> {
  const { data, error } = await supabaseAdmin().from("aura_totals").select("*");
  if (error) {
    console.error("auraLeaderboard failed:", error.message);
    return [];
  }
  return (data ?? [])
    .map((r) => ({
      tokenId: r.token_id as number,
      ...scoreFrom({ social: +r.social, care: +r.care, chog: +r.chog, neglect: +r.neglect }),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function addLoyalty(tokenId: number, delta: number) {
  const db = supabaseAdmin();
  const { data } = await db.from("chog_state").select("loyalty").eq("token_id", tokenId).maybeSingle();
  if (!data) return;
  const loyalty = Math.max(0, Math.min(100, (data.loyalty ?? 0) + delta));
  await db.from("chog_state").update({ loyalty }).eq("token_id", tokenId);
}

export { day as auraDay };
