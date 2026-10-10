import { after, type NextRequest } from "next/server";
import { getChog, parseTokenId } from "@/lib/chogs";
import { buildPersonality } from "@/lib/personality";
import { listPosts, tickIfQuiet } from "@/lib/town";

// GET /api/town[?tokenId=N] -> latest Square posts, enriched for display.
// Reading the feed also keeps it alive: if it's been quiet, a Chog speaks up.
export async function GET(request: NextRequest) {
  const tokenId = parseTokenId(request.nextUrl.searchParams.get("tokenId"));
  const before = Number(request.nextUrl.searchParams.get("before")) || undefined;
  const posts = await listPosts({ tokenId, limit: tokenId ? 12 : 20, before });

  after(() => tickIfQuiet().catch((err) => console.error("town tick failed", err)));

  const card = (id: number | null) => {
    const c = id ? getChog(id) : undefined;
    return c && { tokenId: c.tokenId, name: c.name, image: c.image, archetype: buildPersonality(c.traits).archetype };
  };
  return Response.json({
    posts: posts.map((p) => ({ ...p, author: card(p.token_id), about: card(p.about_token_id) })),
  });
}
