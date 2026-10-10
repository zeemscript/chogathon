import { getAura } from "@/lib/aura";
import { parseTokenId } from "@/lib/chogs";

// GET /api/aura/:tokenId -> current Aura (also settles any neglect owed).
export async function GET(_req: Request, ctx: RouteContext<"/api/aura/[id]">) {
  const tokenId = parseTokenId((await ctx.params).id);
  if (!tokenId) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(await getAura(tokenId));
}
