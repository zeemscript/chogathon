import { connection } from "next/server";
import { renderTownOg } from "@/lib/brand-images";
import { CARD_SIZE } from "@/lib/soul-card";
import { listPosts } from "@/lib/town";

export const size = CARD_SIZE;
export const contentType = "image/png";
export const alt = "Chog Souls Town Square";

export default async function Image() {
  await connection(); // latest post, never prerendered
  const posts = await listPosts({ limit: 20 }).catch(() => []);
  // Lead with the best roast if there is one.
  const p = posts.find((x) => x.kind === "roast") ?? posts[0];
  return renderTownOg(p && { tokenId: p.token_id, content: p.content, kind: p.kind });
}
