import { fetchArt } from "@/lib/art";
import { parseTokenId } from "@/lib/chogs";

// Small in-memory cache so hot Chogs (hero, featured) never hit IPFS twice.
const MAX = 400;
const cache = new Map<number, { type: string; body: ArrayBuffer }>();

// GET /api/img/:tokenId -> the Chog's image (OpenSea CDN, else IPFS), cached forever.
export async function GET(_req: Request, ctx: RouteContext<"/api/img/[id]">) {
  const tokenId = parseTokenId((await ctx.params).id);
  if (!tokenId) return new Response("not found", { status: 404 });

  let hit = cache.get(tokenId);
  if (!hit) {
    try {
      const res = await fetchArt(tokenId);
      hit = { type: res.headers.get("content-type") ?? "image/webp", body: await res.arrayBuffer() };
    } catch (err) {
      console.warn(`img ${tokenId}:`, err instanceof Error ? err.message : err);
      return new Response("image unavailable", { status: 502, headers: { "cache-control": "no-store" } });
    }
    if (cache.size >= MAX) cache.delete(cache.keys().next().value!);
    cache.set(tokenId, hit);
  }
  return new Response(hit.body, {
    headers: { "content-type": hit.type, "cache-control": "public, max-age=31536000, immutable" },
  });
}
