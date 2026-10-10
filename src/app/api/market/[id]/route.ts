import { parseTokenId } from "@/lib/chogs";
import { getMarket } from "@/lib/opensea";

// GET /api/market/:tokenId -> floor + last sale (everything else is on OpenSea).
export async function GET(_req: Request, ctx: RouteContext<"/api/market/[id]">) {
  const tokenId = parseTokenId((await ctx.params).id);
  if (!tokenId) return Response.json({ error: "not found" }, { status: 404 });
  const { floor, lastSale, url } = await getMarket(tokenId);
  return Response.json({ floor, lastSale, url }, { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=600" } });
}
