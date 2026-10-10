import "server-only";
import { scoreFrom } from "./aura";
import { supabaseAdmin } from "./supabase/server";
import { TIERS } from "./tiers";

// A Chog's life story, assembled from everything we already record: owner
// changes, Aura milestones, bonds, feeds and its first appearances. Grouped
// into "eras", one per owner, so it reads like a biography.

export type StoryEvent = {
  at: string;
  type: "owner" | "tier" | "bond" | "feed" | "first_post" | "first_visit" | "first_human";
  title: string;
  detail?: string;
  tokenId?: number; // another Chog involved
  tone?: "good" | "bad" | "neutral";
};

export type Era = { owner: string | null; from: string | null; to: string | null; events: StoryEvent[] };

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const ZERO = "0x0000000000000000000000000000000000000000";

export async function getStory(tokenId: number, currentOwner?: string): Promise<{ eras: Era[]; owners: number }> {
  const db = supabaseAdmin();
  const [history, aura, rels, feeds, firstPost, firstVisit, firstHuman] = await Promise.all([
    db.from("owner_history").select("from_address, to_address, created_at").eq("token_id", tokenId).order("created_at"),
    db.from("aura_events").select("source, points, actor, created_at").eq("token_id", tokenId).order("created_at").limit(5000),
    db.from("chog_relations").select("other_token_id, affinity").eq("token_id", tokenId),
    db.from("chog_feeds").select("amount, from_addr, created_at").eq("token_id", tokenId).order("created_at"),
    db.from("town_posts").select("content, created_at").eq("token_id", tokenId).order("created_at").limit(1),
    db.from("chog_memory").select("created_at").eq("token_id", tokenId).eq("kind", "chat").like("owner", "visitor:%").order("created_at").limit(1),
    db.from("chog_memory").select("created_at, owner").eq("token_id", tokenId).eq("kind", "chat").not("owner", "like", "visitor:%").order("created_at").limit(1),
  ]);

  const events: StoryEvent[] = [];

  // Ownership changes (mints come from the Etherscan backfill as from=0x0).
  for (const h of history.data ?? []) {
    const minted = !h.from_address || h.from_address === ZERO;
    events.push({
      at: h.created_at,
      type: "owner",
      title: minted ? "Born on Monad" : `Changed hands`,
      detail: minted ? `Minted to ${short(h.to_address)}` : `${short(h.from_address)} → ${short(h.to_address)}`,
    });
  }

  // Aura tiers reached, replayed from the event log.
  const t = { social: 0, care: 0, chog: 0, neglect: 0 };
  let tierIdx = 0;
  for (const e of aura.data ?? []) {
    const pts = Number(e.points);
    if (["visitor_chat", "square_post", "square_mention", "bond", "hype", "laugh"].includes(e.source)) t.social += pts;
    else if (["owner_chat", "owner_care"].includes(e.source)) t.care += pts;
    else if (e.source === "chog_feed") t.chog += pts;
    else if (e.source === "neglect") t.neglect += pts;
    const idx = TIERS.findIndex((x) => x.name === scoreFrom(t).tier);
    if (idx > tierIdx) {
      tierIdx = idx;
      events.push({ at: e.created_at, type: "tier", title: `Became ${TIERS[idx].name}`, detail: `${scoreFrom(t).score} Aura`, tone: "good" });
    }
    if (e.source === "bond" && e.actor) {
      const other = Number(e.actor);
      const aff = (rels.data ?? []).find((r) => r.other_token_id === other)?.affinity ?? 0;
      events.push({
        at: e.created_at,
        type: "bond",
        title: aff >= 0 ? `Found a bestie in #${other}` : `Made a nemesis of #${other}`,
        tokenId: other,
        tone: aff >= 0 ? "good" : "bad",
      });
    }
  }

  for (const f of feeds.data ?? []) {
    if (Number(f.amount) < 100) continue;
    events.push({ at: f.created_at, type: "feed", title: `Fed ${Number(f.amount).toLocaleString()} $CHOG`, detail: `by ${short(f.from_addr)}`, tone: "good" });
  }
  const fp = firstPost.data?.[0];
  if (fp) events.push({ at: fp.created_at, type: "first_post", title: "First words in the Square", detail: `“${fp.content}”` });
  const fv = firstVisit.data?.[0];
  if (fv) events.push({ at: fv.created_at, type: "first_visit", title: "A stranger talked to it for the first time" });
  const fh = firstHuman.data?.[0];
  if (fh) events.push({ at: fh.created_at, type: "first_human", title: "First conversation with its human", detail: fh.owner ? short(fh.owner) : undefined });

  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  // Split into eras by owner. Known transfers set the boundaries; anything
  // before the first known transfer belongs to an "unknown" opening era.
  const transfers = (history.data ?? []).map((h) => ({ at: h.created_at, to: h.to_address as string }));
  const eras: Era[] = [];
  let era: Era = { owner: transfers.length ? null : (currentOwner ?? null), from: null, to: null, events: [] };
  let ti = 0;
  for (const ev of events) {
    while (ti < transfers.length && Date.parse(transfers[ti].at) <= Date.parse(ev.at)) {
      if (era.events.length || era.owner) eras.push({ ...era, to: transfers[ti].at });
      era = { owner: transfers[ti].to, from: transfers[ti].at, to: null, events: [] };
      ti++;
    }
    era.events.push(ev);
  }
  while (ti < transfers.length) {
    if (era.events.length || era.owner) eras.push({ ...era, to: transfers[ti].at });
    era = { owner: transfers[ti].to, from: transfers[ti].at, to: null, events: [] };
    ti++;
  }
  if (!era.owner) era.owner = currentOwner ?? null;
  eras.push(era);

  const owners = new Set(eras.map((e) => e.owner).filter(Boolean)).size;
  return { eras: eras.reverse(), owners: Math.max(1, owners) }; // newest era first
}
