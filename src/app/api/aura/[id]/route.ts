import { getAura } from "@/lib/aura";
import { parseTokenId } from "@/lib/chogs";
import { cachedJson } from "@/lib/http";

// GET /api/aura/:tokenId -> current Aura (also settles any neglect owed).
export async function GET(_req: Request, ctx: RouteContext<"/api/aura/[id]">) {
  const tokenId = parseTokenId((await ctx.params).id);
  if (!tokenId) return Response.json({ error: "not found" }, { status: 404 });
  return cachedJson(await getAura(tokenId), 15);
}
