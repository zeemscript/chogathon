import { parseTokenId } from "@/lib/chogs";
import { renderSoulCard } from "@/lib/soul-card";

// GET /api/card/:tokenId -> the Soul Card PNG (?download=1 to save it).
export async function GET(request: Request, ctx: RouteContext<"/api/card/[id]">) {
  const tokenId = parseTokenId((await ctx.params).id);
  if (!tokenId) return new Response("not found", { status: 404 });
  const img = await renderSoulCard(tokenId);
  const headers = new Headers(img.headers);
  // Aura changes over time: cache briefly at the edge, then re-render.
  headers.set("cache-control", "public, max-age=60, s-maxage=300, stale-while-revalidate=3600");
  if (new URL(request.url).searchParams.has("download")) {
    headers.set("content-disposition", `attachment; filename="chog-${tokenId}-soul-card.png"`);
  }
  return new Response(img.body, { status: img.status, headers });
}
