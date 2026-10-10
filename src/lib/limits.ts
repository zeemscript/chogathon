import "server-only";
import { auraDay } from "./aura";
import { supabaseAdmin } from "./supabase/server";

// Chat costs real AI credit, so cap it per person per UTC day, plus a global
// ceiling that protects the whole budget. Counted from saved chat turns, so
// only replies that actually reached the AI count, and it works across every
// server instance.

export const LIMITS = {
  visitor: Number(process.env.CHAT_LIMIT_VISITOR ?? 20), // per visitor, across all Chogs
  owner: Number(process.env.CHAT_LIMIT_OWNER ?? 60), // per owner wallet, across their Chogs
  global: Number(process.env.CHAT_LIMIT_GLOBAL ?? 3000), // whole app
};

export type Quota = { allowed: boolean; used: number; limit: number; remaining: number; reason?: "you" | "global" };

const today = () => `${auraDay()}T00:00:00Z`;

async function countUserTurns(owner?: string): Promise<number> {
  let q = supabaseAdmin()
    .from("chog_memory")
    .select("id", { count: "exact", head: true })
    .eq("kind", "chat")
    .eq("role", "user")
    .gte("created_at", today());
  if (owner) q = q.eq("owner", owner);
  const { count, error } = await q;
  if (error) throw new Error(`quota: ${error.message}`);
  return count ?? 0;
}

// `memoryOwner` is the id chat turns are saved under: a wallet for owners,
// `visitor:<id>` for visitors.
export async function chatQuota(memoryOwner: string, role: "owner" | "visitor"): Promise<Quota> {
  const limit = role === "owner" ? LIMITS.owner : LIMITS.visitor;
  const [used, all] = await Promise.all([countUserTurns(memoryOwner), countUserTurns()]);
  if (all >= LIMITS.global) return { allowed: false, used, limit, remaining: 0, reason: "global" };
  const remaining = Math.max(0, limit - used);
  return { allowed: remaining > 0, used, limit, remaining, reason: remaining > 0 ? undefined : "you" };
}
