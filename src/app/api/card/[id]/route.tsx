import { parseTokenId } from "@/lib/chogs";
import { parseCardStyle, renderSoulCard, soulCardOg } from "@/lib/soul-card";

// GET /api/card/:tokenId?style=night|poster|paper -> the Soul Card (1200x800 PNG).
// ?og=1 serves the 1200x630 JPEG link preview; ?download=1 saves the PNG.
export async function GET(request: Request, ctx: RouteContext<"/api/card/[id]">) {
  const tokenId = parseTokenId((await ctx.params).id);
  if (!tokenId) return new Response("not found", { status: 404 });
  const q = new URL(request.url).searchParams;
  const style = parseCardStyle(q.get("style"));
  if (q.has("og")) return soulCardOg(tokenId, style);
  const img = await renderSoulCard(tokenId, style);
  const headers = new Headers(img.headers);
  // Aura changes over time: cache briefly at the edge, then re-render.
  headers.set("cache-control", "public, max-age=60, s-maxage=300, stale-while-revalidate=3600");
  if (q.has("download")) {
    headers.set("content-disposition", `attachment; filename="chog-${tokenId}-soul-card-${style}.png"`);
  }
  return new Response(img.body, { status: img.status, headers });
}
