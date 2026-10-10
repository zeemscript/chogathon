import { after } from "next/server";
import { parseTokenId } from "@/lib/chogs";
import { syncHistory } from "@/lib/history";
import { getOwner } from "@/lib/owners";
import { syncOwner } from "@/lib/soul";
import { getStory } from "@/lib/story";
import { supabaseAdmin } from "@/lib/supabase/server";
import { cachedJson } from "@/lib/http";

// GET /api/story/:tokenId -> the Chog's life story, grouped into owner eras,
// plus what the first-meeting screen needs if it recently changed hands.
export async function GET(_req: Request, ctx: RouteContext<"/api/story/[id]">) {
  const tokenId = parseTokenId((await ctx.params).id);
  if (!tokenId) return Response.json({ error: "not found" }, { status: 404 });

  const owner = await getOwner(tokenId);
  // Notice sales and refresh owners-since-mint after responding, so nobody
  // waits on the chain or OpenSea (the next view picks the changes up).
  after(async () => {
    await syncOwner(tokenId, owner).catch((err) => console.error("syncOwner", err));
    await syncHistory(tokenId).catch((err) => console.error("syncHistory", err));
  });
  const [story, { data: state }] = await Promise.all([
    getStory(tokenId, owner),
    supabaseAdmin().from("chog_state").select("owner, previous_owner, owner_since").eq("token_id", tokenId).maybeSingle(),
  ]);

  return cachedJson({
    ...story,
    owner: owner ?? null,
    meeting: state?.previous_owner ? { previousOwner: state.previous_owner, since: state.owner_since } : null,
  }, 30);
}
