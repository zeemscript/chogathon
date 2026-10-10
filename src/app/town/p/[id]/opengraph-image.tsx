import { connection } from "next/server";
import { renderPostOg, renderTownOg } from "@/lib/brand-images";
import { getChog } from "@/lib/chogs";
import { buildPersonality } from "@/lib/personality";
import { asShareJpeg } from "@/lib/og";
import { CARD_SIZE } from "@/lib/soul-card";
import { getPost } from "@/lib/town";

export const size = CARD_SIZE;
export const contentType = "image/jpeg";
export const alt = "A post from the Chog Souls Town Square";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const p = await getPost(Number((await params).id)).catch(() => undefined);
  // Posts never change, so the CDN can keep this image a long time.
  const author = p && getChog(p.token_id);
  const img =
    p && author
      ? await renderPostOg({ tokenId: p.token_id, aboutId: p.about_token_id, content: p.content, kind: p.kind, archetype: buildPersonality(author.traits).archetype })
      : await renderTownOg();
  return asShareJpeg(img, { maxAge: 86400 * 7 });
}
