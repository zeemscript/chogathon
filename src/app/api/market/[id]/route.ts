import { parseTokenId } from "@/lib/chogs";
import { getMarket } from "@/lib/opensea";
import { supabaseAdmin } from "@/lib/supabase/server";

// GET /api/market/:tokenId -> floor, last sale, listing, plus Aura gained this
// week, so owners can see their Chog's reputation next to its price.
export async function GET(_req: Request, ctx: RouteContext<"/api/market/[id]">) {
  const tokenId = parseTokenId((await ctx.params).id);
  if (!tokenId) return Response.json({ error: "not found" }, { status: 404 });
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [market, week] = await Promise.all([
    getMarket(tokenId),
    supabaseAdmin().from("aura_events").select("points").eq("token_id", tokenId).gte("created_at", since).limit(5000),
  ]);
  const auraWeek = Math.round((week.data ?? []).reduce((s, r) => s + Number(r.points), 0));
  return Response.json({ ...market, auraWeek }, { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=600" } });
}
