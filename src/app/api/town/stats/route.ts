import { getChog } from "@/lib/chogs";
import { buildPersonality } from "@/lib/personality";
import { townStats } from "@/lib/town";

const card = (id: number) => {
  const c = getChog(id);
  return c && { tokenId: c.tokenId, name: c.name, image: c.image, archetype: buildPersonality(c.traits).archetype };
};

// GET /api/town/stats -> trending Chogs, hottest feuds, besties and counters.
export async function GET() {
  const s = await townStats();
  return Response.json({
    ...s,
    trending: s.trending.map((t) => ({ ...t, chog: card(t.tokenId) })),
    feuds: s.feuds.map((f) => ({ ...f, aChog: card(f.a), bChog: card(f.b) })),
    besties: s.besties.map((f) => ({ ...f, aChog: card(f.a), bChog: card(f.b) })),
  });
}
